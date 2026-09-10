"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useLangue } from "@/i18n/fournisseur";
import { prefixer } from "@/i18n/liens";

/**
 * Lien interne du site : `next/link`, avec la langue courante ajoutee aux
 * adresses. Les pages ecrivent « /heroes » ; le lien pointe vers « /fr/heroes »
 * sans passer par la redirection du proxy.
 */
export default function Lien({ href, ...reste }: ComponentProps<typeof NextLink>) {
  const langue = useLangue();
  return <NextLink href={typeof href === "string" ? prefixer(href, langue) : href} {...reste} />;
}
