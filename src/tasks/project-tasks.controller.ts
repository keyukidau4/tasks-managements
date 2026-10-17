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
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { ApiUuidParams } from '../common/decorators/api-uuid-params.decorator';
import { TaskPriority } from './task-priority.enum';
import { TaskStatus } from './task-status.enum';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { TasksRolesGuard } from './tasks-roles.guard';
import { TasksService } from './tasks.service';

@Controller('projects/:projectId/tasks')
@UseGuards(AccessTokenGuard, TasksRolesGuard)
@ApiTags('Tasks')
@ApiBearerAuth()
@ApiExtraModels(ListTasksQueryDto)
export class ProjectTasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a task in a project' })
  @ApiUuidParams('projectId')
  create(
    @CurrentUser() user: AuthUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(user.sub, projectId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List tasks in a project' })
  @ApiUuidParams('projectId')
  @ApiQuery({ name: 'status', required: false, enum: TaskStatus })
  @ApiQuery({ name: 'priority', required: false, enum: TaskPriority })
  @ApiQuery({
    name: 'assigneeId',
    required: false,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiQuery({
    name: 'dueDateFrom',
    required: false,
    schema: { type: 'string', format: 'date-time' },
  })
  @ApiQuery({
    name: 'dueDateTo',
    required: false,
    schema: { type: 'string', format: 'date-time' },
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'updatedAt', 'dueDate', 'title', 'status', 'priority'],
    schema: { default: 'createdAt' },
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['asc', 'desc'],
    schema: { default: 'desc' },
  })
  @ApiQuery({
    name: 'page',
    required: false,
    schema: { type: 'integer', minimum: 1, default: 1 },
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  })
  findAll(
    @CurrentUser() user: AuthUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query() query: ListTasksQueryDto,
  ) {
    return this.tasksService.findAll(user.sub, projectId, query);
  }
}
