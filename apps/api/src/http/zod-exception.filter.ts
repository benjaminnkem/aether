import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ZodError } from "zod";
import type { AuthenticatedRequest } from "../auth/auth";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const correlationId =
      (request as AuthenticatedRequest).requestId ?? "unknown";

    if (error instanceof ZodError) {
      response.status(HttpStatus.BAD_REQUEST).json({
        code: "INVALID_REQUEST",
        message: "Request validation failed.",
        correlationId,
        details: error.issues.map(({ code, path, message }) => ({
          code,
          path,
          message,
        })),
      });
      return;
    }

    if (error instanceof HttpException) {
      const status = error.getStatus();
      const body = error.getResponse();
      const message =
        typeof body === "string"
          ? body
          : typeof body === "object" && body && "message" in body
            ? String((body as { message: unknown }).message)
            : error.message;
      response.status(status).json({
        code: status === 409 ? "CONFLICT" : `HTTP_${status}`,
        message,
        correlationId,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: "INTERNAL_ERROR",
      message: "The request could not be completed.",
      correlationId,
    });
  }
}
