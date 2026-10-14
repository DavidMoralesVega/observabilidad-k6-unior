import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from '../../contexts/identity-access/user/application/user.service';
import { JwtAuthGuard } from '../../contexts/identity-access/auth/infrastructure/jwt-auth.guard';

describe('UserController', () => {
  let controller: UserController;
  let userService: jest.Mocked<UserService>;

  const mockUser = {
    id: '1',
    email: 'juan@test.com',
    name: 'Juan',
    role: 'CLIENT',
    status: 'ACTIVE',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            findAll: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserController>(UserController);
    userService = module.get(UserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('returns all users', async () => {
      userService.findAll.mockResolvedValue([mockUser]);

      const result = await controller.findAll();
      expect(result).toEqual([mockUser]);
      expect(userService.findAll).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('creates a user', async () => {
      userService.create.mockResolvedValue(mockUser as any);

      const result = await controller.create(
        { id: '1' },
        {
          email: 'juan@test.com',
          name: 'Juan',
          password: 'password123',
        },
      );
      expect(result).toEqual(mockUser);
      expect(userService.create).toHaveBeenCalledWith(
        {
          email: 'juan@test.com',
          name: 'Juan',
          password: 'password123',
        },
        '1',
      );
    });
  });
});
