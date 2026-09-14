import { patches } from "@/lib/data";
import { responseApi } from "@/lib/api";

/** Versions recensees, de la plus recente a la plus ancienne. */
export const dynamic = "force-static";

export function GET() {
  return responseApi(patches, { total: patches.length });
}
