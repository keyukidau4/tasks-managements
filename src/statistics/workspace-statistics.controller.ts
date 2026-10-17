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
import { WorkspaceRole } from '../workspaces/workspace-role.enum';
import { WorkspaceRoles } from '../workspaces/workspace-roles.decorator';
import { WorkspaceRolesGuard } from '../workspaces/workspace-roles.guard';
import { StatisticsService } from './statistics.service';

@Controller('workspaces/:id/statistics')
@UseGuards(AccessTokenGuard, WorkspaceRolesGuard)
export class WorkspaceStatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('workload')
  @WorkspaceRoles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
  )
  workload(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
  ) {
    return this.statisticsService.workspaceWorkload(user.sub, workspaceId);
  }

  @Get('overdue')
  @WorkspaceRoles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
  )
  overdue(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
  ) {
    return this.statisticsService.workspaceOverdueTasks(user.sub, workspaceId);
  }
}
