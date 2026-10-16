import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { InviteWorkspaceMemberDto } from './dto/invite-workspace-member.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceRole } from './workspace-role.enum';
import { WorkspaceRoles } from './workspace-roles.decorator';
import { WorkspaceRolesGuard } from './workspace-roles.guard';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
@UseGuards(AccessTokenGuard, WorkspaceRolesGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(user.sub, dto);
  }

  @Get(':id')
  @WorkspaceRoles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
  )
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
  ) {
    return this.workspacesService.findOne(user.sub, workspaceId);
  }

  @Patch(':id')
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(user.sub, workspaceId, dto);
  }

  @Post(':id/members')
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  inviteMember(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
    @Body() dto: InviteWorkspaceMemberDto,
  ) {
    return this.workspacesService.inviteMember(
      user.sub,
      workspaceId,
      dto.email,
    );
  }

  @Delete(':id/members/:userId')
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
    @Param('userId', new ParseUUIDPipe()) memberUserId: string,
  ) {
    return this.workspacesService.removeMember(
      user.sub,
      workspaceId,
      memberUserId,
    );
  }
}
