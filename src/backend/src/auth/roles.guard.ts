import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './jwt-auth.guard';

/**
 * Se aplica DESPUÉS de JwtAuthGuard (requiere req.user ya seteado).
 * El control de acceso a Seguridad vive acá, en el backend — el frontend
 * sólo oculta el link como mejora de UX, nunca como mecanismo de seguridad.
 */
@Injectable()
export class AdminOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (req.user?.role !== 'admin') {
      throw new ForbiddenException('No tenés permisos para esta acción');
    }
    return true;
  }
}
