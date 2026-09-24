import { IconUserCircle } from "@tabler/icons-react";
import { Route } from "./components/Topbar";

export const routes: Route[] = [
  { label: "Découvrez des activités", route: "/discover" },
  { label: "Explorer", route: "/explorer" },
  { label: "Mes activités", route: "/my-activities", requiredAuth: true },
  {
    label: "Utilisateur",
    icon: IconUserCircle,
    route: [
      {
        label: "Connection",
        link: "/signin",
        requiredAuth: false,
      },
      {
        label: "Inscription",
        link: "/signup",
        requiredAuth: false,
      },
      { label: "Profil", link: "/profil", requiredAuth: true },
      { label: "Déconnection", action: "logout", requiredAuth: true },
    ],
  },
];
