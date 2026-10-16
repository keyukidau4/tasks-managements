import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { MAX_TASK_ATTACHMENT_SIZE } from './attachment-policy';
import { TaskAttachmentsService } from './task-attachments.service';
import { TasksRolesGuard } from './tasks-roles.guard';

@Controller('tasks/:id/attachments')
@UseGuards(AccessTokenGuard, TasksRolesGuard)
export class TaskAttachmentsController {
  constructor(private readonly attachmentsService: TaskAttachmentsService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) taskId: string,
  ) {
    return this.attachmentsService.findAll(user.sub, taskId);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_TASK_ATTACHMENT_SIZE },
    }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) taskId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.attachmentsService.upload(user.sub, taskId, file);
  }
}
