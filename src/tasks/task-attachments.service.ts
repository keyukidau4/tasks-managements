import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from './object-storage.service';
import { TasksService } from './tasks.service';
import { validateTaskAttachment } from './attachment-policy';

const attachmentSelect = {
  id: true,
  taskId: true,
  fileName: true,
  contentType: true,
  fileSize: true,
  uploadedBy: true,
  createdAt: true,
} satisfies Prisma.TaskAttachmentSelect;

const fileExtensions: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

@Injectable()
export class TaskAttachmentsService {
  private readonly logger = new Logger(TaskAttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
    private readonly storage: ObjectStorageService,
  ) {}

  async findAll(userId: string, taskId: string) {
    await this.tasksService.assertTaskMembership(userId, taskId);
    return this.prisma.taskAttachment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      select: attachmentSelect,
    });
  }

  async upload(
    userId: string,
    taskId: string,
    file: Express.Multer.File | undefined,
  ) {
    await this.tasksService.assertTaskMembership(userId, taskId);
    if (!file) {
      throw new BadRequestException('Attachment file is required');
    }

    const contentType = validateTaskAttachment(file);
    const fileKey = `${randomUUID()}${fileExtensions[contentType]}`;
    await this.storage.upload(fileKey, contentType, file.buffer);

    const pathName = file.originalname.replace(/\\/g, '/').split('/').pop();
    const fileName = Array.from(pathName || 'attachment')
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .slice(0, 255)
      .join('');

    try {
      return await this.prisma.taskAttachment.create({
        data: {
          taskId,
          fileName: fileName || 'attachment',
          fileKey,
          contentType,
          fileSize: file.size,
          uploadedBy: userId,
        },
        select: attachmentSelect,
      });
    } catch (error) {
      try {
        await this.storage.delete(fileKey);
      } catch (cleanupError) {
        this.logger.error(
          `Failed to remove orphaned attachment object ${fileKey}`,
          cleanupError instanceof Error
            ? cleanupError.stack
            : String(cleanupError),
        );
        throw new InternalServerErrorException(
          'Attachment metadata could not be saved and object cleanup failed',
          { cause: error },
        );
      }
      throw error;
    }
  }
}
