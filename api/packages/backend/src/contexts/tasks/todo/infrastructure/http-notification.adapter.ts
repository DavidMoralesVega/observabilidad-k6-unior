import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationPort,
  SendNotificationData,
} from '../domain/notification.port';

@Injectable()
export class HttpNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger(HttpNotificationAdapter.name);
  private readonly notificationUrl: string;

  constructor(private readonly config: ConfigService) {
    this.notificationUrl = this.config.get<string>(
      'NOTIFICATION_SERVICE_URL',
      'http://localhost:3060',
    );
  }

  async send(data: SendNotificationData): Promise<void> {
    try {
      const res = await fetch(`${this.notificationUrl}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        this.logger.warn(
          `Notification failed: ${res.status} ${res.statusText}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Notification service unreachable: ${(error as Error).message}`,
      );
    }
  }
}
