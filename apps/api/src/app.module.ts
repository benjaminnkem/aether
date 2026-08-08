import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { MongooseModule } from "@nestjs/mongoose";
import { loadRootEnvironment } from "@aether/backend";
import { AuthGuard } from "./auth/auth";
import { AuthController } from "./auth/auth-controller";
import { AuthService } from "./auth/auth-service";
import {
  ApiKeysController,
  ApprovalsController,
  AuditController,
  DemoController,
  KeeperHubIntegrationController,
  MissionsController,
  PolicyController,
  RunsController,
  SystemController,
  WebhooksController,
} from "./http/v1-controllers";
import { StructuredLogger } from "./observability/logger";
import { MissionStore } from "./runtime/mission-store";
import {
  DualRpcObserver,
  GroqIncidentSummarizer,
  KeeperHubHttpClient,
} from "./runtime/providers";
import { RunCoordinator } from "./runtime/run-coordinator";

loadRootEnvironment();

const jwtSecret = required("AETHER_ACCESS_TOKEN_SECRET");
if (jwtSecret.length < 32) {
  throw new Error(
    "AETHER_ACCESS_TOKEN_SECRET must contain at least 32 characters.",
  );
}

@Module({
  imports: [
    MongooseModule.forRoot(required("MONGODB_URI"), {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE ?? 20),
    }),
    JwtModule.register({
      global: true,
      secret: jwtSecret,
      signOptions: { audience: "aether-api", issuer: "aether" },
    }),
  ],
  controllers: [
    SystemController,
    AuthController,
    MissionsController,
    RunsController,
    ApprovalsController,
    AuditController,
    KeeperHubIntegrationController,
    ApiKeysController,
    PolicyController,
    DemoController,
    WebhooksController,
  ],
  providers: [
    StructuredLogger,
    AuthService,
    MissionStore,
    KeeperHubHttpClient,
    DualRpcObserver,
    GroqIncidentSummarizer,
    RunCoordinator,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
