import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { setupOpenApi } from '../src/common/openapi';
import { notificationQueueProvider } from './notification-queue.mock';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(notificationQueueProvider.provide)
      .useValue(notificationQueueProvider.useValue)
      .compile();

    app = moduleFixture.createNestApplication();
    setupOpenApi(app);
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect({
      success: true,
      data: 'Hello World!',
    });
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({
        success: true,
        data: { status: 'ok' },
      });
  });

  it('publishes OpenAPI documentation for every API route and response envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const document = response.body as {
      paths: Record<
        string,
        Record<
          string,
          {
            security?: unknown[];
            responses: Record<string, unknown>;
            parameters?: { name: string; in: string }[];
            requestBody?: unknown;
          }
        >
      >;
      components: {
        schemas: Record<string, unknown>;
      };
    };

    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        '/auth/register',
        '/auth/login',
        '/auth/refresh',
        '/auth/logout',
        '/auth/me',
        '/workspaces',
        '/workspaces/{id}',
        '/workspaces/{id}/members',
        '/workspaces/{id}/members/{userId}',
        '/workspaces/{workspaceId}/projects',
        '/projects/{id}',
        '/projects/{id}/statistics/progress',
        '/projects/{projectId}/tasks',
        '/tasks/{id}',
        '/tasks/{id}/comments',
        '/tasks/{id}/attachments',
        '/workspaces/{id}/statistics/workload',
        '/workspaces/{id}/statistics/overdue',
        '/health',
        '/',
      ]),
    );
    for (const schema of [
      'RegisterDto',
      'LoginDto',
      'RefreshTokenDto',
      'CreateWorkspaceDto',
      'UpdateWorkspaceDto',
      'InviteWorkspaceMemberDto',
      'CreateProjectDto',
      'UpdateProjectDto',
      'CreateTaskDto',
      'UpdateTaskDto',
      'CreateTaskCommentDto',
      'ListTasksQueryDto',
      'SuccessEnvelope',
      'ErrorEnvelope',
    ]) {
      expect(document.components.schemas[schema]).toBeDefined();
    }
    expect(document.paths['/tasks/{id}'].patch.responses['409']).toEqual(
      expect.objectContaining({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorEnvelope' },
          },
        },
      }),
    );
    for (const status of ['400', '401', '403', '404', '409', '429', '500']) {
      expect(
        document.paths['/tasks/{id}'].patch.responses[status],
      ).toBeDefined();
    }
    expect(
      document.paths['/projects/{projectId}/tasks'].get.parameters?.some(
        ({ name, in: location }) => name === 'limit' && location === 'query',
      ),
    ).toBe(true);
    expect(
      document.paths['/tasks/{id}/attachments'].post.requestBody,
    ).toBeDefined();
    expect(document.paths['/tasks/{id}'].get.security).toEqual([
      { bearer: [] },
    ]);
  });

  it('returns a structured error for unknown routes', () => {
    return request(app.getHttpServer())
      .get('/not-found')
      .expect(404)
      .expect({
        success: false,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Cannot GET /not-found',
          details: [],
        },
      });
  });

  it('preserves a valid request ID in the response headers', () => {
    const requestId = '123e4567-e89b-42d3-a456-426614174000';

    return request(app.getHttpServer())
      .get('/health')
      .set('X-Request-Id', requestId)
      .expect(200)
      .expect('X-Request-Id', requestId);
  });

  afterEach(async () => {
    await app.close();
  });
});
