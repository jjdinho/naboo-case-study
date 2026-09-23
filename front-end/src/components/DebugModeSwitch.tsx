import { useDebugMode } from "@/hooks";
import { Affix, Group, Paper, Switch } from "@mantine/core";
import { IconBug } from "@tabler/icons-react";

export function DebugModeSwitch() {
  const { isAdmin, debugMode, setDebugMode } = useDebugMode();

  if (!isAdmin) return null;

  return (
    <Affix position={{ bottom: "1rem", right: "1rem" }}>
      <Paper shadow="md" p="sm" radius="md" withBorder>
        <Group spacing="xs">
          <IconBug size="1.25rem" />
          <Switch
            label="Mode debug"
            labelPosition="left"
            checked={debugMode}
            onChange={(event) => setDebugMode(event.currentTarget.checked)}
          />
        </Group>
      </Paper>
    </Affix>
  );
}
