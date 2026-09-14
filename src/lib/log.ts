import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Journal serveur.
 *
 * Les erreurs partent toujours vers la sortie standard — captee par le
 * conteneur — et, quand le dossier est inscriptible, dans un fichier range par
 * jour sous `logs/`. Les erreurs sont ecrites a part des evenements ordinaires
 * pour se retrouver d'un coup d'oeil. Le journal ne doit jamais interrompre une
 * requete : toute panne d'ecriture est avalee.
 */
const FOLDER = process.env.LOGS_DIR ?? "logs";

export type Level = "info" | "warning" | "error";

function fileOfDay(level: Level): string {
  const day = new Date().toISOString().slice(0, 10);
  return level === "error" ? `erreurs-${day}.log` : `evenements-${day}.log`;
}

export async function log(
  level: Level,
  message: string,
  context: Record<string, unknown> = {},
): Promise<void> {
  const row = JSON.stringify({ t: new Date().toISOString(), niveau: level, message, ...context }) + "\n";

  // Sortie standard : toujours, pour les plateformes qui collectent les logs.
  (level === "error" ? console.error : console.log)(row.trimEnd());

  try {
    await mkdir(FOLDER, { recursive: true });
    await appendFile(join(FOLDER, fileOfDay(level)), row, "utf8");
  } catch {
    // Dossier en lecture seule ou indisponible : la sortie standard suffit.
  }
}

/** Raccourci pour la journalisation d'une erreur, avec cause serialisee. */
export function logError(
  message: string,
  cause?: unknown,
  context: Record<string, unknown> = {},
): Promise<void> {
  const detail =
    cause instanceof Error ? { erreur: cause.message, pile: cause.stack } : cause != null ? { erreur: String(cause) } : {};
  return log("error", message, { ...detail, ...context });
}
