import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./app.module";
import { validateRuntimeChainEnvironment } from "@aether/backend";

async function bootstrap() {
  validateRuntimeChainEnvironment();
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger:
      process.env.NODE_ENV === "production"
        ? ["fatal", "error", "warn", "log"]
        : ["fatal", "error", "warn", "log", "debug"],
  });
  app.enableShutdownHooks();
}

void bootstrap();
