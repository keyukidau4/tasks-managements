import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StatisticsService } from './statistics.service';

describe('StatisticsService', () => {
  let service: StatisticsService;
  const prisma = {
    project: { findFirst: jest.fn() },
    task: {
      groupBy: jest.fn(),
      findMany: jest.fn<Promise<unknown[]>, [Prisma.TaskFindManyArgs]>(),
      count: jest.fn<Promise<number>, [Prisma.TaskCountArgs]>(),
    },
    workspaceMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatisticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(StatisticsService);
  });

  it('returns all statuses and excludes soft-deleted tasks from project progress', async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: 'project-id',
      workspaceId: 'workspace-id',
    });
    prisma.workspaceMember.findUnique.mockResolvedValue({
      id: 'membership-id',
    });
    prisma.task.groupBy.mockResolvedValue([
      { status: 'TODO', _count: { _all: 2 } },
      { status: 'DONE', _count: { _all: 1 } },
    ]);

    await expect(
      service.projectProgress('member-id', 'project-id'),
    ).resolves.toEqual({
      projectId: 'project-id',
      total: 3,
      byStatus: [
        { status: 'TODO', count: 2 },
        { status: 'IN_PROGRESS', count: 0 },
        { status: 'IN_REVIEW', count: 0 },
        { status: 'DONE', count: 1 },
      ],
    });
    expect(prisma.task.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      where: { projectId: 'project-id', deletedAt: null },
      _count: { _all: true },
    });
  });

  it('returns workspace member workloads and omits unassigned tasks', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({
      id: 'membership-id',
    });
    prisma.workspaceMember.findMany.mockResolvedValue([
      {
        role: 'OWNER',
        user: { id: 'owner-id', name: 'Owner' },
      },
      {
        role: 'MEMBER',
        user: { id: 'member-id', name: 'Member' },
      },
    ]);
    prisma.task.groupBy.mockResolvedValue([
      {
        assigneeId: 'member-id',
        status: 'IN_PROGRESS',
        _count: { _all: 2 },
      },
      {
        assigneeId: 'member-id',
        status: 'DONE',
        _count: { _all: 1 },
      },
    ]);

    await expect(
      service.workspaceWorkload('owner-id', 'workspace-id'),
    ).resolves.toMatchObject({
      workspaceId: 'workspace-id',
      totalAssignedTasks: 3,
      members: [
        {
          user: { id: 'owner-id' },
          total: 0,
          byStatus: [
            { status: 'TODO', count: 0 },
            { status: 'IN_PROGRESS', count: 0 },
            { status: 'IN_REVIEW', count: 0 },
            { status: 'DONE', count: 0 },
          ],
        },
        {
          user: { id: 'member-id' },
          total: 3,
          byStatus: [
            { status: 'TODO', count: 0 },
            { status: 'IN_PROGRESS', count: 2 },
            { status: 'IN_REVIEW', count: 0 },
            { status: 'DONE', count: 1 },
          ],
        },
      ],
    });
    expect(prisma.task.groupBy).toHaveBeenCalledWith({
      by: ['assigneeId', 'status'],
      where: {
        assigneeId: { not: null },
        deletedAt: null,
        project: { is: { workspaceId: 'workspace-id', deletedAt: null } },
      },
      _count: { _all: true },
    });
  });

  it('does not query statistics for non-members', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    await expect(
      service.workspaceWorkload('outsider-id', 'workspace-id'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.task.groupBy).not.toHaveBeenCalled();
    expect(prisma.workspaceMember.findMany).not.toHaveBeenCalled();
  });

  it('returns only overdue, active, non-completed workspace tasks', async () => {
    const overdueTask = {
      id: 'task-id',
      title: 'Overdue task',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      dueDate: new Date('2020-01-01T00:00:00.000Z'),
      assignee: {
        id: 'member-id',
        name: 'Member',
        email: 'member@example.invalid',
      },
      project: { id: 'project-id', name: 'Project' },
    };
    prisma.workspaceMember.findUnique.mockResolvedValue({
      id: 'membership-id',
    });
    prisma.task.findMany.mockResolvedValue([overdueTask]);
    prisma.task.count.mockResolvedValue(1);

    await expect(
      service.workspaceOverdueTasks('member-id', 'workspace-id'),
    ).resolves.toMatchObject({
      workspaceId: 'workspace-id',
      total: 1,
      tasks: [overdueTask],
    });
    const [findManyArgs] = prisma.task.findMany.mock.calls[0];
    const { dueDate, ...otherFilters } = findManyArgs.where ?? {};
    expect(otherFilters).toEqual({
      deletedAt: null,
      status: { not: 'DONE' },
      project: { is: { workspaceId: 'workspace-id', deletedAt: null } },
    });
    expect(dueDate).toBeDefined();
    if (dueDate && typeof dueDate === 'object' && 'lt' in dueDate) {
      expect(dueDate.lt).toBeInstanceOf(Date);
    } else {
      throw new Error('Expected an exclusive due date upper bound');
    }
    expect(findManyArgs.orderBy).toEqual([{ dueDate: 'asc' }, { id: 'asc' }]);
    expect(findManyArgs.select).toMatchObject({
      assignee: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
    });
    const [countArgs] = prisma.task.count.mock.calls[0];
    const { dueDate: countDueDate, ...countFilters } = countArgs.where ?? {};
    expect(countFilters).toMatchObject({
      deletedAt: null,
      status: { not: 'DONE' },
      project: { is: { workspaceId: 'workspace-id', deletedAt: null } },
    });
    expect(countDueDate).toBeDefined();
    if (
      countDueDate &&
      typeof countDueDate === 'object' &&
      'lt' in countDueDate
    ) {
      expect(countDueDate.lt).toBeInstanceOf(Date);
    } else {
      throw new Error('Expected an exclusive due date upper bound');
    }
  });

  it('does not run overdue queries for non-members', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    await expect(
      service.workspaceOverdueTasks('outsider-id', 'workspace-id'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.task.findMany).not.toHaveBeenCalled();
    expect(prisma.task.count).not.toHaveBeenCalled();
  });
});
