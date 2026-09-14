"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useLocale } from "@/i18n/provider";
import { prefix } from "@/i18n/links";

/**
 * Seules passent les adresses internes, les ancres et les liens web. Une
 * adresse venue des donnees en « javascript: » ou « data: » s'executerait au
 * clic : elle devient une ancre vide.
 */
const SAFE_ADDRESS = /^(?:\/(?!\/)|#|\?|https?:\/\/|mailto:)/i;

export function safeAddress(href: string): string {
  return SAFE_ADDRESS.test(href) ? href : "#";
}

/**
 * Lien interne du site : `next/link`, avec la langue courante ajoutee aux
 * adresses. Les pages ecrivent « /heroes » ; le lien pointe vers « /fr/heroes »
 * sans passer par la redirection du proxy.
 */
export default function Link({ href, ...rest }: ComponentProps<typeof NextLink>) {
  const locale = useLocale();
  return <NextLink href={typeof href === "string" ? prefix(safeAddress(href), locale) : href} {...rest} />;
}
