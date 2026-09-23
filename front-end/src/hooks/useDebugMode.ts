import { Role } from "@/graphql/generated/types";
import { useLocalStorage } from "@mantine/hooks";
import { useAuth } from "./useAuth";

export function useDebugMode() {
  const { user } = useAuth();
  const [enabled, setDebugMode] = useLocalStorage({
    key: "debugMode",
    defaultValue: false,
  });
  const isAdmin = user?.role === Role.Admin;

  // The role is the gate; the stored flag is only a preference.
  return { isAdmin, debugMode: isAdmin && enabled, setDebugMode };
}
