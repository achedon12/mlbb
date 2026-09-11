"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useLangue } from "@/i18n/fournisseur";
import { prefixer } from "@/i18n/liens";

/**
 * Seules passent les adresses internes, les ancres et les liens web. Une
 * adresse venue des donnees en « javascript: » ou « data: » s'executerait au
 * clic : elle devient une ancre vide.
 */
const ADRESSE_SURE = /^(?:\/(?!\/)|#|\?|https?:\/\/|mailto:)/i;

export function adresseSure(href: string): string {
  return ADRESSE_SURE.test(href) ? href : "#";
}

/**
 * Lien interne du site : `next/link`, avec la langue courante ajoutee aux
 * adresses. Les pages ecrivent « /heroes » ; le lien pointe vers « /fr/heroes »
 * sans passer par la redirection du proxy.
 */
export default function Lien({ href, ...reste }: ComponentProps<typeof NextLink>) {
  const langue = useLangue();
  return <NextLink href={typeof href === "string" ? prefixer(adresseSure(href), langue) : href} {...reste} />;
}
