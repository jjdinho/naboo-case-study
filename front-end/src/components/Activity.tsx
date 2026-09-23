import { ActivityFragment } from "@/graphql/generated/types";
import { useDebugMode } from "@/hooks";
import { useGlobalStyles } from "@/utils";
import { Badge, Button, Card, Grid, Group, Image, Text } from "@mantine/core";
import Link from "next/link";

interface ActivityProps {
  activity: ActivityFragment;
}

export function Activity({ activity }: ActivityProps) {
  const { classes } = useGlobalStyles();
  const debugMode = useDebugMode();

  return (
    <Grid.Col span={4}>
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Card.Section>
          <Image
            src="https://dummyimage.com/480x4:3"
            height={160}
            alt="random image of city"
          />
        </Card.Section>

        <Group position="apart" mt="md" mb="xs">
          <Text weight={500} className={classes.ellipsis}>
            {activity.name}
          </Text>
        </Group>

        <Group mt="md" mb="xs">
          <Badge color="pink" variant="light">
            {activity.city}
          </Badge>
          <Badge color="yellow" variant="light">
            {`${activity.price}€/j`}
          </Badge>
        </Group>

        <Text size="sm" color="dimmed" className={classes.ellipsis}>
          {activity.description}
        </Text>

        {debugMode && activity.createdAt && (
          <Text size="xs" color="dimmed" mt="xs">
            Créée le {new Date(activity.createdAt).toLocaleString("fr-FR")}
          </Text>
        )}

        <Link href={`/activities/${activity.id}`} className={classes.link}>
          <Button variant="light" color="blue" fullWidth mt="md" radius="md">
            Voir plus
          </Button>
        </Link>
      </Card>
    </Grid.Col>
  );
}
