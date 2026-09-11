import { NextResponse } from "next/server";
import { configPush } from "@/lib/push-serveur";

/**
 * Cle publique VAPID des notifications de patch.
 *
 * Lue a l'execution plutot que figee au build (`NEXT_PUBLIC_…`) : les cles se
 * posent sur le serveur, sans reconstruire l'image. `cle: null` signifie que
 * la fonction est desactivee — l'interface la masque alors.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ cle: configPush()?.publique ?? null }, { headers: { "Cache-Control": "no-store" } });
}
