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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { ApiUuidParams } from '../common/decorators/api-uuid-params.decorator';
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
@ApiTags('Workspaces')
@ApiBearerAuth()
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a workspace' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(user.sub, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workspace' })
  @ApiUuidParams('id')
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
  @ApiOperation({ summary: 'Update a workspace' })
  @ApiUuidParams('id')
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(user.sub, workspaceId, dto);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Invite a workspace member' })
  @ApiUuidParams('id')
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
  @ApiOperation({ summary: 'Remove a workspace member' })
  @ApiUuidParams('id', 'userId')
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
