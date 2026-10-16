import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
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
