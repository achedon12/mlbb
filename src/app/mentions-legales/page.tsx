import type { Metadata } from "next";
import { EnTetePage } from "@/components/ui";
import { legal, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mentions legales",
  description:
    "Editeur, hebergeur et proprietaires des contenus du site. Projet de fan independant, sans affiliation avec Moonton.",
  alternates: { canonical: "/mentions-legales" },
};

export default function PageMentionsLegales() {
  return (
    <>
      <EnTetePage
        titre="Mentions legales"
        chapeau="Qui edite ce site, qui l'heberge, et a qui appartiennent les contenus."
      />

      <div className="prose-mlbb mx-auto max-w-3xl px-4 py-14">
        <h2>Editeur</h2>
        <p>
          Ce site est edite a titre personnel par{" "}
          <a href={legal.editeurSite} rel="noreferrer" target="_blank">
            {legal.editeur}
          </a>
          , dans le cadre d&apos;un projet de fan independant, sans but lucratif
          et sans structure commerciale. Il ne s&apos;agit pas d&apos;une
          entreprise.
        </p>
        <p>
          Contact :{" "}
          <a href={`mailto:${legal.contact}`}>{legal.contact}</a>
        </p>

        <h2>Hebergeur</h2>
        <p>
          Le site est heberge par{" "}
          <a href={legal.hebergeurSite} rel="noreferrer" target="_blank">
            {legal.hebergeur}
          </a>
          .
        </p>

        <h2>Propriete intellectuelle</h2>
        <p>
          <strong>
            Mobile Legends: Bang Bang, son univers, ses heros, leurs noms et
            leurs representations graphiques
          </strong>{" "}
          sont des marques et des oeuvres de <strong>Shanghai Moonton
          Technology Co., Ltd.</strong> Ce site est un projet de fan
          independant, sans affiliation, ni approbation, ni parrainage de
          Moonton.
        </p>
        <p>
          Les visuels affiches (portraits, icones, emblemes, illustrations)
          proviennent du wiki communautaire et restent la propriete de Moonton.
          Ils sont inclus a des fins d&apos;illustration et d&apos;information.
          Sur demande de l&apos;ayant droit, ils seront retires.
        </p>
        <p>
          Les donnees factuelles proviennent du{" "}
          <a href="https://mobilelegends.fandom.com" rel="noreferrer nofollow" target="_blank">
            wiki Mobile Legends
          </a>{" "}
          (licence CC BY-SA) et d&apos;une API communautaire. Le code et les
          textes rediges pour ce site sont publies sous licence MIT — voir le{" "}
          <a href={site.depot} rel="noreferrer" target="_blank">
            depot public
          </a>
          .
        </p>

        <h2>Responsabilite</h2>
        <p>
          Les informations sont fournies a titre indicatif, sans garantie
          d&apos;exactitude ni d&apos;exhaustivite : le jeu evolue, et certaines
          donnees peuvent etre en retard sur une mise a jour. Les liens vers des
          sites tiers n&apos;engagent que leurs auteurs.
        </p>

        <h2>Donnees personnelles</h2>
        <p>
          Le traitement des donnees et l&apos;usage des cookies sont detailles
          dans la{" "}
          <a href="/confidentialite">politique de confidentialite</a>.
        </p>
      </div>
    </>
  );
}
