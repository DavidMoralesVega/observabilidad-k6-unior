import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/contexts/identity-access/auth/infrastructure/jwt-auth.guard';
import { CreateUserDto } from 'src/contexts/identity-access/user/application/dto/create-user.dto';
import { UserService } from 'src/contexts/identity-access/user/application/user.service';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/contexts/identity-access/auth/infrastructure/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todos los usuarios' })
  @ApiOkResponse({ description: 'Lista de usuarios (sin passwords)' })
  async findAll() {
    return this.userService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo usuario' })
  @ApiCreatedResponse({ description: 'Usuario creado correctamente' })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateUserDto) {
    return this.userService.create(dto, user.id);
  }
}
