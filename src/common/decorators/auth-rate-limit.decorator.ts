import { applyDecorators } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

export function AuthRateLimit() {
  return applyDecorators(Throttle({ default: { limit: 5, ttl: 60_000 } }));
}
