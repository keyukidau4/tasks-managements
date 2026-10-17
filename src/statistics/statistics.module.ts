import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectRolesGuard } from '../projects/project-roles.guard';
import { WorkspaceRolesGuard } from '../workspaces/workspace-roles.guard';
import { ProjectStatisticsController } from './project-statistics.controller';
import { StatisticsService } from './statistics.service';
import { WorkspaceStatisticsController } from './workspace-statistics.controller';

@Module({
  imports: [AuthModule],
  controllers: [ProjectStatisticsController, WorkspaceStatisticsController],
  providers: [StatisticsService, ProjectRolesGuard, WorkspaceRolesGuard],
})
export class StatisticsModule {}
