import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { TasksRolesGuard } from './tasks-roles.guard';
import { TasksService } from './tasks.service';

@Controller('projects/:projectId/tasks')
@UseGuards(AccessTokenGuard, TasksRolesGuard)
export class ProjectTasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(user.sub, projectId, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query() query: ListTasksQueryDto,
  ) {
    return this.tasksService.findAll(user.sub, projectId, query);
  }
}
