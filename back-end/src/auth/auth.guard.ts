import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { PayloadDto } from './types/jwtPayload.dto';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext();

    const token = ctx.req.cookies?.['jwt'];
    if (!token) throw new UnauthorizedException();

    try {
      ctx.jwtPayload = (await this.jwtService.verifyAsync(token)) as PayloadDto;
    } catch {
      throw new UnauthorizedException();
    }

    return true;
  }
}
