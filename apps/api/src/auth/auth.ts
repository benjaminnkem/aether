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
import { tenantContextSchema, type TenantContext } from "@aether/backend";
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
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

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
    const development =
      (process.env.AETHER_AUTH_MODE ?? "development") === "development";

    let tenant: TenantContext;
    if (!authorization && development) {
      tenant = {
        actorId: "user-mina",
        organizationId: "org-arcadia",
        protocolId: "arcadia",
        role: "owner",
      };
    } else {
      const token = authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!token) throw new UnauthorizedException("Bearer token required.");
      try {
        tenant = tenantContextSchema.parse(
          await this.jwt.verifyAsync(token, {
            audience: "aether-api",
            issuer: "aether",
          }),
        );
      } catch {
        throw new UnauthorizedException("Invalid access token.");
      }
    }

    const configuredOrganization =
      process.env.AETHER_ORGANIZATION_ID ?? "org-arcadia";
    const configuredProtocol = process.env.AETHER_PROTOCOL_ID ?? "arcadia";
    if (
      tenant.organizationId !== configuredOrganization ||
      tenant.protocolId !== configuredProtocol
    ) {
      throw new ForbiddenException(
        "Actor is not a member of the configured MVP context.",
      );
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
