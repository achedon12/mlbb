/**
 * Demarrage du serveur.
 *
 * Next appelle `register()` une fois par demarrage. On y annonce le dernier
 * patch aux abonnes des notifications, s'il ne l'a pas encore ete : une
 * synchronisation de donnees arrive par un commit suivi d'un redeploiement,
 * donc un nouveau patch coincide toujours avec un demarrage.
 *
 * Seul le runtime Node est concerne (pas l'edge), jamais le build, et rien
 * n'est charge tant que les cles VAPID sont absentes.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  const [{ notifierAuDemarrage }, { patchsRecents }] = await Promise.all([
    import("@/lib/push-serveur"),
    import("@/lib/suivi-patchs"),
  ]);
  // Sans attendre : le serveur repond pendant l'envoi, qui ne leve jamais.
  void notifierAuDemarrage(patchsRecents[0]);
}
