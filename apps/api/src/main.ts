import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import {
  json,
  urlencoded,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";
import { validateRuntimeChainEnvironment } from "@aether/backend";
import { AppModule } from "./app.module";
import type { AuthenticatedRequest } from "./auth/auth";
import { ApiExceptionFilter } from "./http/zod-exception.filter";
import { StructuredLogger } from "./observability/logger";

export async function createApplication() {
  validateRuntimeChainEnvironment();
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
    rawBody: true,
  });
  const logger = app.get(StructuredLogger);
  app.useLogger(logger);
  app.useGlobalFilters(new ApiExceptionFilter());
  app.setGlobalPrefix("v1");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true },
    }),
  );
  app.use(json({ limit: process.env.AETHER_BODY_LIMIT ?? "256kb" }));
  app.use(urlencoded({ extended: false, limit: "32kb" }));
  app.use(cookieParser(required("AETHER_COOKIE_SECRET")));
  app.enableCors({
    origin: (process.env.AETHER_WEB_ORIGINS ?? "http://localhost:3000")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    credentials: true,
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    const requestId =
      request.get("x-request-id")?.slice(0, 128) ?? randomUUID();
    (request as AuthenticatedRequest).requestId = requestId;
    response.setHeader("X-Request-Id", requestId);
    next();
  });
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Aether API")
    .setDescription(
      "Durable multi-step Sepolia execution, independent verification, reconciliation, recovery, approvals, and audit.",
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

if (require.main === module) void bootstrap();
