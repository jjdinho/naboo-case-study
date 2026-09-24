import { IconUserCircle } from "@tabler/icons-react";

export type SubRoute = {
  label: string;
  requiredAuth?: boolean;
} & ({ link: string } | { action: "logout" });

export type Route = {
  label: string;
  route: string | SubRoute[];
  icon?: typeof IconUserCircle;
  requiredAuth?: boolean;
};
