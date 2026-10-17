import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TaskStatus } from '../tasks/task-status.enum';

const taskStatuses = Object.values(TaskStatus);

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async projectProgress(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, workspaceId: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    await this.requireWorkspaceMembership(userId, project.workspaceId);

    const groupedTasks = await this.prisma.task.groupBy({
      by: ['status'],
      where: { projectId, deletedAt: null },
      _count: { _all: true },
    });
    const counts = new Map(
      groupedTasks.map(({ status, _count }) => [status, _count._all]),
    );
    const byStatus = taskStatuses.map((status) => ({
      status,
      count: counts.get(status) ?? 0,
    }));

    return {
      projectId,
      total: byStatus.reduce((sum, item) => sum + item.count, 0),
      byStatus,
    };
  }

  async workspaceWorkload(userId: string, workspaceId: string) {
    await this.requireWorkspaceMembership(userId, workspaceId);

    const [members, groupedTasks] = await Promise.all([
      this.prisma.workspaceMember.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'asc' },
        select: {
          role: true,
          user: { select: { id: true, name: true } },
        },
      }),
      this.prisma.task.groupBy({
        by: ['assigneeId', 'status'],
        where: {
          assigneeId: { not: null },
          deletedAt: null,
          project: { is: { workspaceId, deletedAt: null } },
        },
        _count: { _all: true },
      }),
    ]);

    const counts = new Map<string, number>();
    for (const task of groupedTasks) {
      if (task.assigneeId) {
        counts.set(`${task.assigneeId}:${task.status}`, task._count._all);
      }
    }

    const workload = members.map(({ role, user }) => {
      const byStatus = taskStatuses.map((status) => ({
        status,
        count: counts.get(`${user.id}:${status}`) ?? 0,
      }));
      return {
        user,
        role,
        total: byStatus.reduce((sum, item) => sum + item.count, 0),
        byStatus,
      };
    });

    return {
      workspaceId,
      totalAssignedTasks: workload.reduce(
        (sum, member) => sum + member.total,
        0,
      ),
      members: workload,
    };
  }

  async workspaceOverdueTasks(userId: string, workspaceId: string) {
    await this.requireWorkspaceMembership(userId, workspaceId);
    const asOf = new Date();
    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      dueDate: { lt: asOf },
      status: { not: TaskStatus.DONE },
      project: { is: { workspaceId, deletedAt: null } },
    };

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          assignee: {
            select: { id: true, name: true, email: true },
          },
          project: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    return { workspaceId, asOf, total, tasks };
  }

  private async requireWorkspaceMembership(
    userId: string,
    workspaceId: string,
  ) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { id: true },
    });
    if (!membership) {
      throw new NotFoundException('Workspace not found');
    }
  }
}
