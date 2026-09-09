"use client";

import { useState } from "react";
import Image from "next/image";
import { ExternalLink, Play } from "lucide-react";

/**
 * Presentation video officielle d'un heros.
 *
 * Le lecteur n'est charge qu'au clic : integrer une video YouTube pose une
 * demi-douzaine de requetes et des traceurs sur chaque fiche, pour un contenu
 * que la plupart des visiteurs ne regarderont pas. La vignette provient de
 * YouTube mais ne depose rien tant qu'on n'a pas demande la video.
 *
 * Sans identifiant connu, on propose une recherche plutot qu'un cadre vide :
 * la video existe, c'est son referencement qui manque.
 */
export function PresentationVideo({
  video,
  nom,
}: {
  video: { id: string; titre: string } | null;
  nom: string;
}) {
  const [lance, setLance] = useState(false);

  if (!video) {
    const recherche = `https://www.youtube.com/results?search_query=${encodeURIComponent(
      `Hero Spotlight ${nom} Mobile Legends Bang Bang`,
    )}`;

    return (
      <a
        href={recherche}
        target="_blank"
        rel="noreferrer nofollow"
        className="biseau flex items-center gap-3 border border-dashed border-nuit-700 p-4 text-sm text-craie-500 transition-colors hover:border-or-500/60 hover:text-or-400"
      >
        <ExternalLink size={16} aria-hidden />
        Chercher la presentation officielle de {nom} sur YouTube
      </a>
    );
  }

  if (!lance) {
    return (
      <button
        type="button"
        onClick={() => setLance(true)}
        className="biseau group relative block aspect-video w-full overflow-hidden border border-nuit-700/70"
        aria-label={`Lire la presentation video de ${nom}`}
      >
        <Image
          src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
          alt=""
          fill
          sizes="(min-width: 1024px) 900px, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute inset-0 bg-nuit-950/40 transition-colors group-hover:bg-nuit-950/25" />
        <span className="absolute inset-0 grid place-items-center">
          <span className="biseau-sm grid size-16 place-items-center bg-or-500/90 text-nuit-950 transition-transform group-hover:scale-110">
            <Play size={26} aria-hidden fill="currentColor" />
          </span>
        </span>
        <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-nuit-950 to-transparent p-4 text-left text-sm text-craie-100">
          {video.titre}
        </span>
      </button>
    );
  }

  return (
    <div className="biseau relative aspect-video w-full overflow-hidden border border-nuit-700/70">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1`}
        title={video.titre}
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 size-full"
      />
    </div>
  );
}
