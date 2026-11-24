import type { Metadata } from "next";
import Image from "next/image";
import { Check, Download, X } from "lucide-react";
import { DiscordMark } from "@/components/bot/discord-mark";
import { Wordmark } from "@/components/brand-mark";
import { CopyValue } from "@/components/copy-value";
import { DiscordJoinLink } from "@/components/discord-join-link";
import Link from "@/components/link";
import type { DexPose } from "@/components/mascot";
import { StageHeader } from "@/components/stage";
import type { Locale } from "@/i18n/config";
import { metaPage } from "@/i18n/seo";
import { createT } from "@/i18n/translations";
import { communityInvite } from "@/lib/bot/public";
import { site } from "@/lib/site";

type Params = { params: Promise<{ locale: Locale }> };

/**
 * The brand and press kit: the name, the palette with its codes (and a copy
 * button), the three typefaces, the short rules, and Dex's poses as PNG
 * (`public/mascot/*.png`, from `scripts/mascot-png.mjs`).
 *
 * The logo (`public/brand/`, docs/logo-brief.md) is shown with its SVG
 * files to download: the emblem, the horizontal and the stacked logo. The
 * palette mirrors the tokens of `globals.css` (docs/design-system.md).
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.brandKit.metaTitle"),
    description: t("pages.brandKit.metaDescription"),
    path: "/brand",
  });
}

const COLORS = [
  { key: "night950", token: "night-950", hex: "#06080F" },
  { key: "night900", token: "night-900", hex: "#0B1020" },
  { key: "night800", token: "night-800", hex: "#141B33" },
  { key: "gold400", token: "gold-400", hex: "#F5C451" },
  { key: "gold600", token: "gold-600", hex: "#C8901E" },
  { key: "azure400", token: "azure-400", hex: "#3D8BFF" },
  { key: "blood400", token: "blood-400", hex: "#FF4D4D" },
  { key: "chalk100", token: "chalk-100", hex: "#EEF2FB" },
  { key: "chalk400", token: "chalk-400", hex: "#9AA6C2" },
] as const;

const FONTS = [
  { key: "display", name: "Saira Extra Condensed", className: "display-caps text-4xl", url: "https://fonts.google.com/specimen/Saira+Extra+Condensed" },
  { key: "heading", name: "Barlow Condensed", className: "font-heading text-3xl font-bold", url: "https://fonts.google.com/specimen/Barlow+Condensed" },
  { key: "body", name: "Inter", className: "font-body text-xl", url: "https://fonts.google.com/specimen/Inter" },
] as const;

/** Each pose and its drawing's size, for the preview's frame. */
const POSES: { pose: DexPose; width: number; height: number }[] = [
  { pose: "salut", width: 264, height: 302 },
  { pose: "reflexion", width: 205, height: 308 },
  { pose: "idee", width: 261, height: 307 },
  { pose: "surpris", width: 234, height: 308 },
  { pose: "victoire", width: 276, height: 308 },
  { pose: "carte", width: 286, height: 292 },
  { pose: "joie", width: 211, height: 303 },
  { pose: "bravo", width: 211, height: 309 },
  { pose: "saut", width: 316, height: 290 },
  { pose: "pointe", width: 281, height: 309 },
  { pose: "triste", width: 220, height: 283 },
  { pose: "dodo", width: 293, height: 255 },
];

