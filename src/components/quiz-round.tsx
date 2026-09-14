"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, Check, Flag, LayoutGrid, Lock, X } from "lucide-react";
import { GuessField, type GuessOption } from "@/components/guess-field";
import { HeroSelector, type HeroPickable } from "@/components/hero-picker";
import Link from "@/components/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { LOCALE_HTML } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/provider";
import type { T } from "@/i18n/t";
import {
  ABANDON,
  compareHeroes,
  compareItems,
  errors,
  attemptsMax,
  roundFinished,
  responsesDuel,
  ZOOMS,
  type Agreement,
  type QuizHero,
  type Round,
  type ItemRoster,
  type Direction,
} from "@/lib/quiz";
import { cn } from "@/lib/utils";

/**
 * Une manche du quiz : l'enonce, les indices qui se debloquent a chaque
 * erreur, le champ de reponse et les essais deja joues. Sans etat de partie :
 * le defi du jour et l'entrainement tiennent les essais, cette vue les montre.
 */

export interface CatalogQuiz {
  heroes: QuizHero[];
  items: ItemRoster[];
  heroesBySlug: Map<string, QuizHero>;
  itemsBySlug: Map<string, ItemRoster>;
  /** The same heroes and items shaped for the pickers (the quiz pool keeps its stored field names). */
  heroChoices: HeroPickable[];
  itemChoices: GuessOption[];
}

interface Hint {
  key: string;
  content: React.ReactNode;
}

const COLOR_AGREEMENT: Record<Agreement, string> = {
  yes: "border-emerald-500/60 bg-emerald-500/15 text-emerald-300",
  partial: "border-gold-500/60 bg-gold-500/15 text-gold-400",
  no: "border-blood-500/50 bg-blood-500/10 text-blood-500",
};

function listRoles(h: QuizHero, t: T) {
  return h.roles.map((r) => t(`roles.${r}`)).join(" / ");
}
function listLanes(h: QuizHero, t: T) {
  return h.lanes.map((l) => t(`lanes.${l}`)).join(" / ") || "—";
}

/** Indices de la manche, dans l'ordre ou les erreurs les debloquent. */
function hintsOf(round: Round, target: QuizHero | undefined, t: T): Hint[] {
  const list: (Hint | null)[] = [];
  if (round.type === "skill" && target) {
    list.push(
      { key: "skillName", content: round.nom },
      round.extrait ? { key: "description", content: <q>{round.extrait}</q> } : null,
      { key: "roles", content: listRoles(target, t) },
      { key: "lanes", content: listLanes(target, t) },
    );
  } else if (round.type === "skin" && target) {
    list.push(
      { key: "roles", content: listRoles(target, t) },
      { key: "lanes", content: listLanes(target, t) },
      target.annee ? { key: "year", content: String(target.annee) } : null,
      { key: "skin", content: round.skin },
    );
  } else if (round.type === "story" && target) {
    list.push(
      round.extraits[1] ? { key: "excerpt", content: <q>{round.extraits[1]}</q> } : null,
      target.region ? { key: "region", content: target.region } : null,
      { key: "roles", content: listRoles(target, t) },
      {
        key: "initial",
        content: t("pages.quizUI.initial", { lettre: target.nom[0], n: target.nom.replace(/[^\p{L}]/gu, "").length }),
      },
    );
  } else if (round.type === "item") {
    list.push(
      { key: "category", content: round.categorie },
      round.recette.length
        ? {
            key: "recipe",
            content: (
              <span className="flex flex-wrap gap-2">
                {round.recette.map((r, i) => (
                  <span key={`${r.nom}-${i}`} className="inline-flex items-center gap-1.5">
                    <HeroPortrait source={r.icone} name={r.nom} size="micro" decorative />
                    {r.nom}
                  </span>
                ))}
              </span>
            ),
          }
        : null,
      round.passif ? { key: "passive", content: <q>{round.passif}</q> } : null,
    );
  }
  return list.filter((x): x is Hint => x !== null);
}

