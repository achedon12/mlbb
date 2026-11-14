import { absoluteImage, localeParam, responseApi } from "@/lib/api";
import { spellSheets, textChoice } from "@/lib/usage-sheets";
import { battleSpells } from "@/data/emblems";
import { createT } from "@/i18n/translations";

/**
 * Battle spells, as their pages name them (`/spells/{slug}`): effect,
 * cooldown in seconds and who the spell is for. `?locale=` picks the
 * language (English by default).
 */
// Reads `?locale=`: a static response would ignore it.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const t = createT(localeParam(new URL(request.url).searchParams));
  const results = spellSheets.map(({ slug, name, cooldown, image }) => {
    const known = battleSpells.find((s) => s.key === slug);
    return {
      slug,
      name: textChoice(t, slug, "name", name),
      description: textChoice(t, slug, "description", null),
      cooldown,
      roles: known?.roles ?? [],
      bestFor: textChoice(t, slug, "bestFor", null),
      image: absoluteImage(image),
    };
  });
  return responseApi(results, { total: results.length });
}
