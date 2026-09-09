# Politique de securite

## Versions suivies

Seule la branche `main` est maintenue. Un correctif de securite y est applique
directement.

## Signaler une faille

**N'ouvrez pas d'issue publique pour une faille de securite.**

Utilisez l'onglet **Security → Report a vulnerability** du depot
([lien direct](https://github.com/achedon12/mlbb/security/advisories/new)). Le
signalement reste prive tant qu'un correctif n'est pas publie.

A defaut, contactez le mainteneur via son profil GitHub :
[achedon12](https://github.com/achedon12).

### Ce qui aide

- Ce que vous avez obtenu, et ce que vous auriez du obtenir.
- Les etapes minimales pour reproduire.
- La version concernee : commit ou date de deploiement.

Une reponse arrive sous **72 heures**. Un correctif est vise sous **7 jours**
pour une faille exploitable a distance sans authentification, sous 30 jours
sinon.

### Merci de ne pas

- Tester sur l'instance publique de facon destructrice : pas de deni de
  service, pas de suppression de donnees, pas d'acces aux comptes d'autrui.
- Divulguer publiquement avant qu'un correctif soit disponible.

## Perimetre

**Concerne :** le code de ce depot et l'instance <https://mlbb.leoderoin.fr> —
authentification, sessions, injection, exposition de donnees d'autres
utilisateurs, XSS, traversee de chemin.

**Hors perimetre :**

- Le jeu Mobile Legends: Bang Bang lui-meme et les services de Moonton. Ce
  projet n'a aucun lien avec eux ; adressez-vous a l'editeur.
- Le wiki communautaire dont proviennent les donnees.
- L'absence d'en-tetes sur des ressources purement statiques, sans impact
  demontrable.
- Le volume de requetes sortantes vers les sources publiques agregees.

## Donnees stockees

Le site conserve, pour un compte cree volontairement : une adresse e-mail, un
pseudo, un mot de passe derive par scrypt, les identifiants de jeu lies et les
heros mis en favori. Aucun traceur, aucune mesure d'audience tierce, aucune
revente. Une faille exposant ces donnees est traitee en priorite haute.
