import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import { TaskAssignedNotification } from './notification.types';

export interface SentEmail {
  messageId: string;
}

@Injectable()
export class EmailService {
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly appUrl: string;

  constructor(config: ConfigService) {
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');

    this.transporter = nodemailer.createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port: config.getOrThrow<number>('SMTP_PORT'),
      secure: config.getOrThrow<boolean>('SMTP_SECURE'),
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
    this.from = config.getOrThrow<string>('SMTP_FROM');
    this.appUrl = config.getOrThrow<string>('APP_URL').replace(/\/$/, '');
  }

  async sendTaskAssigned(
    notification: TaskAssignedNotification,
  ): Promise<SentEmail> {
    const taskTitle = escapeHtml(notification.taskTitle);
    const projectName = escapeHtml(notification.projectName);
    const assignedByName = escapeHtml(notification.assignedByName);
    const taskUrl = `${this.appUrl}/tasks/${encodeURIComponent(notification.taskId)}`;

    const result = await this.transporter.sendMail({
      from: this.from,
      to: {
        name: notification.assigneeName,
        address: notification.assigneeEmail,
      },
      subject: `You have been assigned: ${notification.taskTitle}`,
      text: `${notification.assignedByName} assigned you "${notification.taskTitle}" in ${notification.projectName}.\n\nView task: ${taskUrl}`,
      html: [
        `<p>${assignedByName} assigned you <strong>${taskTitle}</strong> in ${projectName}.</p>`,
        `<p><a href="${taskUrl}">View task</a></p>`,
      ].join(''),
    });

    return { messageId: result.messageId };
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}
