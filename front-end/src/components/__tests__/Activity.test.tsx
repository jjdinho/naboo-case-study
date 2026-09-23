import { AuthContext } from "@/contexts/authContext";
import {
  ActivityFragment,
  GetUserQuery,
  Role,
} from "@/graphql/generated/types";
import { Grid } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { Activity } from "../Activity";

const activity: ActivityFragment = {
  id: "activity1",
  city: "Paris",
  description: "Une description",
  name: "Une activité",
  price: 50,
  // Built in local time, so the expected text holds in any timezone.
  createdAt: new Date(2026, 8, 23, 14, 32, 5).toISOString(),
  owner: { firstName: "john", lastName: "doe" },
};

const userWithRole = (role: Role): GetUserQuery["getMe"] => ({
  id: "user1",
  email: "user1@test.fr",
  firstName: "john",
  lastName: "doe",
  role,
});

const renderCard = (user: GetUserQuery["getMe"] | null) =>
  render(
    <AuthContext.Provider
      value={{
        user,
        isLoading: false,
        handleSignin: vi.fn(),
        handleSignup: vi.fn(),
        handleLogout: vi.fn(),
      }}
    >
      <Grid>
        <Activity activity={activity} />
      </Grid>
    </AuthContext.Provider>
  );

describe("Activity", () => {
  it("shows an admin when the activity was created", () => {
    renderCard(userWithRole(Role.Admin));

    expect(
      screen.getByText("Créée le 23/09/2026 14:32:05")
    ).toBeInTheDocument();
  });

  it.each([
    ["a regular user", userWithRole(Role.User)],
    ["a logged-out visitor", null],
  ])("hides the creation date from %s", (_, user) => {
    renderCard(user);

    expect(screen.queryByText(/Créée le/)).not.toBeInTheDocument();
  });
});
