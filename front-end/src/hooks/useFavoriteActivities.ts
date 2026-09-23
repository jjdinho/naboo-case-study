import {
  ActivityFragment,
  AddFavoriteActivityMutation,
  AddFavoriteActivityMutationVariables,
  GetFavoriteActivitiesQuery,
  GetFavoriteActivitiesQueryVariables,
  RemoveFavoriteActivityMutation,
  RemoveFavoriteActivityMutationVariables,
  ReorderFavoriteActivitiesMutation,
  ReorderFavoriteActivitiesMutationVariables,
} from "@/graphql/generated/types";
import AddFavoriteActivity from "@/graphql/mutations/favorite/addFavoriteActivity";
import RemoveFavoriteActivity from "@/graphql/mutations/favorite/removeFavoriteActivity";
import ReorderFavoriteActivities from "@/graphql/mutations/favorite/reorderFavoriteActivities";
import GetFavoriteActivities from "@/graphql/queries/favorite/getFavoriteActivities";
import { ApolloCache, useMutation, useQuery } from "@apollo/client";
import { useSnackbar } from "./useSnackbar";

// Every favorites mutation returns the new list. Writing it over the query's
// cache keeps the detail page and the profile in sync without a refetch.
const writeFavorites = (
  cache: ApolloCache<unknown>,
  favorites: ActivityFragment[] | undefined
) => {
  if (!favorites) return;
  cache.writeQuery<GetFavoriteActivitiesQuery>({
    query: GetFavoriteActivities,
    data: { getFavoriteActivities: favorites },
  });
};

export function useFavoriteActivities() {
  const snackbar = useSnackbar();
  const onError = () => snackbar.error("Une erreur est survenue");

  const { data, loading } = useQuery<
    GetFavoriteActivitiesQuery,
    GetFavoriteActivitiesQueryVariables
  >(GetFavoriteActivities);
  const [add] = useMutation<
    AddFavoriteActivityMutation,
    AddFavoriteActivityMutationVariables
  >(AddFavoriteActivity, {
    update: (cache, { data }) =>
      writeFavorites(cache, data?.addFavoriteActivity),
    onError,
  });
  const [remove] = useMutation<
    RemoveFavoriteActivityMutation,
    RemoveFavoriteActivityMutationVariables
  >(RemoveFavoriteActivity, {
    update: (cache, { data }) =>
      writeFavorites(cache, data?.removeFavoriteActivity),
    onError,
  });
  const [reorder] = useMutation<
    ReorderFavoriteActivitiesMutation,
    ReorderFavoriteActivitiesMutationVariables
  >(ReorderFavoriteActivities, {
    update: (cache, { data }) =>
      writeFavorites(cache, data?.reorderFavoriteActivities),
    onError,
  });

  return {
    favorites: data?.getFavoriteActivities ?? [],
    loading,
    add: (activityId: string) => add({ variables: { activityId } }),
    remove: (activityId: string) => remove({ variables: { activityId } }),
    // Optimistic, so the dropped item doesn't jump back while the server
    // confirms; Apollo rolls it back if the mutation fails.
    reorder: (favorites: ActivityFragment[]) =>
      reorder({
        variables: { activityIds: favorites.map((favorite) => favorite.id) },
        optimisticResponse: { reorderFavoriteActivities: favorites },
      }),
  };
}
