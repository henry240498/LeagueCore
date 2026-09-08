import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';

export interface AuthenticatedRequest extends Request {
  user?: { id: number; username: string; role: string };
  authToken?: string;
}

function extractToken(req: Request): string | null {
  const cookieToken = (req as any).cookies?.lc_token;
  if (cookieToken) return cookieToken;

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);

  return null;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractToken(req);
    if (!token) throw new UnauthorizedException('No autenticado');

    const user = await this.authService.validateSession(token);
    if (!user) throw new UnauthorizedException('Sesión inválida o expirada');

    req.user = user;
    req.authToken = token;
    return true;
  }
}
