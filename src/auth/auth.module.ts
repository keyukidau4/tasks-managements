import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { AccessTokenGuard } from './access-token.guard';
import { AccessTokenService } from './access-token.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: AccessTokenService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new AccessTokenService(
          config.get<string>('JWT_ACCESS_SECRET') ??
            randomBytes(32).toString('hex'),
        ),
    },
    AuthService,
    AccessTokenGuard,
  ],
})
export class AuthModule {}