export default async function BrandPage({ params }: Params) {
  const { locale } = await params;
  const t = createT(locale);
  const invite = communityInvite();
  const h2 = "type-section text-chalk-100";
  const more = "text-sm font-semibold text-gold-400 transition-colors hover:text-gold-300";
  const chip =
    "bevel-sm inline-flex min-h-9 items-center gap-1.5 bg-night-800 px-3 text-sm text-chalk-200 transition-[color,background-color,translate] hover:-translate-y-px hover:bg-night-700 hover:text-gold-300";

  return (
    <>
      <StageHeader title={t("pages.brandKit.title")} lead={t("pages.brandKit.lead")} dex="idee" dexHeight={210}>
        <p className="dex-bubble mt-5 max-w-md font-heading text-lg font-semibold leading-snug text-chalk-100">{t("pages.brandKit.dexLine")}</p>
      </StageHeader>

      <div className="stage-enter page-wrap space-y-16 py-10 sm:space-y-24 sm:py-14">
        <section aria-labelledby="name">
          <h2 id="name" className={h2}>
            {t("pages.brandKit.nameTitle")}
          </h2>
          <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
          <div className="mt-6 grid items-center gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-12">
            <div className="bevel-lg flex items-center gap-6 bg-night-900 px-8 py-7">
              {/* eslint-disable-next-line @next/next/no-img-element -- an SVG shown at a fixed size */}
              <img src="/brand/emblem.svg" alt={t("pages.brandKit.logoAlt")} width={108} height={104} className="shrink-0" />
              <Wordmark className="text-[3rem] sm:text-[4rem]" />
            </div>
            <div className="max-w-xl space-y-3 leading-relaxed text-chalk-300">
              <p>{t("pages.brandKit.nameText")}</p>
              <p className="text-chalk-400">{t("pages.brandKit.logoText")}</p>
              <p className="flex flex-wrap gap-2 pt-1">
                {(["emblem", "logo", "logo-stacked"] as const).map((file) => (
                  <a key={file} href={`/brand/${file}.svg`} download className="bevel-sm inline-flex items-center gap-1.5 bg-night-800 px-3 py-1.5 text-sm font-semibold text-gold-300 shadow-[inset_0_0_0_1px_var(--color-night-600)] hover:text-gold-200">
                    {t(`pages.brandKit.logoFile.${file === "logo-stacked" ? "stacked" : file}`)}
                  </a>
                ))}
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="colors">
          <h2 id="colors" className={h2}>
            {t("pages.brandKit.colorsTitle")}
          </h2>
          <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
          <p className="mt-3 max-w-2xl text-chalk-300">{t("pages.brandKit.colorsLead")}</p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COLORS.map((c) => (
              <li key={c.key} className="flex items-center gap-4">
                <span
                  aria-hidden
                  className="bevel size-16 shrink-0 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]"
                  style={{ backgroundColor: c.hex }}
                />
                <div className="min-w-0">
                  <p className="font-heading text-lg font-bold text-chalk-100">{t(`pages.brandKit.colors.${c.key}`)}</p>
                  <p className="mb-1.5 font-mono text-xs text-chalk-500">{c.token}</p>
                  <CopyValue value={c.hex} label={t("pages.brandKit.copy", { hex: c.hex })} copiedLabel={t("pages.brandKit.copied")} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="type">
          <h2 id="type" className={h2}>
            {t("pages.brandKit.typeTitle")}
          </h2>
          <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
          <ul className="mt-6 divide-y divide-night-700/70 border-y border-night-700/70">
            {FONTS.map((f) => (
              <li key={f.key} className="grid gap-2 py-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-center md:gap-10">
                <p className={`${f.className} leading-tight text-chalk-100`}>{t("pages.brandKit.sample")}</p>
                <div>
                  <h3 className="font-heading text-lg font-bold text-gold-400">
                    <a href={f.url} rel="noreferrer" target="_blank" className="transition-colors hover:text-gold-300">
                      {f.name}
                    </a>
                  </h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-chalk-300">{t(`pages.brandKit.type.${f.key}`)}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-chalk-400">{t("pages.brandKit.fontsNote")}</p>
        </section>

        <section aria-labelledby="rules">
          <h2 id="rules" className={h2}>
            {t("pages.brandKit.rulesTitle")}
          </h2>
          <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
          <div className="mt-6 grid gap-8 md:grid-cols-2 md:gap-12">
            {(["do", "dont"] as const).map((kind) => (
              <div key={kind}>
                <h3 className={`display-caps text-3xl ${kind === "do" ? "text-azure-400" : "text-blood-400"}`}>
                  {t(`pages.brandKit.${kind}Title`)}
                </h3>
                <ul className="mt-3 space-y-2.5">
                  {[1, 2, 3, 4].map((n) => (
                    <li key={n} className="flex gap-2.5 leading-relaxed text-chalk-300">
                      {kind === "do" ? (
                        <Check size={18} aria-hidden className="mt-1 shrink-0 text-azure-400" />
                      ) : (
                        <X size={18} aria-hidden className="mt-1 shrink-0 text-blood-400" />
                      )}
                      {t(`pages.brandKit.${kind}${n}`)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="dex-png">
          <h2 id="dex-png" className={h2}>
            {t("pages.brandKit.dexTitle")}
          </h2>
          <div aria-hidden className="eclat mt-3 h-[3px] w-24" />
          <p className="mt-3 max-w-2xl text-chalk-300">{t("pages.brandKit.dexLead")}</p>
          <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-6">
            {POSES.map(({ pose, width, height }) => {
              const name = t(`pages.dexPage.poses.${pose}.name`);
              return (
                <li key={pose} className="flex flex-col items-center text-center">
                  <span className="flex h-[150px] items-end">
                    <Image
                      src={`/mascot/dex-${pose}.webp`}
                      alt=""
                      width={Math.round((width / height) * 140)}
                      height={140}
                      sizes="140px"
                      className="drop-shadow-[0_6px_14px_rgb(0_0_0/0.45)]"
                    />
                  </span>
                  <h3 className="display-caps mt-3 text-xl text-chalk-100">{name}</h3>
                  <p className="mt-2 flex flex-wrap justify-center gap-2">
                    <a href={`/mascot/dex-${pose}.png`} download aria-label={t("pages.brandKit.downloadLabel", { pose: name })} className={chip}>
                      <Download size={14} aria-hidden />
                      {t("pages.brandKit.download")}
                    </a>
                    <a
                      href={`/mascot/dex-${pose}-square.png`}
                      download
                      aria-label={t("pages.brandKit.downloadSquareLabel", { pose: name })}
                      className={chip}
                    >
                      <Download size={14} aria-hidden />
                      {t("pages.brandKit.downloadSquare")}
                    </a>
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-8">
            <Link href="/dex" className={more}>
              {t("pages.brandKit.dexPageLink")} →
            </Link>
          </p>
        </section>

        <section aria-labelledby="press" className="bevel-lg bg-night-800 p-6 shadow-[inset_0_3px_0_var(--color-gold-400)] sm:p-10">
          <h2 id="press" className={h2}>
            {t("pages.brandKit.pressTitle")}
          </h2>
          <p className="mt-3 max-w-2xl text-chalk-300">{t("pages.brandKit.pressText")}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {invite && (
              <DiscordJoinLink href={invite} placement="Inline" className="btn btn-primary">
                <DiscordMark />
                {t("pages.brandKit.discord")}
              </DiscordJoinLink>
            )}
            <a href={site.repository} rel="noreferrer" target="_blank" className="btn btn-secondary">
              {t("pages.brandKit.repo")}
            </a>
          </div>
          <p className="mt-6 max-w-3xl text-xs leading-relaxed text-chalk-500">{t("pages.brandKit.legal")}</p>
        </section>
      </div>
    </>
  );
}
