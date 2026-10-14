import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserRepository } from '../../user/domain/user.repository';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser = {
    id: '1',
    email: 'juan@test.com',
    name: 'Juan',
    password: 'hashed-password',
    role: 'CLIENT' as const,
    status: 'ACTIVE' as const,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserRepository,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('jwt-token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(UserRepository);
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('returns accessToken and user on valid credentials', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'juan@test.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('accessToken', 'jwt-token');
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
    });

    it('throws UnauthorizedException when user not found', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'no@test.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password is invalid', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser as any);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'juan@test.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
