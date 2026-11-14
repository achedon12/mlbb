"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Trash2 } from "lucide-react";
import { useLocale, useT } from "@/i18n/provider";
import { LOCALE_INTL } from "@/i18n/config";
import { trackEvent } from "@/lib/analytics";
import { CARD_HEROES_MAX, CARD_NOTE_MAX, LANGUAGES, PLAY_TIMES, RANKS, REGIONS } from "@/lib/community/constants";
import { LANES } from "@/lib/draft";
import { cn } from "@/lib/utils";
import { HeroTagsInput, type HeroOption } from "./hero-tags-input";
import { QUIET } from "./post-actions";
import { refusal, send } from "./request";

/**
 * The player's own "looking for teammates" card: one per account, listed
 * for 7 days from each save. Folded behind a button until asked for.
 */

export interface OwnCard {
  region: string;
  rank: string;
  lanes: string[];
  heroes: string[];
  languages: string[];
  playTimes: string[];
  note: string | null;
  gameId: string | null;
  discord: string | null;
  /** ISO date. */
  expiresAt: string;
  hidden: boolean;
}

const FIELD = "bevel-sm mt-1 block h-11 w-full border border-night-700 bg-night-900 px-3 text-sm text-chalk-100 outline-none transition-colors focus:border-gold-500";
const MAX_LANGUAGES = 4;

