import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
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
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, projectId: string, dto: CreateTaskDto) {
    const project = await this.requireProjectMembership(userId, projectId);
    const title = dto.title.trim();
    if (!title) {
      throw new BadRequestException('Task title must not be empty');
    }

    if (dto.assigneeId) {
      await this.requireMembership(userId, project.workspaceId, dto.assigneeId);
    }

    return this.prisma.task.create({
      data: {
        projectId,
        title,
        description: dto.description?.trim() || null,
        assigneeId: dto.assigneeId ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        createdBy: userId,
      },
      select: taskSelect,
    });
  }

  async findAll(userId: string, projectId: string) {
    await this.requireProjectMembership(userId, projectId);
    return this.prisma.task.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: taskSelect,
    });
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
    if (Object.keys(changes).length === 0) {
      throw new BadRequestException('At least one task field must be provided');
    }

    const result = await this.prisma.task.updateMany({
      where: { id: task.id, deletedAt: null },
      data: changes,
    });
    if (result.count === 0) {
      throw new NotFoundException('Task not found');
    }

    const updatedTask = await this.prisma.task.findFirst({
      where: { id: task.id, deletedAt: null },
      select: taskSelect,
    });
    if (!updatedTask) {
      throw new NotFoundException('Task not found');
    }
    return updatedTask;
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
