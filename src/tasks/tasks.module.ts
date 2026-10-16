import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectTasksController } from './project-tasks.controller';
import { TasksController } from './tasks.controller';
import { TasksRolesGuard } from './tasks-roles.guard';
import { TasksService } from './tasks.service';

@Module({
  imports: [AuthModule],
  controllers: [ProjectTasksController, TasksController],
  providers: [TasksService, TasksRolesGuard],
})
export class TasksModule {}
