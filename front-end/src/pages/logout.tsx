import { useAuth } from "@/hooks";
import { useEffect } from "react";

export default function Logout() {
  const { handleLogout } = useAuth();

  // Once, on arrival: handleLogout is a new function on every render.
  useEffect(() => {
    handleLogout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
