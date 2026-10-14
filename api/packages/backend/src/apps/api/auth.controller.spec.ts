import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../../contexts/identity-access/auth/application/auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('returns accessToken and user', async () => {
      const mockResult = {
        accessToken: 'jwt-token',
        user: { id: '1', email: 'juan@test.com', role: 'CLIENT' },
      };
      authService.login.mockResolvedValue(mockResult);

      const result = await controller.login({
        email: 'juan@test.com',
        password: 'password123',
      });

      expect(result).toEqual(mockResult);
      expect(authService.login).toHaveBeenCalledWith({
        email: 'juan@test.com',
        password: 'password123',
      });
    });
  });
});
