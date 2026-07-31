import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import {
  CredentialCipher,
  registerModels,
  safeEqual,
  type TenantContext,
} from "@aether/backend";
import {
  createHmac,
  createPrivateKey,
  randomUUID,
  sign as signBytes,
} from "node:crypto";
import type { Connection, Model } from "mongoose";
import type { Request } from "express";
import { z } from "zod";

@Injectable()
export class GitHubService {
  private readonly models: Record<string, Model<unknown>>;

  constructor(
    @InjectConnection() connection: Connection,
    private readonly jwt: JwtService,
  ) {
    this.models = registerModels(connection);
  }

  async installUrl(tenant: TenantContext) {
    const slug = required("GITHUB_APP_SLUG");
    const state = await this.jwt.signAsync(
      {
        organizationId: tenant.organizationId,
        protocolId: tenant.protocolId,
        actorId: tenant.actorId,
        nonce: randomUUID(),
      },
      {
        secret: required("GITHUB_WEBHOOK_SECRET"),
        issuer: "aether-github-install",
        audience: "github-app-install",
        expiresIn: 600,
      },
    );
    return {
      url: `https://github.com/apps/${encodeURIComponent(slug)}/installations/new?state=${encodeURIComponent(state)}`,
    };
  }

  async callback(query: unknown) {
    const parsed = z
      .object({
        installation_id: z.coerce.number().int().positive(),
        state: z.string().min(20),
        setup_action: z.enum(["install", "update"]).optional(),
      })
      .parse(query);
    const claims = z
      .object({
        organizationId: z.string().min(1),
        protocolId: z.string().min(1),
        actorId: z.string().min(1),
      })
      .parse(
        await this.jwt.verifyAsync(parsed.state, {
          secret: required("GITHUB_WEBHOOK_SECRET"),
          issuer: "aether-github-install",
          audience: "github-app-install",
        }),
      );
    const token = await this.installationToken(parsed.installation_id);
    const scope = {
      organizationId: claims.organizationId,
      protocolId: claims.protocolId,
      provider: "github",
    };
    const cipher = new CredentialCipher(
      required("AETHER_CREDENTIAL_ENCRYPTION_KEY"),
    );
    await this.models.ProviderConnection!.updateOne(
      scope,
      {
        $set: {
          ...scope,
          mode: "github_app",
          status: "healthy",
          installationId: String(parsed.installation_id),
          encryptedCredentials: cipher.encrypt(token.token, scope),
          metadata: { tokenExpiresAt: token.expires_at },
        },
      },
      { upsert: true },
    );
    return { connected: true, provider: "github" };
  }

  async repositories(tenant: TenantContext) {
    const connection = await this.connection(tenant);
    const token = await this.installationToken(
      Number(connection.installationId),
    );
    const response = await githubFetch(
      "https://api.github.com/installation/repositories?per_page=100",
      token.token,
    );
    return z
      .object({
        repositories: z.array(
          z.object({
            full_name: z.string(),
            default_branch: z.string(),
            private: z.boolean(),
            html_url: z.string().url(),
          }),
        ),
      })
      .parse(response).repositories;
  }

  async selectRepository(tenant: TenantContext, input: unknown) {
    const parsed = z
      .object({
        repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
        defaultBranch: z.string().min(1).max(255),
        desiredStatePath: z.string().min(1).max(500),
      })
      .parse(input);
    const available = await this.repositories(tenant);
    const repository = available.find(
      (item) => item.full_name === parsed.repository,
    );
    if (!repository) {
      throw new BadRequestException(
        "Repository is not available to this GitHub App installation.",
      );
    }
    if (repository.default_branch !== parsed.defaultBranch) {
      throw new BadRequestException("Default branch does not match GitHub.");
    }
    await this.models.ProviderConnection!.updateOne(
      { ...scope(tenant), provider: "github" },
      { $set: parsed },
    );
    return { ...parsed, connected: true };
  }

  async webhook(request: Request & { rawBody?: Buffer }) {
    const deliveryId = request.get("x-github-delivery");
    const event = request.get("x-github-event");
    const signature = request.get("x-hub-signature-256");
    if (!deliveryId || !event || !signature || !request.rawBody) {
      throw new UnauthorizedException("Invalid GitHub webhook.");
    }
    const expected = `sha256=${createHmac(
      "sha256",
      required("GITHUB_WEBHOOK_SECRET"),
    )
      .update(request.rawBody)
      .digest("hex")}`;
    if (!safeEqual(expected, signature)) {
      throw new UnauthorizedException("Invalid GitHub webhook signature.");
    }
    const inserted = await this.models.WebhookDelivery!.updateOne(
      { provider: "github", deliveryId },
      {
        $setOnInsert: {
          provider: "github",
          deliveryId,
          event,
          receivedAt: new Date(),
          processedAt: new Date(),
        },
      },
      { upsert: true },
    );
    if (inserted.upsertedCount === 0)
      return { accepted: true, duplicate: true };
    if (
      event === "installation" &&
      (request.body as { action?: string }).action === "deleted"
    ) {
      const installationId = String(
        (request.body as { installation?: { id?: number } }).installation?.id,
      );
      await this.models.ProviderConnection!.updateMany(
        { provider: "github", installationId },
        {
          $set: { status: "unavailable" },
          $unset: { encryptedCredentials: 1 },
        },
      );
    }
    return { accepted: true, duplicate: false };
  }

  private async connection(tenant: TenantContext) {
    const connection = await this.models
      .ProviderConnection!.findOne({
        ...scope(tenant),
        provider: "github",
        mode: "github_app",
      })
      .lean()
      .exec();
    if (!connection) {
      throw new BadRequestException("GitHub App is not connected.");
    }
    return connection as Record<string, unknown>;
  }

  private async installationToken(installationId: number) {
    const now = Math.floor(Date.now() / 1_000);
    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = base64url(
      JSON.stringify({
        iat: now - 30,
        exp: now + 540,
        iss: required("GITHUB_APP_ID"),
      }),
    );
    const input = `${header}.${payload}`;
    const key = createPrivateKey(
      Buffer.from(required("GITHUB_PRIVATE_KEY_BASE64"), "base64").toString(
        "utf8",
      ),
    );
    const signature = signBytes("RSA-SHA256", Buffer.from(input), key).toString(
      "base64url",
    );
    return z
      .object({ token: z.string().min(1), expires_at: z.string().datetime() })
      .parse(
        await githubFetch(
          `https://api.github.com/app/installations/${installationId}/access_tokens`,
          `${input}.${signature}`,
          "POST",
        ),
      );
  }
}

function scope(tenant: TenantContext) {
  return {
    organizationId: tenant.organizationId,
    protocolId: tenant.protocolId,
  };
}

async function githubFetch(url: string, token: string, method = "GET") {
  const response = await fetch(url, {
    method,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "aether-api",
      "x-github-api-version": "2022-11-28",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new BadRequestException(
      `GitHub request failed (${response.status}).`,
    );
  }
  return response.json();
}

function base64url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new BadRequestException(`${name} is not configured.`);
  return value;
}
