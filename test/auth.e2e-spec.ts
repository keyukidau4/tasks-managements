import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { notificationQueueProvider } from './notification-queue.mock';

interface PublicUserResponse {
  email: string;
  name: string;
  passwordHash?: string;
}

interface TokenResponse {
  user: PublicUserResponse;
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

function envelopeData<T>(body: unknown): T {
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    throw new Error('Expected a successful API response envelope');
  }
  return body.data as T;
}

function errorCode(body: unknown): string {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('error' in body) ||
    typeof body.error !== 'object' ||
    body.error === null ||
    !('code' in body.error) ||
    typeof body.error.code !== 'string'
  ) {
    throw new Error('Expected an API error response envelope');
  }
  return body.error.code;
}

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;
  let email: string;

  beforeEach(async () => {
    email = `auth-${randomUUID()}@example.invalid`;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(notificationQueueProvider.provide)
      .useValue(notificationQueueProvider.useValue)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.get(PrismaService).user.deleteMany({ where: { email } });
    await app.close();
  });

  it('registers users without exposing password hashes and rejects duplicates', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, name: 'Auth Test', password: 'correct horse 123' })
      .expect(201);

    const user = envelopeData<PublicUserResponse>(response.body);
    expect(user).toMatchObject({
      email,
      name: 'Auth Test',
    });
    expect(user).not.toHaveProperty('passwordHash');

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, name: 'Duplicate', password: 'correct horse 123' })
      .expect(409);
  });

  it('validates registration input and returns indistinguishable login failures', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, name: 'Too Short', password: 'short' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, name: 'Auth Test', password: 'correct horse 123' })
      .expect(201);

    const unknownUser = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: `missing-${email}`, password: 'correct horse 123' })
      .expect(401);
    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'incorrect password' })
      .expect(401);

    expect(unknownUser.body).toEqual(wrongPassword.body);
  });

  it('rotates refresh tokens, authenticates /me, and revokes on logout', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, name: 'Auth Test', password: 'correct horse 123' })
      .expect(201);

    const unauthenticatedMe = await request(app.getHttpServer())
      .get('/auth/me')
      .expect(401);
    expect(errorCode(unauthenticatedMe.body)).toBe('UNAUTHORIZED');

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'correct horse 123' })
      .expect(200);
    const session = envelopeData<TokenResponse>(login.body);
    const { accessToken, refreshToken } = session;

    expect(session.accessTokenExpiresIn).toBe(900);
    expect(session.refreshTokenExpiresAt).toBeDefined();
    expect(session.user).not.toHaveProperty('passwordHash');

    const storedRefreshToken = await app
      .get(PrismaService)
      .refreshToken.findUniqueOrThrow({
        where: {
          tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
        },
      });
    expect(storedRefreshToken.tokenHash).not.toBe(refreshToken);
    expect(storedRefreshToken.tokenHash).toHaveLength(64);
    expect(storedRefreshToken.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(storedRefreshToken.revokedAt).toBeNull();

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((response) => {
        const user = envelopeData<PublicUserResponse>(response.body);
        expect(user.email).toBe(email);
        expect(user).not.toHaveProperty('passwordHash');
      });

    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    const rotatedRefreshToken = envelopeData<TokenResponse>(
      refreshed.body,
    ).refreshToken;
    expect(rotatedRefreshToken).not.toBe(refreshToken);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken: rotatedRefreshToken })
      .expect(200)
      .expect((response) => {
        expect(envelopeData<{ loggedOut: boolean }>(response.body)).toEqual({
          loggedOut: true,
        });
      });

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: rotatedRefreshToken })
      .expect(401);
  });

  it('rate-limits repeated login attempts', async () => {
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        request(app.getHttpServer())
          .post('/auth/login')
          .send({ email, password: 'incorrect password' }),
      ),
    );

    expect(responses.map((response) => response.status).sort()).toEqual([
      401, 401, 401, 401, 401, 429,
    ]);
  });
});
