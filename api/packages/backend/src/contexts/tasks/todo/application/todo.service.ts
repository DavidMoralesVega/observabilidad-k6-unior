import { Injectable, NotFoundException } from '@nestjs/common';
import { TodoRepository, UpdateTodoData } from '../domain/todo.repository';
import { NotificationPort } from '../domain/notification.port';
import { CreateTodoDto } from './dto/create-todo.dto';

@Injectable()
export class TodoService {
  constructor(
    private readonly todoRepository: TodoRepository,
    private readonly notificationPort: NotificationPort,
  ) {}

  async findAll() {
    return this.todoRepository.findAll();
  }

  async getOne(id: string) {
    const todo = await this.todoRepository.getOne(id);
    if (!todo) {
      throw new NotFoundException(`Todo with id ${id} not found`);
    }
    return todo;
  }

  async create(userId: string, dto: CreateTodoDto) {
    const todo = await this.todoRepository.create({
      title: dto.title,
      description: dto.description || '',
      completed: false,
      userId,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
    });

    await this.notificationPort.send({
      userId,
      type: 'TASK_CREATED',
      title: 'Nueva tarea',
      message: `Se creó la tarea "${dto.title}"`,
      metadata: { taskId: todo.id },
    });

    return todo;
  }

  async update(id: string, dto: UpdateTodoData) {
    const existing = await this.getOne(id);
    const data: UpdateTodoData = {
      ...dto,
      dueDate:
        dto.dueDate !== undefined
          ? dto.dueDate
            ? new Date(dto.dueDate as string | Date)
            : null
          : undefined,
    };
    const updated = await this.todoRepository.update(id, data);

    if (dto.completed !== undefined && dto.completed !== existing.completed) {
      if (dto.completed) {
        await this.notificationPort.send({
          userId: existing.userId,
          type: 'TASK_COMPLETED',
          title: 'Tarea completada',
          message: `La tarea "${existing.title}" fue completada`,
          metadata: { taskId: id },
        });
      }
    }

    return updated;
  }

  async deleteItem(id: string) {
    await this.getOne(id);
    return this.todoRepository.deleteItem(id);
  }
}
