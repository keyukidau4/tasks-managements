import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectTasksController } from './project-tasks.controller';
import { ObjectStorageService } from './object-storage.service';
import { TaskAttachmentsController } from './task-attachments.controller';
import { TaskAttachmentsService } from './task-attachments.service';
import { TaskCommentsController } from './task-comments.controller';
import { TaskCommentsService } from './task-comments.service';
import { TasksController } from './tasks.controller';
import { TasksRolesGuard } from './tasks-roles.guard';
import { TasksService } from './tasks.service';

@Module({
  imports: [AuthModule],
  controllers: [
    ProjectTasksController,
    TasksController,
    TaskCommentsController,
    TaskAttachmentsController,
  ],
  providers: [
    TasksService,
    TasksRolesGuard,
    TaskCommentsService,
    TaskAttachmentsService,
    ObjectStorageService,
  ],
})
export class TasksModule {}
