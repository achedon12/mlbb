import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * Base de donnees du site.
 *
 * SQLite suffit largement : le site ne stocke que des comptes et des favoris,
 * et tout tient dans un fichier que l'on peut sauvegarder d'un `cp`. Le chemin
 * est configurable pour que le conteneur puisse le placer sur un volume.
 */
const CHEMIN = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "mlbb.db");

let instance: Database.Database | null = null;

export function db(): Database.Database {
  if (instance) return instance;

  fs.mkdirSync(path.dirname(CHEMIN), { recursive: true });

  const base = new Database(CHEMIN);
  // WAL : lectures concurrentes sans blocage, ce qui suffit au trafic vise.
  base.pragma("journal_mode = WAL");
  base.pragma("foreign_keys = ON");

  base.exec(`
    CREATE TABLE IF NOT EXISTS utilisateurs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    NOT NULL UNIQUE,
      pseudo        TEXT    NOT NULL,
      mot_de_passe  TEXT    NOT NULL,
      cree_le       TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Un compte de jeu lie, verifie via l'endpoint de validation d'identifiant.
    -- On ne stocke que ce qui est reellement verifiable : identifiant, serveur
    -- et pseudo retourne. Aucune statistique n'est disponible cote Moonton.
    CREATE TABLE IF NOT EXISTS comptes_jeu (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
      identifiant    TEXT    NOT NULL,
      serveur        TEXT    NOT NULL,
      pseudo_jeu     TEXT    NOT NULL,
      verifie_le     TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE (utilisateur_id, identifiant, serveur)
    );

    CREATE TABLE IF NOT EXISTS favoris (
      utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
      heros          TEXT    NOT NULL,
      ajoute_le      TEXT    NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (utilisateur_id, heros)
    );
  `);

  instance = base;
  return base;
}

export interface Utilisateur {
  id: number;
  email: string;
  pseudo: string;
  mot_de_passe: string;
  cree_le: string;
}

export interface CompteJeu {
  id: number;
  utilisateur_id: number;
  identifiant: string;
  serveur: string;
  pseudo_jeu: string;
  verifie_le: string;
}
