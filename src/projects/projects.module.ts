import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectRolesGuard } from './project-roles.guard';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { WorkspaceProjectsController } from './workspace-projects.controller';

@Module({
  imports: [AuthModule],
  controllers: [WorkspaceProjectsController, ProjectsController],
  providers: [ProjectsService, ProjectRolesGuard],
})
export class ProjectsModule {}
