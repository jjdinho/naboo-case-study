import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from 'src/user/user.schema';
import { UserService } from '../user/user.service';
import { SignInInput, SignUpInput } from './types';
import { PayloadDto } from './types/jwtPayload.dto';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async signIn({
    email,
    password,
  }: SignInInput): Promise<{ user: User; accessToken: string }> {
    const user = await this.userService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Wrong credentials provided');

    const isSamePassword = await bcrypt.compare(password, user.password);
    if (!isSamePassword)
      throw new UnauthorizedException('Wrong credentials provided');

    const accessToken = await this.generateToken({ user });

    return { user, accessToken };
  }

  async generateToken({ user }: { user: User }): Promise<string> {
    const payload: PayloadDto = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    return await this.jwtService.signAsync(payload);
  }

  async signUp({
    email,
    password,
    firstName,
    lastName,
  }: SignUpInput): Promise<User> {
    const user = await this.userService.findByEmail(email);

    if (user) throw new UnauthorizedException();

    return this.userService.createUser({
      email,
      password,
      firstName,
      lastName,
    });
  }
}
