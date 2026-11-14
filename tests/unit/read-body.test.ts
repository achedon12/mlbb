import { describe, expect, it } from "vitest";
import { readCapped } from "@/lib/read-body";

/** A body sent in chunks, without Content-Length, like a chunked upload. */
function chunked(chunks: string[]): { request: Request; pulled: () => number } {
  let pulled = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulled >= chunks.length) return controller.close();
      controller.enqueue(new TextEncoder().encode(chunks[pulled]));
      pulled += 1;
    },
  });
  const request = new Request("http://x/api", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  return { request, pulled: () => pulled };
}

describe("capped body reading", () => {
  it("reads a body within the cap", async () => {
    expect(await readCapped(new Request("http://x", { method: "POST", body: "hello" }), 5)).toBe("hello");
    expect(await readCapped(new Request("http://x", { method: "POST" }), 5)).toBe("");
  });

  it("refuses a declared length over the cap without reading", async () => {
    const request = new Request("http://x", { method: "POST", body: "x", headers: { "content-length": "999999" } });
    expect(await readCapped(request, 1024)).toBeNull();
  });

  it("stops a chunked body as soon as it passes the cap", async () => {
    const { request, pulled } = chunked(Array.from({ length: 100 }, () => "x".repeat(1024)));
    expect(await readCapped(request, 4 * 1024)).toBeNull();
    expect(pulled()).toBeLessThan(10);
  });

  it("counts bytes, not characters", async () => {
    expect(await readCapped(new Request("http://x", { method: "POST", body: "éé" }), 3)).toBeNull();
    expect(await readCapped(new Request("http://x", { method: "POST", body: "éé" }), 4)).toBe("éé");
  });
});
