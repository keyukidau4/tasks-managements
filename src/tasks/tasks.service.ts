import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATIONS_QUEUE,
  TASK_ASSIGNED_JOB,
} from '../queues/queue.constants';
import { TaskAssignedNotification } from '../queues/notification.types';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const taskSelect = {
  id: true,
  projectId: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  assigneeId: true,
  dueDate: true,
  version: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TaskSelect;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly notificationsQueue: Queue<TaskAssignedNotification>,
  ) {}

  async create(userId: string, projectId: string, dto: CreateTaskDto) {
    const project = await this.requireProjectMembership(userId, projectId);
    const title = dto.title.trim();
    if (!title) {
      throw new BadRequestException('Task title must not be empty');
    }

    if (dto.assigneeId) {
      await this.requireMembership(userId, project.workspaceId, dto.assigneeId);
    }

    const result = await this.prisma.$transaction(async (transaction) => {
      const createdTask = await transaction.task.create({
        data: {
          projectId,
          title,
          description: dto.description?.trim() || null,
          assigneeId: dto.assigneeId ?? null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          status: dto.status,
          priority: dto.priority,
          createdBy: userId,
        },
        select: {
          ...taskSelect,
          assignee: { select: { name: true, email: true } },
          project: { select: { name: true } },
          creator: { select: { name: true } },
        },
      });

      await transaction.auditLog.create({
        data: {
          actorId: userId,
          action: 'TASK_CREATED',
          entityType: 'TASK',
          entityId: createdTask.id,
          metadata: {
            projectId,
            version: createdTask.version,
            status: createdTask.status,
            priority: createdTask.priority,
          },
        },
      });

      const {
        assignee,
        project: assignedProject,
        creator,
        ...task
      } = createdTask;
      return {
        task,
        notification:
          assignee && dto.assigneeId
            ? {
                taskId: task.id,
                taskTitle: task.title,
                projectName: assignedProject.name,
                assigneeName: assignee.name,
                assigneeEmail: assignee.email,
                assignedByName: creator.name,
              }
            : null,
      };
    });
    if (result.notification) {
      await this.enqueueTaskAssignedNotification(
        result.notification,
        result.task.version,
      );
    }
    return result.task;
  }

  async findAll(userId: string, projectId: string, query: ListTasksQueryDto) {
    await this.requireProjectMembership(userId, projectId);
    if (
      query.dueDateFrom &&
      query.dueDateTo &&
      new Date(query.dueDateFrom) > new Date(query.dueDateTo)
    ) {
      throw new BadRequestException(
        'dueDateFrom must not be later than dueDateTo',
      );
    }

    const dueDate: Prisma.DateTimeNullableFilter = {};
    if (query.dueDateFrom) {
      dueDate.gte = new Date(query.dueDateFrom);
    }
    if (query.dueDateTo) {
      dueDate.lte = new Date(query.dueDateTo);
    }

    const where: Prisma.TaskWhereInput = {
      projectId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      ...(Object.keys(dueDate).length ? { dueDate } : {}),
    };
    const orderBy: Prisma.TaskOrderByWithRelationInput = {
      [query.sortBy]: query.sortOrder,
    };
    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: taskSelect,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(userId: string, taskId: string) {
    const task = await this.requireTaskMembership(userId, taskId);
    const result = await this.prisma.task.findFirst({
      where: { id: task.id, deletedAt: null },
      select: taskSelect,
    });
    if (!result) {
      throw new NotFoundException('Task not found');
    }
    return result;
  }

  async update(userId: string, taskId: string, dto: UpdateTaskDto) {
    const task = await this.requireTaskMembership(userId, taskId);
    const changes: Prisma.TaskUncheckedUpdateManyInput = {};

    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (!title) {
        throw new BadRequestException('Task title must not be empty');
      }
      changes.title = title;
    }
    if (dto.description !== undefined) {
      changes.description = dto.description?.trim() || null;
    }
    if (dto.assigneeId !== undefined) {
      if (dto.assigneeId) {
        const project = await this.requireProjectMembership(
          userId,
          task.projectId,
        );
        await this.requireMembership(
          userId,
          project.workspaceId,
          dto.assigneeId,
        );
      }
      changes.assigneeId = dto.assigneeId;
    }
    if (dto.dueDate !== undefined) {
      changes.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.status !== undefined) {
      changes.status = dto.status;
    }
    if (dto.priority !== undefined) {
      changes.priority = dto.priority;
    }
    if (Object.keys(changes).length === 0) {
      throw new BadRequestException('At least one task field must be provided');
    }

    const result = await this.prisma.$transaction(async (transaction) => {
      const currentTask = await transaction.task.findFirst({
        where: { id: task.id, deletedAt: null },
        select: { version: true, assigneeId: true },
      });
      if (!currentTask) {
        throw new NotFoundException('Task not found');
      }

      const result = await transaction.task.updateMany({
        where: { id: task.id, deletedAt: null, version: dto.version },
        data: { ...changes, version: { increment: 1 } },
      });
      if (result.count === 0) {
        throw new ConflictException(
          'Task was modified by another request; fetch the latest version and retry',
        );
      }

      const updatedTask = await transaction.task.findFirst({
        where: { id: task.id, deletedAt: null },
        select: {
          ...taskSelect,
          assignee: { select: { name: true, email: true } },
          project: { select: { name: true } },
          creator: { select: { name: true } },
        },
      });
      if (!updatedTask) {
        throw new NotFoundException('Task not found');
      }

      await transaction.auditLog.create({
        data: {
          actorId: userId,
          action: 'TASK_UPDATED',
          entityType: 'TASK',
          entityId: task.id,
          metadata: {
            changedFields: Object.keys(changes),
            previousVersion: currentTask.version,
            version: updatedTask.version,
          },
        },
      });

      const {
        assignee,
        project: assignedProject,
        creator,
        ...taskResult
      } = updatedTask;
      return {
        task: taskResult,
        notification:
          dto.assigneeId &&
          currentTask.assigneeId !== updatedTask.assigneeId &&
          assignee
            ? {
                taskId: taskResult.id,
                taskTitle: taskResult.title,
                projectName: assignedProject.name,
                assigneeName: assignee.name,
                assigneeEmail: assignee.email,
                assignedByName: creator.name,
              }
            : null,
      };
    });
    if (result.notification) {
      await this.enqueueTaskAssignedNotification(
        result.notification,
        result.task.version,
      );
    }
    return result.task;
  }

  async remove(userId: string, taskId: string): Promise<{ deleted: true }> {
    const task = await this.requireTaskMembership(userId, taskId);
    const result = await this.prisma.task.updateMany({
      where: { id: task.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException('Task not found');
    }
    return { deleted: true };
  }

  private async requireProjectMembership(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, workspaceId: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.requireMembership(userId, project.workspaceId);
    return project;
  }

  private async enqueueTaskAssignedNotification(
    notification: TaskAssignedNotification,
    version: number,
  ): Promise<void> {
    await this.notificationsQueue.add(TASK_ASSIGNED_JOB, notification, {
      jobId: `task-assigned-${notification.taskId}-${version}`,
    });
  }

  private async requireTaskMembership(userId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: { id: true, projectId: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.requireProjectMembership(userId, task.projectId);
    return task;
  }

  async assertTaskMembership(userId: string, taskId: string): Promise<void> {
    await this.requireTaskMembership(userId, taskId);
  }

  private async requireMembership(
    actorId: string,
    workspaceId: string,
    memberId = actorId,
  ) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: memberId },
      },
      select: { id: true },
    });
    if (!membership) {
      if (memberId !== actorId) {
        throw new BadRequestException(
          'Assignee must be a member of the project workspace',
        );
      }
      throw new NotFoundException('Project not found');
    }
    return membership;
  }
}
