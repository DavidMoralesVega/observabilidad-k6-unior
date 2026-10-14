import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'Email del usuario',
    example: 'juan@test.com',
  })
  @IsString()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Nombre del usuario',
    example: 'Juan Pérez',
  })
  @IsString()
  @IsNotEmpty()
  name: string | null;

  @ApiProperty({
    description: 'Contraseña del usuario (mínimo 6 caracteres)',
    example: 'password123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password: string;
}
