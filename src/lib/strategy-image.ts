/**
 * PNG of a strategy plan, from the planner's own SVG.
 *
 * An SVG drawn into a canvas loads no external resource: the hero and
 * monster pictures are first read into data URLs. They come from
 * `public/visuels`, on the same domain, so the canvas is not tainted and
 * exports without a proxy. Selection rings and hit areas, marked
 * `data-export="skip"`, are left out.
 */

const SIZE = 1600;
const FOOTER = 56;
const BACKGROUND = "#06080f";
const SUBTLE = "#7b88a6";

async function dataUrl(source: string): Promise<string | null> {
  try {
    const response = await fetch(source);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportPlanImage(svg: SVGSVGElement, footer: string): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('[data-export="skip"]').forEach((n) => n.remove());
  const cache = new Map<string, Promise<string | null>>();
  await Promise.all(
    [...clone.querySelectorAll("image")].map(async (image) => {
      const href = image.getAttribute("href");
      if (!href || href.startsWith("data:")) return;
      if (!cache.has(href)) cache.set(href, dataUrl(href));
      const data = await cache.get(href)!;
      if (data) image.setAttribute("href", data);
      else image.remove();
    }),
  );
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(SIZE));
  clone.setAttribute("height", String(SIZE));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
  try {
    const picture = new Image();
    picture.src = url;
    await picture.decode();
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE + FOOTER;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(picture, 0, 0, SIZE, SIZE);
    ctx.fillStyle = SUBTLE;
    ctx.font = "600 24px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(footer, SIZE - 24, SIZE + FOOTER / 2);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
