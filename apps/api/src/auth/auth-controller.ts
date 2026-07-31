import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Public } from "./auth";
import { AuthService } from "./auth-service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("signup")
  signup(@Body() body: unknown, @Req() request: Request) {
    return this.auth.signup(body, request);
  }

  @Public()
  @Post("login")
  login(
    @Body() body: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.login(body, request, response);
  }

  @Public()
  @Post("refresh")
  refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.refresh(request, response);
  }

  @Public()
  @Post("logout")
  logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.logout(request, response);
  }

  @Public()
  @Post("verify-email")
  verifyEmail(@Body() body: unknown) {
    return this.auth.verifyEmail(body);
  }

  @Public()
  @Post("forgot-password")
  forgotPassword(@Body() body: unknown, @Req() request: Request) {
    return this.auth.forgotPassword(body, request);
  }

  @Public()
  @Post("reset-password")
  resetPassword(@Body() body: unknown) {
    return this.auth.resetPassword(body);
  }

  @Public()
  @Get("sessions")
  sessions(@Req() request: Request) {
    return this.auth.sessions(request);
  }

  @Public()
  @Delete("sessions/:sessionId")
  revoke(@Param("sessionId") sessionId: string, @Req() request: Request) {
    return this.auth.revokeSession(sessionId, request);
  }

  @Public()
  @Post("onboarding")
  onboarding(@Body() body: unknown, @Req() request: Request) {
    return this.auth.onboard(body, request);
  }
}
