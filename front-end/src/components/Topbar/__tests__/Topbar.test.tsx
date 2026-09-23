import { AuthContext } from "@/contexts/authContext";
import { GetUserQuery, Role } from "@/graphql/generated/types";
import { routes } from "@/routes";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Topbar } from "../Topbar";

const user: GetUserQuery["getMe"] = {
  id: "user1",
  email: "user1@test.fr",
  firstName: "john",
  lastName: "doe",
  role: Role.User,
};

describe("Topbar", () => {
  it("logs out from the user menu", async () => {
    const handleLogout = vi.fn();
    const { container } = render(
      <AuthContext.Provider
        value={{
          user,
          isLoading: false,
          handleSignin: vi.fn(),
          handleSignup: vi.fn(),
          handleLogout,
        }}
      >
        <Topbar routes={routes} />
      </AuthContext.Provider>
    );

    // The user menu opens on hover; its target is an icon with no name.
    await userEvent.hover(container.querySelector("[aria-haspopup]")!);
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Déconnection" })
    );

    expect(handleLogout).toHaveBeenCalledTimes(1);
  });
});
