import { User } from './user.entity';

export interface UserCreateData {
  email: string;
  name: string | null;
  password: string;
  role: 'CLIENT' | 'ADMIN';
  status: 'ACTIVE' | 'BLOCKED';
}

export abstract class UserRepository {
  abstract findByEmail(email: string): Promise<User | null>;
  abstract findById(id: string): Promise<User | null>;
  abstract findAll(): Promise<User[]>;
  abstract create(data: UserCreateData): Promise<User>;
}
