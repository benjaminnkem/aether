import { Body, Controller, Get, Post, Put, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import type { TenantContext } from "@aether/backend";
import { Actor, Public, Roles } from "../auth/auth";
import { GitHubService } from "./github-service";

@Controller("github")
export class GitHubController {
  constructor(private readonly github: GitHubService) {}

  @Get("install-url")
  @Roles("owner", "operator")
  installUrl(@Actor() tenant: TenantContext) {
    return this.github.installUrl(tenant);
  }

  @Public()
  @Get("callback")
  callback(@Query() query: unknown) {
    return this.github.callback(query);
  }

  @Get("repositories")
  repositories(@Actor() tenant: TenantContext) {
    return this.github.repositories(tenant);
  }

  @Put("repository")
  @Roles("owner", "operator")
  repository(@Actor() tenant: TenantContext, @Body() body: unknown) {
    return this.github.selectRepository(tenant, body);
  }

  @Public()
  @Post("webhooks")
  webhook(@Req() request: Request & { rawBody?: Buffer }) {
    return this.github.webhook(request);
  }
}
