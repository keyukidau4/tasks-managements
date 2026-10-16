import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from './object-storage.service';
import { TaskAttachmentsService } from './task-attachments.service';
import { TasksService } from './tasks.service';

describe('TaskAttachmentsService', () => {
  let service: TaskAttachmentsService;
  const prisma = {
    taskAttachment: {
      findMany: jest.fn(),
      create: jest.fn<
        Promise<{ id: string; contentType: string }>,
        [Prisma.TaskAttachmentCreateArgs]
      >(),
    },
  };
  const tasksService = { assertTaskMembership: jest.fn() };
  const storage = {
    upload: jest.fn<Promise<void>, [string, string, Buffer]>(),
    delete: jest.fn<Promise<void>, [string]>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskAttachmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TasksService, useValue: tasksService },
        { provide: ObjectStorageService, useValue: storage },
      ],
    }).compile();
    service = module.get(TaskAttachmentsService);
  });

  it('checks membership before returning attachment metadata', async () => {
    prisma.taskAttachment.findMany.mockResolvedValue([]);

    await service.findAll('member-id', 'task-id');

    expect(tasksService.assertTaskMembership).toHaveBeenCalledWith(
      'member-id',
      'task-id',
    );
    expect(prisma.taskAttachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { taskId: 'task-id' },
        orderBy: { createdAt: 'asc' },
      }),
    );
  });

  it('uploads validated content before persisting its metadata', async () => {
    prisma.taskAttachment.create.mockResolvedValue({
      id: 'attachment-id',
      contentType: 'image/png',
    });
    const buffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const file = {
      originalname: 'folder\\image.png',
      mimetype: 'image/png',
      size: buffer.byteLength,
      buffer,
    } as Express.Multer.File;

    await expect(
      service.upload('member-id', 'task-id', file),
    ).resolves.toMatchObject({ contentType: 'image/png' });

    expect(storage.upload).toHaveBeenCalledWith(
      expect.stringMatching(/\.png$/),
      'image/png',
      buffer,
    );
    const [createArgs] = prisma.taskAttachment.create.mock.calls[0];
    expect(createArgs.data).toMatchObject({
      taskId: 'task-id',
      fileName: 'image.png',
      contentType: 'image/png',
      fileSize: buffer.byteLength,
      uploadedBy: 'member-id',
    });
  });

  it('removes the uploaded object if metadata persistence fails', async () => {
    prisma.taskAttachment.create.mockRejectedValue(
      new Error('database unavailable'),
    );
    const buffer = Buffer.from('%PDF-1.7\n');
    const file = {
      originalname: 'document.pdf',
      mimetype: 'application/pdf',
      size: buffer.byteLength,
      buffer,
    } as Express.Multer.File;

    await expect(service.upload('member-id', 'task-id', file)).rejects.toThrow(
      'database unavailable',
    );

    const [key] = storage.upload.mock.calls[0];
    expect(storage.delete).toHaveBeenCalledWith(key);
  });

  it('does not upload for users without task membership', async () => {
    tasksService.assertTaskMembership.mockRejectedValue(
      new Error('not a member'),
    );

    await expect(
      service.upload('outsider-id', 'task-id', undefined),
    ).rejects.toThrow('not a member');
    expect(storage.upload).not.toHaveBeenCalled();
  });
});