function Checks({
  legend,
  options,
  value,
  onChange,
  label,
  max,
}: {
  legend: string;
  options: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
  label: (o: string) => string;
  max?: number;
}) {
  return (
    <fieldset>
      <legend className="text-xs text-chalk-400">{legend}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value.includes(o);
          const blocked = !on && max !== undefined && value.length >= max;
          return (
            <label
              key={o}
              className={cn(
                "bevel-sm inline-flex min-h-10 cursor-pointer items-center border px-3 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold-400",
                on ? "border-gold-500 bg-gold-500/15 text-chalk-100" : "border-night-700 text-chalk-300 hover:border-gold-500/50",
                blocked && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                disabled={blocked}
                onChange={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
              />
              {label(o)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function TeammateForm({ heroes, card }: { heroes: HeroOption[]; card: OwnCard | null }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState(card?.region ?? "");
  const [rank, setRank] = useState(card?.rank ?? "");
  const [lanes, setLanes] = useState<string[]>(card?.lanes ?? []);
  const [picks, setPicks] = useState<string[]>(card?.heroes ?? []);
  const [languages, setLanguages] = useState<string[]>(card?.languages ?? []);
  const [times, setTimes] = useState<string[]>(card?.playTimes ?? []);
  const [note, setNote] = useState(card?.note ?? "");
  const [gameId, setGameId] = useState(card?.gameId ?? "");
  const [discord, setDiscord] = useState(card?.discord ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const languageName = new Intl.DisplayNames([LOCALE_INTL[locale]], { type: "language" });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (lanes.length === 0 || languages.length === 0) {
      setMessage({ ok: false, text: t("pages.communityUI.teammates.needLanesAndLanguages") });
      return;
    }
    setBusy(true);
    setMessage(null);
    const answer = await send("PUT", "/api/community/teammates", {
      region,
      rank,
      lanes,
      heroes: picks,
      languages,
      playTimes: times,
      note,
      gameId,
      discord,
    });
    setBusy(false);
    if (answer.status === 200) {
      trackEvent("Community", "Teammate card", region);
      setMessage({ ok: true, text: t("pages.communityUI.teammates.saved") });
      setOpen(false);
      router.refresh();
      return;
    }
    const field = answer.status === 400 ? String(answer.data.error ?? "") : "";
    if (field === "gameId") setMessage({ ok: false, text: t("pages.communityUI.teammates.errors.gameId") });
    else if (field === "discord") setMessage({ ok: false, text: t("pages.communityUI.teammates.errors.discord") });
    else if (field === "note") setMessage({ ok: false, text: t("pages.communityUI.teammates.errors.note", { max: CARD_NOTE_MAX }) });
    else if (answer.data.error === "hidden") setMessage({ ok: false, text: t("pages.communityUI.teammates.errors.hidden") });
    else setMessage({ ok: false, text: refusal(t, answer) });
  }

  async function remove() {
    if (!window.confirm(t("pages.communityUI.teammates.confirmDelete"))) return;
    setBusy(true);
    const answer = await send("DELETE", "/api/community/teammates");
    setBusy(false);
    if (answer.status === 204 || answer.status === 404) router.refresh();
    else setMessage({ ok: false, text: refusal(t, answer) });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={formId}
          onClick={() => setOpen((o) => !o)}
          className="bevel-sm inline-flex min-h-11 items-center bg-gold-500 px-4 text-sm font-semibold text-night-950 transition-colors hover:bg-gold-400"
        >
          {card ? t("pages.communityUI.teammates.editCard") : t("pages.communityUI.teammates.newCard")}
        </button>
        {card && (
          <button type="button" onClick={remove} disabled={busy} className={cn(QUIET, "hover:text-blood-400")}>
            <Trash2 size={15} aria-hidden />
            {t("pages.communityUI.teammates.deleteCard")}
          </button>
        )}
      </div>
      {card && (
        <p className="text-xs text-chalk-500">
          {card.hidden
            ? t("pages.communityUI.teammates.cardHidden")
            : t("pages.communityUI.teammates.cardListed", {
                date: new Intl.DateTimeFormat(LOCALE_INTL[locale], { day: "numeric", month: "long" }).format(new Date(card.expiresAt)),
              })}
        </p>
      )}
      {message && (
        <p role={message.ok ? "status" : "alert"} className={cn("text-sm", message.ok ? "text-chalk-200" : "text-blood-400")}>
          {message.text}
        </p>
      )}
      {open && (
        <form id={formId} onSubmit={save} className="bevel space-y-5 border border-night-700 bg-night-900/70 p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs text-chalk-400">
              {t("pages.communityUI.teammates.region")}
              <select required value={region} onChange={(e) => setRegion(e.target.value)} className={FIELD}>
                <option value="" disabled>
                  {t("pages.communityUI.teammates.choose")}
                </option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`pages.communityUI.regions.${r}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-chalk-400">
              {t("pages.communityUI.teammates.rank")}
              <select required value={rank} onChange={(e) => setRank(e.target.value)} className={FIELD}>
                <option value="" disabled>
                  {t("pages.communityUI.teammates.choose")}
                </option>
                {RANKS.map((r) => (
                  <option key={r} value={r}>
                    {t(`rankNames.${r}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Checks legend={t("pages.communityUI.teammates.lanes")} options={LANES} value={lanes} onChange={setLanes} label={(l) => t(`lanes.${l}`)} />
          <HeroTagsInput
            heroes={heroes}
            value={picks}
            onChange={setPicks}
            max={CARD_HEROES_MAX}
            label={t("pages.communityUI.teammates.heroes")}
            hint={t("pages.communityUI.teammates.heroesHint", { n: CARD_HEROES_MAX })}
          />
          <Checks
            legend={t("pages.communityUI.teammates.languages", { n: MAX_LANGUAGES })}
            options={LANGUAGES}
            value={languages}
            onChange={setLanguages}
            label={(l) => languageName.of(l) ?? l}
            max={MAX_LANGUAGES}
          />
          <Checks
            legend={t("pages.communityUI.teammates.playTimes")}
            options={PLAY_TIMES}
            value={times}
            onChange={setTimes}
            label={(p) => t(`pages.communityUI.playTimes.${p}`)}
          />
          <label className="block text-xs text-chalk-400">
            <span className="flex justify-between">
              <span>{t("pages.communityUI.teammates.note")}</span>
              <span className="tabular-nums">
                {[...note].length}/{CARD_NOTE_MAX}
              </span>
            </span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={CARD_NOTE_MAX} className={FIELD} />
          </label>
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-1 text-xs text-chalk-400">{t("pages.communityUI.teammates.contact")}</legend>
            <label className="block text-xs text-chalk-400">
              {t("pages.communityUI.teammates.gameId")}
              <input
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                maxLength={24}
                inputMode="numeric"
                placeholder="12345678 (1234)"
                autoComplete="off"
                className={FIELD}
              />
            </label>
            <label className="block text-xs text-chalk-400">
              {t("pages.communityUI.teammates.discord")}
              <input value={discord} onChange={(e) => setDiscord(e.target.value)} maxLength={40} autoComplete="off" className={FIELD} />
            </label>
            <p className="text-xs leading-relaxed text-chalk-500 sm:col-span-2">{t("pages.communityUI.teammates.contactNote")}</p>
          </fieldset>
          <button
            type="submit"
            disabled={busy}
            className="bevel-sm inline-flex min-h-11 items-center gap-2 bg-gold-500 px-4 text-sm font-semibold text-night-950 transition-colors hover:bg-gold-400 disabled:opacity-60"
          >
            <Send size={16} aria-hidden />
            {busy ? t("pages.communityUI.sending") : t("pages.communityUI.teammates.publish")}
          </button>
        </form>
      )}
    </div>
  );
}
