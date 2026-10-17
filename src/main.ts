import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { setupOpenApi } from './common/openapi';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableShutdownHooks();
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.enableCors({
    origin: config
      .getOrThrow<string>('CORS_ORIGINS')
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  setupOpenApi(app);

  await app.listen(config.getOrThrow<number>('PORT'));
}
void bootstrap();
