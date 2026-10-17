import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AccessTokenService } from './access-token.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const user = {
    id: 'user-id',
    email: 'person@example.com',
    name: 'Test User',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
  };
  let storedPasswordHash = '';
  let storedRefreshTokenHash = '';
  let normalizedRegistration: { email: string; name: string } | undefined;
  const prisma = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const accessTokens = { issue: jest.fn() };
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    storedPasswordHash = '';
    storedRefreshTokenHash = '';
    normalizedRegistration = undefined;
    service = new AuthService(
      prisma as unknown as PrismaService,
      accessTokens as unknown as AccessTokenService,
    );
  });

  it('normalizes registration data and returns no password hash', async () => {
    prisma.user.create.mockImplementation(
      (args: {
        data: { email: string; name: string; passwordHash: string };
      }) => {
        storedPasswordHash = args.data.passwordHash;
        normalizedRegistration = {
          email: args.data.email,
          name: args.data.name,
        };
        return {
          ...user,
          email: args.data.email,
          name: args.data.name,
        };
      },
    );

    const result = await service.register({
      email: ' Person@Example.com ',
      name: ' Test User ',
      password: 'correct horse 123',
    });

    expect(normalizedRegistration).toEqual({
      email: 'person@example.com',
      name: 'Test User',
    });
    expect(await compare('correct horse 123', storedPasswordHash)).toBe(true);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('translates duplicate-email database errors into a conflict', async () => {
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.register({
        email: 'person@example.com',
        name: 'Test User',
        password: 'correct horse 123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid credentials and issues tokens for valid credentials', async () => {
    const passwordHash = await hash('correct horse 123', 4);
    prisma.user.findUnique.mockResolvedValue({ ...user, passwordHash });
    prisma.refreshToken.create.mockImplementation(
      (args: {
        data: { tokenHash: string; userId: string; expiresAt: Date };
      }) => {
        storedRefreshTokenHash = args.data.tokenHash;
        expect(args.data.userId).toBe(user.id);
        expect(args.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
        return {};
      },
    );
    accessTokens.issue.mockReturnValue('access-token');

    await expect(
      service.login({ email: user.email, password: 'incorrect password' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const session = await service.login({
      email: ' PERSON@example.com ',
      password: 'correct horse 123',
    });
    expect(session).toMatchObject({
      user,
      accessToken: 'access-token',
      accessTokenExpiresIn: 900,
    });
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(session.refreshToken).not.toBe(storedRefreshTokenHash);
    expect(storedRefreshTokenHash).toBe(
      createHash('sha256').update(session.refreshToken).digest('hex'),
    );
  });

  it('rotates refresh tokens in a transaction and revokes on logout', async () => {
    const originalToken = 'original-refresh-token';
    const originalHash = createHash('sha256')
      .update(originalToken)
      .digest('hex');
    prisma.$transaction.mockImplementation(
      (callback: (transaction: PrismaService) => Promise<unknown>) =>
        callback(prisma as unknown as PrismaService),
    );
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'refresh-token-id',
      userId: user.id,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.refreshToken.create.mockResolvedValue({});
    prisma.user.findUnique.mockResolvedValue(user);
    accessTokens.issue.mockReturnValue('next-access-token');

    const session = await service.refresh(originalToken);
    expect(prisma.refreshToken.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: originalHash } }),
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledTimes(1);
    expect(session.refreshToken).not.toBe(originalToken);

    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    await expect(service.logout(session.refreshToken)).resolves.toEqual({
      loggedOut: true,
    });
  });
});
