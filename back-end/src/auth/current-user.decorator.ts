import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { PayloadDto } from './types/jwtPayload.dto';

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): PayloadDto =>
    GqlExecutionContext.create(context).getContext().req.user,
);
