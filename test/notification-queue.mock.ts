import { getQueueToken } from '@nestjs/bullmq';
import { NOTIFICATIONS_QUEUE } from '../src/queues/queue.constants';

export const notificationQueueMock = {
  add: jest.fn().mockResolvedValue(undefined),
};

export const notificationQueueProvider = {
  provide: getQueueToken(NOTIFICATIONS_QUEUE),
  useValue: notificationQueueMock,
};
