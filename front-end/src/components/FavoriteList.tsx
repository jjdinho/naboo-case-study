import { ActivityFragment } from "@/graphql/generated/types";
import { moveItem } from "@/utils";
import {
  DragDropContext,
  Draggable,
  DropResult,
  Droppable,
} from "@hello-pangea/dnd";
import { Box, Button, Flex, Paper } from "@mantine/core";
import { IconGripVertical } from "@tabler/icons-react";
import { ActivityListItem } from "./ActivityListItem";

interface FavoriteListProps {
  favorites: ActivityFragment[];
  onReorder: (favorites: ActivityFragment[]) => void;
  onRemove: (activityId: string) => void;
}

export function FavoriteList({
  favorites,
  onReorder,
  onRemove,
}: FavoriteListProps) {
  const handleDragEnd = ({ source, destination }: DropResult) => {
    if (destination && destination.index !== source.index) {
      onReorder(moveItem(favorites, source.index, destination.index));
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="favorites">
        {(droppable) => (
          <div ref={droppable.innerRef} {...droppable.droppableProps}>
            {favorites.map((favorite, index) => (
              <Draggable
                key={favorite.id}
                draggableId={favorite.id}
                index={index}
              >
                {(draggable) => (
                  <Paper
                    ref={draggable.innerRef}
                    {...draggable.draggableProps}
                    withBorder
                    p="sm"
                    mb="sm"
                  >
                    <Flex align="center" gap="md">
                      <Box {...draggable.dragHandleProps} aria-label="Déplacer">
                        <IconGripVertical />
                      </Box>
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
                )}
              </Draggable>
            ))}
            {droppable.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
