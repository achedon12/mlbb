import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Langue } from "@/i18n/config";
import { roleDuSlug, SLUGS_ROLE } from "@/lib/filtres-tier-list";
import { metaTierList, TierList } from "../../contenu";

type Params = { params: Promise<{ locale: Langue; role: string }> };

/** Une page par role, tous rangs confondus : « /tier-list/role/marksman ». */
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(SLUGS_ROLE).map((role) => ({ role }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, role } = await params;
  const valeur = roleDuSlug(role);
  return valeur ? metaTierList(locale, "all", { type: "role", valeur }) : {};
}

export default async function PageTierListRole({ params }: Params) {
  const { locale, role } = await params;
  const valeur = roleDuSlug(role);
  if (!valeur) notFound();
  return <TierList locale={locale} rang="all" filtre={{ type: "role", valeur }} />;
}
