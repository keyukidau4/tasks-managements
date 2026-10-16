import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from './tasks.service';

const commentSelect = {
  id: true,
  taskId: true,
  content: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.TaskCommentSelect;

@Injectable()
export class TaskCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
  ) {}

  async findAll(userId: string, taskId: string) {
    await this.tasksService.assertTaskMembership(userId, taskId);
    return this.prisma.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      select: commentSelect,
    });
  }

  async create(userId: string, taskId: string, content: string) {
    await this.tasksService.assertTaskMembership(userId, taskId);
    const normalizedContent = content.trim();
    if (!normalizedContent) {
      throw new BadRequestException('Comment content must not be empty');
    }

    return this.prisma.taskComment.create({
      data: { taskId, userId, content: normalizedContent },
      select: commentSelect,
    });
  }
}
