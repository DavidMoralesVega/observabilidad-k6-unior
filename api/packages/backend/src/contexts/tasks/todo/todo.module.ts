import { Module } from '@nestjs/common';
import { TodoService } from './application/todo.service';
import { TodoRepository } from './domain/todo.repository';
import { PrismaTodoRepository } from './infrastructure/prisma-todo.repository';
import { NotificationPort } from './domain/notification.port';
import { HttpNotificationAdapter } from './infrastructure/http-notification.adapter';

@Module({
  providers: [
    TodoService,
    {
      provide: TodoRepository,
      useClass: PrismaTodoRepository,
    },
    {
      provide: NotificationPort,
      useClass: HttpNotificationAdapter,
    },
  ],
  exports: [TodoService, NotificationPort],
})
export class TodoModule {}
