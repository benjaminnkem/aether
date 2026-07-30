import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AuthGuard } from "./auth/auth";
import {
  AuditController,
  DashboardController,
  DemoController,
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

const jwtSecret =
  process.env.AETHER_JWT_SECRET ??
  "development-only-secret-change-before-production";
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.AETHER_JWT_SECRET || process.env.AETHER_JWT_SECRET.length < 32)
) {
  throw new Error("AETHER_JWT_SECRET of at least 32 characters is required.");
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
    DashboardController,
    DemoController,
    ProtocolSetupController,
    DesiredStateController,
    ObservationController,
    OperationController,
    ExecutionController,
    AuditController,
    RealtimeController,
  ],
  providers: [StructuredLogger, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
