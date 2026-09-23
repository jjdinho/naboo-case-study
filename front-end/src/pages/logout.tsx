import { useAuth } from "@/hooks";

export default function Logout() {
  const { handleLogout } = useAuth();
  handleLogout();
  return null;
}
