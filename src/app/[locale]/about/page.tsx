import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "A propos",
  description:
    "Ce qu'est ce site, ce qu'il contient, ce qu'il ne peut pas contenir, et comment y contribuer.",
  alternates: { canonical: "/about" },
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
          Le roster complet, les skins de chaque heros, les objets, les
          emblemes, les sorts de combat et la liste des patchs. Ces donnees
          sont extraites automatiquement du wiki communautaire chaque semaine :
          un nouveau heros apparait ici sans que personne ait a le saisir.
        </p>
        <p>
          S&apos;y ajoute ce qu&apos;aucune extraction ne produira : une analyse
          redigee pour une partie des heros — ce qu&apos;ils font vraiment,
          leurs builds, leurs contres — une tier list dont chaque placement est
          argumente, et des guides de fond.
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
          <strong>Les visuels appartiennent a Moonton.</strong> Portraits,
          icones et illustrations de skins proviennent du wiki communautaire et
          sont servis par ce site pour que rien ne depende d&apos;un domaine
          tiers. Ils restent la propriete de Moonton, sont presents a des fins
          d&apos;illustration, et seront retires sur demande de
          l&apos;ayant droit. L&apos;identite visuelle du site — bleu nuit, or,
          angles coupes — s&apos;inspire de celle du jeu sans en reprendre les
          fichiers d&apos;interface.
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
          Se connecter passe par le code de verification officiel de Moonton —
          un code a quatre chiffres envoye dans votre messagerie en jeu. Le site
          ne voit jamais votre mot de passe : il recoit un jeton temporaire,
          range dans un cookie securise, que vous effacez en vous deconnectant.
        </p>
        <p>
          Aucune base de donnees, aucun compte cree sur le site. Vos heros
          favoris sont conserves dans votre navigateur, pas sur un serveur.
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
