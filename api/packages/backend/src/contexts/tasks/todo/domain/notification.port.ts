export interface SendNotificationData {
  userId: string;
  type: 'TASK_CREATED' | 'TASK_COMPLETED' | 'TASK_DUE_SOON';
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export abstract class NotificationPort {
  abstract send(data: SendNotificationData): Promise<void>;
}
