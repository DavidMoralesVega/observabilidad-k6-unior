import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from 'src/contexts/identity-access/auth/application/auth.service';
import { LoginDto } from 'src/contexts/identity-access/auth/application/dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión y obtener un token JWT' })
  @ApiOkResponse({
    description: 'Sesión iniciada correctamente',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'uuid' },
            email: { type: 'string', example: 'juan@test.com' },
            role: { type: 'string', example: 'CLIENT' },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Credenciales inválidas' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
