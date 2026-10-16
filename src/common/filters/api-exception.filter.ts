import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { Request, Response } from 'express';

type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RESOURCE_NOT_FOUND'
  | 'CONFLICT'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_SERVER_ERROR';

const errorCodes: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'RESOURCE_NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const requestId = request.id;

    if (status >= 500) {
      this.logger.error(
        { err: exception, requestId },
        'Unhandled API exception',
      );
    }

    const exceptionBody =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const body =
      typeof exceptionBody === 'object' && exceptionBody !== null
        ? (exceptionBody as { message?: unknown }).message
        : exceptionBody;
    const messages = Array.isArray(body)
      ? body.filter((message): message is string => typeof message === 'string')
      : typeof body === 'string' && status < 500 && body !== HttpStatus[status]
        ? [body]
        : [];
    const isServerError = status >= 500;

    response.status(status).json({
      success: false,
      error: {
        code: errorCodes[status] ?? 'INTERNAL_SERVER_ERROR',
        message: isServerError
          ? 'Internal server error'
          : (messages[0] ?? HttpStatus[status]),
        details: messages.length > 1 ? messages : [],
      },
    });
  }
}
