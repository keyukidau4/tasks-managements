import { Injectable } from '@nestjs/common';
import { sign, verify } from 'jsonwebtoken';

@Injectable()
export class AccessTokenService {
  constructor(private readonly secret: string) {}

  issue(userId: string): string {
    return sign({ sub: userId }, this.secret, {
      algorithm: 'HS256',
      audience: 'task-management-client',
      expiresIn: 15 * 60,
      issuer: 'task-management-api',
    });
  }

  verify(token: string): { sub: string } | undefined {
    const payload = verify(token, this.secret, {
      algorithms: ['HS256'],
      audience: 'task-management-client',
      issuer: 'task-management-api',
    });

    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      return undefined;
    }
    return { sub: payload.sub };
  }
}
