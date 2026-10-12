import { normalizePersianSearchText } from "../src/modules/content/content-discovery.service";
import { searchVariants } from "../src/modules/content/search-synonyms";

describe("search synonyms", () => {
  const variants = (q: string) => searchVariants(normalizePersianSearchText(q), normalizePersianSearchText);

  it("finds the Persian name of an English term, and back", () => {
    expect(variants("dijkstra")).toEqual(expect.arrayContaining(["دایکسترا", "کوتاه ترین مسیر"]));
    expect(variants("هرم")).toEqual(expect.arrayContaining(["heap"]));
  });

  it("swaps only whole words and keeps the rest of the query", () => {
    expect(variants("الگوریتم dijkstra")).toContain("الگوریتم دایکسترا");
    expect(variants("heaped")).toEqual(["heaped"]);
  });
});
