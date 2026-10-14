import { Module } from '@nestjs/common';
import { TasksModule } from './tasks/tasks.module';
import { IdentityAccessModule } from './identity-access/identity-access.module';

@Module({
  imports: [TasksModule, IdentityAccessModule],
  controllers: [],
  providers: [],
})
export class ContextsModule {}
