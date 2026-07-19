import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Translations resolve to their key path; the Link mock preserves hrefs.
vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/dashboard",
  Link: ({ href, children, ...rest }: React.ComponentProps<"a">) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import BottomTabBar from "@/components/BottomTabBar";

describe("BottomTabBar", () => {
  it("renders the four primary tabs in order, Learn included", () => {
    render(<BottomTabBar />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/dashboard",
      "/explore",
      "/learn",
      "/profile",
    ]);
    expect(screen.getByText("nav.myDay")).toBeTruthy();
    expect(screen.getByText("nav.explore")).toBeTruthy();
    expect(screen.getByText("nav.learn")).toBeTruthy();
    expect(screen.getByText("nav.profile")).toBeTruthy();
  });

  it("marks the current tab active", () => {
    render(<BottomTabBar />);
    const active = screen.getByText("nav.myDay").closest("a")!;
    const inactive = screen.getByText("nav.learn").closest("a")!;
    expect(active.className).toContain("text-accent");
    expect(inactive.className).not.toContain("text-accent");
  });
});
