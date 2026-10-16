import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceRole } from './workspace-role.enum';

describe('WorkspacesService authorization', () => {
  let service: WorkspacesService;
  const prisma = {
    $transaction: jest.fn(),
    workspace: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    workspaceMember: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(WorkspacesService);
  });

  it('does not query workspace data for a non-member', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    await expect(service.findOne('user-id', 'workspace-id')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.workspace.findUnique).not.toHaveBeenCalled();
  });

  it('requires owner/admin membership to update workspace data', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.MEMBER,
    });

    await expect(
      service.update('user-id', 'workspace-id', { name: 'Changed' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.workspace.update).not.toHaveBeenCalled();
  });

  it('requires owner/admin membership before looking up an invitee', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    await expect(
      service.inviteMember(
        'outsider-id',
        'workspace-id',
        'invitee@example.invalid',
      ),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.workspaceMember.create).not.toHaveBeenCalled();
  });

  it('requires owner/admin membership before reading the target to remove', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    await expect(
      service.removeMember('outsider-id', 'workspace-id', 'target-id'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.workspaceMember.delete).not.toHaveBeenCalled();
  });
});