/** Pastille de comparaison : l'essai partage-t-il ce trait avec la reponse ? */
function Badge({ agreement, label, value, t }: { agreement: Agreement; label: string; value?: string; t: T }) {
  const Icon = agreement === "yes" ? Check : agreement === "partial" ? null : X;
  return (
    <span
      className={cn("bevel-sm inline-flex items-center gap-1 border px-1.5 py-0.5 text-[0.7rem]", COLOR_AGREEMENT[agreement])}
    >
      {Icon ? <Icon size={12} aria-hidden /> : <span aria-hidden>≈</span>}
      {value ?? label}
      <span className="sr-only">
        {value ? ` (${label})` : ""} : {t(`pages.quizUI.agreement.${agreement}`)}
      </span>
    </span>
  );
}

/** Pastille de sens : la reponse est plus recente, plus chere… ou egale. */
function DirectionBadge({ direction, value, family, t }: { direction: Direction; value: string; family: "year" | "price"; t: T }) {
  const agreement: Agreement = direction === "equal" ? "yes" : "no";
  const Icon = direction === "higher" ? ArrowUp : direction === "lower" ? ArrowDown : direction === "equal" ? Check : null;
  return (
    <span
      className={cn("bevel-sm inline-flex items-center gap-1 border px-1.5 py-0.5 text-[0.7rem]", COLOR_AGREEMENT[agreement])}
      title={t(`pages.quizUI.${family}.${direction}`)}
    >
      {value}
      {Icon && <Icon size={12} aria-hidden />}
      <span className="sr-only"> : {t(`pages.quizUI.${family}.${direction}`)}</span>
    </span>
  );
}

