import { notFound } from "next/navigation";

/**
 * Adresse inconnue sous une langue : la page 404 du site, dans sa langue et
 * avec sa navigation, plutot que la page brute de Next — qui ne sait rien de
 * la langue ni de la mise en page.
 */
export default function AdresseInconnue() {
  notFound();
}
