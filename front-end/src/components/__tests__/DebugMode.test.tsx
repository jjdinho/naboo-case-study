import { AuthContext } from "@/contexts/authContext";
import {
  ActivityFragment,
  GetUserQuery,
  Role,
} from "@/graphql/generated/types";
import { Grid } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Activity } from "../Activity";
import { DebugModeSwitch } from "../DebugModeSwitch";

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

// Like the app: the switch sits in the layout, the card on the page.
const renderPage = (user: GetUserQuery["getMe"] | null) =>
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
      <DebugModeSwitch />
      <Grid>
        <Activity activity={activity} />
      </Grid>
    </AuthContext.Provider>
  );

const getSwitch = () => screen.queryByRole("checkbox", { name: "Mode debug" });
const getDate = () => screen.queryByText(/Créée le/);

describe("Mode debug", () => {
  afterEach(() => localStorage.clear());

  it("starts off for an admin", () => {
    renderPage(userWithRole(Role.Admin));

    expect(getSwitch()).not.toBeChecked();
    expect(getDate()).not.toBeInTheDocument();
  });

  it("shows and hides the creation date as an admin switches it", async () => {
    renderPage(userWithRole(Role.Admin));

    await userEvent.click(getSwitch()!);
    expect(
      screen.getByText("Créée le 23/09/2026 14:32:05")
    ).toBeInTheDocument();

    await userEvent.click(getSwitch()!);
    expect(getDate()).not.toBeInTheDocument();
  });

  it("remembers the switch in this browser", () => {
    localStorage.setItem("debugMode", "true");
    renderPage(userWithRole(Role.Admin));

    expect(getSwitch()).toBeChecked();
    expect(getDate()).toBeInTheDocument();
  });

  it.each([
    ["a regular user", userWithRole(Role.User)],
    ["a logged-out visitor", null],
  ])("shows %s neither the switch nor the date", (_, user) => {
    localStorage.setItem("debugMode", "true");
    renderPage(user);

    expect(getSwitch()).not.toBeInTheDocument();
    expect(getDate()).not.toBeInTheDocument();
  });
});