export function RoundQuiz({
  round,
  attempts,
  catalog,
  onAttempt,
  roundLabel,
  refTitle,
  measure,
}: {
  round: Round;
  attempts: string[];
  catalog: CatalogQuiz;
  onAttempt: (slug: string) => void;
  /** Position de la manche, « Manche 2/5 ». */
  roundLabel: string;
  refTitle?: React.Ref<HTMLHeadingElement>;
  /** Date du releve des taux, citee par le duel. */
  measure: string;
}) {
  const t = useT();
  const locale = useLocale();
  const [roster, setRoster] = useState(false);
  const finished = roundFinished(round, attempts);
  const formatRate = useMemo(
    () => new Intl.NumberFormat(LOCALE_HTML[locale], { minimumFractionDigits: 1, maximumFractionDigits: 2 }),
    [locale],
  );
  const formatPrice = useMemo(() => new Intl.NumberFormat(LOCALE_HTML[locale]), [locale]);

  const isItem = round.type === "item";
  const response = round.type === "duel" ? null : round.reponse;
  const target = response && !isItem ? catalog.heroesBySlug.get(response) : undefined;
  const targetItem = response && isItem ? catalog.itemsBySlug.get(response) : undefined;
  const nameResponse = target?.nom ?? targetItem?.nom ?? "";
  const nbErrors = errors(round, attempts);
  const hints = hintsOf(round, target, t);
  const visible = finished ? hints.length : Math.min(nbErrors, hints.length);
  const played = attempts.filter((e) => e !== ABANDON);
  const excluded = useMemo(() => new Set(attempts), [attempts]);

  const announcement = announcementOf();

  function announcementOf(): string {
    const last = attempts.at(-1);
    if (last === undefined) return "";
    if (round.type === "duel") {
      const i = attempts.length - 1;
      const good = responsesDuel(round)[i];
      const h = catalog.heroesBySlug.get(good);
      const rate = formatRate.format(round.paires[i].find((d) => d.slug === good)?.victoire ?? 0);
      return t(last === good ? "pages.quizUI.announceDuelRight" : "pages.quizUI.announceDuelWrong", {
        nom: h?.nom ?? good,
        taux: rate,
      });
    }
    if (last === round.reponse) return t("pages.quizUI.announceFound", { nom: nameResponse });
    if (finished) return t("pages.quizUI.announceMissed", { nom: nameResponse });
    const attempt = catalog.heroesBySlug.get(last)?.nom ?? catalog.itemsBySlug.get(last)?.nom ?? last;
    const unlocked = hints[visible - 1];
    return [
      t("pages.quizUI.announceWrong", { nom: attempt, n: attemptsMax(round) - attempts.length }),
      unlocked ? t("pages.quizUI.announceClue", { titre: t(`pages.quizUI.clues.${unlocked.key}`) }) : "",
    ].join(" ");
  }

  return (
    <section className="relative p-4 sm:p-6">
      {/*
        Le biseau (clip-path) est porte par un calque de fond : pose sur la
        section, il rognait la liste de suggestions du champ et masquait la
        fenetre « Parcourir les heros », pourtant en position fixe.
      */}
      <div aria-hidden className="bevel absolute inset-0 border border-night-700/70 bg-night-900/60" />
      <div className="relative">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs uppercase tracking-wide text-chalk-500">
        <span>
          {roundLabel} · {t(`pages.quizUI.types.${round.type}`)}
        </span>
        {round.type !== "duel" && !finished && (
          <span className="tabular-nums text-chalk-300">
            {t("pages.quizUI.triesLeft", { n: attemptsMax(round) - attempts.length })}
          </span>
        )}
      </div>
      <h3
        ref={refTitle}
        tabIndex={-1}
        className="mt-2 font-heading text-xl font-bold text-chalk-100 outline-none sm:text-2xl"
      >
        {t(`pages.quizUI.questions.${round.type}`)}
      </h3>

      <div className="mt-4">
        <Statement round={round} nbErrors={nbErrors} finished={finished} formatPrice={formatPrice} t={t} />
      </div>

      {round.type === "duel" ? (
        <Duel round={round} attempts={attempts} catalog={catalog} onAttempt={onAttempt} formatRate={formatRate} t={t} />
      ) : (
        <>
          {hints.length > 0 && (
            <div className="mt-5">
              <h4 className="text-xs uppercase tracking-wide text-chalk-500">
                {t("pages.quizUI.cluesTitle", { n: visible, max: hints.length })}
              </h4>
              <ol className="mt-2 space-y-1.5">
                {hints.map((ind, i) =>
                  i < visible ? (
                    <li key={ind.key} className="border-l-2 border-gold-500/60 pl-3 text-sm leading-relaxed text-chalk-200">
                      <span className="font-semibold text-gold-400">{t(`pages.quizUI.clues.${ind.key}`)} : </span>
                      {ind.content}
                    </li>
                  ) : (
                    <li key={ind.key} className="flex items-center gap-2 pl-3 text-xs text-chalk-600">
                      <Lock size={12} aria-hidden />
                      {t("pages.quizUI.lockedClue", { n: i + 1 })}
                    </li>
                  ),
                )}
              </ol>
            </div>
          )}

          {!finished && (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <GuessField
                  options={isItem ? catalog.itemChoices : catalog.heroChoices}
                  excluded={excluded}
                  label={t(isItem ? "pages.quizUI.itemField" : "pages.quizUI.heroField")}
                  none={t("pages.quizUI.noResult")}
                  onChoose={onAttempt}
                />
              </div>
              <div className="flex gap-2">
                {!isItem && (
                  <button
                    type="button"
                    onClick={() => setRoster(true)}
                    className="bevel-sm flex flex-1 items-center justify-center gap-1.5 border border-night-600 px-3 py-2 text-sm text-chalk-300 transition-colors hover:border-gold-500 hover:text-gold-400"
                  >
                    <LayoutGrid size={15} aria-hidden />
                    {t("pages.quizUI.browse")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onAttempt(ABANDON)}
                  className="bevel-sm flex flex-1 items-center justify-center gap-1.5 border border-night-600 px-3 py-2 text-sm text-chalk-500 transition-colors hover:border-blood-500 hover:text-blood-500"
                >
                  <Flag size={15} aria-hidden />
                  {t("pages.quizUI.skip")}
                </button>
              </div>
            </div>
          )}

          {played.length > 0 && (
            <ol className="mt-4 space-y-1.5" aria-label={t("pages.quizUI.yourTries")}>
              {played.map((slug) => {
                const good = slug === response;
                const h = catalog.heroesBySlug.get(slug);
                const o = catalog.itemsBySlug.get(slug);
                const attempt = isItem ? o : h;
                if (!attempt) return null;
                return (
                  <li
                    key={slug}
                    className={cn(
                      "bevel-sm flex flex-wrap items-center gap-2 border px-2 py-1.5",
                      good ? "border-emerald-500/60 bg-emerald-500/10" : "border-night-700/70 bg-night-950/40",
                    )}
                  >
                    <HeroPortrait source={attempt.icone} name={attempt.nom} size="small" decorative />
                    <span className={cn("mr-auto text-sm font-medium", good ? "text-emerald-300" : "text-chalk-100")}>
                      {attempt.nom}
                    </span>
                    {good ? (
                      <Check size={16} className="text-emerald-400" aria-label={t("pages.quizUI.agreement.yes")} />
                    ) : h && target ? (
                      <HeroComparison attempt={h} target={target} t={t} />
                    ) : o && targetItem ? (
                      <ComparisonItem attempt={o} target={targetItem} formatPrice={formatPrice} t={t} />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}

          {finished && (
            <Result
              round={round}
              found={response !== null && attempts.includes(response)}
              attempts={played.length}
              target={target ?? targetItem}
              t={t}
            />
          )}
        </>
      )}

      {round.type === "duel" && (
        <p className="mt-4 text-xs text-chalk-500">
          {t("pages.quizUI.duelSource", {
            date: new Intl.DateTimeFormat(LOCALE_HTML[locale], { dateStyle: "long", timeZone: "UTC" }).format(
              new Date(measure),
            ),
          })}
        </p>
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {roster && (
        <HeroSelector
          heroes={catalog.heroChoices}
          excluded={excluded}
          lane={null}
          title={t("pages.quizUI.browse")}
          onChoose={(slug) => {
            setRoster(false);
            onAttempt(slug);
          }}
          onClose={() => setRoster(false)}
        />
      )}
      </div>
    </section>
  );
}

function HeroComparison({ attempt, target, t }: { attempt: QuizHero; target: QuizHero; t: T }) {
  const c = compareHeroes(attempt, target);
  return (
    <span className="flex flex-wrap gap-1">
      <Badge agreement={c.roles} label={t("pages.quizUI.comparison.roles")} t={t} />
      <Badge agreement={c.lanes} label={t("pages.quizUI.comparison.lanes")} t={t} />
      {attempt.annee !== null && <DirectionBadge direction={c.year} value={String(attempt.annee)} family="year" t={t} />}
      <Badge agreement={c.region} label={t("pages.quizUI.comparison.region")} t={t} />
    </span>
  );
}

function ComparisonItem({
  attempt,
  target,
  formatPrice,
  t,
}: {
  attempt: ItemRoster;
  target: ItemRoster;
  formatPrice: Intl.NumberFormat;
  t: T;
}) {
  const c = compareItems(attempt, target);
  return (
    <span className="flex flex-wrap gap-1">
      {attempt.prix !== null && <DirectionBadge direction={c.price} value={formatPrice.format(attempt.prix)} family="price" t={t} />}
      <Badge agreement={c.category} label={t("pages.quizUI.comparison.category")} value={attempt.categorie} t={t} />
    </span>
  );
}

/** Ce que la manche montre d'emblee ; l'illustration d'un skin se degage erreur apres erreur. */
function Statement({
  round,
  nbErrors,
  finished,
  formatPrice,
  t,
}: {
  round: Round;
  nbErrors: number;
  finished: boolean;
  formatPrice: Intl.NumberFormat;
  t: T;
}) {
  if (round.type === "skill") {
    return (
      <Image
        src={round.icone}
        alt={t("pages.quizUI.altSkill")}
        width={80}
        height={80}
        className="bevel-sm size-20 bg-night-800"
      />
    );
  }
  if (round.type === "skin") {
    const zoom = finished ? 1 : ZOOMS[Math.min(nbErrors, ZOOMS.length - 1)];
    return (
      <div className="bevel relative aspect-video w-full overflow-hidden border border-night-700 bg-night-800">
        <Image
          src={round.image}
          alt={t(finished ? "pages.quizUI.altSkinFull" : "pages.quizUI.altSkin")}
          fill
          sizes="(min-width: 768px) 720px, 100vw"
          draggable={false}
          className="select-none object-cover transition-transform duration-700 ease-out motion-reduce:transition-none"
          style={{ transform: `scale(${zoom})`, transformOrigin: `${round.foyer[0] * 100}% ${round.foyer[1] * 100}%` }}
        />
      </div>
    );
  }
  if (round.type === "story") {
    return (
      <blockquote className="border-l-2 border-gold-500 pl-4 leading-relaxed text-chalk-200">
        {round.extraits[0]}
      </blockquote>
    );
  }
  if (round.type === "item") {
    return (
      <div className="bevel-sm border border-night-700 bg-night-950/50 p-4">
        <ul className="space-y-1 text-sm text-chalk-100">
          {round.bonus.split(/,\s*(?=[+-])/).map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        {round.prix !== null && (
          <p className="mt-3 text-sm font-semibold text-gold-400">
            {t("pages.quizUI.itemPrice", { prix: formatPrice.format(round.prix) })}
          </p>
        )}
      </div>
    );
  }
  return null;
}

function Result({
  round,
  found,
  attempts,
  target,
  t,
}: {
  round: Exclude<Round, { type: "duel" }>;
  found: boolean;
  attempts: number;
  target: QuizHero | ItemRoster | undefined;
  t: T;
}) {
  if (!target) return null;
  const item = round.type === "item";
  return (
    <div
      className={cn(
        "bevel mt-5 flex flex-wrap items-center gap-4 border p-4",
        found ? "border-emerald-500/60 bg-emerald-500/10" : "border-blood-500/50 bg-blood-500/10",
      )}
    >
      <HeroPortrait source={target.icone} name={target.nom} size="thumb" decorative />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold", found ? "text-emerald-300" : "text-blood-500")}>
          {found ? t("pages.quizUI.found", { n: attempts, max: attemptsMax(round) }) : t("pages.quizUI.missed")}
        </p>
        <p className="font-heading text-xl font-bold text-chalk-100">{target.nom}</p>
        {round.type === "skin" && (
          <p className="text-sm text-chalk-300">{t("pages.quizUI.skinName", { nom: round.skin })}</p>
        )}
        {round.type === "skill" && (
          <p className="text-sm text-chalk-300">{t("pages.quizUI.skillName", { nom: round.nom })}</p>
        )}
      </div>
      <Link
        href={item ? `/items#${target.slug}` : `/heroes/${target.slug}`}
        className="text-sm font-semibold text-gold-400 transition-colors hover:text-gold-500"
      >
        {t(item ? "pages.quizUI.seeItem" : "pages.quizUI.seeSheet")} →
      </Link>
    </div>
  );
}

function Duel({
  round,
  attempts,
  catalog,
  onAttempt,
  formatRate,
  t,
}: {
  round: Extract<Round, { type: "duel" }>;
  attempts: string[];
  catalog: CatalogQuiz;
  onAttempt: (slug: string) => void;
  formatRate: Intl.NumberFormat;
  t: T;
}) {
  const good = responsesDuel(round);
  return (
    <ol className="space-y-3">
      {round.paires.map((pair, i) => {
        if (i > attempts.length) return null;
        const choice = attempts[i];
        const answered = choice !== undefined;
        return (
          <li key={`${pair[0].slug}-${pair[1].slug}`}>
            {round.paires.length > 1 && (
              <p className="mb-1.5 text-xs uppercase tracking-wide text-chalk-500">
                {t("pages.quizUI.pair", { n: i + 1, max: round.paires.length })}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {pair.map((d) => {
                const h = catalog.heroesBySlug.get(d.slug);
                const winner = d.slug === good[i];
                const chosen = choice === d.slug;
                return (
                  <button
                    key={d.slug}
                    type="button"
                    disabled={answered}
                    aria-pressed={answered ? chosen : undefined}
                    onClick={() => onAttempt(d.slug)}
                    className={cn(
                      "bevel-sm flex flex-col items-center gap-2 border p-3 text-center transition-colors",
                      !answered && "border-night-600 hover:border-gold-500 hover:bg-night-850",
                      answered && winner && "border-emerald-500/60 bg-emerald-500/10",
                      answered && !winner && "border-night-700/70 opacity-80",
                      answered && chosen && !winner && "border-blood-500/60 bg-blood-500/10",
                    )}
                  >
                    <HeroPortrait source={h?.icone ?? null} name={h?.nom ?? d.slug} size="thumb" decorative />
                    <span className="font-heading text-base font-bold text-chalk-100">{h?.nom ?? d.slug}</span>
                    {answered && (
                      <span
                        className={cn("text-sm tabular-nums", winner ? "text-emerald-300" : "text-chalk-400")}
                      >
                        {t("pages.quizUI.win", { taux: formatRate.format(d.victoire) })}
                      </span>
                    )}
                    {answered && chosen && (
                      <span className="sr-only">
                        {t(winner ? "pages.quizUI.duelRight" : "pages.quizUI.duelWrong")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
