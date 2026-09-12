import { NextResponse } from "next/server";

/**
 * Reponses de l'API publique.
 *
 * Les donnees du site sont extraites d'un wiki sous licence CC BY-SA : les
 * republier suppose de crediter la source, ce que chaque reponse fait via ses
 * en-tetes plutot que de compter sur la bonne volonte du consommateur.
 *
 * Le cache est genereux : ces donnees ne changent qu'a la synchronisation
 * hebdomadaire, et rien ne justifie de recalculer une reponse identique.
 */
export function reponseApi(donnees: unknown, options: { total?: number } = {}) {
  return NextResponse.json(
    {
      data: donnees,
      ...(options.total !== undefined ? { total: options.total } : {}),
      source: {
        name: "Mobile Legends Wiki",
        url: "https://mobilelegends.fandom.com",
        license: "CC BY-SA",
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        // L'API est faite pour etre consommee depuis un navigateur tiers.
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        // Un en-tete HTTP n'accepte que du latin-1 : pas de tiret cadratin ici.
        "X-Data-License": "CC BY-SA / Mobile Legends Wiki",
      },
    },
  );
}

export function introuvable(quoi: string) {
  return NextResponse.json(
    { error: `${quoi} not found` },
    { status: 404, headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
