import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import CityYearStrip from "@/components/CityYearStrip";
import { HEAT_LOW, HEAT_HIGH } from "@/lib/year-strip";

const MONTHS = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function renderStrip(hoursByDay: number[], height?: number) {
  const { container } = render(
    <CityYearStrip
      hoursByDay={hoursByDay}
      monthLabels={MONTHS}
      caption="cap"
      legend={{ low: "0 h", high: "10 h+" }}
      height={height}
    />,
  );
  return container;
}

describe("CityYearStrip", () => {
  it("draws one unit-wide column per day with the shared ramp", () => {
    const container = renderStrip([0, 5, 10]);
    const rects = Array.from(container.querySelectorAll("rect"));
    expect(rects).toHaveLength(3);
    expect(rects.map((r) => r.getAttribute("x"))).toEqual(["0", "1", "2"]);
    expect(rects.every((r) => r.getAttribute("width") === "1")).toBe(true);
    expect(rects[0].getAttribute("fill")).toBe(HEAT_LOW);
    expect(rects[1].getAttribute("fill")).toBe("hsl(32.5, 90%, 40%)");
    expect(rects[2].getAttribute("fill")).toBe(HEAT_HIGH);
  });

  it("sizes the viewBox from the data, not from a hardcoded 365", () => {
    // Regression guard: width used to be a literal 365, so any other length
    // drew off-canvas silently under preserveAspectRatio="none".
    expect(renderStrip([0, 5, 10]).querySelector("svg")!.getAttribute("viewBox"))
      .toBe("0 0 3 48");
    expect(renderStrip(new Array(365).fill(0), 110).querySelector("svg")!.getAttribute("viewBox"))
      .toBe("0 0 365 110");
  });

  it("keeps the full-year markup the city pages already ship", () => {
    const hours = Array.from({ length: 365 }, (_, i) => (i % 11));
    const container = renderStrip(hours, 110);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("preserveAspectRatio")).toBe("none");
    expect(svg.getAttribute("aria-label")).toBe("cap");
    expect(svg.querySelectorAll("rect")).toHaveLength(365);
    expect(svg.querySelectorAll("rect")[0].getAttribute("height")).toBe("110");
    // The faint-on-dark token class is what makes the labels legible on the
    // PhaseWindow plate; the widget has to reproduce its literal value.
    expect(container.querySelectorAll(".text-on-window-faint").length).toBeGreaterThan(0);
  });

  it("paints the legend swatch with the ramp's own gradient", () => {
    const container = renderStrip([0, 10]);
    const swatch = Array.from(container.querySelectorAll("span")).find(
      (s) => s.style.background.length > 0,
    );
    expect(swatch).toBeDefined();
    expect(swatch!.style.background).toContain("linear-gradient");
  });
});
