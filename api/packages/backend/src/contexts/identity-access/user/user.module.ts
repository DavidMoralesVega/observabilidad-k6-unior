import { Module } from '@nestjs/common';
import { UserService } from './application/user.service';
import { UserRepository } from './domain/user.repository';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { NotificationPort } from 'src/contexts/tasks/todo/domain/notification.port';
import { HttpNotificationAdapter } from 'src/contexts/tasks/todo/infrastructure/http-notification.adapter';

@Module({
  imports: [],
  providers: [
    UserService,
    {
      provide: UserRepository,
      useClass: PrismaUserRepository,
    },
    {
      provide: NotificationPort,
      useClass: HttpNotificationAdapter,
    },
  ],
  exports: [UserService, UserRepository],
})
export class UserModule {}
