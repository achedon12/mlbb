/**
 * Carte de resultat de l'entraineur de Chatiment, dessinee dans un canvas au
 * format des cartes de partage (1200 x 630) : en image fixe, ou animee et
 * filmee en une courte video — le score qui monte, les manches qui tombent une
 * a une, l'eclair sur le monstre.
 *
 * Aucune image externe : le dessin se fait hors ligne, avec les polices deja
 * chargees par la page et le portrait local du monstre, et rien ne quitte le
 * navigateur tant que le joueur ne partage pas.
 */
import type { Issue } from "./chatiment";

export const LARGEUR_CARTE = 1200;
export const HAUTEUR_CARTE = 630;
/** Duree de l'animation, puis de la video : l'image finale reste un moment a l'ecran. */
export const DUREE_ANIMATION_MS = 2600;
export const DUREE_VIDEO_MS = 4200;

export interface DonneesCarte {
  marque: string;
  titre: string;
  sousTitre: string;
  total: number;
  /** Mise en forme des nombres dans la langue de la page. */
  formater: (n: number) => string;
  libelleScore: string;
  stats: { libelle: string; valeur: string }[];
  manches: Issue[];
  /** Mention « nouveau record », ou null. */
  record: string | null;
  adresse: string;
  polices: { titre: string; corps: string };
  /** Portrait du monstre, deja charge ; null s'il n'a pas pu l'etre. */
  portrait: CanvasImageSource | null;
  /** Teinte du monstre : halo et anneau du portrait. */
  teinte: string;
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

const borne = (x: number) => Math.min(1, Math.max(0, x));
const adoucir = (x: number) => 1 - (1 - x) ** 3;
/** Leger depassement avant de se poser, pour les elements qui « tombent ». */
const rebond = (x: number) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;
/** Avancement (0 a 1) d'un element anime entre deux instants de l'animation. */
const avance = (t: number, debut: number, fin: number) => borne((t - debut) / (fin - debut));

/** Dessine `trace` a l'echelle `s` autour de (cx, cy). */
function aEchelle(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, trace: () => void) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.translate(-cx, -cy);
  trace();
  ctx.restore();
}

/**
 * Dessine la carte. `t` va de 0 (debut de l'animation) a 1 (image finale,
 * celle de la carte fixe).
 */
