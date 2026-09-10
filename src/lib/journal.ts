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
const DOSSIER = process.env.LOGS_DIR ?? "logs";

export type Niveau = "info" | "avertissement" | "erreur";

function fichierDuJour(niveau: Niveau): string {
  const jour = new Date().toISOString().slice(0, 10);
  return niveau === "erreur" ? `erreurs-${jour}.log` : `evenements-${jour}.log`;
}

export async function journaliser(
  niveau: Niveau,
  message: string,
  contexte: Record<string, unknown> = {},
): Promise<void> {
  const ligne = JSON.stringify({ t: new Date().toISOString(), niveau, message, ...contexte }) + "\n";

  // Sortie standard : toujours, pour les plateformes qui collectent les logs.
  (niveau === "erreur" ? console.error : console.log)(ligne.trimEnd());

  try {
    await mkdir(DOSSIER, { recursive: true });
    await appendFile(join(DOSSIER, fichierDuJour(niveau)), ligne, "utf8");
  } catch {
    // Dossier en lecture seule ou indisponible : la sortie standard suffit.
  }
}

/** Raccourci pour la journalisation d'une erreur, avec cause serialisee. */
export function journaliserErreur(
  message: string,
  cause?: unknown,
  contexte: Record<string, unknown> = {},
): Promise<void> {
  const detail =
    cause instanceof Error ? { erreur: cause.message, pile: cause.stack } : cause != null ? { erreur: String(cause) } : {};
  return journaliser("erreur", message, { ...detail, ...contexte });
}
