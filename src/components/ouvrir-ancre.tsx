"use client";

import { useEffect } from "react";

/**
 * Ouvre le `<details>` vise par une ancre (« #rang-mythic ») : Chromium ne le
 * deplie pas de lui-meme, ni au chargement ni au clic, et le lien arriverait
 * sur une section fermee. Le contenu est deja dans le HTML ; ce composant ne
 * fait que l'ouvrir, et n'affiche rien.
 */
export function OuvrirAncre() {
  useEffect(() => {
    const ouvrir = (id: string) => {
      const cible = id ? document.getElementById(decodeURIComponent(id)) : null;
      if (cible instanceof HTMLDetailsElement) cible.open = true;
    };
    const depuisAdresse = () => ouvrir(location.hash.slice(1));
    // Le clic couvre aussi un second clic sur la meme ancre, qui ne change pas l'adresse.
    const auClic = (e: MouseEvent) => {
      const lien = e.target instanceof Element ? e.target.closest('a[href^="#"]') : null;
      if (lien) ouvrir(lien.getAttribute("href")!.slice(1));
    };
    depuisAdresse();
    addEventListener("hashchange", depuisAdresse);
    document.addEventListener("click", auClic);
    return () => {
      removeEventListener("hashchange", depuisAdresse);
      document.removeEventListener("click", auClic);
    };
  }, []);
  return null;
}
