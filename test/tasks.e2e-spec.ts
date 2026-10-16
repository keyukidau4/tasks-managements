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
}

interface TaskResponse {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  dueDate: string | null;
}

function envelopeData<T>(body: unknown): T {
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    throw new Error('Expected a successful API response envelope');
  }
  return body.data as T;
}

describe('Tasks (e2e)', () => {
  let app: INestApplication<App>;
  const userIds: string[] = [];
  let workspaceIds: string[] = [];
  let projectIds: string[] = [];
  let taskIds: string[] = [];

  async function createAuthenticatedUser() {
    const email = `task-${randomUUID()}@example.invalid`;
    const password = 'task-test-password';
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, name: 'Task Test User', password })
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
      .send({ name: 'Task Test Workspace' })
      .expect(201);
    const workspace = envelopeData<{ id: string }>(response.body);
    workspaceIds.push(workspace.id);
    return workspace;
  }

  async function createProject(token: string, workspaceId: string) {
    const response = await request(app.getHttpServer())
      .post(`/workspaces/${workspaceId}/projects`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Task Test Project' })
      .expect(201);
    const project = envelopeData<ProjectResponse>(response.body);
    projectIds.push(project.id);
    return project;
  }

  beforeEach(async () => {
    workspaceIds = [];
    projectIds = [];
    taskIds = [];
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
    if (taskIds.length) {
      await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    }
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

  it('creates, lists, reads, updates, and soft-deletes tasks', async () => {
    const owner = await createAuthenticatedUser();
    const workspace = await createWorkspace(owner.accessToken);
    const project = await createProject(owner.accessToken, workspace.id);
    const dueDate = '2030-04-05T10:00:00.000Z';

    const created = await request(app.getHttpServer())
      .post(`/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        title: '  Prepare release  ',
        description: '  Verify all changes  ',
        dueDate,
      })
      .expect(201);
    const task = envelopeData<TaskResponse>(created.body);
    taskIds.push(task.id);
    expect(task).toMatchObject({
      projectId: project.id,
      title: 'Prepare release',
      description: 'Verify all changes',
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate,
    });

    const listed = await request(app.getHttpServer())
      .get(`/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(envelopeData<TaskResponse[]>(listed.body)).toHaveLength(1);

    const detail = await request(app.getHttpServer())
      .get(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(envelopeData<TaskResponse>(detail.body).id).toBe(task.id);

    const updated = await request(app.getHttpServer())
      .patch(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        title: '  Release completed  ',
        description: null,
        dueDate: null,
      })
      .expect(200);
    expect(envelopeData<TaskResponse>(updated.body)).toMatchObject({
      title: 'Release completed',
      description: null,
      dueDate: null,
    });

    await request(app.getHttpServer())
      .delete(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(envelopeData(body)).toEqual({ deleted: true });
      });

    const persisted = await app.get(PrismaService).task.findUniqueOrThrow({
      where: { id: task.id },
      select: { deletedAt: true },
    });
    expect(persisted.deletedAt).toBeInstanceOf(Date);

    await request(app.getHttpServer())
      .get(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(404);
    const tasksAfterDelete = await request(app.getHttpServer())
      .get(`/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(envelopeData<TaskResponse[]>(tasksAfterDelete.body)).toEqual([]);
  });

  it('allows workspace members to manage tasks but blocks outsiders', async () => {
    const owner = await createAuthenticatedUser();
    const member = await createAuthenticatedUser();
    const outsider = await createAuthenticatedUser();
    const workspace = await createWorkspace(owner.accessToken);
    const project = await createProject(owner.accessToken, workspace.id);
    await app.get(PrismaService).workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: member.user.id,
        role: 'MEMBER',
      },
    });

    const created = await request(app.getHttpServer())
      .post(`/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ title: 'Member-created task' })
      .expect(201);
    const task = envelopeData<TaskResponse>(created.body);
    taskIds.push(task.id);

    await request(app.getHttpServer())
      .get(`/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ title: 'Member-updated task' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .send({ title: 'Outsider task' })
      .expect(404);
    await request(app.getHttpServer())
      .get(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(404);
  });

  it('validates IDs, titles, dates, and empty updates', async () => {
    const owner = await createAuthenticatedUser();
    const workspace = await createWorkspace(owner.accessToken);
    const project = await createProject(owner.accessToken, workspace.id);

    await request(app.getHttpServer())
      .post(`/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: ' ' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Bad date', dueDate: 'not-a-date' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/tasks/not-a-uuid')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(400);

    const created = await request(app.getHttpServer())
      .post(`/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Empty Update Validation' })
      .expect(201);
    const task = envelopeData<TaskResponse>(created.body);
    taskIds.push(task.id);
    await request(app.getHttpServer())
      .patch(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({})
      .expect(400);
  });
});
