import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  NOTIFICATION_JOB_OPTIONS,
  NOTIFICATIONS_QUEUE,
  TASK_ASSIGNED_JOB,
} from './queue.constants';
import { EmailService } from './email.service';
import { TaskAssignedNotification } from './notification.types';

@Processor(NOTIFICATIONS_QUEUE, { concurrency: 5 })
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(
    job: Job<TaskAssignedNotification>,
  ): Promise<{ messageId: string }> {
    if (job.name !== TASK_ASSIGNED_JOB) {
      throw new Error(`Unsupported notification job: ${job.name}`);
    }

    const result = await this.emailService.sendTaskAssigned(job.data);
    this.logger.log(
      `Sent task assignment email for job ${job.id ?? 'unknown'} (${result.messageId})`,
    );
    return result;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    const attempts = job?.opts.attempts ?? NOTIFICATION_JOB_OPTIONS.attempts;
    const attempt = job?.attemptsMade ?? 0;
    const message = `Notification job ${job?.id ?? 'unknown'} (${job?.name ?? 'unknown'}) failed on attempt ${attempt}/${attempts}: ${error.message}`;

    if (attempt >= attempts) {
      this.logger.error(`${message}; retained as a failed job`, error.stack);
      return;
    }
    this.logger.warn(`${message}; retry scheduled`);
  }

  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.logger.error(
      `Notification worker error: ${error.message}`,
      error.stack,
    );
  }
}
