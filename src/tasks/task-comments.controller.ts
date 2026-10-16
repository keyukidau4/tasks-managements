import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { TasksRolesGuard } from './tasks-roles.guard';
import { TaskCommentsService } from './task-comments.service';

@Controller('tasks/:id/comments')
@UseGuards(AccessTokenGuard, TasksRolesGuard)
export class TaskCommentsController {
  constructor(private readonly commentsService: TaskCommentsService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) taskId: string,
  ) {
    return this.commentsService.findAll(user.sub, taskId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) taskId: string,
    @Body() dto: CreateTaskCommentDto,
  ) {
    return this.commentsService.create(user.sub, taskId, dto.content);
  }
}
