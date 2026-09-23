import { Role } from "@/graphql/generated/types";
import { useAuth } from "./useAuth";

export function useDebugMode() {
  const { user } = useAuth();
  return user?.role === Role.Admin;
}
