import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;
  const taskModel = {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn<
      Promise<Prisma.BatchPayload>,
      [Prisma.TaskUpdateManyArgs]
    >(),
  };
  const auditLog = { create: jest.fn() };
  const transaction = { task: taskModel, auditLog };
  const prisma = {
    $transaction: jest.fn(
      (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
    project: { findFirst: jest.fn() },
    task: taskModel,
    workspaceMember: { findUnique: jest.fn() },
    auditLog,
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

    await expect(
      service.findAll('outsider-id', 'project-id', new ListTasksQueryDto()),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('filters deleted tasks from project lists', async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: 'project-id',
      workspaceId: 'workspace-id',
    });
    prisma.workspaceMember.findUnique.mockResolvedValue({ id: 'member-id' });
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.count.mockResolvedValue(0);

    await service.findAll('member-id', 'project-id', new ListTasksQueryDto());

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: 'project-id', deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      }),
    );
    expect(prisma.task.count).toHaveBeenCalledWith({
      where: { projectId: 'project-id', deletedAt: null },
    });
  });

  it('applies filters, sorting, and requested pagination', async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: 'project-id',
      workspaceId: 'workspace-id',
    });
    prisma.workspaceMember.findUnique.mockResolvedValue({ id: 'member-id' });
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.count.mockResolvedValue(25);
    const query = Object.assign(new ListTasksQueryDto(), {
      status: 'IN_PROGRESS' as const,
      priority: 'HIGH' as const,
      assigneeId: '123e4567-e89b-42d3-a456-426614174000',
      dueDateFrom: '2030-01-01T00:00:00.000Z',
      dueDateTo: '2030-01-31T00:00:00.000Z',
      sortBy: 'dueDate' as const,
      sortOrder: 'asc' as const,
      page: 2,
      limit: 10,
    });

    await expect(
      service.findAll('member-id', 'project-id', query),
    ).resolves.toMatchObject({
      pagination: { page: 2, limit: 10, total: 25, totalPages: 3 },
    });
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: 'project-id',
          deletedAt: null,
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          assigneeId: '123e4567-e89b-42d3-a456-426614174000',
          dueDate: {
            gte: new Date('2030-01-01T00:00:00.000Z'),
            lte: new Date('2030-01-31T00:00:00.000Z'),
          },
        },
        orderBy: { dueDate: 'asc' },
        skip: 10,
        take: 10,
      }),
    );
  });

  it('rejects an inverted due-date filter range', async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: 'project-id',
      workspaceId: 'workspace-id',
    });
    prisma.workspaceMember.findUnique.mockResolvedValue({ id: 'member-id' });

    await expect(
      service.findAll(
        'member-id',
        'project-id',
        Object.assign(new ListTasksQueryDto(), {
          dueDateFrom: '2030-02-01T00:00:00.000Z',
          dueDateTo: '2030-01-01T00:00:00.000Z',
        }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.task.findMany).not.toHaveBeenCalled();
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

  it('writes task creation and audit log in one transaction', async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: 'project-id',
      workspaceId: 'workspace-id',
    });
    prisma.workspaceMember.findUnique.mockResolvedValue({ id: 'member-id' });
    prisma.task.create.mockResolvedValue({
      id: 'task-id',
      projectId: 'project-id',
      title: 'Task',
      status: 'TODO',
      priority: 'MEDIUM',
      version: 1,
    });

    await service.create('member-id', 'project-id', { title: 'Task' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'member-id',
        action: 'TASK_CREATED',
        entityType: 'TASK',
        entityId: 'task-id',
        metadata: {
          projectId: 'project-id',
          version: 1,
          status: 'TODO',
          priority: 'MEDIUM',
        },
      },
    });
  });

  it('atomically updates the matching version and increments it', async () => {
    prisma.task.findFirst
      .mockResolvedValueOnce({ id: 'task-id', projectId: 'project-id' })
      .mockResolvedValueOnce({ version: 1 })
      .mockResolvedValueOnce({
        id: 'task-id',
        projectId: 'project-id',
        title: 'Updated task',
        version: 2,
      });
    prisma.project.findFirst.mockResolvedValue({
      id: 'project-id',
      workspaceId: 'workspace-id',
    });
    prisma.workspaceMember.findUnique.mockResolvedValue({ id: 'member-id' });
    prisma.task.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.update('member-id', 'task-id', {
        version: 1,
        title: 'Updated task',
      }),
    ).resolves.toMatchObject({ version: 2 });

    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: { id: 'task-id', deletedAt: null, version: 1 },
      data: {
        title: 'Updated task',
        version: { increment: 1 },
      },
    });
    expect(auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'member-id',
        action: 'TASK_UPDATED',
        entityType: 'TASK',
        entityId: 'task-id',
        metadata: {
          changedFields: ['title'],
          previousVersion: 1,
          version: 2,
        },
      },
    });
  });

  it('returns conflict when the supplied version is stale', async () => {
    prisma.task.findFirst
      .mockResolvedValueOnce({ id: 'task-id', projectId: 'project-id' })
      .mockResolvedValueOnce({ version: 2 });
    prisma.project.findFirst.mockResolvedValue({
      id: 'project-id',
      workspaceId: 'workspace-id',
    });
    prisma.workspaceMember.findUnique.mockResolvedValue({ id: 'member-id' });
    prisma.task.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.update('member-id', 'task-id', {
        version: 1,
        title: 'Stale update',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('returns not found when task is deleted during update', async () => {
    prisma.task.findFirst
      .mockResolvedValueOnce({ id: 'task-id', projectId: 'project-id' })
      .mockResolvedValueOnce(null);
    prisma.project.findFirst.mockResolvedValue({
      id: 'project-id',
      workspaceId: 'workspace-id',
    });
    prisma.workspaceMember.findUnique.mockResolvedValue({ id: 'member-id' });
    prisma.task.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.update('member-id', 'task-id', {
        version: 1,
        title: 'Concurrent update',
      }),
    ).rejects.toThrow(NotFoundException);
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
