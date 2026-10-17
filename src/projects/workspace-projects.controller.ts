import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { ApiUuidParams } from '../common/decorators/api-uuid-params.decorator';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/current-user.decorator';
import { WorkspaceRole } from '../workspaces/workspace-role.enum';
import { WorkspaceRoles } from '../workspaces/workspace-roles.decorator';
import { WorkspaceRolesGuard } from '../workspaces/workspace-roles.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectsService } from './projects.service';

@Controller('workspaces/:workspaceId/projects')
@UseGuards(AccessTokenGuard, WorkspaceRolesGuard)
@ApiTags('Projects')
@ApiBearerAuth()
export class WorkspaceProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a project in a workspace' })
  @ApiUuidParams('workspaceId')
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  create(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(user.sub, workspaceId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List projects in a workspace' })
  @ApiUuidParams('workspaceId')
  @WorkspaceRoles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
  )
  findAll(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
  ) {
    return this.projectsService.findAll(user.sub, workspaceId);
  }
}
