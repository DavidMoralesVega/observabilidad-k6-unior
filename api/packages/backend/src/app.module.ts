import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ContextsModule } from './contexts/contexts.module';
import { AppsModule } from './apps/apps.module';
import { PrismaModule } from './shared/infrastructure/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ContextsModule,
    AppsModule,
    PrismaModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
