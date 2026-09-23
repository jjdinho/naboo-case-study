import { useFavoriteActivities } from "@/hooks";
import { Button } from "@mantine/core";
import { IconHeart, IconHeartFilled } from "@tabler/icons-react";

interface FavoriteButtonProps {
  activityId: string;
}

export function FavoriteButton({ activityId }: FavoriteButtonProps) {
  const { favorites, loading, add, remove } = useFavoriteActivities();
  const isFavorite = favorites.some((favorite) => favorite.id === activityId);

  return (
    <Button
      variant={isFavorite ? "light" : "outline"}
      color="pink"
      loading={loading}
      leftIcon={
        isFavorite ? <IconHeartFilled size="1rem" /> : <IconHeart size="1rem" />
      }
      onClick={() => (isFavorite ? remove(activityId) : add(activityId))}
    >
      {isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
    </Button>
  );
}
