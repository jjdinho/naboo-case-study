import { ActivityFragment } from "@/graphql/generated/types";
import { Box, Button, Flex, Paper } from "@mantine/core";
import { ActivityListItem } from "./ActivityListItem";

interface FavoriteListProps {
  favorites: ActivityFragment[];
  onRemove: (activityId: string) => void;
}

export function FavoriteList({ favorites, onRemove }: FavoriteListProps) {
  return (
    <>
      {favorites.map((favorite) => (
        <Paper key={favorite.id} withBorder p="sm" mb="sm">
          <Flex align="center" gap="md">
            <Box sx={{ flex: 1 }}>
              <ActivityListItem activity={favorite} />
            </Box>
            <Button
              variant="subtle"
              color="red"
              onClick={() => onRemove(favorite.id)}
            >
              Retirer
            </Button>
          </Flex>
        </Paper>
      ))}
    </>
  );
}
