import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { loadRootEnvironment } from "@aether/backend";
import { AuthGuard } from "./auth/auth";
import { AuthController } from "./auth/auth-controller";
import { AuthService } from "./auth/auth-service";
import { GitHubController } from "./github/github-controller";
import { GitHubService } from "./github/github-service";
import {
  AuditController,
  DashboardController,
  DesiredStateController,
  ExecutionController,
  ObservationController,
  OperationController,
  ProtocolSetupController,
  RealtimeController,
  SystemController,
} from "./http/controllers";
import { StructuredLogger } from "./observability/logger";
import { PersistenceModule } from "./persistence/state-store";

loadRootEnvironment();

const jwtSecret = process.env.AETHER_ACCESS_TOKEN_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error(
    "AETHER_ACCESS_TOKEN_SECRET of at least 32 characters is required.",
  );
}

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: jwtSecret,
      signOptions: { audience: "aether-api", issuer: "aether" },
    }),
    PersistenceModule.register(),
  ],
  controllers: [
    SystemController,
    AuthController,
    GitHubController,
    DashboardController,
    ProtocolSetupController,
    DesiredStateController,
    ObservationController,
    OperationController,
    ExecutionController,
    AuditController,
    RealtimeController,
  ],
  providers: [
    StructuredLogger,
    AuthService,
    GitHubService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
