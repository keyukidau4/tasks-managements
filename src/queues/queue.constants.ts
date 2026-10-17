export const NOTIFICATIONS_QUEUE = 'notifications';
export const TASK_ASSIGNED_JOB = 'task-assigned';
export const NOTIFICATION_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 1000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 1000 },
};
