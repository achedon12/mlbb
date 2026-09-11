import { couleurTexte, type EtatTier } from "./createur-tier";

/**
 * Image d'une tier list, dessinee dans un canevas du navigateur.
 *
 * Les vignettes viennent de `public/visuels`, sur le meme domaine : le canevas
 * n'est pas « teinte » et s'exporte en PNG sans proxy ni en-tete CORS.
 */

const LARGEUR = 1200;
const MARGE = 24;
const ETIQUETTE = 150;
const ICONE = 72;
const ECART = 6;
const ENTETE = 88;
const PIED = 48;
const INTERLIGNE = 4;

const FOND = "#06080f";
const SURFACE = "#0e1424";
const TEXTE = "#eef2fb";
const DISCRET = "#7b88a6";

interface VignetteImage {
  nom: string;
  icone: string | null;
}

async function charger(source: string): Promise<HTMLImageElement | null> {
  const image = new Image();
  image.src = source;
  try {
    await image.decode();
    return image;
  } catch {
    return null;
  }
}

/** Police des titres du site (`next/font`), si elle est chargee ; sinon celle du systeme. */
async function policeTitre(): Promise<string> {
  const famille = getComputedStyle(document.documentElement).getPropertyValue("--heading-font").trim();
  const police = famille ? `${famille}, sans-serif` : "sans-serif";
  try {
    await document.fonts.load(`700 40px ${police}`);
  } catch {
    /* police de secours */
  }
  return police;
}

/** Plus grande taille, de `max` a 14 px, a laquelle le texte tient dans `largeur`. */
function ajuster(ctx: CanvasRenderingContext2D, texte: string, police: string, largeur: number, max: number) {
  for (let taille = max; taille > 14; taille -= 2) {
    ctx.font = `700 ${taille}px ${police}`;
    if (ctx.measureText(texte).width <= largeur) return;
  }
  ctx.font = `700 14px ${police}`;
}

export async function exporterImage(
  etat: EtatTier,
  o: { titre: string; pied: string; heros: Map<string, VignetteImage> },
): Promise<Blob> {
  const police = await policeTitre();
  const parLigne = Math.floor((LARGEUR - 2 * MARGE - ETIQUETTE - ECART) / (ICONE + ECART));
  const hauteurs = etat.rangees.map(
    (r) => Math.max(1, Math.ceil(r.heros.length / parLigne)) * (ICONE + ECART) + ECART,
  );
  const hauteur = ENTETE + hauteurs.reduce((a, b) => a + b, 0) + INTERLIGNE * (etat.rangees.length - 1) + PIED;

  const canevas = document.createElement("canvas");
  canevas.width = LARGEUR;
  canevas.height = hauteur;
  const ctx = canevas.getContext("2d");
  if (!ctx) throw new Error("canvas");

  const slugs = [...new Set(etat.rangees.flatMap((r) => r.heros))];
  const images = new Map(
    await Promise.all(
      slugs.map(async (s) => {
        const source = o.heros.get(s)?.icone;
        return [s, source ? await charger(source) : null] as const;
      }),
    ),
  );

  ctx.fillStyle = FOND;
  ctx.fillRect(0, 0, LARGEUR, hauteur);
  ctx.textBaseline = "middle";

  ctx.fillStyle = TEXTE;
  ajuster(ctx, o.titre, police, LARGEUR - 2 * MARGE, 40);
  ctx.fillText(o.titre, MARGE, ENTETE / 2);

  let y = ENTETE;
  etat.rangees.forEach((r, i) => {
    const h = hauteurs[i];
    ctx.fillStyle = r.couleur;
    ctx.fillRect(MARGE, y, ETIQUETTE, h);
    ctx.fillStyle = SURFACE;
    ctx.fillRect(MARGE + ETIQUETTE, y, LARGEUR - 2 * MARGE - ETIQUETTE, h);

    ctx.fillStyle = couleurTexte(r.couleur);
    ctx.textAlign = "center";
    ajuster(ctx, r.nom, police, ETIQUETTE - 16, 44);
    ctx.fillText(r.nom, MARGE + ETIQUETTE / 2, y + h / 2);
    ctx.textAlign = "left";

    r.heros.forEach((slug, k) => {
      const x = MARGE + ETIQUETTE + ECART + (k % parLigne) * (ICONE + ECART);
      const yy = y + ECART + Math.floor(k / parLigne) * (ICONE + ECART);
      const image = images.get(slug);
      if (image) {
        // Recadrage carre, cale en haut : un portrait garde le visage.
        const cote = Math.min(image.naturalWidth, image.naturalHeight);
        ctx.drawImage(image, (image.naturalWidth - cote) / 2, 0, cote, cote, x, yy, ICONE, ICONE);
      } else {
        const nom = o.heros.get(slug)?.nom ?? slug;
        ctx.fillStyle = "#1c2742";
        ctx.fillRect(x, yy, ICONE, ICONE);
        ctx.fillStyle = TEXTE;
        ctx.textAlign = "center";
        ajuster(ctx, nom, police, ICONE - 6, 16);
        ctx.fillText(nom, x + ICONE / 2, yy + ICONE / 2);
        ctx.textAlign = "left";
      }
    });
    y += h + INTERLIGNE;
  });

  ctx.fillStyle = DISCRET;
  ctx.font = `600 20px ${police}`;
  ctx.fillText(o.pied, MARGE, hauteur - PIED / 2);

  return new Promise((resoudre, rejeter) =>
    canevas.toBlob((blob) => (blob ? resoudre(blob) : rejeter(new Error("toBlob"))), "image/png"),
  );
}
