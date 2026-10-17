import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { EmailService } from './email.service';
import { TaskAssignedNotification } from './notification.types';

describe('EmailService', () => {
  let service: EmailService;
  const sendMail = jest.fn();
  const transporter = nodemailer.createTransport({ jsonTransport: true });
  let createTransportSpy: jest.SpyInstance;

  const notification: TaskAssignedNotification = {
    taskId: 'task/id',
    taskTitle: '<Release & verify>',
    projectName: 'Project "One"',
    assigneeName: 'Assignee',
    assigneeEmail: 'assignee@example.invalid',
    assignedByName: "O'Neil",
  };
  const configValues: Record<string, string | number | boolean> = {
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_SECURE: false,
    SMTP_FROM: 'noreply@localhost',
    APP_URL: 'http://localhost:5173/',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(transporter, 'sendMail').mockImplementation(sendMail);
    createTransportSpy = jest
      .spyOn(nodemailer, 'createTransport')
      .mockReturnValue(transporter);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => configValues[key],
            get: (key: string) => configValues[key],
          },
        },
      ],
    }).compile();
    service = module.get(EmailService);
  });

  afterEach(() => {
    createTransportSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('sends task assignment email through configured SMTP transport', async () => {
    sendMail.mockResolvedValue({ messageId: 'mailpit-message-id' });

    await expect(service.sendTaskAssigned(notification)).resolves.toEqual({
      messageId: 'mailpit-message-id',
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'localhost',
      port: 1025,
      secure: false,
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: 'noreply@localhost',
      to: { name: 'Assignee', address: 'assignee@example.invalid' },
      subject: 'You have been assigned: <Release & verify>',
      text: 'O\'Neil assigned you "<Release & verify>" in Project "One".\n\nView task: http://localhost:5173/tasks/task%2Fid',
      html: '<p>O&#39;Neil assigned you <strong>&lt;Release &amp; verify&gt;</strong> in Project &quot;One&quot;.</p><p><a href="http://localhost:5173/tasks/task%2Fid">View task</a></p>',
    });
  });

  it('propagates SMTP failures so BullMQ can retry the job', async () => {
    const smtpError = new Error('SMTP unavailable');
    sendMail.mockRejectedValue(smtpError);

    await expect(service.sendTaskAssigned(notification)).rejects.toBe(
      smtpError,
    );
  });
});
