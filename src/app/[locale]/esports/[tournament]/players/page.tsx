import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SourceCredit, TournamentNav } from "@/components/esports-parts";
import { heroName, roleText, teamName } from "@/components/esports-pro";
import { PageHeader } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { ExtendMessages } from "@/i18n/provider";
import { metaPage } from "@/i18n/seo";
import { createT, messagesPage } from "@/i18n/translations";
import { heroesBySlug } from "@/lib/data";
import { tournamentBySlug, tournaments } from "@/lib/esports";
import {
  hasPlayerPage,
  hasPlayerStats,
  hasTeamPage,
  playerBySlug,
  roleIn,
  ROLE_ORDER,
  tournamentPlayers,
} from "@/lib/esports-players";
import { PlayersTable, type PlayerStatRow } from "./players-table";

type Params = { params: Promise<{ locale: Locale; tournament: string }> };

/** Only tournaments with at least one game get a players page. */
export function generateStaticParams() {
  return tournaments.filter((t) => hasPlayerStats(t.slug)).map((t) => ({ tournament: t.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, tournament } = await params;
  const turn = tournamentBySlug.get(tournament);
  if (!turn || !hasPlayerStats(turn.slug)) return {};
  const t = createT(locale);
  return metaPage(locale, {
    title: t("pages.esports.pro.players.seoTitle", { name: turn.name }),
    description: t("pages.esports.pro.players.seoDescription", {
      name: turn.name,
      n: tournamentPlayers(turn.slug).length,
    }),
    path: `/esports/${turn.slug}/players`,
  });
}

export default async function TournamentPlayersPage({ params }: Params) {
  const { locale, tournament } = await params;
  const turn = tournamentBySlug.get(tournament);
  if (!turn || !hasPlayerStats(turn.slug)) notFound();
  const t = createT(locale);

  const rows: PlayerStatRow[] = tournamentPlayers(turn.slug).map((l) => {
    const player = playerBySlug.get(l.player);
    const role = player ? roleIn(player, turn.slug) : null;
    const heroes = l.heroes.filter((h) => heroesBySlug.has(h.slug));
    return {
      slug: l.player,
      name: player?.name ?? l.player,
      linked: hasPlayerPage(l.player),
      team: teamName(l.team),
      teamSlug: l.team,
      teamLinked: hasTeamPage(l.team),
      role: roleText(t, role),
      roleIndex: role ? ROLE_ORDER.indexOf(role) : ROLE_ORDER.length,
      games: l.games,
      wins: l.wins,
      losses: l.games - l.wins,
      winRate: Math.round((l.wins / l.games) * 1000) / 10,
      mvps: l.mvps,
      heroCount: heroes.length,
      top: heroes.slice(0, 3).map((h) => ({ slug: h.slug, name: heroName(h.slug), games: h.games, wins: h.wins })),
    };
  });

  return (
    <ExtendMessages messages={messagesPage(locale, ["pages.esportsPlayersUI"])}>
      <PageHeader
        title={t("pages.esports.pro.players.title", { name: turn.name })}
        lead={t("pages.esports.pro.players.lead", { n: rows.length, games: turn.games })}
        crumbs={[
          { name: t("pages.esports.title"), href: "/esports" },
          { name: turn.shortName, href: `/esports/${turn.slug}` },
          { name: t("pages.esports.nav.players") },
        ]}
        details={{ label: t("pages.esports.pro.methodLabel"), content: <p>{t("pages.esports.pro.method")}</p> }}
      >
        <TournamentNav t={t} turn={turn} active="players" />
      </PageHeader>

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
        <PlayersTable rows={rows} name={turn.name} />
        <SourceCredit t={t} locale={locale} sources={turn.sources} />
      </div>
    </ExtendMessages>
  );
}
