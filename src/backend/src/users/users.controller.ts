import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AdminOnlyGuard } from '../auth/roles.guard';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { SetUserPasswordDto, SetUserStatusDto, UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

// Gestión de usuarios -- exclusiva de ADMINISTRADOR (pedido explícito, §4/§15), mismo guard que ya
// usa Seguridad/Parametrizaciones/Importación. El frontend además oculta el menú, pero el rechazo
// real vive acá (§8: "el backend debe comprobar el rol, no basta con ocultar opciones").
@Controller('users')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  private meta(req: AuthenticatedRequest) {
    return { ip: req.ip, userAgent: req.headers['user-agent'] };
  }

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getById(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.user!.id, this.meta(req));
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto, @Req() req: AuthenticatedRequest) {
    return this.service.update(id, dto, req.user!.id, this.meta(req));
  }

  @Patch(':id/status')
  setStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: SetUserStatusDto, @Req() req: AuthenticatedRequest) {
    return this.service.setStatus(id, dto, req.user!.id, this.meta(req));
  }

  @Post(':id/reset-password')
  resetPassword(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    return this.service.adminResetPassword(id, req.user!.id, this.meta(req));
  }

  @Patch(':id/password')
  setPassword(@Param('id', ParseIntPipe) id: number, @Body() dto: SetUserPasswordDto, @Req() req: AuthenticatedRequest) {
    return this.service.adminSetPassword(id, dto, req.user!.id, this.meta(req));
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: AuthenticatedRequest) {
    await this.service.remove(id, req.user!.id, this.meta(req));
    return { message: 'Usuario eliminado' };
  }
}
