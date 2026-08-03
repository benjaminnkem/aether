import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import {
  randomBytes,
  randomUUID,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import type { Connection, Model } from "mongoose";
import type { Request, Response } from "express";
import * as argon2 from "argon2";
import nodemailer from "nodemailer";
import { registerModels, type TenantContext } from "@aether/backend";
import { activeLiveChain } from "@aether/shared";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
});
const tokenSchema = z.object({ token: z.string().min(32).max(512) });
const accessClaimsSchema = z.object({
  sub: z.string().min(1),
  sid: z.string().min(1),
  actorId: z.string().min(1),
  organizationId: z.string().min(1).optional(),
  protocolId: z.string().min(1).optional(),
  role: z.enum(["owner", "operator", "reviewer", "viewer"]).optional(),
});

type AnyModel = Model<Record<string, unknown>>;

@Injectable()
export class AuthService {
  private readonly models: Record<string, Model<unknown>>;

  constructor(
    @InjectConnection() connection: Connection,
    private readonly jwt: JwtService,
  ) {
    this.models = registerModels(connection);
  }

  async signup(input: unknown, request: Request, response: Response) {
    const { email, password } = credentialsSchema.parse(input);
    await this.rateLimit("signup", request.ip ?? "", 5, 60 * 60_000);
    const users = this.model("User");
    if (await users.exists({ email })) {
      throw new ConflictException("An account with this email already exists.");
    }
    const userId = `usr_${randomUUID()}`;
    await users.create({
      userId,
      email,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    });
    await this.authAudit("auth.signup", "completed", request, userId, email);
    const authenticatedSession = await this.createSession(
      userId,
      request,
      response,
    );
    return { ...authenticatedSession, email };
  }

  async login(input: unknown, request: Request, response: Response) {
    const { email, password } = credentialsSchema.parse(input);
    await this.rateLimit(
      "login",
      `${request.ip ?? ""}:${email}`,
      10,
      15 * 60_000,
    );
    const users = this.model("User");
    const user = await users
      .findOne({ email })
      .select("+passwordHash")
      .lean()
      .exec();
    if (!user) {
      await this.authAudit("auth.login", "failed", request, undefined, email);
      throw new UnauthorizedException("Invalid email or password.");
    }
    const lockedUntil = user.lockedUntil as Date | undefined;
    if (lockedUntil && lockedUntil > new Date()) {
      throw new HttpException("Try again later.", HttpStatus.TOO_MANY_REQUESTS);
    }
    const valid = await argon2.verify(String(user.passwordHash), password);
    if (!valid) {
      const failures = Number(user.failedLoginCount ?? 0) + 1;
      await users.updateOne(
        { userId: user.userId },
        {
          $set: {
            failedLoginCount: failures,
            lockedUntil:
              failures >= 5 ? new Date(Date.now() + 15 * 60_000) : undefined,
          },
        },
      );
      throw new UnauthorizedException("Invalid email or password.");
    }
    await users.updateOne(
      { userId: user.userId },
      { $set: { failedLoginCount: 0 }, $unset: { lockedUntil: 1 } },
    );
    await this.authAudit(
      "auth.login",
      "completed",
      request,
      String(user.userId),
      email,
    );
    return this.createSession(String(user.userId), request, response);
  }

