import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { Msg } from 'src/helpers/responseMsg';
import { ApiResponse } from 'src/helpers/ApiResponse';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException(
        new ApiResponse(401, {}, 'Missing API Key'),
      );
    }

    if (apiKey !== process.env.IVR_API_KEY) {
      throw new UnauthorizedException(
        new ApiResponse(401, {}, 'Invalid API Key'),
      );
    }

    return true;
  }
}
