import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { WORKSPACE_ROLES_KEY } from './workspace-roles.decorator';
import { WorkspaceRole } from './workspace-role.enum';
import { WorkspaceRolesGuard } from './workspace-roles.guard';

describe('WorkspaceRolesGuard', () => {
  let guard: WorkspaceRolesGuard;
  const reflector = { getAllAndOverride: jest.fn() };
  const prisma = {
    workspaceMember: { findUnique: jest.fn() },
  };

  function createContext(
    params: Record<string, string>,
    userId = 'user-id',
  ): ExecutionContext {
    const handler = jest.fn();
    const controller = jest.fn();
    return {
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({
        getRequest: () => ({ params, user: { sub: userId } }),
      }),
    } as ExecutionContext;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceRolesGuard,
        { provide: Reflector, useValue: reflector },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    guard = module.get(WorkspaceRolesGuard);
  });

  it('checks membership for workspace-scoped routes even without role metadata', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    prisma.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.MEMBER,
    });

    await expect(
      guard.canActivate(
        createContext({ id: '123e4567-e89b-42d3-a456-426614174000' }),
      ),
    ).resolves.toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      WORKSPACE_ROLES_KEY,
      expect.any(Array),
    );
    expect(prisma.workspaceMember.findUnique).toHaveBeenCalledWith({
      where: {
        workspaceId_userId: {
          workspaceId: '123e4567-e89b-42d3-a456-426614174000',
          userId: 'user-id',
        },
      },
      select: { role: true },
    });
  });

  it('supports workspaceId route parameters and rejects non-members', async () => {
    reflector.getAllAndOverride.mockReturnValue([WorkspaceRole.OWNER]);
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    await expect(
      guard.canActivate(
        createContext({
          workspaceId: '123e4567-e89b-42d3-a456-426614174000',
        }),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('restricts routes to the declared role set', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ]);
    prisma.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.MEMBER,
    });

    await expect(
      guard.canActivate(
        createContext({ id: '123e4567-e89b-42d3-a456-426614174000' }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects invalid workspace IDs before querying membership', async () => {
    reflector.getAllAndOverride.mockReturnValue([WorkspaceRole.MEMBER]);

    await expect(
      guard.canActivate(createContext({ id: 'not-a-uuid' })),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.workspaceMember.findUnique).not.toHaveBeenCalled();
  });

  it('allows non-workspace routes without role metadata', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(createContext({}))).resolves.toBe(true);
    expect(prisma.workspaceMember.findUnique).not.toHaveBeenCalled();
  });
});
