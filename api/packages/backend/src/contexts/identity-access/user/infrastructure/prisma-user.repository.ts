import { Injectable } from '@nestjs/common';
import { UserCreateData, UserRepository } from '../domain/user.repository';
import { User } from '../domain/user.entity';
import { PrismaService } from 'src/shared/infrastructure/prisma/prisma.service';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {} 

  private toDomain(row: any): User {
    return new User(
      row.id,
      row.email,
      row.name,
      row.password,
      row.role,
      row.status,
    );
  }

  async findAll(): Promise<User[]> {
    const users = await this.prisma.user.findMany();
    return users.map((user) => this.toDomain(user));
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user ? this.toDomain(user) : null;
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.toDomain(user) : null;
  }

  async create(user: UserCreateData) {
    const row = await this.prisma.user.create({ data: user });
    return this.toDomain(row);
  }
}
