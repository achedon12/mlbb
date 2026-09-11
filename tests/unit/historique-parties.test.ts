import { afterEach, describe, expect, it, vi } from "vitest";
import { historiqueParties } from "@/lib/mlbb-auth";
import { pageHistorique, partieBrute } from "./echantillons-joueur";

/**
 * Pagination de l'historique, service simule : chaque page repond selon son
 * curseur. Le jeton change a chaque test, la memoire des reponses etant
 * indexee par jeton.
 */
const CURSEURS = ["4143043017340290910", "4143043017340290911", "4143043017340290912"];

/** Trois pages de vingt, puis une de cinq ; la deuxieme repete la derniere partie de la premiere. */
const serie = (debut: number, n: number, hid: number, lid: number, res: 0 | 1, ts: number) =>
  Array.from({ length: n }, (_, i) => partieBrute(debut + i, hid, lid, res, ts - i));
const PAGES: Record<string, string> = {
  "": pageHistorique(serie(0, 20, 84, 4, 1, 1774857999), CURSEURS[0]),
  [CURSEURS[0]]: pageHistorique(serie(19, 20, 20, 3, 0, 1774850000), CURSEURS[1]),
  [CURSEURS[1]]: pageHistorique(serie(39, 20, 17, 4, 1, 1774840000), CURSEURS[2]),
  [CURSEURS[2]]: pageHistorique(serie(59, 5, 36, 2, 0, 1774830000), null),
};

type Reponse = Response | Promise<Response>;

function service(repondre: (curseur: string) => Reponse | undefined) {
  const appels: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const curseur = new URL(url).searchParams.get("last_cursor") ?? "";
      appels.push(curseur);
      return Promise.resolve(repondre(curseur) ?? new Response(PAGES[curseur], { status: 200 }));
    }),
  );
  return appels;
}

let n = 0;
const jeton = () => `jeton-historique-${++n}`;

afterEach(() => vi.unstubAllGlobals());

describe("historiqueParties", () => {
  it("enchaine les pages jusqu'au plafond, sans doublon", async () => {
    const appels = service(() => undefined);
    const r = await historiqueParties(jeton(), 40);
    expect(r.etat).toBe("ok");
    if (r.etat !== "ok") return;
    // 65 entrees, dont une repetee d'une page a l'autre.
    expect(r.donnees.parties).toHaveLength(64);
    expect(new Set(r.donnees.parties.map((p) => p.id)).size).toBe(64);
    expect(r.donnees.fin).toBe(true);
    // Curseurs transmis intacts, malgre leurs 19 chiffres.
    expect(appels).toEqual(["", ...CURSEURS]);
  });

  it("s'arrete au nombre demande et le dit", async () => {
    const appels = service(() => undefined);
    const r = await historiqueParties(jeton(), 40, 30);
    expect(r).toMatchObject({ etat: "ok", donnees: { fin: false } });
    if (r.etat === "ok") expect(r.donnees.parties).toHaveLength(30);
    expect(appels).toHaveLength(2);
  });

  it("garde ce qui est lu quand une page suivante manque", async () => {
    service((c) => (c === CURSEURS[0] ? new Response("", { status: 502 }) : undefined));
    const r = await historiqueParties(jeton(), 40);
    expect(r).toMatchObject({ etat: "ok", donnees: { fin: false } });
    if (r.etat === "ok") expect(r.donnees.parties).toHaveLength(20);
  });

  it("n'attend pas une page lente au-dela du budget", async () => {
    service((c) => (c === CURSEURS[0] ? new Promise<Response>(() => {}) : undefined));
    const debut = Date.now();
    const r = await historiqueParties(jeton(), 40, 100, 50);
    expect(Date.now() - debut).toBeLessThan(2000);
    if (r.etat === "ok") expect(r.donnees.parties).toHaveLength(20);
    else expect.unreachable();
  });

  it("signale une session expiree et une premiere page indisponible", async () => {
    service(() => new Response("", { status: 401 }));
    expect(await historiqueParties(jeton(), 40)).toEqual({ etat: "expire" });
    service(() => new Response('{"code":10407,"data":null}', { status: 200 }));
    expect(await historiqueParties(jeton(), 40)).toEqual({ etat: "indisponible" });
    expect(await historiqueParties(jeton(), 0)).toEqual({ etat: "indisponible" });
  });

  it("ne tourne pas en rond sur un curseur qui ne bouge pas", async () => {
    const boucle = pageHistorique([partieBrute(1, 84, 4, 1, 1774857999)], CURSEURS[0]);
    const appels = service(() => new Response(boucle, { status: 200 }));
    const r = await historiqueParties(jeton(), 40);
    expect(r).toMatchObject({ etat: "ok", donnees: { fin: true } });
    expect(appels).toHaveLength(2);
  });
});
