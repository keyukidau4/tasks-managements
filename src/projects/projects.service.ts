import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceRole } from '../workspaces/workspace-role.enum';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

const projectSelect = {
  id: true,
  workspaceId: true,
  name: true,
  description: true,
  dueDate: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProjectSelect;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, workspaceId: string, dto: CreateProjectDto) {
    await this.requireManagerMembership(userId, workspaceId);
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Project name must not be empty');
    }

    return this.prisma.project.create({
      data: {
        workspaceId,
        name,
        description: dto.description?.trim() || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        createdBy: userId,
      },
      select: projectSelect,
    });
  }

  async findAll(userId: string, workspaceId: string) {
    await this.requireMembership(userId, workspaceId);
    return this.prisma.project.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: projectSelect,
    });
  }

  async findOne(userId: string, projectId: string) {
    const project = await this.requireProjectMembership(userId, projectId);
    const result = await this.prisma.project.findFirst({
      where: { id: project.id, deletedAt: null },
      select: projectSelect,
    });
    if (!result) {
      throw new NotFoundException('Project not found');
    }
    return result;
  }

  async update(userId: string, projectId: string, dto: UpdateProjectDto) {
    const project = await this.requireProjectManager(userId, projectId);
    const changes: Prisma.ProjectUpdateInput = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('Project name must not be empty');
      }
      changes.name = name;
    }
    if (dto.description !== undefined) {
      changes.description = dto.description?.trim() || null;
    }
    if (dto.dueDate !== undefined) {
      changes.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (Object.keys(changes).length === 0) {
      throw new BadRequestException(
        'At least one project field must be provided',
      );
    }

    const result = await this.prisma.project.updateMany({
      where: { id: project.id, deletedAt: null },
      data: changes,
    });
    if (result.count === 0) {
      throw new NotFoundException('Project not found');
    }
    const updatedProject = await this.prisma.project.findFirst({
      where: { id: project.id, deletedAt: null },
      select: projectSelect,
    });
    if (!updatedProject) {
      throw new NotFoundException('Project not found');
    }
    return updatedProject;
  }

  async remove(userId: string, projectId: string): Promise<{ deleted: true }> {
    const project = await this.requireProjectManager(userId, projectId);
    const result = await this.prisma.project.updateMany({
      where: { id: project.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException('Project not found');
    }
    return { deleted: true };
  }

  private async requireMembership(userId: string, workspaceId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    });
    if (!membership) {
      throw new NotFoundException('Workspace not found');
    }
    return membership;
  }

  private async requireManagerMembership(userId: string, workspaceId: string) {
    const membership = await this.requireMembership(userId, workspaceId);
    if (
      membership.role !== WorkspaceRole.OWNER &&
      membership.role !== WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only workspace owners and admins can manage projects',
      );
    }
    return membership;
  }

  private async requireProjectMembership(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, workspaceId: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    await this.requireMembership(userId, project.workspaceId);
    return project;
  }

  private async requireProjectManager(userId: string, projectId: string) {
    const project = await this.requireProjectMembership(userId, projectId);
    await this.requireManagerMembership(userId, project.workspaceId);
    return project;
  }
}
