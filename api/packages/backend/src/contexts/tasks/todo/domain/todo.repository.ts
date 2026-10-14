import { Todo } from './todo.entity';

export interface CreateTodoData {
  title: string;
  description: string;
  completed: boolean;
  userId: string;
  dueDate?: Date | null;
}

export interface UpdateTodoData {
  title?: string;
  description?: string;
  completed?: boolean;
  dueDate?: string | Date | null;
}

export abstract class TodoRepository {
  abstract findAll(): Promise<Todo[]>;
  abstract getOne(id: string): Promise<Todo | null>;
  abstract create(data: CreateTodoData): Promise<Todo>;
  abstract update(id: string, data: UpdateTodoData): Promise<Todo | null>;
  abstract deleteItem(id: string): Promise<void>;
}
