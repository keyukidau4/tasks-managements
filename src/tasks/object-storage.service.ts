import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';

@Injectable()
export class ObjectStorageService implements OnModuleDestroy {
  private client?: S3Client;

  constructor(private readonly config: ConfigService) {}

  onModuleDestroy(): void {
    this.client?.destroy();
  }

  async upload(key: string, contentType: string, body: Buffer): Promise<void> {
    const client = this.getClient();
    const bucket = this.config.getOrThrow<string>('MINIO_BUCKET');

    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (error) {
      if (
        !(error instanceof S3ServiceException) ||
        error.$metadata.httpStatusCode !== 404
      ) {
        throw error;
      }
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    }

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentLength: body.byteLength,
        ContentType: contentType,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.getClient().send(
      new DeleteObjectCommand({
        Bucket: this.config.getOrThrow<string>('MINIO_BUCKET'),
        Key: key,
      }),
    );
  }

  private getClient(): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        endpoint: this.config.getOrThrow<string>('MINIO_ENDPOINT'),
        region: 'us-east-1',
        forcePathStyle: true,
        credentials: {
          accessKeyId: this.config.getOrThrow<string>('MINIO_ACCESS_KEY'),
          secretAccessKey: this.config.getOrThrow<string>('MINIO_SECRET_KEY'),
        },
      });
    }
    return this.client;
  }
}
