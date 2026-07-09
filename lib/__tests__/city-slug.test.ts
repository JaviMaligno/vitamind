import { describe, it, expect } from "vitest";
import { slugify } from "@/lib/city-slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("London")).toBe("london");
    expect(slugify("Nueva York")).toBe("nueva-york");
    expect(slugify("New York")).toBe("new-york");
  });

  it("strips Latin diacritics", () => {
    expect(slugify("Zürich")).toBe("zurich");
    expect(slugify("Malaga")).toBe("malaga");
    expect(slugify("Šiauliai")).toBe("siauliai");
    expect(slugify("Londonas")).toBe("londonas");
  });

  it("transliterates Cyrillic", () => {
    expect(slugify("Лондон")).toBe("london");
    expect(slugify("Москва")).toBe("moskva");
    expect(slugify("Нью-Йорк")).toBe("nyu-york");
  });

  it("collapses separators and trims", () => {
    expect(slugify("  Ciudad  de   Mexico ")).toBe("ciudad-de-mexico");
    expect(slugify("São Paulo")).toBe("sao-paulo");
  });

  it("returns empty string when nothing slugifiable remains", () => {
    expect(slugify("!!!")).toBe("");
  });
});
