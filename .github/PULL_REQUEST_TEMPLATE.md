## Ce que fait cette pull request

<!-- En une ou deux phrases. Si elle repond a une issue : « Corrige #12 ». -->

## Type

- [ ] Analyse de heros ecrite ou completee
- [ ] Correction de donnees ou d'equilibrage
- [ ] Article : guide, actualite, patch note
- [ ] Correction de bogue
- [ ] Fonctionnalite
- [ ] Documentation

## Verifications

- [ ] `npm run lint` passe
- [ ] `npm run typecheck` passe
- [ ] `npm run build` passe
- [ ] Je n'ai **pas** modifie `src/data/jeu/` a la main
      (ces fichiers sont ecrases a chaque synchronisation)

<!--
Si vous ajoutez une analyse de heros :
- le `slug` est repris tel quel depuis src/data/jeu/heros.json
- le champ `contexte` de chaque build explique *quand* le prendre
- les placements de tier list sont argumentes

Si vous corrigez une donnee du jeu : elle vient du wiki communautaire.
Corriger le wiki resout le probleme pour tout le monde, et pour de bon.
-->

## Contexte

<!-- Capture d'ecran, lien vers les notes de patch, ou rien si evident. -->
