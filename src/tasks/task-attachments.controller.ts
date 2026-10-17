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
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { ApiUuidParams } from '../common/decorators/api-uuid-params.decorator';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { MAX_TASK_ATTACHMENT_SIZE } from './attachment-policy';
import { TaskAttachmentsService } from './task-attachments.service';
import { TasksRolesGuard } from './tasks-roles.guard';

@Controller('tasks/:id/attachments')
@UseGuards(AccessTokenGuard, TasksRolesGuard)
@ApiTags('Task attachments')
@ApiBearerAuth()
export class TaskAttachmentsController {
  constructor(private readonly attachmentsService: TaskAttachmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List task attachments' })
  @ApiUuidParams('id')
  findAll(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) taskId: string,
  ) {
    return this.attachmentsService.findAll(user.sub, taskId);
  }

  @Post()
  @ApiOperation({ summary: 'Upload an attachment to a task' })
  @ApiUuidParams('id')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: `Allowed file size up to ${MAX_TASK_ATTACHMENT_SIZE} bytes; only supported MIME types are accepted.`,
        },
      },
    },
  })
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
