import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;
  const prisma = {
    project: { findFirst: jest.fn() },
    task: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn<
        Promise<Prisma.BatchPayload>,
        [Prisma.TaskUpdateManyArgs]
      >(),
    },
    workspaceMember: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [TasksService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(TasksService);
  });

  it('does not list tasks when the actor is not a project workspace member', async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: 'project-id',
      workspaceId: 'workspace-id',
    });
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    await expect(service.findAll('outsider-id', 'project-id')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('filters deleted tasks from project lists', async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: 'project-id',
      workspaceId: 'workspace-id',
    });
    prisma.workspaceMember.findUnique.mockResolvedValue({ id: 'member-id' });
    prisma.task.findMany.mockResolvedValue([]);

    await service.findAll('member-id', 'project-id');

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'project-id', deletedAt: null },
      }),
    );
  });

  it('rejects assigning a task to a non-member', async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: 'project-id',
      workspaceId: 'workspace-id',
    });
    prisma.workspaceMember.findUnique
      .mockResolvedValueOnce({ id: 'actor-membership' })
      .mockResolvedValueOnce(null);

    await expect(
      service.create('actor-id', 'project-id', {
        title: 'Task',
        assigneeId: 'outsider-id',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('soft-deletes a task without physically deleting its row', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 'task-id',
      projectId: 'project-id',
    });
    prisma.project.findFirst.mockResolvedValue({
      id: 'project-id',
      workspaceId: 'workspace-id',
    });
    prisma.workspaceMember.findUnique.mockResolvedValue({ id: 'member-id' });
    prisma.task.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.remove('member-id', 'task-id')).resolves.toEqual({
      deleted: true,
    });

    expect(prisma.task.updateMany).toHaveBeenCalledTimes(1);
    const updateArgs = prisma.task.updateMany.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 'task-id', deletedAt: null });
    expect(updateArgs.data.deletedAt).toBeInstanceOf(Date);
  });
});
