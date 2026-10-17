import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  const logError = jest.fn();
  const logger = { error: logError } as unknown as PinoLogger;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function catchException(exception: unknown) {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ id: 'request-id' }),
        getResponse: () => response,
      }),
    } as ArgumentsHost;

    new ApiExceptionFilter(logger).catch(exception, host);
    return response;
  }

  it.each([
    [HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR'],
    [HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED'],
    [HttpStatus.FORBIDDEN, 'FORBIDDEN'],
    [HttpStatus.NOT_FOUND, 'RESOURCE_NOT_FOUND'],
    [HttpStatus.CONFLICT, 'CONFLICT'],
    [HttpStatus.TOO_MANY_REQUESTS, 'TOO_MANY_REQUESTS'],
  ])('maps HTTP %s to %s', (status, code) => {
    const response = catchException(new HttpException('Rejected', status));

    expect(response.status).toHaveBeenCalledWith(status);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      error: { code, message: 'Rejected', details: [] },
    });
  });

  it('maps and sanitizes server errors', () => {
    const response = catchException(new Error('sensitive database detail'));

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        details: [],
      },
    });
    expect(logError).toHaveBeenCalledTimes(1);
  });
});
