import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ObjectStorageService } from '../src/tasks/object-storage.service';

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
  version: number;
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
  const storage = {
    upload: jest.fn(),
    delete: jest.fn(),
  };
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
    storage.upload.mockReset().mockResolvedValue(undefined);
    storage.delete.mockReset().mockResolvedValue(undefined);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ObjectStorageService)
      .useValue(storage)
      .compile();

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
      await prisma.auditLog.deleteMany({
        where: { entityType: 'TASK', entityId: { in: taskIds } },
      });
    }
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
        status: 'IN_PROGRESS',
        priority: 'HIGH',
      })
      .expect(201);
    const task = envelopeData<TaskResponse>(created.body);
    taskIds.push(task.id);
    expect(task).toMatchObject({
      projectId: project.id,
      title: 'Prepare release',
      description: 'Verify all changes',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      dueDate,
    });
    await expect(
      app.get(PrismaService).auditLog.findMany({
        where: { entityType: 'TASK', entityId: task.id },
        select: { action: true, actorId: true },
        orderBy: { createdAt: 'asc' },
      }),
    ).resolves.toEqual([{ action: 'TASK_CREATED', actorId: owner.user.id }]);

    const listed = await request(app.getHttpServer())
      .get(`/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(
      envelopeData<{ items: TaskResponse[] }>(listed.body).items,
    ).toHaveLength(1);

    const detail = await request(app.getHttpServer())
      .get(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(envelopeData<TaskResponse>(detail.body).id).toBe(task.id);

    const updated = await request(app.getHttpServer())
      .patch(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        version: task.version,
        title: '  Release completed  ',
        description: null,
        dueDate: null,
        status: 'DONE',
        priority: 'URGENT',
      })
      .expect(200);
    expect(envelopeData<TaskResponse>(updated.body)).toMatchObject({
      title: 'Release completed',
      description: null,
      dueDate: null,
      status: 'DONE',
      priority: 'URGENT',
      version: 2,
    });
    await expect(
      app.get(PrismaService).auditLog.findMany({
        where: { entityType: 'TASK', entityId: task.id },
        select: { action: true, actorId: true },
        orderBy: { createdAt: 'asc' },
      }),
    ).resolves.toEqual([
      { action: 'TASK_CREATED', actorId: owner.user.id },
      { action: 'TASK_UPDATED', actorId: owner.user.id },
    ]);

    await request(app.getHttpServer())
      .patch(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ version: task.version, title: 'Stale update' })
      .expect(409);

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
    expect(
      envelopeData<{ items: TaskResponse[] }>(tasksAfterDelete.body).items,
    ).toEqual([]);
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
      .send({ version: task.version, title: 'Member-updated task' })
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

  it('filters, sorts, and paginates tasks with the documented defaults', async () => {
    const owner = await createAuthenticatedUser();
    const assignee = await createAuthenticatedUser();
    const workspace = await createWorkspace(owner.accessToken);
    const project = await createProject(owner.accessToken, workspace.id);
    await app.get(PrismaService).workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: assignee.user.id,
        role: 'MEMBER',
      },
    });

    async function addTask(
      title: string,
      status: string,
      priority: string,
      dueDate: string,
      assigneeId?: string,
    ) {
      const response = await request(app.getHttpServer())
        .post(`/projects/${project.id}/tasks`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ title, status, priority, dueDate, assigneeId })
        .expect(201);
      const task = envelopeData<TaskResponse>(response.body);
      taskIds.push(task.id);
      return task;
    }

    await addTask(
      'Early task',
      'IN_PROGRESS',
      'HIGH',
      '2030-04-01T00:00:00.000Z',
      assignee.user.id,
    );
    const later = await addTask(
      'Later task',
      'IN_PROGRESS',
      'HIGH',
      '2030-04-05T00:00:00.000Z',
      assignee.user.id,
    );
    await addTask('Different task', 'TODO', 'LOW', '2030-04-03T00:00:00.000Z');

    const defaults = await request(app.getHttpServer())
      .get(`/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    const defaultPage = envelopeData<{
      items: TaskResponse[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(defaults.body);
    expect(defaultPage.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 3,
      totalPages: 1,
    });

    const filtered = await request(app.getHttpServer())
      .get(`/projects/${project.id}/tasks`)
      .query({
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        assigneeId: assignee.user.id,
        dueDateFrom: '2030-04-01T00:00:00.000Z',
        dueDateTo: '2030-04-30T00:00:00.000Z',
        sortBy: 'dueDate',
        sortOrder: 'asc',
        page: '2',
        limit: '1',
      })
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    const filteredPage = envelopeData<{
      items: TaskResponse[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(filtered.body);
    expect(filteredPage.items.map(({ id }) => id)).toEqual([later.id]);
    expect(filteredPage.pagination).toEqual({
      page: 2,
      limit: 1,
      total: 2,
      totalPages: 2,
    });

    await request(app.getHttpServer())
      .get(`/projects/${project.id}/tasks`)
      .query({ status: 'INVALID' })
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/projects/${project.id}/tasks`)
      .query({ limit: '101' })
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/projects/${project.id}/tasks`)
      .query({ sortBy: 'createdBy' })
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/projects/${project.id}/tasks`)
      .query({
        dueDateFrom: '2030-05-01T00:00:00.000Z',
        dueDateTo: '2030-04-01T00:00:00.000Z',
      })
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(400);
  });

  it('creates and lists comments and uploads authorized attachments', async () => {
    const owner = await createAuthenticatedUser();
    const outsider = await createAuthenticatedUser();
    const workspace = await createWorkspace(owner.accessToken);
    const project = await createProject(owner.accessToken, workspace.id);
    const createdTask = await request(app.getHttpServer())
      .post(`/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Comments and attachments' })
      .expect(201);
    const task = envelopeData<TaskResponse>(createdTask.body);
    taskIds.push(task.id);

    const commentResponse = await request(app.getHttpServer())
      .post(`/tasks/${task.id}/comments`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ content: '  Please review this evidence  ' })
      .expect(201);
    expect(
      envelopeData<{ content: string; user: { id: string } }>(
        commentResponse.body,
      ),
    ).toMatchObject({
      content: 'Please review this evidence',
      user: { id: owner.user.id },
    });
    const comments = await request(app.getHttpServer())
      .get(`/tasks/${task.id}/comments`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(
      envelopeData<Array<{ content: string }>>(comments.body),
    ).toMatchObject([{ content: 'Please review this evidence' }]);
    await request(app.getHttpServer())
      .post(`/tasks/${task.id}/comments`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ content: '   ' })
      .expect(400);

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const uploaded = await request(app.getHttpServer())
      .post(`/tasks/${task.id}/attachments`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .attach('file', png, {
        filename: 'evidence.png',
        contentType: 'image/png',
      })
      .expect(201);
    expect(
      envelopeData<{
        fileName: string;
        contentType: string;
        fileSize: number;
        uploadedBy: string;
      }>(uploaded.body),
    ).toMatchObject({
      fileName: 'evidence.png',
      contentType: 'image/png',
      fileSize: png.byteLength,
      uploadedBy: owner.user.id,
    });
    expect(storage.upload).toHaveBeenCalledWith(
      expect.stringMatching(/\.png$/),
      'image/png',
      png,
    );

    const attachmentList = await request(app.getHttpServer())
      .get(`/tasks/${task.id}/attachments`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    expect(
      envelopeData<Array<{ fileName: string }>>(attachmentList.body),
    ).toMatchObject([{ fileName: 'evidence.png' }]);

    await request(app.getHttpServer())
      .post(`/tasks/${task.id}/attachments`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .attach('file', Buffer.from('%PDF-1.7\n'), {
        filename: 'forged.png',
        contentType: 'image/png',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/tasks/${task.id}/attachments`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), {
        filename: 'too-large.png',
        contentType: 'image/png',
      })
      .expect(413);
    expect(storage.upload).toHaveBeenCalledTimes(1);

    await request(app.getHttpServer())
      .get(`/tasks/${task.id}/comments`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/tasks/${task.id}/attachments`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .attach('file', png, {
        filename: 'outsider.png',
        contentType: 'image/png',
      })
      .expect(404);
    expect(storage.upload).toHaveBeenCalledTimes(1);
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
      .post(`/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Bad status', status: 'BLOCKED' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/projects/${project.id}/tasks`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Bad priority', priority: 'CRITICAL' })
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
    expect(task).toMatchObject({ status: 'TODO', priority: 'MEDIUM' });
    await request(app.getHttpServer())
      .patch(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ title: 'Missing version' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({})
      .expect(400);
  });
});
