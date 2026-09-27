import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { DemoApp } from "../src/demo/DemoApp";

beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

afterEach(cleanup);

function renderDemo(path: string) {
  const router = createMemoryRouter([{ path: "*", element: <DemoApp /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
  return router;
}

it("moves through page URLs with Back and Forward", async () => {
  const router = renderDemo("/");
  fireEvent.click(screen.getByRole("link", { name: "My List" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/my-list"));
  expect(screen.getByRole("heading", { name: "My List" })).toBeTruthy();

  fireEvent.click(screen.getByRole("link", { name: "Rankings" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/rankings"));
  expect(screen.getByRole("heading", { name: "Rankings" })).toBeTruthy();

  await act(async () => {
    await router.navigate(-1);
  });
  expect(router.state.location.pathname).toBe("/my-list");
  expect(screen.getByRole("heading", { name: "My List" })).toBeTruthy();

  await act(async () => {
    await router.navigate(1);
  });
  expect(router.state.location.pathname).toBe("/rankings");
  expect(screen.getByRole("heading", { name: "Rankings" })).toBeTruthy();
});

it.each([
  ["/", "Activity Feed"],
  ["/my-list", "My List"],
  ["/search", "Search Coasters"],
  ["/rankings", "Rankings"],
  ["/profile", "Build your profile"],
  ["/riders/example", "Rider profile"],
  ["/admin", "Admin"],
  ["/missing", "Page not found"],
])("renders a direct visit to %s", (path, heading) => {
  renderDemo(path);
  expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
});

it("does not add a history entry for the active page", () => {
  const router = renderDemo("/search");
  const initialKey = router.state.location.key;
  fireEvent.click(screen.getByRole("link", { name: "Search" }));
  expect(router.state.location.key).toBe(initialKey);
});
