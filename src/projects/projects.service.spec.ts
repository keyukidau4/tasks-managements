import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceRole } from '../workspaces/workspace-role.enum';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  const prisma = {
    project: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn<
        Promise<Prisma.BatchPayload>,
        [Prisma.ProjectUpdateManyArgs]
      >(),
    },
    workspaceMember: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(ProjectsService);
  });

  it('does not list project data for a non-member', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    await expect(
      service.findAll('outsider-id', 'workspace-id'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.project.findMany).not.toHaveBeenCalled();
  });

  it('allows members to list active projects only', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.MEMBER,
    });
    prisma.project.findMany.mockResolvedValue([]);

    await service.findAll('member-id', 'workspace-id');

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: 'workspace-id', deletedAt: null },
      }),
    );
  });

  it('requires a manager role before creating a project', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.MEMBER,
    });

    await expect(
      service.create('member-id', 'workspace-id', { name: 'Project' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it('rejects blank project names after trimming', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.OWNER,
    });

    await expect(
      service.create('owner-id', 'workspace-id', { name: '   ' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it('soft-deletes a project without physically deleting the row', async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: 'project-id',
      workspaceId: 'workspace-id',
    });
    prisma.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.ADMIN,
    });
    prisma.project.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.remove('admin-id', 'project-id')).resolves.toEqual({
      deleted: true,
    });

    expect(prisma.project.updateMany).toHaveBeenCalledTimes(1);
    const updateArgs = prisma.project.updateMany.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 'project-id', deletedAt: null });
    expect(updateArgs.data.deletedAt).toBeInstanceOf(Date);
  });
});
