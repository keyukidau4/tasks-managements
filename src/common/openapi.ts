import {
  DocumentBuilder,
  OpenAPIObject,
  OperationObject,
  SwaggerModule,
} from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

const errorStatuses: Record<string, string> = {
  '400': 'Invalid request or validation failure',
  '401': 'Authentication required or invalid',
  '403': 'Insufficient role for this operation',
  '404': 'Resource not found or outside the caller workspace',
  '409': 'Request conflicts with current resource state',
  '429': 'Rate limit exceeded',
  '500': 'Unexpected server error',
};

export function setupOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Task Management API')
    .setDescription(
      'REST API for authentication, workspaces, projects, tasks, comments, attachments, and statistics. All responses use the documented success/error envelope.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = applyResponseEnvelopeSchemas(
    SwaggerModule.createDocument(app, config),
  );
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
  });
}

export function applyResponseEnvelopeSchemas(
  document: OpenAPIObject,
): OpenAPIObject {
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas.SuccessEnvelope = {
    type: 'object',
    required: ['success', 'data'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: {
        description:
          'The endpoint response payload. Its shape is documented by the endpoint DTO or response description.',
        nullable: true,
      },
    },
  };
  document.components.schemas.ErrorEnvelope = {
    type: 'object',
    required: ['success', 'error'],
    properties: {
      success: { type: 'boolean', enum: [false] },
      error: {
        type: 'object',
        required: ['code', 'message', 'details'],
        properties: {
          code: {
            type: 'string',
            enum: [
              'VALIDATION_ERROR',
              'UNAUTHORIZED',
              'FORBIDDEN',
              'RESOURCE_NOT_FOUND',
              'CONFLICT',
              'TOO_MANY_REQUESTS',
              'INTERNAL_SERVER_ERROR',
            ],
          },
          message: { type: 'string' },
          details: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  };

  for (const pathItem of Object.values(document.paths)) {
    for (const operation of Object.values(pathItem)) {
      if (
        !operation ||
        typeof operation !== 'object' ||
        !('responses' in operation)
      ) {
        continue;
      }
      const apiOperation = operation as OperationObject;
      const successStatus =
        apiOperation.responses['201'] !== undefined ? '201' : '200';
      apiOperation.responses[successStatus] = {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/SuccessEnvelope' },
          },
        },
      };

      for (const [status, description] of Object.entries(errorStatuses)) {
        apiOperation.responses[status] = {
          description,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorEnvelope' },
            },
          },
        };
      }
    }
  }

  return document;
}
