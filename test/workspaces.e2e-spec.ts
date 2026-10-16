import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(30_000);

interface WorkspaceResponse {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  members?: Array<{
    role: string;
    user: { id: string; email: string; name: string };
  }>;
}

interface UserResponse {
  id: string;
}

interface AuthResponse {
  user: UserResponse;
  accessToken: string;
}

interface WorkspaceMemberResponse {
  role: string;
  user: {
    id: string;
    email: string;
    name: string;
    passwordHash?: string;
  };
}

function envelopeData<T>(body: unknown): T {
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    throw new Error('Expected a successful API response envelope');
  }
  return body.data as T;
}

describe('Workspaces (e2e)', () => {
  let app: INestApplication<App>;
  const userIds: string[] = [];
  let workspaceIds: string[] = [];

  async function createAuthenticatedUser() {
    const email = `workspace-${randomUUID()}@example.invalid`;
    const password = 'workspace-test-password';
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, name: 'Workspace Test User', password })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const auth = envelopeData<AuthResponse>(login.body);
    userIds.push(auth.user.id);
    return auth;
  }

  beforeEach(async () => {
    workspaceIds = [];
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    const prisma = app.get(PrismaService);
    if (workspaceIds.length) {
      await prisma.workspace.deleteMany({
        where: { id: { in: workspaceIds } },
      });
    }
    if (userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      userIds.length = 0;
    }
    await app.close();
  });

  it('requires authentication and creates an owner membership atomically', async () => {
    await request(app.getHttpServer())
      .post('/workspaces')
      .send({ name: 'No token' })
      .expect(401);

    const owner = await createAuthenticatedUser();
    const response = await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: '  Product Team  ', description: '  Product work  ' })
      .expect(201);

    const workspace = envelopeData<WorkspaceResponse>(response.body);
    workspaceIds.push(workspace.id);
    expect(workspace).toMatchObject({
      name: 'Product Team',
      description: 'Product work',
      ownerId: owner.user.id,
    });

    const membership = await app.get(PrismaService).workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: owner.user.id,
        },
      },
    });
    expect(membership?.role).toBe('OWNER');
  });

  it('returns workspace details only to members and lets owners update them', async () => {
    const owner = await createAuthenticatedUser();
    const member = await createAuthenticatedUser();
    const outsider = await createAuthenticatedUser();
    const created = await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Shared Space' })
      .expect(201);
    const workspace = envelopeData<WorkspaceResponse>(created.body);
    workspaceIds.push(workspace.id);

    await app.get(PrismaService).workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: member.user.id,
        role: 'MEMBER',
      },
    });

    const detail = await request(app.getHttpServer())
      .get(`/workspaces/${workspace.id}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(200);
    const detailWorkspace = envelopeData<WorkspaceResponse>(detail.body);
    expect(detailWorkspace.members?.map(({ role }) => role)).toEqual([
      'OWNER',
      'MEMBER',
    ]);
    expect(detailWorkspace.members?.[0].user).not.toHaveProperty(
      'passwordHash',
    );

    await request(app.getHttpServer())
      .get(`/workspaces/${workspace.id}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(404);

    const updated = await request(app.getHttpServer())
      .patch(`/workspaces/${workspace.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: '  Renamed Space  ', description: 'Updated' })
      .expect(200);
    expect(envelopeData<WorkspaceResponse>(updated.body)).toMatchObject({
      id: workspace.id,
      name: 'Renamed Space',
      description: 'Updated',
    });

    const clearedDescription = await request(app.getHttpServer())
      .patch(`/workspaces/${workspace.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ description: null })
      .expect(200);
    expect(
      envelopeData<WorkspaceResponse>(clearedDescription.body).description,
    ).toBeNull();
  });

  it('allows admins to update but forbids members and outsiders', async () => {
    const owner = await createAuthenticatedUser();
    const admin = await createAuthenticatedUser();
    const member = await createAuthenticatedUser();
    const outsider = await createAuthenticatedUser();
    const created = await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Role Checks' })
      .expect(201);
    const workspace = envelopeData<WorkspaceResponse>(created.body);
    workspaceIds.push(workspace.id);

    const prisma = app.get(PrismaService);
    await prisma.workspaceMember.createMany({
      data: [
        { workspaceId: workspace.id, userId: admin.user.id, role: 'ADMIN' },
        { workspaceId: workspace.id, userId: member.user.id, role: 'MEMBER' },
      ],
    });

    await request(app.getHttpServer())
      .patch(`/workspaces/${workspace.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: 'Admin Updated' })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/workspaces/${workspace.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/workspaces/${workspace.id}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ name: 'Member Cannot Update' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/workspaces/${workspace.id}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .send({ name: 'Outsider Cannot Update' })
      .expect(404);
  });

  it('validates workspace IDs and rejects invalid or empty updates', async () => {
    const owner = await createAuthenticatedUser();
    await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: ' ' })
      .expect(400);

    await request(app.getHttpServer())
      .get('/workspaces/not-a-uuid')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(400);
  });

  it('invites existing users as members and enforces manager permissions', async () => {
    const owner = await createAuthenticatedUser();
    const admin = await createAuthenticatedUser();
    const member = await createAuthenticatedUser();
    const outsider = await createAuthenticatedUser();
    const invitee = await createAuthenticatedUser();
    const created = await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Member Invitations' })
      .expect(201);
    const workspace = envelopeData<WorkspaceResponse>(created.body);
    workspaceIds.push(workspace.id);

    const prisma = app.get(PrismaService);
    await prisma.workspaceMember.createMany({
      data: [
        { workspaceId: workspace.id, userId: admin.user.id, role: 'ADMIN' },
        { workspaceId: workspace.id, userId: member.user.id, role: 'MEMBER' },
      ],
    });

    await request(app.getHttpServer())
      .post(`/workspaces/${workspace.id}/members`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ email: 'not-an-email' })
      .expect(400);

    const inviteeRecord = await prisma.user.findUniqueOrThrow({
      where: { id: invitee.user.id },
      select: { email: true },
    });
    const invitation = await request(app.getHttpServer())
      .post(`/workspaces/${workspace.id}/members`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ email: inviteeRecord.email.toUpperCase() })
      .expect(201);
    const membership = envelopeData<WorkspaceMemberResponse>(invitation.body);
    expect(membership).toMatchObject({
      role: 'MEMBER',
      user: { id: invitee.user.id, email: inviteeRecord.email },
    });
    expect(membership.user).not.toHaveProperty('passwordHash');

    await request(app.getHttpServer())
      .post(`/workspaces/${workspace.id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'not-a-member-role@example.invalid', role: 'ADMIN' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/workspaces/${workspace.id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: inviteeRecord.email })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/workspaces/${workspace.id}/members`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ email: inviteeRecord.email })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/workspaces/${workspace.id}/members`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .send({ email: inviteeRecord.email })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/workspaces/${workspace.id}/members`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'missing@example.invalid' })
      .expect(404);
  });

  it('lets owners and admins remove members but protects workspace ownership', async () => {
    const owner = await createAuthenticatedUser();
    const admin = await createAuthenticatedUser();
    const member = await createAuthenticatedUser();
    const outsider = await createAuthenticatedUser();
    const created = await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Member Removal' })
      .expect(201);
    const workspace = envelopeData<WorkspaceResponse>(created.body);
    workspaceIds.push(workspace.id);

    await app.get(PrismaService).workspaceMember.createMany({
      data: [
        { workspaceId: workspace.id, userId: admin.user.id, role: 'ADMIN' },
        { workspaceId: workspace.id, userId: member.user.id, role: 'MEMBER' },
      ],
    });

    await request(app.getHttpServer())
      .delete(`/workspaces/${workspace.id}/members/${admin.user.id}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/workspaces/${workspace.id}/members/${admin.user.id}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/workspaces/${workspace.id}/members/${owner.user.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/workspaces/${workspace.id}/members/${member.user.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(envelopeData(body)).toEqual({ removed: true });
      });

    await request(app.getHttpServer())
      .delete(`/workspaces/${workspace.id}/members/${member.user.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(404);
  });
});
