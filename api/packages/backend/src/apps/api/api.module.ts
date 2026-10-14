import { Module } from '@nestjs/common';
import { TodoController } from './todo.controller';
import { TodoModule } from 'src/contexts/tasks/todo/todo.module';
import { UserController } from './user.controller';
import { UserModule } from 'src/contexts/identity-access/user/user.module';
import { AuthController } from './auth.controller';
import { AuthModule } from 'src/contexts/identity-access/auth/auth.module';

@Module({
  imports: [TodoModule, UserModule, AuthModule],
  controllers: [TodoController, UserController, AuthController],
  providers: [],
})
export class ApiModule {}
