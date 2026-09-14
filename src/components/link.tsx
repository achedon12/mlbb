"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useLocale } from "@/i18n/provider";
import { prefix } from "@/i18n/links";

/**
 * Only internal addresses, anchors and web links pass. An address coming
 * from the data as « javascript: » or « data: » would run on click: it
 * becomes an empty anchor.
 */
const SAFE_ADDRESS = /^(?:\/(?!\/)|#|\?|https?:\/\/|mailto:)/i;

export function safeAddress(href: string): string {
  return SAFE_ADDRESS.test(href) ? href : "#";
}

/**
 * Internal site link: `next/link`, with the current locale added to the
 * address. Pages write « /heroes »; the link points to « /fr/heroes »
 * without going through the proxy redirect.
 */
export default function Link({ href, ...rest }: ComponentProps<typeof NextLink>) {
  const locale = useLocale();
  return <NextLink href={typeof href === "string" ? prefix(safeAddress(href), locale) : href} {...rest} />;
}
