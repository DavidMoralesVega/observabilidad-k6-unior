import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/shared/infrastructure/prisma/prisma.service';
import { Todo } from '../domain/todo.entity';
import {
  CreateTodoData,
  TodoRepository,
  UpdateTodoData,
} from '../domain/todo.repository';

@Injectable()
export class PrismaTodoRepository implements TodoRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: any) {
    return new Todo(
      row.id,
      row.title,
      row.description,
      row.completed,
      row.userId,
      row.dueDate,
    );
  }

  async findAll() {
    const rows = await this.prisma.todo.findMany();
    return rows.map((r) => this.toDomain(r));
  }

  async getOne(id: string) {
    const row = await this.prisma.todo.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async create(data: CreateTodoData) {
    const row = await this.prisma.todo.create({ data });
    return this.toDomain(row);
  }

  async update(id: string, data: UpdateTodoData) {
    const row = await this.prisma.todo.update({ where: { id }, data });
    return this.toDomain(row);
  }

  async deleteItem(id: string) {
    await this.prisma.todo.delete({ where: { id } });
  }
}
