import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ApiResponse } from 'src/helpers/ApiResponse';
import { ROLES_KEY } from './roles.decorator';
import { UserRole } from 'src/common/enums/user/role.enum';
import { Msg } from 'src/helpers/responseMsg';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    console.log(user);

    if (!user || !user.roles) {
      throw new ForbiddenException(new ApiResponse(403, {}, Msg.FORBIDDEN));
    }

    // Convert string roles (like "ADMIN") from JWT into an array
    const userRoles = Array.isArray(user.roles) ? user.roles : [user.roles];

    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(new ApiResponse(403, {}, Msg.FORBIDDEN));
    }

    return true;
  }
}
