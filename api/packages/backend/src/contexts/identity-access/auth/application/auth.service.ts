import { JwtService } from '@nestjs/jwt';
import { UserRepository } from '../../user/domain/user.repository';
import { LoginDto } from './dto/login.dto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { trace } from '@opentelemetry/api';

// Tracer para los spans manuales (argon2 no tiene instrumentación automática)
const tracer = trace.getTracer('auth');

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Span manual: así el tiempo de argon2 aparece con nombre propio en Tempo
    const valid = await tracer.startActiveSpan('argon2.verify', async (span) => {
      try {
        return await argon2.verify(user.password, dto.password);
      } finally {
        span.end();
      }
    });
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: user.id, email: user.email, role: user.role },
    };
  }
}
