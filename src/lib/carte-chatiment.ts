/**
 * Carte de resultat de l'entraineur de Chatiment, dessinee dans un canvas au
 * format des cartes de partage (1200 x 630).
 *
 * Aucune image externe : le dessin se fait hors ligne, avec les polices deja
 * chargees par la page, et rien ne quitte le navigateur tant que le joueur ne
 * partage pas.
 */
import type { Issue } from "./chatiment";

export const LARGEUR_CARTE = 1200;
export const HAUTEUR_CARTE = 630;

export interface DonneesCarte {
  marque: string;
  titre: string;
  sousTitre: string;
  score: string;
  libelleScore: string;
  stats: { libelle: string; valeur: string }[];
  manches: Issue[];
  /** Mention « nouveau record », ou null. */
  record: string | null;
  adresse: string;
  polices: { titre: string; corps: string };
}

const C = {
  fond: "#06080f",
  fondClair: "#131b30",
  or: "#f5c451",
  orSombre: "#b8871f",
  craie: "#eef2fb",
  gris: "#99a4c0",
  sang: "#d94848",
  filet: "#2a3758",
};

/** Rectangle aux coins biseautes (haut gauche, bas droit), motif de l'interface du site. */
function biseau(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, h: number, c: number) {
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + l, y);
  ctx.lineTo(x + l, y + h - c);
  ctx.lineTo(x + l - c, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

export function dessinerCarte(ctx: CanvasRenderingContext2D, d: DonneesCarte) {
  const L = LARGEUR_CARTE;
  const H = HAUTEUR_CARTE;
  const titre = (px: number) => `700 ${px}px ${d.polices.titre}`;
  const corps = (px: number, graisse = 500) => `${graisse} ${px}px ${d.polices.corps}`;

  const fond = ctx.createLinearGradient(0, 0, L, H);
  fond.addColorStop(0, C.fond);
  fond.addColorStop(1, C.fondClair);
  ctx.fillStyle = fond;
  ctx.fillRect(0, 0, L, H);
  const halo = ctx.createRadialGradient(L - 200, 110, 10, L - 200, 110, 540);
  halo.addColorStop(0, "rgba(245, 196, 81, 0.2)");
  halo.addColorStop(1, "rgba(245, 196, 81, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, L, H);

  ctx.strokeStyle = C.orSombre;
  ctx.lineWidth = 3;
  biseau(ctx, 32, 32, L - 64, H - 64, 36);
  ctx.stroke();

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.or;
  ctx.font = titre(34);
  ctx.fillText(d.marque.toUpperCase(), 80, 104);
  ctx.fillStyle = C.craie;
  ctx.font = titre(58);
  ctx.fillText(d.titre, 80, 172, L - 160);
  ctx.fillStyle = C.gris;
  ctx.font = corps(30);
  ctx.fillText(d.sousTitre, 80, 220, L - 160);

  if (d.record) {
    ctx.font = titre(28);
    const largeur = ctx.measureText(d.record).width + 44;
    const x = L - 80 - largeur;
    biseau(ctx, x, 70, largeur, 48, 12);
    ctx.fillStyle = C.or;
    ctx.fill();
    ctx.fillStyle = C.fond;
    ctx.fillText(d.record, x + 22, 104);
  }

  ctx.fillStyle = C.or;
  ctx.font = titre(150);
  ctx.fillText(d.score, 74, 388);
  const apresScore = 74 + ctx.measureText(d.score).width + 20;
  ctx.fillStyle = C.gris;
  ctx.font = corps(34);
  ctx.fillText(d.libelleScore, apresScore, 388);

  // Une case par manche : pleine si le monstre est securise, barree sinon.
  const cote = 46;
  const ecart = 14;
  const x0 = L - 80 - d.manches.length * (cote + ecart) + ecart;
  d.manches.forEach((issue, i) => {
    const x = x0 + i * (cote + ecart);
    const y = 300;
    biseau(ctx, x, y, cote, cote, 10);
    ctx.lineWidth = 3;
    if (issue === "securise") {
      ctx.fillStyle = C.or;
      ctx.fill();
      ctx.strokeStyle = C.or;
      ctx.stroke();
      return;
    }
    ctx.strokeStyle = issue === "rate" ? C.gris : C.sang;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 13, y + 13);
    ctx.lineTo(x + cote - 13, y + cote - 13);
    ctx.moveTo(x + cote - 13, y + 13);
    ctx.lineTo(x + 13, y + cote - 13);
    ctx.stroke();
  });

  const colonne = (L - 160) / Math.max(1, d.stats.length);
  d.stats.forEach((s, i) => {
    const x = 80 + i * colonne;
    ctx.fillStyle = C.gris;
    ctx.font = corps(22, 600);
    ctx.fillText(s.libelle.toUpperCase(), x, 462, colonne - 24);
    ctx.fillStyle = C.craie;
    ctx.font = titre(48);
    ctx.fillText(s.valeur, x, 514, colonne - 24);
  });

  ctx.strokeStyle = C.filet;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 545);
  ctx.lineTo(L - 80, 545);
  ctx.stroke();
  ctx.fillStyle = C.gris;
  ctx.font = corps(24);
  ctx.fillText(d.adresse, 80, 584, L - 160);
}
