import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { NotificationProcessor } from './notification.processor';
import {
  NOTIFICATION_JOB_OPTIONS,
  NOTIFICATIONS_QUEUE,
} from './queue.constants';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      extraOptions: {
        manualRegistration: process.env.NODE_ENV === 'test',
      },
      useFactory: (config: ConfigService) => {
        const password = config.get<string>('REDIS_PASSWORD');
        return {
          connection: {
            host: config.getOrThrow<string>('REDIS_HOST'),
            port: config.getOrThrow<number>('REDIS_PORT'),
            ...(password ? { password } : {}),
            maxRetriesPerRequest: null,
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: NOTIFICATIONS_QUEUE,
      defaultJobOptions: NOTIFICATION_JOB_OPTIONS,
    }),
  ],
  providers: [EmailService, NotificationProcessor],
  exports: [BullModule, EmailService],
})
export class QueuesModule {}
