import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NOTIFICATIONS_QUEUE } from './queue.constants';

@Processor(NOTIFICATIONS_QUEUE, { concurrency: 5 })
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  process(job: Job): Promise<{ processed: true }> {
    this.logger.log(
      `Picked up notification job ${job.id ?? 'unknown'} (${job.name})`,
    );
    return Promise.resolve({ processed: true });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(
      `Notification job ${job?.id ?? 'unknown'} failed: ${error.message}`,
      error.stack,
    );
  }

  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.logger.error(
      `Notification worker error: ${error.message}`,
      error.stack,
    );
  }
}
