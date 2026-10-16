import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TaskCommentsService } from './task-comments.service';
import { TasksService } from './tasks.service';

describe('TaskCommentsService', () => {
  let service: TaskCommentsService;
  const prisma = {
    taskComment: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };
  const tasksService = { assertTaskMembership: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskCommentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TasksService, useValue: tasksService },
      ],
    }).compile();
    service = module.get(TaskCommentsService);
  });

  it('checks task membership before listing comments', async () => {
    prisma.taskComment.findMany.mockResolvedValue([]);

    await service.findAll('member-id', 'task-id');

    expect(tasksService.assertTaskMembership).toHaveBeenCalledWith(
      'member-id',
      'task-id',
    );
    expect(prisma.taskComment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { taskId: 'task-id' },
        orderBy: { createdAt: 'asc' },
      }),
    );
  });

  it('trims comment content and stores it with the authenticated user', async () => {
    prisma.taskComment.create.mockResolvedValue({ id: 'comment-id' });

    await service.create('member-id', 'task-id', '  Looks good  ');

    expect(prisma.taskComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          taskId: 'task-id',
          userId: 'member-id',
          content: 'Looks good',
        },
      }),
    );
  });

  it('rejects whitespace-only comments', async () => {
    await expect(service.create('member-id', 'task-id', '  ')).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.taskComment.create).not.toHaveBeenCalled();
  });
});
