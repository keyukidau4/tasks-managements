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
import { WorkspaceRole } from '../workspaces/workspace-role.enum';
import { WorkspaceRoles } from '../workspaces/workspace-roles.decorator';
import { ProjectRolesGuard } from './project-roles.guard';
import { ProjectsService } from './projects.service';
import { UpdateProjectDto } from './dto/update-project.dto';

@Controller('projects')
@UseGuards(AccessTokenGuard, ProjectRolesGuard)
@ApiTags('Projects')
@ApiBearerAuth()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get a project' })
  @ApiUuidParams('id')
  @WorkspaceRoles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
  )
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.projectsService.findOne(user.sub, projectId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  @ApiUuidParams('id')
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(user.sub, projectId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a project' })
  @ApiUuidParams('id')
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.projectsService.remove(user.sub, projectId);
  }
}
