import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import type { AuthenticatedRequest } from "./auth/auth";
import { StructuredLogger } from "./observability/logger";
import { ZodExceptionFilter } from "./http/zod-exception.filter";
import { validateRuntimeChainEnvironment } from "@aether/backend";

export async function createApplication() {
  validateRuntimeChainEnvironment();
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  const logger = app.get(StructuredLogger);
  app.useLogger(logger);
  app.useGlobalFilters(new ZodExceptionFilter());
  app.setGlobalPrefix("v1");
  app.use(helmet());
  app.use(cookieParser(required("AETHER_COOKIE_SECRET")));
  app.enableCors({
    origin: (process.env.AETHER_WEB_ORIGINS ?? "http://localhost:3000").split(
      ",",
    ),
    credentials: true,
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "Idempotency-Key",
      "Last-Event-ID",
      "X-Aether-Client",
      "X-Organization-Id",
      "X-Protocol-Id",
      "X-Request-Id",
      "X-CSRF-Token",
    ],
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const requestId =
      (request.headers["x-request-id"] as string | undefined) ?? randomUUID();
    (request as AuthenticatedRequest).requestId = requestId;
    response.setHeader("X-Request-Id", requestId);
    next();
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Aether MVP API")
    .setDescription(
      "Desired state, drift, deterministic correction, KeeperHub execution, verification, audit, and realtime API.",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("v1/docs", app, document, {
    jsonDocumentUrl: "v1/openapi.json",
  });
  return app;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function bootstrap() {
  const app = await createApplication();
  await app.listen(Number(process.env.PORT ?? 4000), "0.0.0.0");
}

if (require.main === module) {
  void bootstrap();
}
