import Link from "next/link";

export default function Introuvable() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-32 text-center">
      <p className="font-titre text-6xl font-bold text-or-400">404</p>
      <h1 className="mt-4 font-titre text-2xl font-bold text-craie-100">Page introuvable</h1>
      <p className="mt-4 leading-relaxed text-craie-500">
        Cette page n&apos;existe pas, ou plus. Les fiches heros sont accessibles
        depuis le catalogue.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="biseau-sm bg-or-500 px-6 py-3 font-semibold text-nuit-950 transition-colors hover:bg-or-400"
        >
          Retour a l&apos;accueil
        </Link>
        <Link
          href="/heroes"
          className="biseau-sm border border-nuit-600 px-6 py-3 font-semibold text-craie-100 transition-colors hover:border-or-500/60 hover:text-or-400"
        >
          Voir les heros
        </Link>
      </div>
    </div>
  );
}
