import { patchs } from "@/lib/donnees";
import { reponseApi } from "@/lib/api";

/** Versions recensees, de la plus recente a la plus ancienne. */
export const dynamic = "force-static";

export function GET() {
  return reponseApi(patchs, { total: patchs.length });
}
