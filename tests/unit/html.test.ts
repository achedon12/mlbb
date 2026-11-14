import { describe, expect, it } from "vitest";
import { cleanGuideHtml, cleanHtml } from "@/lib/html";

describe("cleanHtml", () => {
  it("drops a link left empty once its image is removed", () => {
    const html = '<p><a href="https://mobilelegends.fandom.com/wiki/Dominance_Ice"><img src="x.png"></a> Dominance Ice</p>';
    expect(cleanHtml(html)).toBe("<p> Dominance Ice</p>");
  });

  it("keeps a link with text, forced to a new tab without referrer", () => {
    expect(cleanHtml('<a href="https://example.com">wiki</a>')).toBe(
      '<a href="https://example.com" rel="noreferrer nofollow" target="_blank">wiki</a>',
    );
  });

  it("also drops empty links from guides", () => {
    expect(cleanGuideHtml('<p><a href="/heroes/tigreal"> </a>Tigreal</p>', "en")).toBe("<p>Tigreal</p>");
  });
});
