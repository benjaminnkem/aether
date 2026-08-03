import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import {
  registerModels,
  safeEqual,
  stableIdempotencyKey,
  type TenantContext,
} from "@aether/backend";
import {
  createHmac,
  createHash,
  createPrivateKey,
  randomUUID,
  sign as signBytes,
} from "node:crypto";
import type { Connection, Model } from "mongoose";
import type { Request } from "express";
import { z } from "zod";
import { parse as parseYaml } from "yaml";
import {
  desiredStateSchema,
  githubDesiredStateSourceSchema,
} from "@aether/shared";

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
    const nonce = randomUUID();
    await this.models.GitHubAuthorizationAttempt!.create({
      organizationId: tenant.organizationId,
      protocolId: tenant.protocolId,
      actorId: tenant.actorId,
      nonceHash: sha256(nonce),
      expiresAt: new Date(Date.now() + 10 * 60 * 1_000),
    });
    const state = await this.jwt.signAsync(
      {
        organizationId: tenant.organizationId,
        protocolId: tenant.protocolId,
        actorId: tenant.actorId,
        nonce,
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
        installation_id: z.coerce.number().int().positive().optional(),
        state: z.string().min(20),
        setup_action: z.enum(["install", "update", "request"]).optional(),
      })
      .parse(query);
    const claims = z
      .object({
        organizationId: z.string().min(1),
        protocolId: z.string().min(1),
        actorId: z.string().min(1),
        nonce: z.string().uuid(),
      })
      .parse(
        await this.jwt.verifyAsync(parsed.state, {
          secret: required("GITHUB_WEBHOOK_SECRET"),
          issuer: "aether-github-install",
          audience: "github-app-install",
        }),
      );
    const attemptFilter = {
      organizationId: claims.organizationId,
      protocolId: claims.protocolId,
      actorId: claims.actorId,
      nonceHash: sha256(claims.nonce),
      consumedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    };
    const pendingAttempt =
      await this.models.GitHubAuthorizationAttempt!.exists(attemptFilter);
    if (!pendingAttempt) {
      throw new UnauthorizedException(
        "This GitHub installation request is expired or was already used.",
      );
    }
    if (parsed.setup_action === "request") {
      const requested =
        await this.models.GitHubAuthorizationAttempt!.findOneAndUpdate(
          attemptFilter,
          { $set: { consumedAt: new Date() } },
          { new: true },
        );
      if (!requested) {
        throw new UnauthorizedException(
          "This GitHub installation request is expired or was already used.",
        );
      }
      return { redirectUrl: this.setupRedirect("requested") };
    }
    if (!parsed.installation_id) {
      throw new BadRequestException(
        "GitHub did not return an installation ID.",
      );
    }
    const installation = await this.installation(parsed.installation_id);
    const attempt =
      await this.models.GitHubAuthorizationAttempt!.findOneAndUpdate(
        attemptFilter,
        { $set: { consumedAt: new Date() } },
        { new: true },
      );
    if (!attempt) {
      throw new UnauthorizedException(
        "This GitHub installation request is expired or was already used.",
      );
    }
    const token = await this.installationToken(parsed.installation_id);
    const scope = {
      organizationId: claims.organizationId,
      protocolId: claims.protocolId,
      provider: "github",
    };
    await this.models.ProviderConnection!.updateOne(
      scope,
      {
        $set: {
          ...scope,
          mode: "github_app",
          status: "healthy",
          installationId: String(parsed.installation_id),
          metadata: {
            tokenExpiresAt: token.expires_at,
            accountLogin: installation.account.login,
            accountType: installation.account.type,
            repositorySelection: installation.repository_selection,
            connectedBy: claims.actorId,
          },
        },
      },
      { upsert: true },
    );
    return { redirectUrl: this.setupRedirect("connected") };
  }

  async repositories(tenant: TenantContext) {
    const connection = await this.connection(tenant);
    const token = await this.installationToken(
      Number(connection.installationId),
    );
    const repositories = [];
    for (let page = 1; page <= 100; page += 1) {
      const response = repositoryPageSchema.parse(
        await githubFetch(
          `https://api.github.com/installation/repositories?per_page=100&page=${page}`,
          token.token,
        ),
      );
      repositories.push(...response.repositories);
      if (
        repositories.length >= response.total_count ||
        response.repositories.length < 100
      )
        break;
    }
    return repositories;
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

  async desiredStateSource(tenant: TenantContext) {
    const connection = await this.connection(tenant);
    const selected = z
      .object({
        installationId: z.coerce.number().int().positive(),
        repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
        defaultBranch: z.string().min(1).max(255),
        desiredStatePath: z.string().min(1).max(500),
      })
      .parse(connection);
    const token = await this.installationToken(selected.installationId);
    const commit = z
      .object({
        sha: z.string().regex(/^[a-f0-9]{40}$/i),
        html_url: z.string().url(),
      })
      .parse(
        await githubFetch(
          `https://api.github.com/repos/${encodeRepository(selected.repository)}/commits/${encodeURIComponent(selected.defaultBranch)}`,
          token.token,
        ),
      );
    const file = z
      .object({
        type: z.literal("file"),
        encoding: z.literal("base64"),
        content: z.string().min(1),
        size: z.number().int().positive().max(262_144),
        html_url: z.string().url(),
      })
      .parse(
        await githubFetch(
          `https://api.github.com/repos/${encodeRepository(selected.repository)}/contents/${encodePath(selected.desiredStatePath)}?ref=${encodeURIComponent(commit.sha)}`,
          token.token,
        ),
      );
    const content = Buffer.from(
      file.content.replace(/\s/g, ""),
      "base64",
    ).toString("utf8");
    if (!content.trim() || Buffer.byteLength(content, "utf8") > 262_144) {
      throw new BadRequestException(
        "The configured desired-state file is empty or too large.",
      );
    }
    let decoded: unknown;
    try {
      decoded = parseYaml(content);
    } catch {
      throw new BadRequestException(
        "The configured desired-state file is not valid YAML.",
      );
    }
    const manifest = desiredStateSchema.safeParse(decoded);
    if (!manifest.success) {
      const issue = manifest.error.issues[0];
      throw new BadRequestException(
        `GitHub desired state is invalid at ${issue?.path.join(".") || "manifest"}: ${issue?.message ?? "schema validation failed"}.`,
      );
    }
    const contract = await this.models
      .Contract!.findOne({
        ...scope(tenant),
        networkId: manifest.data.networkId,
        chainId: manifest.data.chainId,
        implementationAddress:
          manifest.data.implementationAddress.toLowerCase(),
      })
      .lean()
      .exec();
    if (!contract) {
      throw new BadRequestException(
        "The GitHub manifest implementation does not match a validated tenant contract on Ethereum Sepolia.",
      );
    }
    const resolvedContractId = String(
      (contract as Record<string, unknown>).contractId,
    );
    const normalizedManifest = desiredStateSchema.parse({
      ...manifest.data,
      contractId: resolvedContractId,
    });
    const manifestHash = stableIdempotencyKey(
      JSON.stringify(normalizedManifest),
    );
    const activeVersion = await this.models
      .DesiredStateVersion!.findOne({ ...scope(tenant), active: true })
      .select("manifestHash")
      .lean()
      .exec();
    return githubDesiredStateSourceSchema.parse({
      repository: selected.repository,
      branch: selected.defaultBranch,
      path: selected.desiredStatePath,
      commitSha: commit.sha,
      commitUrl: commit.html_url,
      fileUrl: file.html_url,
      fetchedAt: new Date().toISOString(),
      content,
      manifest: normalizedManifest,
      manifestHash,
      matchesActiveVersion:
        String(
          (activeVersion as Record<string, unknown> | null)?.manifestHash ?? "",
        ) === manifestHash,
      resolution: {
        repositoryContractId: manifest.data.contractId,
        resolvedContractId,
        matchBasis: "chain-and-implementation",
      },
    });
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
    return z
      .object({ token: z.string().min(1), expires_at: z.string().datetime() })
      .parse(
        await githubFetch(
          `https://api.github.com/app/installations/${installationId}/access_tokens`,
          this.appJwt(),
          "POST",
        ),
      );
  }

  private async installation(installationId: number) {
    return z
      .object({
        id: z.number().int().positive(),
        repository_selection: z.enum(["all", "selected"]),
        account: z.object({
          login: z.string().min(1),
          type: z.string().min(1),
        }),
      })
      .parse(
        await githubFetch(
          `https://api.github.com/app/installations/${installationId}`,
          this.appJwt(),
        ),
      );
  }

  private appJwt() {
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
    return `${input}.${signature}`;
  }

  private setupRedirect(status: "connected" | "requested") {
    const redirect = new URL(
      "/app/protocol-setup",
      required("NEXT_PUBLIC_AETHER_APP_URL"),
    );
    redirect.searchParams.set("tab", "github");
    redirect.searchParams.set("github", status);
    return redirect.toString();
  }
}

const repositoryPageSchema = z.object({
  total_count: z.number().int().nonnegative(),
  repositories: z.array(
    z.object({
      full_name: z.string(),
      default_branch: z.string(),
      private: z.boolean(),
      html_url: z.string().url(),
    }),
  ),
});

function scope(tenant: TenantContext) {
  return {
    organizationId: tenant.organizationId,
    protocolId: tenant.protocolId,
  };
}

function encodeRepository(repository: string) {
  return repository.split("/").map(encodeURIComponent).join("/");
}

function encodePath(path: string) {
  return path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
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

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new BadRequestException(`${name} is not configured.`);
  return value;
}
