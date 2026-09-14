import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { roleOfSlug, SLUGS_ROLE } from "@/lib/tier-list-filters";
import { metaTierList, TierList } from "../../content";

type Params = { params: Promise<{ locale: Locale; role: string }> };

/** One page per role, all ranks combined: "/tier-list/role/marksman". */
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(SLUGS_ROLE).map((role) => ({ role }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, role } = await params;
  const value = roleOfSlug(role);
  return value ? metaTierList(locale, "all", { type: "role", value }) : {};
}

export default async function TierListRolePage({ params }: Params) {
  const { locale, role } = await params;
  const value = roleOfSlug(role);
  if (!value) notFound();
  return <TierList locale={locale} rank="all" filter={{ type: "role", value }} />;
}
