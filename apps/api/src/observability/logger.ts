import { ConsoleLogger, Injectable, type LogLevel } from "@nestjs/common";
import { redact } from "@aether/backend";

@Injectable()
export class StructuredLogger extends ConsoleLogger {
  constructor() {
    const levels: LogLevel[] = ["log", "fatal", "error", "warn", "debug"];
    super("aether-api", { json: true, logLevels: levels });
  }

  override log(message: unknown, context?: string): void {
    super.log(redact(message), context);
  }

  override error(message: unknown, stack?: string, context?: string): void {
    super.error(redact(message), stack, context);
  }

  override warn(message: unknown, context?: string): void {
    super.warn(redact(message), context);
  }

  override debug(message: unknown, context?: string): void {
    super.debug(redact(message), context);
  }
}