export function dessinerCarte(ctx: CanvasRenderingContext2D, d: DonneesCarte, t = 1) {
  const L = LARGEUR_CARTE;
  const H = HAUTEUR_CARTE;
  const titre = (px: number) => `700 ${px}px ${d.polices.titre}`;
  const corps = (px: number, graisse = 500) => `${graisse} ${px}px ${d.polices.corps}`;
  const securise = d.manches.includes("securise");
  // L'eclair tombe quand le score finit de monter : trois eclats rapides.
  const eclair = securise ? [0, 0.9, 0.35, 1, 0][Math.floor(avance(t, 0.56, 0.8) * 4.999)] * (t < 0.8 ? 1 : 0) : 0;

  ctx.globalAlpha = 1;
  const fond = ctx.createLinearGradient(0, 0, L, H);
  fond.addColorStop(0, C.fond);
  fond.addColorStop(1, C.fondClair);
  ctx.fillStyle = fond;
  ctx.fillRect(0, 0, L, H);
  const halo = ctx.createRadialGradient(L - 200, 190, 10, L - 200, 190, 560);
  halo.addColorStop(0, `rgba(245, 196, 81, ${0.2 + 0.2 * eclair})`);
  halo.addColorStop(1, "rgba(245, 196, 81, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, L, H);

  ctx.strokeStyle = C.orSombre;
  ctx.lineWidth = 3;
  biseau(ctx, 32, 32, L - 64, H - 64, 36);
  ctx.stroke();

  // En-tete : il glisse en place au tout debut.
  const entree = adoucir(avance(t, 0, 0.16));
  ctx.globalAlpha = entree;
  ctx.textBaseline = "alphabetic";
  const decalage = (1 - entree) * 16;
  ctx.fillStyle = C.or;
  ctx.font = titre(34);
  ctx.fillText(d.marque.toUpperCase(), 80, 104 + decalage);
  ctx.fillStyle = C.craie;
  ctx.font = titre(58);
  ctx.fillText(d.titre, 80, 172 + decalage, L - 440);
  ctx.fillStyle = C.gris;
  ctx.font = corps(30);
  ctx.fillText(d.sousTitre, 80, 220 + decalage, L - 440);
  ctx.globalAlpha = 1;

  // Portrait du monstre : il apparait, tremble sous les coups, puis l'eclair le frappe.
  const px = L - 190;
  const py = 200;
  const r = 80;
  const apparition = rebond(avance(t, 0.04, 0.24));
  const tremble = t > 0.26 && t < 0.56 ? Math.sin(t * 190) * 4 * (1 - avance(t, 0.26, 0.56)) : 0;
  if (apparition > 0) {
    aEchelle(ctx, px, py, apparition, () => {
      const lueur = ctx.createRadialGradient(px, py, r * 0.6, px, py, r * 1.9);
      lueur.addColorStop(0, `${d.teinte}88`);
      lueur.addColorStop(1, `${d.teinte}00`);
      ctx.fillStyle = lueur;
      ctx.fillRect(px - r * 2, py - r * 2, r * 4, r * 4);
      ctx.save();
      ctx.beginPath();
      ctx.arc(px + tremble, py, r, 0, Math.PI * 2);
      ctx.clip();
      if (d.portrait) ctx.drawImage(d.portrait, px + tremble - r, py - r, r * 2, r * 2);
      else {
        ctx.fillStyle = C.fondClair;
        ctx.fill();
      }
      if (eclair > 0) {
        ctx.fillStyle = `rgba(255, 245, 207, ${0.55 * eclair})`;
        ctx.fillRect(px - r, py - r, r * 2, r * 2);
      }
      ctx.restore();
      ctx.strokeStyle = d.teinte;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(px + tremble, py, r, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
  if (eclair > 0) {
    ctx.save();
    ctx.globalAlpha = eclair;
    ctx.shadowColor = C.or;
    ctx.shadowBlur = 30;
    ctx.fillStyle = "#fff5cf";
    ctx.strokeStyle = C.or;
    ctx.lineWidth = 3;
    // Le trace de l'eclair de la page, a l'echelle du portrait (64 x 128).
    const e = (2.1 * r) / 128;
    const ox = px - 32 * e;
    const oy = py - r * 1.35;
    const points = [[40, 0], [14, 72], [31, 72], [20, 128], [54, 50], [36, 50], [48, 0]];
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x * e, oy + y * e) : ctx.moveTo(ox + x * e, oy + y * e)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  if (d.record) {
    const pop = rebond(avance(t, 0.8, 0.92));
    if (pop > 0) {
      ctx.font = titre(28);
      const largeur = ctx.measureText(d.record).width + 44;
      const x = L - 80 - largeur;
      aEchelle(ctx, x + largeur / 2, 94, pop, () => {
        biseau(ctx, x, 70, largeur, 48, 12);
        ctx.fillStyle = C.or;
        ctx.fill();
        ctx.fillStyle = C.fond;
        ctx.fillText(d.record!, x + 22, 104);
      });
    }
  }

  // Le score monte de zero ; son libelle, place d'apres le score final,
  // n'apparait qu'a la fin du decompte, quand le chiffre l'a rejoint.
  ctx.globalAlpha = entree;
  ctx.font = titre(150);
  const largeurScore = ctx.measureText(d.formater(d.total)).width;
  ctx.fillStyle = C.or;
  ctx.fillText(d.formater(Math.round(d.total * adoucir(avance(t, 0.14, 0.58)))), 74, 388);
  ctx.globalAlpha = adoucir(avance(t, 0.5, 0.62));
  ctx.fillStyle = C.gris;
  ctx.font = corps(34);
  ctx.fillText(d.libelleScore, 74 + largeurScore + 20, 388);

  // Une case par manche : pleine si le monstre est securise, barree sinon.
  // Elles tombent l'une apres l'autre pendant que le score monte.
  const cote = 46;
  const ecart = 14;
  const x0 = L - 80 - d.manches.length * (cote + ecart) + ecart;
  d.manches.forEach((issue, i) => {
    const x = x0 + i * (cote + ecart);
    const y = 300;
    ctx.globalAlpha = entree;
    biseau(ctx, x, y, cote, cote, 10);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.filet;
    ctx.stroke();
    const chute = rebond(avance(t, 0.2 + i * 0.075, 0.3 + i * 0.075));
    if (chute <= 0) return;
    ctx.globalAlpha = 1;
    aEchelle(ctx, x + cote / 2, y + cote / 2, chute, () => {
      biseau(ctx, x, y, cote, cote, 10);
      if (issue === "securise") {
        ctx.fillStyle = C.or;
        ctx.fill();
        ctx.strokeStyle = C.or;
        ctx.stroke();
        return;
      }
      ctx.fillStyle = C.fond;
      ctx.fill();
      ctx.strokeStyle = issue === "rate" ? C.gris : C.sang;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 13, y + 13);
      ctx.lineTo(x + cote - 13, y + cote - 13);
      ctx.moveTo(x + cote - 13, y + 13);
      ctx.lineTo(x + 13, y + cote - 13);
      ctx.stroke();
    });
  });

  const colonne = (L - 160) / Math.max(1, d.stats.length);
  d.stats.forEach((s, i) => {
    const a = adoucir(avance(t, 0.58 + i * 0.05, 0.74 + i * 0.05));
    ctx.globalAlpha = a;
    const x = 80 + i * colonne;
    const y = (1 - a) * 18;
    ctx.fillStyle = C.gris;
    ctx.font = corps(22, 600);
    ctx.fillText(s.libelle.toUpperCase(), x, 462 + y, colonne - 24);
    ctx.fillStyle = C.craie;
    ctx.font = titre(48);
    ctx.fillText(s.valeur, x, 514 + y, colonne - 24);
  });

  ctx.globalAlpha = entree;
  ctx.strokeStyle = C.filet;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 545);
  ctx.lineTo(L - 80, 545);
  ctx.stroke();
  ctx.fillStyle = C.gris;
  ctx.font = corps(24);
  ctx.fillText(d.adresse, 80, 584, L - 160);
  ctx.globalAlpha = 1;
}

/** Formats essayes, du plus partageable (MP4, lu partout) au plus repandu cote enregistrement (WebM). */
const FORMATS_VIDEO = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];

/**
 * Filme la carte animee : quelques secondes enregistrees en temps reel depuis
 * un canvas hors page. Null quand le navigateur ne sait pas enregistrer.
 */
export async function filmerCarte(d: DonneesCarte): Promise<Blob | null> {
  if (typeof MediaRecorder === "undefined") return null;
  const format = FORMATS_VIDEO.find((f) => MediaRecorder.isTypeSupported(f));
  const canvas = document.createElement("canvas");
  canvas.width = LARGEUR_CARTE;
  canvas.height = HAUTEUR_CARTE;
  const ctx = canvas.getContext("2d");
  if (!format || !ctx || typeof canvas.captureStream !== "function") return null;

  dessinerCarte(ctx, d, 0);
  const flux = canvas.captureStream(30);
  const enregistreur = new MediaRecorder(flux, { mimeType: format, videoBitsPerSecond: 5_000_000 });
  const morceaux: Blob[] = [];
  enregistreur.ondataavailable = (e) => {
    if (e.data.size) morceaux.push(e.data);
  };
  const arret = new Promise<void>((ok) => {
    enregistreur.onstop = () => ok();
  });
  enregistreur.start();
  await new Promise<void>((ok) => {
    const debut = performance.now();
    const image = (instant: number) => {
      const ecoule = instant - debut;
      dessinerCarte(ctx, d, Math.min(1, ecoule / DUREE_ANIMATION_MS));
      if (ecoule < DUREE_VIDEO_MS) requestAnimationFrame(image);
      else ok();
    };
    requestAnimationFrame(image);
  });
  enregistreur.stop();
  await arret;
  flux.getTracks().forEach((piste) => piste.stop());
  return morceaux.length ? new Blob(morceaux, { type: format.split(";")[0] }) : null;
}
