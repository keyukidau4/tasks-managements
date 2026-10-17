import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { ApiUuidParams } from '../common/decorators/api-uuid-params.decorator';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProjectRolesGuard } from '../projects/project-roles.guard';
import { WorkspaceRole } from '../workspaces/workspace-role.enum';
import { WorkspaceRoles } from '../workspaces/workspace-roles.decorator';
import { StatisticsService } from './statistics.service';

@Controller('projects/:id/statistics')
@UseGuards(AccessTokenGuard, ProjectRolesGuard)
@ApiTags('Statistics')
@ApiBearerAuth()
export class ProjectStatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('progress')
  @ApiOperation({ summary: 'Count project tasks by status' })
  @ApiUuidParams('id')
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
