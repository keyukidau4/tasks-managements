import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProjectRolesGuard } from '../projects/project-roles.guard';
import { WorkspaceRole } from '../workspaces/workspace-role.enum';
import { WorkspaceRoles } from '../workspaces/workspace-roles.decorator';
import { StatisticsService } from './statistics.service';

@Controller('projects/:id/statistics')
@UseGuards(AccessTokenGuard, ProjectRolesGuard)
export class ProjectStatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('progress')
  @WorkspaceRoles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
  )
  progress(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.statisticsService.projectProgress(user.sub, projectId);
  }
}
