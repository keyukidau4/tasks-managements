import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { ApiUuidParams } from '../common/decorators/api-uuid-params.decorator';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { TasksRolesGuard } from './tasks-roles.guard';
import { TaskCommentsService } from './task-comments.service';

@Controller('tasks/:id/comments')
@UseGuards(AccessTokenGuard, TasksRolesGuard)
@ApiTags('Task comments')
@ApiBearerAuth()
export class TaskCommentsController {
  constructor(private readonly commentsService: TaskCommentsService) {}

  @Get()
  @ApiOperation({ summary: 'List comments on a task' })
  @ApiUuidParams('id')
  findAll(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) taskId: string,
  ) {
    return this.commentsService.findAll(user.sub, taskId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a comment to a task' })
  @ApiUuidParams('id')
  create(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) taskId: string,
    @Body() dto: CreateTaskCommentDto,
  ) {
    return this.commentsService.create(user.sub, taskId, dto.content);
  }
}
