import { configurationSchema } from './configuration.schema';

describe('configurationSchema JWT secret validation', () => {
  const productionConfig = {
    NODE_ENV: 'production',
    REDIS_PASSWORD: 'test-redis-password',
    DATABASE_URL: 'postgresql://app:password@localhost:5432/tasks',
  };

  it('requires a strong JWT access secret in production', () => {
    const { error } = configurationSchema.validate(productionConfig);
    expect(error?.details[0].path).toContain('JWT_ACCESS_SECRET');
  });

  it('rejects short production JWT access secrets', () => {
    const { error } = configurationSchema.validate({
      ...productionConfig,
      JWT_ACCESS_SECRET: 'short',
    });
    expect(error?.details[0].path).toContain('JWT_ACCESS_SECRET');
  });

  it('accepts a production secret of at least 32 characters', () => {
    const { error } = configurationSchema.validate({
      ...productionConfig,
      JWT_ACCESS_SECRET: 'a'.repeat(32),
    });
    expect(error).toBeUndefined();
  });

  it('accepts optional MinIO credentials', () => {
    const { error } = configurationSchema.validate({
      ...productionConfig,
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      MINIO_ACCESS_KEY: 'local-access-key',
      MINIO_SECRET_KEY: 'local-secret-key',
    });

    expect(error).toBeUndefined();
  });
});

describe('configurationSchema Redis validation', () => {
  it('provides local Redis connection defaults', () => {
    const result = configurationSchema.validate({
      NODE_ENV: 'development',
    });
    expect(result.error).toBeUndefined();
    expect(result).toMatchObject({
      value: {
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
      },
    });
  });

  it('requires a Redis password in production', () => {
    const { error } = configurationSchema.validate({
      NODE_ENV: 'production',
    });

    expect(error).toBeDefined();
  });
});
