import { Query, Resolver } from '@nestjs/graphql';
import { UserService } from '../../user/user.service';
import { CurrentUser } from '../../auth/current-user.decorator';
import { PayloadDto } from '../../auth/types/jwtPayload.dto';
import { User } from 'src/user/user.schema';

@Resolver('Me')
export class MeResolver {
  constructor(private readonly userService: UserService) {}

  @Query(() => User)
  async getMe(@CurrentUser() user: PayloadDto): Promise<User> {
    return this.userService.getById(user.id);
  }
}
