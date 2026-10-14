export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly name: string | null,
    public readonly password: string,
    public readonly role: 'CLIENT' | 'ADMIN',
    public readonly status: 'ACTIVE' | 'BLOCKED',
  ) {}
}

export function toSafeUser(user: User) {
  const { password, ...safeUser } = user;
  return safeUser;
}

export function toSafeUsers(users: User[]) {
  return users.map((user) => toSafeUser(user));
}
