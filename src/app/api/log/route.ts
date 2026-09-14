import { NextResponse } from "next/server";
import { log } from "@/lib/log";

/**
 * Reception des erreurs survenues cote navigateur.
 *
 * Les frontieres d'erreur et le rapporteur global (src/components/
 * rapport-erreurs.tsx) y postent le message, la pile et le chemin : les
 * incidents clients rejoignent ainsi le meme journal que les incidents
 * serveur, plutot que de rester dans la seule console du visiteur.
 *
 * La route est publique : un corps trop gros est ignore, et une meme adresse
 * ne peut pas envoyer plus de trente rapports par minute, pour qu'un script
 * malveillant ou une boucle d'erreurs ne remplisse pas le disque.
 */
const SIZE_MAX = 8_000;
const BY_MINUTE = 30;
const sends = new Map<string, { start: number; count: number }>();

function allowed(address: string): boolean {
  const now = Date.now();
  const tracking = sends.get(address);
  if (!tracking || now - tracking.start > 60_000) {
    // La table ne garde que la minute en cours : on la vide quand elle grossit.
    if (sends.size > 5_000) sends.clear();
    sends.set(address, { start: now, count: 1 });
    return true;
  }
  tracking.count += 1;
  return tracking.count <= BY_MINUTE;
}

const text = (value: unknown, max: number) => (value == null ? undefined : String(value).slice(0, max));

export async function POST(request: Request) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "inconnue";
  if (!allowed(address)) return new NextResponse(null, { status: 429 });

  try {
    const raw = await request.text();
    if (raw.length > SIZE_MAX) return new NextResponse(null, { status: 413 });
    const body = JSON.parse(raw) as Record<string, unknown>;
    await log("error", "erreur navigateur", {
      source: "client",
      type: text(body.type, 20) ?? "frontiere",
      message: text(body.message, 500) ?? "",
      chemin: text(body.chemin, 300) ?? "",
      digest: text(body.digest, 100),
      pile: text(body.pile, 2000),
      version: text(body.version, 20),
      navigateur: text(request.headers.get("user-agent"), 200),
    });
  } catch {
    // Un rapport malforme ne doit rien casser.
  }
  return new NextResponse(null, { status: 204 });
}
