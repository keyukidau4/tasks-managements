import * as Joi from 'joi';

const validOrigins = (value: string, helpers: Joi.CustomHelpers) => {
  const origins = value.split(',').map((origin) => origin.trim());

  if (
    origins.some((origin) => {
      try {
        const url = new URL(origin);
        return (
          !['http:', 'https:'].includes(url.protocol) ||
          url.origin !== origin ||
          url.username.length > 0 ||
          url.password.length > 0
        );
      } catch {
        return true;
      }
    })
  ) {
    return helpers.error('any.invalid');
  }

  return value;
};

export const configurationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .default(
      'postgresql://task_app:task_app_local@localhost:5432/task_management?schema=public',
    ),
  MINIO_ENDPOINT: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:9000'),
  MINIO_ACCESS_KEY: Joi.string().min(1).optional(),
  MINIO_SECRET_KEY: Joi.string().min(1).optional(),
  MINIO_BUCKET: Joi.string()
    .pattern(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)
    .default('task-attachments'),
  JWT_ACCESS_SECRET: Joi.string().min(32).when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  CORS_ORIGINS: Joi.string()
    .custom(validOrigins, 'comma-separated HTTP origins')
    .default('http://localhost:5173'),
  LOG_LEVEL: Joi.string()
    .valid('trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent')
    .default('info'),
});
