import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { ApiUuidParams } from '../common/decorators/api-uuid-params.decorator';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { TasksRolesGuard } from './tasks-roles.guard';
import { TasksService } from './tasks.service';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller('tasks')
@UseGuards(AccessTokenGuard, TasksRolesGuard)
@ApiTags('Tasks')
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get a task' })
  @ApiUuidParams('id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) taskId: string,
  ) {
    return this.tasksService.findOne(user.sub, taskId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task using optimistic locking' })
  @ApiUuidParams('id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(user.sub, taskId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a task' })
  @ApiUuidParams('id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) taskId: string,
  ) {
    return this.tasksService.remove(user.sub, taskId);
  }
}
