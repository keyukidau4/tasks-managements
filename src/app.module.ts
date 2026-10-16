import { LoggerModule } from 'nestjs-pino';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { configurationSchema } from './config/configuration.schema';
import { HealthModule } from './health/health.module';
import { HomeModule } from './home/home.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configurationSchema,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL', 'info'),
          genReqId: (request, response) => {
            const requestId = request.headers['x-request-id'];
            const id =
              typeof requestId === 'string' &&
              /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                requestId,
              )
                ? requestId
                : randomUUID();

            response.setHeader('X-Request-Id', id);
            return id;
          },
          redact: {
            paths: ['req.headers.authorization', 'req.headers.cookie'],
            censor: '[Redacted]',
          },
          ...(config.get<string>('NODE_ENV') === 'development'
            ? {
                transport: {
                  target: 'pino-pretty',
                  options: { singleLine: true, colorize: true },
                },
              }
            : {}),
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => [{ name: 'default', ttl: 60_000, limit: 100 }],
    }),
    HealthModule,
    HomeModule,
    PrismaModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
