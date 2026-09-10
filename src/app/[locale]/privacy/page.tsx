import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui";
import { legal } from "@/lib/site";

export const metadata: Metadata = {
  title: "Confidentialite",
  description:
    "Quelles donnees ce site traite, quels cookies il utilise, et vos droits. Aucune donnee personnelle n'est conservee sur un serveur.",
  alternates: { canonical: "/privacy" },
};

export default function PageConfidentialite() {
  return (
    <>
      <EnTetePage
        titre="Confidentialite"
        chapeau="Ce que le site traite, ce qu'il ne conserve pas, et vos droits."
      />

      <div className="prose-mlbb mx-auto max-w-3xl px-4 py-14">
        <p>
          Ce site est concu pour fonctionner <strong>sans conserver de donnees
          personnelles sur un serveur</strong> : il n&apos;a pas de base de
          donnees de comptes. Cette page decrit le peu qui est traite, et ou.
        </p>

        <h2>Cookies</h2>
        <p>
          Un seul cookie peut etre depose, et uniquement si vous connectez votre
          compte de jeu :
        </p>
        <ul>
          <li>
            <strong>
              <code>mlbb_jeu</code>
            </strong>{" "}
            — cookie de session strictement necessaire a la connexion. Il
            contient le jeton temporaire remis par le service de Moonton, ne
            quitte jamais le serveur (<code>httpOnly</code>), et expire de
            lui-meme. Sans connexion, aucun cookie n&apos;est depose.
          </li>
        </ul>
        <p>
          Ce cookie etant strictement necessaire au service que vous demandez
          (rester connecte), il ne requiert pas de consentement prealable.
          Aucun cookie publicitaire ni de suivi n&apos;est utilise.
        </p>

        <h2>Stockage dans votre navigateur</h2>
        <p>
          Vos <strong>heros favoris</strong> sont enregistres dans le stockage
          local de votre navigateur (<code>localStorage</code>), sur votre
          appareil uniquement. Ils ne sont envoyes a aucun serveur et ne quittent
          pas ce navigateur. Vider les donnees du site les efface.
        </p>

        <h2>Connexion au compte de jeu</h2>
        <p>
          La connexion utilise le flux officiel de Moonton : vous fournissez
          votre identifiant et serveur de jeu, un code de verification vous est
          envoye en jeu, et le site recoit en retour un jeton temporaire. Ces
          echanges transitent par une API communautaire (
          <code>arena.rone.dev</code>) et le service d&apos;authentification de
          Moonton. Le site n&apos;enregistre <strong>rien</strong> de ces
          informations : le jeton vit dans le cookie de session, cote navigateur,
          et disparait a la deconnexion ou a l&apos;expiration. Aucun mot de
          passe ne vous est jamais demande.
        </p>

        <h2>Contenus tiers</h2>
        <p>
          Les images (portraits, icones, emblemes) sont servies par les
          hebergeurs de Moonton et du wiki communautaire. Charger une page
          adresse donc des requetes a ces services, qui peuvent voir votre
          adresse IP, comme pour toute ressource distante.
        </p>

        <h2>Mesure d&apos;audience</h2>
        <p>
          Si une mesure d&apos;audience est activee, elle l&apos;est avec un
          outil <strong>sans cookie et sans donnee personnelle</strong>, qui ne
          suit pas les visiteurs d&apos;un site a l&apos;autre. Aucun bandeau de
          consentement n&apos;est alors necessaire.
        </p>

        <h2>Vos droits</h2>
        <p>
          Le site ne constituant aucun fichier de donnees personnelles, il
          n&apos;y a rien a consulter, rectifier ou supprimer cote serveur. Vous
          gardez la main sur ce qui vit dans votre navigateur (favoris, session)
          en vous deconnectant ou en effacant les donnees du site. Pour toute
          question, ecrivez a{" "}
          <a href={`mailto:${legal.contact}`}>{legal.contact}</a>.
        </p>
      </div>
    </>
  );
}
