import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesController } from './workspaces.controller';
import { WorkspaceRolesGuard } from './workspace-roles.guard';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [AuthModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceRolesGuard],
  exports: [WorkspaceRolesGuard],
})
export class WorkspacesModule {}
