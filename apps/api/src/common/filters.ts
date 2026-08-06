import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { Request } from "express";

/** Structured error responses: { statusCode, message, path, timestamp, requestId }. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exceptions");

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = "Internal server error";
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === "string") message = res;
      else if (res && typeof res === "object" && "message" in res) {
        message = (res as { message: string | string[] }).message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= 500) {
      this.logger.error(
        `[${request.method} ${request.url}] ${exception instanceof Error ? exception.stack ?? exception.message : String(exception)}`,
      );
    } else {
      this.logger.warn(`[${request.method} ${request.url}] ${status} ${Array.isArray(message) ? message.join(", ") : message}`);
    }

    const responseBody = {
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId: request.headers["x-request-id"] ?? undefined,
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, status);
  }
}
