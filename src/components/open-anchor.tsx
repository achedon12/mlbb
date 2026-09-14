"use client";

import { useEffect } from "react";

/**
 * Ouvre le `<details>` vise par une ancre (« #rang-mythic ») : Chromium ne le
 * deplie pas de lui-meme, ni au chargement ni au clic, et le lien arriverait
 * sur une section fermee. Le contenu est deja dans le HTML ; ce composant ne
 * fait que l'ouvrir, et n'affiche rien.
 */
export function OpenAnchor() {
  useEffect(() => {
    const open = (id: string) => {
      const target = id ? document.getElementById(decodeURIComponent(id)) : null;
      if (target instanceof HTMLDetailsElement) target.open = true;
    };
    const fromAddress = () => open(location.hash.slice(1));
    // Le clic couvre aussi un second clic sur la meme ancre, qui ne change pas l'adresse.
    const onClick = (e: MouseEvent) => {
      const link = e.target instanceof Element ? e.target.closest('a[href^="#"]') : null;
      if (link) open(link.getAttribute("href")!.slice(1));
    };
    fromAddress();
    addEventListener("hashchange", fromAddress);
    document.addEventListener("click", onClick);
    return () => {
      removeEventListener("hashchange", fromAddress);
      document.removeEventListener("click", onClick);
    };
  }, []);
  return null;
}
