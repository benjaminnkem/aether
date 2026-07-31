import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import {
  registerModels,
  safeEqual,
  tenantContextSchema,
  type TenantContext,
} from "@aether/backend";
import { InjectConnection } from "@nestjs/mongoose";
import type { Connection, Model } from "mongoose";
import type { Request } from "express";

export const IS_PUBLIC = "aether:public";
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const REQUIRED_ROLES = "aether:roles";
export const Roles = (...roles: TenantContext["role"][]) =>
  SetMetadata(REQUIRED_ROLES, roles);

export interface AuthenticatedRequest extends Request {
  tenant: TenantContext;
  requestId: string;
}

export const Actor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TenantContext =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().tenant,
);

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly models: Record<string, Model<unknown>>;

  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @InjectConnection() connection: Connection,
  ) {
    this.models = registerModels(connection);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token =
      authorization?.match(/^Bearer (.+)$/)?.[1] ??
      (request.cookies?.aether_access as string | undefined);
    if (!token) throw new UnauthorizedException("Authentication required.");
    let tenant: TenantContext;
    try {
      const claims = await this.jwt.verifyAsync(token, {
        secret: process.env.AETHER_ACCESS_TOKEN_SECRET,
        audience: "aether-api",
        issuer: "aether",
      });
      tenant = tenantContextSchema.parse({
        ...claims,
        actorId: claims.actorId ?? claims.sub,
      });
    } catch {
      throw new UnauthorizedException("Invalid access token.");
    }
    const membership = await this.models
      .Membership!.findOne({
        organizationId: tenant.organizationId,
        userId: tenant.actorId,
      })
      .lean()
      .exec();
    const protocolExists = await this.models.Protocol!.exists({
      organizationId: tenant.organizationId,
      protocolId: tenant.protocolId,
    });
    if (!membership || !protocolExists) {
      throw new ForbiddenException("Membership is no longer active.");
    }
    tenant = tenantContextSchema.parse({
      ...tenant,
      role: String((membership as Record<string, unknown>).role),
    });

    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.cookies?.aether_access
    ) {
      const cookie = request.cookies?.aether_csrf as string | undefined;
      const header = request.get("x-csrf-token");
      if (!cookie || !header || !safeEqual(cookie, header)) {
        throw new ForbiddenException("CSRF validation failed.");
      }
    }

    const requestedOrganization =
      (request.query.organizationId as string | undefined) ??
      (request.headers["x-organization-id"] as string | undefined);
    const requestedProtocol =
      (request.query.protocolId as string | undefined) ??
      (request.headers["x-protocol-id"] as string | undefined);
    if (
      (requestedOrganization &&
        requestedOrganization !== tenant.organizationId) ||
      (requestedProtocol && requestedProtocol !== tenant.protocolId)
    ) {
      throw new ForbiddenException("Tenant context mismatch.");
    }

    const roles = this.reflector.getAllAndOverride<TenantContext["role"][]>(
      REQUIRED_ROLES,
      [context.getHandler(), context.getClass()],
    );
    if (roles && !roles.includes(tenant.role)) {
      throw new ForbiddenException("Role is not authorized for this action.");
    }
    request.tenant = tenant;
    return true;
  }
}
