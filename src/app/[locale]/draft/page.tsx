import type { Metadata } from "next";
import Link from "@/components/lien";
import { OutilDraft } from "@/components/outil-draft";
import { EnTetePage } from "@/components/ui";
import { herosDraft } from "@/lib/catalogue-draft";
import { heros } from "@/lib/donnees";
import { dateLongue, patchActuel } from "@/lib/fraicheur";
import { donneesLd } from "@/lib/html";
import type { Langue } from "@/i18n/config";
import { creerT } from "@/i18n/traductions";
import { donneesOutil, metaPage } from "@/i18n/seo";

/** Description en donnees : heros couverts, date du releve et patch. */
function descriptionDraft(locale: Langue): string {
  const t = creerT(locale);
  return t("pages.seo.draft.description", { n: heros.length, date: dateLongue(locale), v: patchActuel.version });
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Langue }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = creerT(locale);
  return metaPage(locale, {
    titre: t("pages.seo.draft.titre", { v: patchActuel.version }),
    description: descriptionDraft(locale),
    partage: t("pages.draft.ogDescription"),
    chemin: "/draft",
  });
}

export default async function PageDraft({ params }: { params: Promise<{ locale: Langue }> }) {
  const { locale } = await params;
  const t = creerT(locale);
  const donneesStructurees = donneesOutil(locale, {
    nom: t("pages.draft.titre"),
    description: descriptionDraft(locale),
    chemin: "/draft",
    categorie: "GameApplication",
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: donneesLd(donneesStructurees) }}
      />
      <EnTetePage
        titre={t("pages.draft.titre")}
        chapeau={t("pages.draft.chapeau")}
      >
        <Link
          href="/tools/team"
          className="mt-5 inline-block text-sm font-semibold text-or-400 transition-colors hover:text-or-500"
        >
          {t("pages.draft.lienEquipe")} →
        </Link>
      </EnTetePage>
      <div className="mx-auto max-w-5xl px-4 py-12">
        <OutilDraft heros={herosDraft()} />

        <p className="mt-14 border-t border-nuit-800 pt-6 text-sm leading-relaxed text-craie-500">{t("pages.draft.note")}</p>
      </div>
    </>
  );
}
