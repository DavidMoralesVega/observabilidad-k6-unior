export class Todo {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly description: string,
    public readonly completed: boolean,
    public readonly userId: string,
    public readonly dueDate: Date | null,
  ) {}
}
