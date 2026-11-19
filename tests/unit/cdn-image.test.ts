import { describe, expect, it } from "vitest";
import { cdnImage } from "@/lib/player-api";

const AVATAR = "https://akmpicture.youngjoygame.com/dist/face/6021/12/62/5_new_07a4fba8.jpg";

describe("cdnImage", () => {
  it("keeps a Moonton CDN address", () => {
    expect(cdnImage(AVATAR)).toBe(AVATAR);
  });
  it("takes the address back out of the wsrv.nl proxy", () => {
    expect(cdnImage(`https://wsrv.nl/?url=${encodeURIComponent(AVATAR)}`)).toBe(AVATAR);
    expect(cdnImage("https://wsrv.nl/?url=akmpicture.youngjoygame.com/dist/face/1.jpg")).toBe("https://akmpicture.youngjoygame.com/dist/face/1.jpg");
  });
  it("refuses any other host, proxied or not", () => {
    expect(cdnImage("https://evil.example/a.jpg")).toBeNull();
    expect(cdnImage(`https://wsrv.nl/?url=${encodeURIComponent("https://evil.example/a.jpg")}`)).toBeNull();
    expect(cdnImage("")).toBeNull();
    expect(cdnImage(null)).toBeNull();
  });
});

describe("friendAvatar", () => {
  it("puts a bare path under dist/face/", async () => {
    const { friendAvatar } = await import("@/lib/mlbb-auth");
    expect(friendAvatar("6422/4/18/878881804_0.jpg")).toBe("https://akmpicture.youngjoygame.com/dist/face/6422/4/18/878881804_0.jpg");
    expect(friendAvatar("/dist/face/1/2.jpg")).toBe("https://akmpicture.youngjoygame.com/dist/face/1/2.jpg");
    expect(friendAvatar("")).toBeNull();
    expect(friendAvatar(undefined)).toBeNull();
  });
});
