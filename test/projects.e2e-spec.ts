import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

jest.setTimeout(30_000);

interface AuthResponse {
  user: { id: string };
  accessToken: string;
}

interface ProjectResponse {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  dueDate: string | null;
}

function envelopeData<T>(body: unknown): T {
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    throw new Error('Expected a successful API response envelope');
  }
  return body.data as T;
}

describe('Projects (e2e)', () => {
  let app: INestApplication<App>;
  const userIds: string[] = [];
  let workspaceIds: string[] = [];
  let projectIds: string[] = [];

  async function createAuthenticatedUser() {
    const email = `project-${randomUUID()}@example.invalid`;
    const password = 'project-test-password';
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, name: 'Project Test User', password })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const auth = envelopeData<AuthResponse>(login.body);
    userIds.push(auth.user.id);
    return auth;
  }

  async function createWorkspace(token: string) {
    const response = await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Project Test Workspace' })
      .expect(201);
    const workspace = envelopeData<{ id: string }>(response.body);
    workspaceIds.push(workspace.id);
    return workspace;
  }

  beforeEach(async () => {
    workspaceIds = [];
    projectIds = [];
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
    if (projectIds.length) {
      await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
    }
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

  it('creates, lists, reads, updates, and soft-deletes projects', async () => {
    const owner = await createAuthenticatedUser();
    const workspace = await createWorkspace(owner.accessToken);
    const dueDate = '2030-04-05T10:00:00.000Z';

    const created = await request(app.getHttpServer())
      .post(`/workspaces/${workspace.id}/projects`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: '  Roadmap  ',
        description: '  Initial scope  ',
        dueDate,
      })
      .expect(201);
    const project = envelopeData<ProjectResponse>(created.body);
    projectIds.push(project.id);
    expect(project).toMatchObject({
      workspaceId: workspace.id,
      name: 'Roadmap',
      description: 'Initial scope',
      dueDate,
    });

    const listed = await request(app.getHttpServer())
      .get(`/workspaces/${workspace.id}/projects`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(envelopeData<ProjectResponse[]>(listed.body)).toHaveLength(1);

    const detail = await request(app.getHttpServer())
      .get(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(envelopeData<ProjectResponse>(detail.body).id).toBe(project.id);

    const updated = await request(app.getHttpServer())
      .patch(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: '  Delivery Plan  ', description: null, dueDate: null })
      .expect(200);
    expect(envelopeData<ProjectResponse>(updated.body)).toMatchObject({
      name: 'Delivery Plan',
      description: null,
      dueDate: null,
    });

    await request(app.getHttpServer())
      .delete(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(envelopeData(body)).toEqual({ deleted: true });
      });

    const persisted = await app.get(PrismaService).project.findUniqueOrThrow({
      where: { id: project.id },
      select: { deletedAt: true },
    });
    expect(persisted.deletedAt).toBeInstanceOf(Date);

    await request(app.getHttpServer())
      .get(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(404);
    const projectsAfterDelete = await request(app.getHttpServer())
      .get(`/workspaces/${workspace.id}/projects`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(envelopeData<ProjectResponse[]>(projectsAfterDelete.body)).toEqual(
      [],
    );
  });

  it('allows members to read but restricts writes to owners and admins', async () => {
    const owner = await createAuthenticatedUser();
    const admin = await createAuthenticatedUser();
    const member = await createAuthenticatedUser();
    const outsider = await createAuthenticatedUser();
    const workspace = await createWorkspace(owner.accessToken);
    const prisma = app.get(PrismaService);
    await prisma.workspaceMember.createMany({
      data: [
        { workspaceId: workspace.id, userId: admin.user.id, role: 'ADMIN' },
        { workspaceId: workspace.id, userId: member.user.id, role: 'MEMBER' },
      ],
    });
    const created = await request(app.getHttpServer())
      .post(`/workspaces/${workspace.id}/projects`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Member Access' })
      .expect(201);
    const project = envelopeData<ProjectResponse>(created.body);
    projectIds.push(project.id);

    await request(app.getHttpServer())
      .patch(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ name: 'Admin Updated Project' })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/workspaces/${workspace.id}/projects`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ name: 'Member Cannot Edit' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/workspaces/${workspace.id}/projects`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ name: 'Member Cannot Create' })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/workspaces/${workspace.id}/projects`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .send({ name: 'Outsider Cannot Edit' })
      .expect(404);
  });

  it('validates project IDs, names, dates, and empty updates', async () => {
    const owner = await createAuthenticatedUser();
    const workspace = await createWorkspace(owner.accessToken);

    await request(app.getHttpServer())
      .post(`/workspaces/${workspace.id}/projects`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Invalid Date', dueDate: 'not-a-date' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/workspaces/${workspace.id}/projects`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: ' ' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/projects/not-a-uuid')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(400);
    const created = await request(app.getHttpServer())
      .post(`/workspaces/${workspace.id}/projects`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Empty Update Validation' })
      .expect(201);
    const project = envelopeData<ProjectResponse>(created.body);
    projectIds.push(project.id);
    await request(app.getHttpServer())
      .patch(`/projects/${project.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({})
      .expect(400);
  });
});
