import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { InjectConnection } from "@nestjs/mongoose";
import type { Request } from "express";
import type { Connection } from "mongoose";
import * as argon2 from "argon2";
import {
  safeEqual,
  tenantContextSchema,
  type TenantContext,
} from "@aether/backend";
import { z } from "zod";

export const PUBLIC_ROUTE = "aether.public";
export const REQUIRED_ROLES = "aether.roles";
export const REQUIRED_SCOPES = "aether.scopes";
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const Roles = (...roles: TenantContext["role"][]) =>
  SetMetadata(REQUIRED_ROLES, roles);
export const Scopes = (...scopes: string[]) =>
  SetMetadata(REQUIRED_SCOPES, scopes);

export interface AuthenticatedRequest extends Request {
  tenant?: TenantContext;
  authScopes?: string[];
  requestId?: string;
}

const claimsSchema = z.object({
  sub: z.string().min(1),
  sid: z.string().min(1),
  actorId: z.string().min(1),
});

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @InjectConnection() private readonly connection: Connection,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenant = await this.authenticate(request);
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.cookies?.aether_access
    ) {
      const cookie = request.cookies?.aether_csrf as string | undefined;
      const header = request.get("x-csrf-token");
      if (!cookie || !header || !safeEqual(cookie, header))
        throw new ForbiddenException("CSRF validation failed.");
    }
    const roles = this.reflector.getAllAndOverride<TenantContext["role"][]>(
      REQUIRED_ROLES,
      [context.getHandler(), context.getClass()],
    );
    if (roles && !roles.includes(tenant.role))
      throw new ForbiddenException("Role is not authorized for this action.");
    const scopes = this.reflector.getAllAndOverride<string[]>(REQUIRED_SCOPES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (
      request.authScopes &&
      (!scopes || !scopes.some((scope) => request.authScopes?.includes(scope)))
    )
      throw new ForbiddenException(
        "API key scope is not authorized for this route.",
      );
    request.tenant = tenant;
    return true;
  }
  private async authenticate(
    request: AuthenticatedRequest,
  ): Promise<TenantContext> {
    const authorization = request.get("authorization");
    if (authorization?.startsWith("Bearer aeth_")) {
      const result = await this.apiKey(authorization.slice(7));
      request.authScopes = result.scopes;
      return result.tenant;
    }
    const token =
      (request.cookies?.aether_access as string | undefined) ??
      (authorization?.startsWith("Bearer ")
        ? authorization.slice(7)
        : undefined);
    if (!token) throw new UnauthorizedException("Authentication required.");
    const claims = claimsSchema.parse(
      await this.jwt.verifyAsync(token, {
        secret: required("AETHER_ACCESS_TOKEN_SECRET"),
        audience: "aether-api",
        issuer: "aether",
      }),
    );
    const session = await this.connection
      .collection("refresh_sessions")
      .findOne({
        sessionId: claims.sid,
        userId: claims.sub,
        revokedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      });
    if (!session) throw new UnauthorizedException("Session is unavailable.");
    const membership = await this.connection
      .collection("workspace_memberships")
      .findOne({ userId: claims.sub });
    if (!membership)
      throw new UnauthorizedException("Workspace membership is unavailable.");
    return tenantContextSchema.parse({
      actorId: claims.actorId,
      workspaceId: membership.workspaceId,
      role: membership.role,
    });
  }
  private async apiKey(
    plaintext: string,
  ): Promise<{ tenant: TenantContext; scopes: string[] }> {
    const prefix = plaintext.slice(0, 14);
    const key = await this.connection
      .collection("api_keys")
      .findOne(
        { prefix, revokedAt: { $exists: false } },
        { projection: { keyHash: 1, workspaceId: 1, scopes: 1 } },
      );
    if (!key?.keyHash || !(await argon2.verify(String(key.keyHash), plaintext)))
      throw new UnauthorizedException("API key is invalid.");
    await this.connection
      .collection("api_keys")
      .updateOne({ _id: key._id }, { $set: { lastUsedAt: new Date() } });
    return {
      tenant: tenantContextSchema.parse({
        actorId: `api-key:${prefix}`,
        workspaceId: key.workspaceId,
        role: "AGENT",
      }),
      scopes: z.array(z.string()).parse(key.scopes),
    };
  }
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
