import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { EmailService } from './email.service';
import { NotificationProcessor } from './notification.processor';
import { NOTIFICATION_JOB_OPTIONS, TASK_ASSIGNED_JOB } from './queue.constants';
import { TaskAssignedNotification } from './notification.types';

describe('NotificationProcessor', () => {
  const emailService = {
    sendTaskAssigned: jest.fn(),
  };
  let processor: NotificationProcessor;
  let module: TestingModule;
  const notification: TaskAssignedNotification = {
    taskId: 'task-id',
    taskTitle: 'Task title',
    projectName: 'Project name',
    assigneeName: 'Assignee',
    assigneeEmail: 'assignee@example.invalid',
    assignedByName: 'Task creator',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    module = await Test.createTestingModule({
      providers: [
        NotificationProcessor,
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();
    processor = module.get(NotificationProcessor);
  });

  afterEach(async () => {
    await module.close();
  });

  it('sends a task-assigned email and returns its message ID', async () => {
    emailService.sendTaskAssigned.mockResolvedValue({
      messageId: 'mailpit-message-id',
    });
    const job = {
      id: 'job-id',
      name: TASK_ASSIGNED_JOB,
      data: notification,
    } as Job<TaskAssignedNotification>;

    await expect(processor.process(job)).resolves.toEqual({
      messageId: 'mailpit-message-id',
    });
    expect(emailService.sendTaskAssigned).toHaveBeenCalledWith(notification);
  });

  it('propagates send failures to trigger the configured retries', async () => {
    const smtpError = new Error('SMTP unavailable');
    emailService.sendTaskAssigned.mockRejectedValue(smtpError);
    const job = {
      id: 'job-id',
      name: TASK_ASSIGNED_JOB,
      data: notification,
    } as Job<TaskAssignedNotification>;

    await expect(processor.process(job)).rejects.toBe(smtpError);
  });

  it('retains failed jobs for inspection after the maximum attempts', () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const job = {
      id: 'job-id',
      name: TASK_ASSIGNED_JOB,
      attemptsMade: NOTIFICATION_JOB_OPTIONS.attempts,
      opts: { attempts: NOTIFICATION_JOB_OPTIONS.attempts },
    } as Job;

    processor.onFailed(job, new Error('SMTP unavailable'));

    expect(NOTIFICATION_JOB_OPTIONS).toMatchObject({
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnFail: { count: 1000 },
    });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('failed on attempt 3/3'),
      expect.any(String),
    );
  });

  it('logs intermediate failures as scheduled retries', () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const job = {
      id: 'job-id',
      name: TASK_ASSIGNED_JOB,
      attemptsMade: 1,
      opts: { attempts: 3 },
    } as Job;

    processor.onFailed(job, new Error('SMTP unavailable'));

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'failed on attempt 1/3: SMTP unavailable; retry scheduled',
      ),
    );
  });

  it('rejects unknown notification job types', async () => {
    const job = {
      id: 'job-id',
      name: 'unknown',
      data: notification,
    } as Job<TaskAssignedNotification>;

    await expect(processor.process(job)).rejects.toThrow(
      'Unsupported notification job: unknown',
    );
    expect(emailService.sendTaskAssigned).not.toHaveBeenCalled();
  });
});
