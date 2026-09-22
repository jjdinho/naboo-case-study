import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SignInDto {
  @Field()
  access_token!: string;
}
