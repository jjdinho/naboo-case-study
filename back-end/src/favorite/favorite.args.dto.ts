import { ArgsType, Field, ID } from '@nestjs/graphql';
import { IsMongoId } from 'class-validator';

@ArgsType()
export class FavoriteActivityArgs {
  @Field(() => ID)
  @IsMongoId()
  activityId!: string;
}
