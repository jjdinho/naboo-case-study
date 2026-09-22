import { Resolver, Mutation, Args, Context } from '@nestjs/graphql';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { SignInInput, SignUpInput } from './types';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { User } from 'src/user/user.schema';

@Resolver('Auth')
export class AuthResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private cookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.configService.get('NODE_ENV') === 'production',
      domain: this.configService.get<string>('FRONTEND_DOMAIN'),
    };
  }

  @Public()
  @Mutation(() => User)
  async login(
    @Args('signInInput') loginUserDto: SignInInput,
    @Context() ctx: { res: Response },
  ): Promise<User> {
    const { user, accessToken } = await this.authService.signIn(loginUserDto);
    ctx.res.cookie('jwt', accessToken, {
      ...this.cookieOptions(),
      // Set-only: express 4 clearCookie would turn a maxAge into a new expiry.
      maxAge: Number(this.configService.get('JWT_EXPIRATION_TIME')) * 1000,
    });

    return user;
  }

  @Public()
  @Mutation(() => User)
  async register(
    @Args('signUpInput') createUserDto: SignUpInput,
  ): Promise<User> {
    return this.authService.signUp(createUserDto);
  }

  @Public()
  @Mutation(() => Boolean)
  async logout(@Context() ctx: { res: Response }): Promise<boolean> {
    ctx.res.clearCookie('jwt', this.cookieOptions());
    return true;
  }
}
