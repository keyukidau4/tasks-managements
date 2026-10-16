import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceRole } from '../workspaces/workspace-role.enum';
import { ProjectRolesGuard } from './project-roles.guard';

describe('ProjectRolesGuard', () => {
  let guard: ProjectRolesGuard;
  const reflector = { getAllAndOverride: jest.fn() };
  const prisma = {
    project: { findFirst: jest.fn() },
    workspaceMember: { findUnique: jest.fn() },
  };

  function createContext(projectId: string, userId = 'user-id') {
    const handler = jest.fn();
    const controller = jest.fn();
    return {
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({
        getRequest: () => ({
          params: { id: projectId },
          user: { sub: userId },
        }),
      }),
    } as ExecutionContext;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectRolesGuard,
        { provide: Reflector, useValue: reflector },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    guard = module.get(ProjectRolesGuard);
  });

  it('requires project and workspace membership before allowing access', async () => {
    reflector.getAllAndOverride.mockReturnValue([WorkspaceRole.MEMBER]);
    prisma.project.findFirst.mockResolvedValue({ workspaceId: 'workspace-id' });
    prisma.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.MEMBER,
    });

    await expect(
      guard.canActivate(createContext('123e4567-e89b-42d3-a456-426614174000')),
    ).resolves.toBe(true);
    expect(prisma.workspaceMember.findUnique).toHaveBeenCalledWith({
      where: {
        workspaceId_userId: {
          workspaceId: 'workspace-id',
          userId: 'user-id',
        },
      },
      select: { role: true },
    });
  });

  it('returns not found for deleted or missing projects', async () => {
    reflector.getAllAndOverride.mockReturnValue([WorkspaceRole.MEMBER]);
    prisma.project.findFirst.mockResolvedValue(null);

    await expect(
      guard.canActivate(createContext('123e4567-e89b-42d3-a456-426614174000')),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.workspaceMember.findUnique).not.toHaveBeenCalled();
  });

  it('rejects users without workspace membership', async () => {
    reflector.getAllAndOverride.mockReturnValue([WorkspaceRole.MEMBER]);
    prisma.project.findFirst.mockResolvedValue({ workspaceId: 'workspace-id' });
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    await expect(
      guard.canActivate(createContext('123e4567-e89b-42d3-a456-426614174000')),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects a member role when a manager role is required', async () => {
    reflector.getAllAndOverride.mockReturnValue([
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
    ]);
    prisma.project.findFirst.mockResolvedValue({ workspaceId: 'workspace-id' });
    prisma.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.MEMBER,
    });

    await expect(
      guard.canActivate(createContext('123e4567-e89b-42d3-a456-426614174000')),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects malformed project IDs before querying the database', async () => {
    reflector.getAllAndOverride.mockReturnValue([WorkspaceRole.MEMBER]);

    await expect(guard.canActivate(createContext('invalid'))).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.project.findFirst).not.toHaveBeenCalled();
  });
});
