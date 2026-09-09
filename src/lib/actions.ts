"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  fermerSession,
  hacherMotDePasse,
  ouvrirSession,
  utilisateurCourant,
  verifierMotDePasse,
} from "./auth";
import { db, type Utilisateur } from "./db";
import { verifierIdentifiant } from "./mlbb";

/**
 * Actions serveur du compte.
 *
 * Chaque action renvoie un objet d'etat plutot que de lancer une exception :
 * les formulaires affichent le message tel quel, et une erreur de saisie n'est
 * pas traitee comme une panne.
 */
export interface Etat {
  erreur?: string;
  succes?: string;
}

const inscription = z.object({
  pseudo: z.string().trim().min(2, "Le pseudo doit faire au moins 2 caracteres.").max(30),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide."),
  motDePasse: z.string().min(10, "Le mot de passe doit faire au moins 10 caracteres."),
});

export async function inscrire(_precedent: Etat, donnees: FormData): Promise<Etat> {
  const analyse = inscription.safeParse({
    pseudo: donnees.get("pseudo"),
    email: donnees.get("email"),
    motDePasse: donnees.get("motDePasse"),
  });

  if (!analyse.success) {
    return { erreur: analyse.error.issues[0]?.message ?? "Saisie invalide." };
  }

  const { pseudo, email, motDePasse } = analyse.data;
  const base = db();

  const existe = base.prepare("SELECT 1 FROM utilisateurs WHERE email = ?").get(email);
  if (existe) return { erreur: "Un compte existe deja avec cette adresse." };

  const resultat = base
    .prepare("INSERT INTO utilisateurs (email, pseudo, mot_de_passe) VALUES (?, ?, ?)")
    .run(email, pseudo, hacherMotDePasse(motDePasse));

  await ouvrirSession(Number(resultat.lastInsertRowid));
  redirect("/compte");
}

export async function connecter(_precedent: Etat, donnees: FormData): Promise<Etat> {
  const email = String(donnees.get("email") ?? "").trim().toLowerCase();
  const motDePasse = String(donnees.get("motDePasse") ?? "");

  if (!email || !motDePasse) return { erreur: "Renseignez votre e-mail et votre mot de passe." };

  const utilisateur = db()
    .prepare("SELECT * FROM utilisateurs WHERE email = ?")
    .get(email) as Utilisateur | undefined;

  // Message identique dans les deux cas : ne pas indiquer si l'adresse existe.
  if (!utilisateur || !verifierMotDePasse(motDePasse, utilisateur.mot_de_passe)) {
    return { erreur: "E-mail ou mot de passe incorrect." };
  }

  await ouvrirSession(utilisateur.id);
  redirect("/compte");
}

export async function deconnecter(): Promise<void> {
  await fermerSession();
  redirect("/");
}

export async function lierCompteJeu(_precedent: Etat, donnees: FormData): Promise<Etat> {
  const utilisateur = await utilisateurCourant();
  if (!utilisateur) return { erreur: "Session expiree, reconnectez-vous." };

  const identifiant = String(donnees.get("identifiant") ?? "").trim();
  const serveur = String(donnees.get("serveur") ?? "").trim();

  const resultat = await verifierIdentifiant(identifiant, serveur);

  if (!resultat.ok) {
    return {
      erreur:
        resultat.raison === "introuvable"
          ? "Aucun compte ne correspond a cet identifiant et ce serveur."
          : "Le service de verification est indisponible. Reessayez dans un moment.",
    };
  }

  db()
    .prepare(
      `INSERT INTO comptes_jeu (utilisateur_id, identifiant, serveur, pseudo_jeu)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (utilisateur_id, identifiant, serveur)
       DO UPDATE SET pseudo_jeu = excluded.pseudo_jeu, verifie_le = datetime('now')`,
    )
    .run(utilisateur.id, identifiant, serveur, resultat.pseudo);

  revalidatePath("/compte");
  return { succes: `Compte verifie : ${resultat.pseudo}.` };
}

export async function delierCompteJeu(donnees: FormData): Promise<void> {
  const utilisateur = await utilisateurCourant();
  if (!utilisateur) return;

  db()
    .prepare("DELETE FROM comptes_jeu WHERE id = ? AND utilisateur_id = ?")
    .run(Number(donnees.get("id")), utilisateur.id);

  revalidatePath("/compte");
}

export async function basculerFavori(donnees: FormData): Promise<void> {
  const utilisateur = await utilisateurCourant();
  if (!utilisateur) return;

  const heros = String(donnees.get("heros") ?? "");
  if (!heros) return;

  const base = db();
  const present = base
    .prepare("SELECT 1 FROM favoris WHERE utilisateur_id = ? AND heros = ?")
    .get(utilisateur.id, heros);

  if (present) {
    base.prepare("DELETE FROM favoris WHERE utilisateur_id = ? AND heros = ?").run(utilisateur.id, heros);
  } else {
    base.prepare("INSERT INTO favoris (utilisateur_id, heros) VALUES (?, ?)").run(utilisateur.id, heros);
  }

  revalidatePath("/compte");
  revalidatePath(`/heros/${heros}`);
}
