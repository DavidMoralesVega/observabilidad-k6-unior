import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { UserRepository } from '../../user/domain/user.repository';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let userRepository: jest.Mocked<UserRepository>;

  const mockUser = {
    id: '1',
    email: 'juan@test.com',
    name: 'Juan',
    password: 'hashed',
    role: 'CLIENT',
    status: 'ACTIVE',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: UserRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    userRepository = module.get(UserRepository);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('returns user when found', async () => {
      userRepository.findById.mockResolvedValue(mockUser as any);

      const result = await strategy.validate({
        sub: '1',
        email: 'juan@test.com',
        role: 'CLIENT',
      });

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(userRepository.findById).toHaveBeenCalledWith('1');
    });

    it('throws UnauthorizedException when user not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(
        strategy.validate({
          sub: '999',
          email: 'no@test.com',
          role: 'CLIENT',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