  async refresh(request: Request, response: Response) {
    this.assertCsrf(request);
    const raw = request.cookies?.aether_refresh as string | undefined;
    if (!raw) throw new UnauthorizedException("Session is unavailable.");
    const claims = accessClaimsSchema.parse(
      await this.jwt.verifyAsync(raw, {
        secret: required("AETHER_REFRESH_TOKEN_SECRET"),
        audience: "aether-refresh",
        issuer: "aether",
      }),
    );
    const sessions = this.model("RefreshSession");
    const current = await sessions
      .findOne({ sessionId: claims.sid })
      .select("+tokenHash")
      .lean()
      .exec();
    if (
      !current ||
      current.revokedAt ||
      new Date(current.expiresAt as Date) <= new Date()
    ) {
      if (current?.familyId) {
        await sessions.updateMany(
          { familyId: current.familyId, revokedAt: { $exists: false } },
          { $set: { revokedAt: new Date(), revokeReason: "replay_detected" } },
        );
      }
      this.clearCookies(response);
      throw new UnauthorizedException("Session has expired.");
    }
    if (!safeEqual(hash(raw), String(current.tokenHash))) {
      await sessions.updateMany(
        { familyId: current.familyId, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date(), revokeReason: "replay_detected" } },
      );
      this.clearCookies(response);
      throw new UnauthorizedException("Session replay detected.");
    }
    return this.rotateSession(current, request, response);
  }

  async session(request: Request) {
    const claims = await this.accessClaims(request);
    const user = await this.model("User")
      .findOne({ userId: claims.sub })
      .select("userId email")
      .lean()
      .exec();
    if (!user) throw new UnauthorizedException("Session user is unavailable.");
    const context =
      claims.organizationId && claims.protocolId && claims.role
        ? {
            organizationId: claims.organizationId,
            protocolId: claims.protocolId,
            role: claims.role,
          }
        : undefined;
    return {
      authenticated: true as const,
      user: { id: String(user.userId), email: String(user.email) },
      context,
      destination: context ? ("dashboard" as const) : ("onboarding" as const),
    };
  }

  async logout(request: Request, response: Response) {
    this.assertCsrf(request);
    const raw = request.cookies?.aether_refresh as string | undefined;
    if (raw) {
      try {
        const claims = accessClaimsSchema.parse(
          await this.jwt.verifyAsync(raw, {
            secret: required("AETHER_REFRESH_TOKEN_SECRET"),
            audience: "aether-refresh",
            issuer: "aether",
          }),
        );
        await this.model("RefreshSession").updateOne(
          { sessionId: claims.sid },
          { $set: { revokedAt: new Date(), revokeReason: "logout" } },
        );
      } catch {
        // Always clear client state without leaking token validity.
      }
    }
    this.clearCookies(response);
    return { ok: true };
  }

  async forgotPassword(input: unknown, request: Request) {
    const email = z
      .object({
        email: z
          .string()
          .email()
          .transform((v) => v.toLowerCase()),
      })
      .parse(input).email;
    await this.rateLimit(
      "forgot-password",
      `${request.ip ?? ""}:${email}`,
      5,
      60 * 60_000,
    );
    const user = await this.model("User").findOne({ email }).lean().exec();
    if (user) {
      await this.issueChallenge(String(user.userId), email, "password_reset");
    }
    return { ok: true };
  }

  async resetPassword(input: unknown) {
    const parsed = tokenSchema
      .extend({ password: z.string().min(12).max(128) })
      .parse(input);
    return this.consumeChallenge(parsed, "password_reset", async (userId) => {
      await this.model("User").updateOne(
        { userId },
        {
          $set: {
            passwordHash: await argon2.hash(parsed.password, {
              type: argon2.argon2id,
            }),
          },
        },
      );
      await this.model("RefreshSession").updateMany(
        { userId, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date(), revokeReason: "password_reset" } },
      );
    });
  }

  async sessions(request: Request) {
    const claims = await this.accessClaims(request);
    return this.model("RefreshSession")
      .find({ userId: claims.sub })
      .select("sessionId createdAt lastUsedAt expiresAt revokedAt revokeReason")
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async revokeSession(sessionId: string, request: Request) {
    this.assertCsrf(request);
    const claims = await this.accessClaims(request);
    await this.model("RefreshSession").updateOne(
      { sessionId, userId: claims.sub },
      { $set: { revokedAt: new Date(), revokeReason: "user_revoked" } },
    );
    return { ok: true };
  }

  async onboard(input: unknown, request: Request) {
    const claims = await this.accessClaims(request);
    const parsed = z
      .object({
        organizationName: z.string().trim().min(2).max(100),
        protocolName: z.string().trim().min(2).max(100),
        governanceAuthority: z.string().trim().min(1).max(200),
      })
      .parse(input);
    if (await this.model("Membership").exists({ userId: claims.sub })) {
      throw new ConflictException(
        "This account already belongs to an organization.",
      );
    }
    const organizationId = `org_${randomUUID()}`;
    const protocolId = `pro_${randomUUID()}`;
    await this.model("Organization").create({
      organizationId,
      name: parsed.organizationName,
    });
    await this.model("Membership").create({
      organizationId,
      userId: claims.sub,
      role: "owner",
    });
    await this.model("Protocol").create({
      organizationId,
      protocolId,
      name: parsed.protocolName,
      environment: activeLiveChain.displayName,
      governance: parsed.governanceAuthority,
      status: "setup_required",
      health: 0,
    });
    return { organizationId, protocolId, role: "owner" as const };
  }

  private async createSession(
    userId: string,
    request: Request,
    response: Response,
    familyId: string = randomUUID(),
    sessionId: string = randomUUID(),
  ) {
    const context = await this.tenantContext(userId);
    const refresh = await this.jwt.signAsync(
      { sub: userId, sid: sessionId, actorId: userId, ...context },
      {
        secret: required("AETHER_REFRESH_TOKEN_SECRET"),
        audience: "aether-refresh",
        issuer: "aether",
        expiresIn: Number(
          process.env.AETHER_REFRESH_TOKEN_TTL_SECONDS ?? 2_592_000,
        ),
      },
    );
    const expiresAt = new Date(
      Date.now() +
        Number(process.env.AETHER_REFRESH_TOKEN_TTL_SECONDS ?? 2_592_000) *
          1_000,
    );
    await this.model("RefreshSession").create({
      sessionId,
      userId,
      familyId,
      tokenHash: hash(refresh),
      expiresAt,
      userAgentHash: hash(request.get("user-agent") ?? ""),
      ipHash: hash(request.ip ?? ""),
      lastUsedAt: new Date(),
    });
    const access = await this.setCookies(
      response,
      userId,
      sessionId,
      refresh,
      context,
    );
    return { authenticated: true as const, userId, context, ...access };
  }

  private async rotateSession(
    current: Record<string, unknown>,
    request: Request,
    response: Response,
  ) {
    const nextId = randomUUID();
    await this.model("RefreshSession").updateOne(
      { sessionId: current.sessionId, revokedAt: { $exists: false } },
      {
        $set: {
          revokedAt: new Date(),
          revokeReason: "rotated",
          replacedBySessionId: nextId,
        },
      },
    );
    return this.createSession(
      String(current.userId),
      request,
      response,
      String(current.familyId),
      nextId,
    );
  }

  private async setCookies(
    response: Response,
    userId: string,
    sessionId: string,
    refresh: string,
    context: Partial<TenantContext>,
  ): Promise<{ accessToken: string; accessTokenExpiresInSeconds: number }> {
    const secure = process.env.NODE_ENV === "production";
    const accessTokenExpiresInSeconds = Number(
      process.env.AETHER_ACCESS_TOKEN_TTL_SECONDS ?? 900,
    );
    const access = await this.jwt.signAsync(
      { sub: userId, sid: sessionId, actorId: userId, ...context },
      {
        secret: required("AETHER_ACCESS_TOKEN_SECRET"),
        audience: "aether-api",
        issuer: "aether",
        expiresIn: accessTokenExpiresInSeconds,
      },
    );
    const csrf = randomBytes(32).toString("base64url");
    response.cookie("aether_access", access, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: accessTokenExpiresInSeconds * 1_000,
    });
    response.cookie("aether_refresh", refresh, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      path: "/v1/auth",
      maxAge:
        Number(process.env.AETHER_REFRESH_TOKEN_TTL_SECONDS ?? 2_592_000) *
        1_000,
    });
    response.cookie("aether_csrf", csrf, {
      httpOnly: false,
      secure,
      sameSite: "strict",
      path: "/",
    });
    return {
      accessToken: access,
      accessTokenExpiresInSeconds,
    };
  }

  private clearCookies(response: Response) {
    response.clearCookie("aether_access", { path: "/" });
    response.clearCookie("aether_refresh", { path: "/v1/auth" });
    response.clearCookie("aether_csrf", { path: "/" });
  }

  private assertCsrf(request: Request) {
    const cookie = request.cookies?.aether_csrf as string | undefined;
    const header = request.get("x-csrf-token");
    if (!cookie || !header || !safeEqual(cookie, header)) {
      throw new UnauthorizedException("CSRF validation failed.");
    }
  }

  private async accessClaims(request: Request) {
    const token = request.cookies?.aether_access as string | undefined;
    if (!token) throw new UnauthorizedException("Authentication required.");
    return accessClaimsSchema.parse(
      await this.jwt.verifyAsync(token, {
        secret: required("AETHER_ACCESS_TOKEN_SECRET"),
        audience: "aether-api",
        issuer: "aether",
      }),
    );
  }

  private async tenantContext(userId: string): Promise<Partial<TenantContext>> {
    const membership = await this.model("Membership")
      .findOne({ userId })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
    if (!membership) return {};
    const protocol = await this.model("Protocol")
      .findOne({ organizationId: membership.organizationId })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
    if (!protocol) return {};
    return {
      organizationId: String(membership.organizationId),
      protocolId: String(protocol.protocolId),
      role: membership.role as TenantContext["role"],
    };
  }

  private async issueChallenge(
    userId: string,
    email: string,
    purpose: "password_reset",
  ) {
    const token = randomBytes(32).toString("base64url");
    await this.model("AuthChallenge").create({
      challengeId: randomUUID(),
      userId,
      purpose,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });
    const origin = required("NEXT_PUBLIC_AETHER_APP_URL");
    const path = "/reset-password";
    await this.sendEmail(
      email,
      "Reset your Aether password",
      `${origin}${path}?token=${encodeURIComponent(token)}`,
    );
  }

  private async sendEmail(to: string, subject: string, actionUrl: string) {
    const transporter = nodemailer.createTransport({
      // host: required("SMTP_HOST"),
      // port: Number(process.env.SMTP_PORT ?? 1025),
      // secure: process.env.SMTP_SECURE === "true",
      service: "gmail",
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: required("SMTP_PASSWORD"),
          }
        : undefined,
    });
    await transporter.sendMail({
      from: required("SMTP_FROM"),
      to,
      subject,
      text: `Open this one-time Aether link: ${actionUrl}`,
    });
  }

  private async consumeChallenge(
    input: unknown,
    purpose: "password_reset",
    action: (userId: string) => Promise<void>,
  ) {
    const { token } = tokenSchema.parse(input);
    const challenge = await this.model("AuthChallenge")
      .findOne({
        purpose,
        consumedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
        tokenHash: hash(token),
      })
      .select("+tokenHash")
      .lean()
      .exec();
    if (!challenge)
      throw new BadRequestException("Token is invalid or expired.");
    await action(String(challenge.userId));
    await this.model("AuthChallenge").updateOne(
      { challengeId: challenge.challengeId, consumedAt: { $exists: false } },
      { $set: { consumedAt: new Date() } },
    );
    return { ok: true };
  }

  private model(name: string): AnyModel {
    return this.models[name] as AnyModel;
  }

  private async rateLimit(
    action: string,
    subject: string,
    maximum: number,
    windowMs: number,
  ) {
    const key = hash(`${action}:${subject}`);
    const now = new Date();
    const result = await this.model("AuthRateLimit")
      .findOneAndUpdate(
        { key, expiresAt: { $gt: now } },
        { $inc: { count: 1 } },
        { new: true },
      )
      .lean()
      .exec();
    const record =
      result ??
      (await this.model("AuthRateLimit")
        .findOneAndUpdate(
          { key },
          {
            $set: { count: 1, expiresAt: new Date(Date.now() + windowMs) },
          },
          { upsert: true, new: true },
        )
        .lean()
        .exec());
    if (Number(record?.count ?? 0) > maximum) {
      throw new HttpException("Try again later.", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async authAudit(
    eventType: string,
    result: string,
    request: Request,
    userId?: string,
    email?: string,
  ) {
    await this.model("AuthAuditEvent").create({
      eventId: `auth_${randomUUID()}`,
      userId,
      eventType,
      result,
      emailHash: email ? hash(email) : undefined,
      ipHash: hash(request.ip ?? ""),
      userAgentHash: hash(request.get("user-agent") ?? ""),
    });
  }
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
