import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangePasswordFirstLoginDto } from './dto/change-password-first-login.dto';
import { LoginDto } from './dto/login.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';

const COOKIE_NAME = 'lc_token';
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function requestMeta(req: AuthenticatedRequest) {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      dto.username,
      dto.password,
      requestMeta(req),
    );

    res.cookie(COOKIE_NAME, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: COOKIE_MAX_AGE_MS,
    });

    return result;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.authToken!, req.user!.id, requestMeta(req));
    res.clearCookie(COOKIE_NAME);
    return { message: 'Sesión cerrada' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: AuthenticatedRequest) {
    return this.authService.me(req.user!.id);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.authService.changePassword(
      req.user!.id,
      dto.currentPassword,
      dto.newPassword,
      requestMeta(req),
    );
    return { message: 'Contraseña cambiada exitosamente' };
  }

  @Post('change-password-first-login')
  @UseGuards(JwtAuthGuard)
  async changePasswordFirstLogin(
    @Body() dto: ChangePasswordFirstLoginDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.authService.changePasswordFirstLogin(
      req.user!.id,
      dto.newPassword,
      requestMeta(req),
    );
    return { message: 'Contraseña actualizada' };
  }

  @Post('reset-password')
  @UseGuards(JwtAuthGuard)
  async resetPassword(@Req() req: AuthenticatedRequest) {
    await this.authService.resetOwnPassword(req.user!.id, requestMeta(req));
    return { message: 'Contraseña reseteada a 123456' };
  }

  @Patch('preferences')
  @UseGuards(JwtAuthGuard)
  async updatePreferences(
    @Body() dto: UpdatePreferencesDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.authService.setForcePasswordChangeOnReset(
      req.user!.id,
      dto.forcePasswordChangeOnReset,
      requestMeta(req),
    );
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async listSessions(@Req() req: AuthenticatedRequest) {
    return this.authService.listSessions(req.user!.id, req.authToken!);
  }

  @Post('sessions/:id/revoke')
  @UseGuards(JwtAuthGuard)
  async revokeSession(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.authService.revokeSession(req.user!.id, id, requestMeta(req));
    return { message: 'Sesión cerrada' };
  }

  @Post('sessions/revoke-others')
  @UseGuards(JwtAuthGuard)
  async revokeOtherSessions(@Req() req: AuthenticatedRequest) {
    const result = await this.authService.revokeOtherSessions(
      req.user!.id,
      req.authToken!,
      requestMeta(req),
    );
    return { message: `${result.revoked} sesión(es) cerrada(s)` };
  }
}
