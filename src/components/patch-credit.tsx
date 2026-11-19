import { Fragment, type ReactNode } from "react";
import type { T } from "@/i18n/translations";
import { interpolate } from "@/components/esports-parts";
import { WikiCredit } from "@/components/wiki-credit";
import { esportsSource } from "@/lib/esports";
import type { DetailedPatch } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Credit of the patch notes, as their license requires (CC BY-SA): the Fandom
 * wiki for the notes taken from it, Liquipedia (CC BY-SA 3.0, with a link to
 * the page and to the license, as on the esports pages) for the notes, or the
 * hero changes, taken from it.
 */

type Credited = Pick<DetailedPatch, "version" | "link" | "source" | "liquipedia" | "adjustmentsSource">;

/** The patch shows content taken from Liquipedia. */
export const fromLiquipedia = (p: Credited): boolean => p.source === "liquipedia" || p.adjustmentsSource === "liquipedia";

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} rel="noreferrer nofollow" target="_blank" className="text-gold-400 hover:underline">
      {children}
    </a>
  );
}

function liquipediaParts(page: { href: string; label: string }) {
  return {
    source: <ExternalLink href={esportsSource.url}>{esportsSource.name}</ExternalLink>,
    license: <ExternalLink href={esportsSource.licenseUrl}>{esportsSource.license}</ExternalLink>,
    page: <ExternalLink href={page.href}>{page.label}</ExternalLink>,
  };
}

/** Full credit, under the notes of one patch. */
export function PatchCredit({
  t,
  patch,
  translated,
  className = "mt-12 border-t border-night-800 pt-6 text-xs leading-relaxed text-chalk-500",
}: {
  t: T;
  patch: Credited;
  translated: boolean;
  className?: string;
}) {
  if (patch.source === "liquipedia") {
    const key = translated ? "pages.patchNotes.creditLiquipediaTranslated" : "pages.patchNotes.creditLiquipedia";
    return (
      <p className={className}>
        {interpolate(t(key), liquipediaParts({ href: patch.link, label: `Patch ${patch.version}` }))}
      </p>
    );
  }
  return (
    <div className={className}>
      <WikiCredit
        t={t}
        href={patch.link}
        messageKey={translated ? "pages.patchNotes.creditTranslated" : "pages.patchNotes.credit"}
        className=""
      />
      {patch.adjustmentsSource === "liquipedia" && patch.liquipedia && (
        <p className="mt-2">
          {interpolate(
            t("pages.patchNotes.creditHeroesLiquipedia"),
            liquipediaParts({ href: patch.liquipedia, label: `Patch ${patch.version}` }),
          )}
        </p>
      )}
    </div>
  );
}

/**
 * One line for a block that shows patch content away from the notes (the
 * home page, a hero's adjustment history): renders nothing when none of the
 * patches comes from Liquipedia.
 */
export function LiquipediaPatchNote({ t, patches, className }: { t: T; patches: Credited[]; className?: string }) {
  const credited = patches.filter((p, i) => fromLiquipedia(p) && patches.findIndex((x) => x.version === p.version) === i);
  if (credited.length === 0) return null;
  const versions = credited.map((p, i) => (
    <Fragment key={p.version}>
      {i > 0 && ", "}
      <ExternalLink href={p.liquipedia ?? p.link}>{p.version}</ExternalLink>
    </Fragment>
  ));
  const { source, license } = liquipediaParts({ href: "", label: "" });
  return (
    <p className={cn("text-xs leading-relaxed text-chalk-500", className)}>
      {interpolate(t("pages.patchNotes.creditShortLiquipedia"), { source, license, versions })}
    </p>
  );
}
