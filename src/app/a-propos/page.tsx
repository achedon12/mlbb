import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "A propos",
  description:
    "Ce qu'est ce site, ce qu'il contient, ce qu'il ne peut pas contenir, et comment y contribuer.",
  alternates: { canonical: "/a-propos" },
};

export default function PageAPropos() {
  return (
    <>
      <EnTetePage
        titre="A propos"
        chapeau="Un projet independant, ouvert, et volontairement explicite sur ses limites."
      />

      <div className="prose-mlbb mx-auto max-w-3xl px-4 py-14">
        <h2>Ce que contient le site</h2>
        <p>
          Le roster complet du jeu avec ses attributs verifies, des fiches
          detaillees pour les heros dont les competences, les builds et les
          contres ont ete controles, une tier list argumentee, les objets, les
          emblemes, les sorts de combat, ainsi que des guides et des resumes de
          patch.
        </p>

        <h2>Ce qu&apos;il ne contient pas, et pourquoi</h2>
        <p>
          <strong>Aucune statistique de joueur.</strong> Moonton ne publie
          aucune interface de programmation : ni classement, ni historique de
          parties, ni indice de competence, ni statut de connexion. Les sites
          qui affichent un « MMR » pour Mobile Legends l&apos;estiment ; ils ne
          le lisent nulle part.
        </p>
        <p>
          La seule information reellement verifiable de l&apos;exterieur est le
          pseudo associe a un identifiant de joueur, via l&apos;etape de
          validation des plateformes de recharge. C&apos;est exactement ce que
          fait la liaison de compte proposee ici, et rien de plus.
        </p>
        <p>
          <strong>Aucune ressource graphique redistribuee.</strong> Les
          portraits de heros affiches ici appartiennent a Moonton : ils ne sont
          pas copies dans ce projet, mais charges depuis le wiki communautaire
          qui les heberge. Aucun fichier d&apos;image du jeu ne figure dans le
          depot. L&apos;identite visuelle du site — bleu nuit, or, angles
          coupes — s&apos;inspire de celle du jeu sans en reprendre les
          fichiers.
        </p>

        <h2>La veille</h2>
        <p>
          La section veille rassemble automatiquement les publications
          d&apos;autres sites sur le jeu. Elle n&apos;en affiche que le titre,
          la date et un court extrait, et renvoie systematiquement vers
          l&apos;editeur d&apos;origine : rien n&apos;y est republie.
        </p>
        <p>
          Moonton ne publie aucun flux officiel — le site du jeu est une
          application dont le contenu n&apos;est pas diffusable. Les mises a
          jour du jeu sont donc reprises et commentees a la main dans les patch
          notes, tandis que la veille couvre ce que publie le reste du web.
        </p>

        <h2>Le compte</h2>
        <p>
          Il est facultatif : tout le contenu est accessible sans se connecter.
          Un compte sert uniquement a conserver ses heros favoris et a lier un
          identifiant de jeu verifie. Les donnees stockees se limitent a une
          adresse e-mail, un pseudo, un mot de passe chiffre, et les
          identifiants de jeu que vous choisissez d&apos;ajouter. Aucun
          traceur, aucune mesure d&apos;audience tierce.
        </p>

        <h2>Contribuer</h2>
        <p>
          Le code et le contenu sont publics. Les fiches heros vivent dans des
          fichiers TypeScript types, les articles dans des fichiers Markdown :
          on peut ajouter une fiche ou corriger une erreur sans connaitre le
          reste du projet.
        </p>
        <p>
          <a href={site.depot} rel="noreferrer">Le depot est ici.</a>{" "}
          Les corrections d&apos;equilibrage, les fiches manquantes et les
          relectures sont particulierement bienvenues.
        </p>

        <h2>Mentions</h2>
        <p>
          Mobile Legends: Bang Bang, son univers, ses heros et leurs noms sont
          des marques deposees de Shanghai Moonton Technology Co., Ltd. Ce site
          est un projet de fan independant, sans affiliation, ni approbation, ni
          parrainage de Moonton.
        </p>
      </div>
    </>
  );
}
