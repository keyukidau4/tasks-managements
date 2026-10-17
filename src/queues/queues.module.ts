import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationProcessor } from './notification.processor';
import { NOTIFICATIONS_QUEUE } from './queue.constants';

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
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      },
    }),
  ],
  providers: [NotificationProcessor],
  exports: [BullModule],
})
export class QueuesModule {}
