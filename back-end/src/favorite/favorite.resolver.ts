import { UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Activity } from 'src/activity/activity.schema';
import { AuthGuard } from 'src/auth/auth.guard';
import { ContextWithJWTPayload } from 'src/auth/types/context';
import {
  FavoriteActivityArgs,
  ReorderFavoriteActivitiesArgs,
} from './favorite.args.dto';
import { FavoriteService } from './favorite.service';

@Resolver()
@UseGuards(AuthGuard)
export class FavoriteResolver {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Query(() => [Activity])
  async getFavoriteActivities(
    @Context() context: ContextWithJWTPayload,
  ): Promise<Activity[]> {
    return this.favoriteService.findByUser(context.jwtPayload.id);
  }

  @Mutation(() => [Activity])
  async addFavoriteActivity(
    @Context() context: ContextWithJWTPayload,
    @Args() { activityId }: FavoriteActivityArgs,
  ): Promise<Activity[]> {
    return this.favoriteService.add(context.jwtPayload.id, activityId);
  }

  @Mutation(() => [Activity])
  async removeFavoriteActivity(
    @Context() context: ContextWithJWTPayload,
    @Args() { activityId }: FavoriteActivityArgs,
  ): Promise<Activity[]> {
    return this.favoriteService.remove(context.jwtPayload.id, activityId);
  }

  @Mutation(() => [Activity])
  async reorderFavoriteActivities(
    @Context() context: ContextWithJWTPayload,
    @Args() { activityIds }: ReorderFavoriteActivitiesArgs,
  ): Promise<Activity[]> {
    return this.favoriteService.reorder(context.jwtPayload.id, activityIds);
  }
}
