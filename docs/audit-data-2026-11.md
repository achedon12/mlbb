# Audit des données et des visuels — novembre 2026

Audit en lecture seule, fait le 19 novembre 2026. Il compare les données du site
(`src/data/game/*.json`, synchronisées le 16 novembre par `scripts/sync.mjs`)
et les pages en ligne (`https://mlbbdex.com/en/…` et `/fr/…`) à trois sources :

- **le texte officiel du jeu** : les fiches héros publiées par Moonton sur le site
  communautaire du jeu (version 2.2.16), lues via l'API arena.rone.dev
  (`/api/heroes/<nom>?lang=en`). Elles donnent les rôles, les voies, les
  spécialités, les noms et descriptions des compétences, les recharges et les coûts ;
- **Liquipedia** (`liquipedia.net/mobilelegends`), par son API, à une requête
  toutes les 2,5 s au plus, avec un agent identifié, sans `action=parse` ;
- **le wiki Fandom**, source actuelle du site : pages des héros, modules de
  données, pages de fichiers et leur historique.

Rien n'a été modifié. Le décalage de la liste des patchs (le site affiche
2.2.16 alors que le patch en ligne est le 2.2.23) est traité à part et n'est
pas détaillé ici.

## Résumé

| Catégorie | Bloquant | Important | Mineur | Total |
| --- | ---: | ---: | ---: | ---: |
| 1. Héros (liste, rôles, statistiques de base) | 2 | 0 | 3 | 5 |
| 2. Compétences | 1 | 0 | 1 | 2 |
| 3. Objets, emblèmes, talents, sorts | 0 | 3 | 2 | 5 |
| 4. Skins | 0 | 2 | 1 | 3 |
| 5. Visuels et illustrations | 1 | 1 | 1 | 3 |
| 6. Statistiques, contres, builds, tier list | 0 | 1 | 0 | 1 |
| 7. Événements, esport, lore, patchs, modes | 1 | 5 | 3 | 9 |
| 8. Textes (traduction, restes du wiki, remplissage) | 2 | 3 | 3 | 8 |
| **Total** | **7** | **15** | **14** | **36** |

Ce qui pèse le plus, dans l'ordre :

1. **Des chiffres faux ou absents partout.**
   - Les statistiques de base n'ont pas suivi les patchs de 2026 : 102 des
     117 changements d'attributs publiés ne sont pas appliqués.
   - Les compétences s'affichent sans leurs dégâts et sans leurs recharges.
   - Un tiers des valeurs qui restent ne correspondent plus au texte officiel.
2. **Des contenus non sortis ou non définitifs présentés comme en jeu.**
   - Le héros Dori, qui n'est pas sorti.
   - L'illustration d'un « revamp non sorti » de Thamuz.
   - Des skins annoncés sans date.
   - Des versions provisoires d'illustrations, jamais remplacées : le script
     ne retélécharge jamais un fichier déjà présent.
3. **Des restes de code du wiki et un article de patch inventé**, visibles sur
   les pages les plus lues.

Ce qui est juste, et qu'on peut dire à la communauté :

- La liste des héros est complète : 133 héros sortis, comme sur Liquipedia.
- Les rôles sont conformes au texte officiel pour les 133 héros.
- Les statistiques de parties sont fraîches (`measuredAt` du 18 novembre 2026)
  et dans des plages plausibles : victoire de 41,8 % à 58,6 %, bannissement
  jusqu'à 67,7 %.
- Les statuts et vainqueurs des tournois suivis sont justes (MPL ID S18,
  MPL PH S18, MSC 2026, M8 à venir).

---

## Bloquant

### B1. Un héros non sorti, Dori, est présenté comme un héros du jeu

- **Où** :
  - `src/data/game/heroes.json`, entrée `dori` (id 1341) : `release: "TBA"`,
    notes `1/1/1/1`, `stats: null` ;
  - la page https://mlbbdex.com/en/heroes/dori, et le héros apparaît dans la
    liste https://mlbbdex.com/en/heroes.
- **Ce que voit le visiteur** :
  - « Release TBA » et des notes à 1/10 partout ;
  - « The data for Dori is up to date — it comes straight from the wiki » ;
  - quatre compétences ;
  - une illustration et un portrait.
- **Réalité** :
  - Dori n'est pas sorti : il est absent de Liquipedia (133 héros) et de l'API
    officielle (133 héros, `/api/heroes?size=200`).
  - Sa page Fandom porte le modèle `{{Unfinished}}`.
  - L'illustration (`File:Dori (Shepherd of Smiles).jpg`) a été envoyée sur le
    wiki le 1ᵉʳ novembre 2026 avec la description « sss ».
  - Le portrait (`File:Hero1341-portrait.png`) date du 31 octobre 2026
    (« for dori »).
  - Ce sont des visuels du serveur avancé, ou de fuite, pas des visuels
    définitifs.
- **Preuves** :
  - https://mobile-legends.fandom.com/wiki/Dori
  - https://mobile-legends.fandom.com/wiki/File:Dori_(Shepherd_of_Smiles).jpg
  - https://liquipedia.net/mobilelegends/Portal:Heroes
- **Correction** (script) :
  - Dans `sync.mjs`, écarter tout héros dont la date de sortie n'est pas une
    date passée (`TBA`, vide, `202X`), ou dont la page porte `{{Unfinished}}`.
  - Ne pas télécharger ses visuels.
  - En option : une rubrique « À venir », clairement étiquetée.
  - Supprimer `public/visuels/heros/dori/`.

### B2. Les statistiques de base n'ont pas suivi les patchs de 2026

- **Où** : `heroes.json`, champ `stats`, affiché dans l'onglet « Stats » de
  chaque fiche, le comparateur et les outils de calcul.
- **Origine** : le module Fandom `Module:Hero/data`, qui n'est plus tenu à jour
  pour les attributs.
- **Mesure** :
  - Les notes de patch elles-mêmes (`patches.json`, versions 2.1.40 à 2.2.16)
    contiennent 117 changements chiffrés d'attributs de base : PV, attaque,
    défenses, vitesse, régénération.
  - Le site n'applique la valeur « après » que dans **15 cas sur 117**.
  - Liquipedia l'applique dans 93 cas sur 117.
  - 52 héros sont concernés.
- **Exemples** :

  | Héros | Attribut | Patch | Valeur du patch | Site | Liquipedia |
  | --- | --- | --- | ---: | ---: | ---: |
  | Saber | PV de base | 2.1.88 | 2500 | 2440 | 2500 |
  | Tigreal | PV de base | 2.1.88 | 2700 | 2581 | 2581 |
  | Hanzo | PV de base | 2.1.88 | 2440 | 2594 | 2594 |
  | Grock | PV de base | 2.1.88 | 2700 | 2819 | 2819 |
  | Atlas | Défense physique | 2.1.88 | 25 | 21 | 21 |
  | Layla | PV / vitesse | 2.1.67 | 2320 / 250 | 2250 / 240 | 2320 / 250 |
  | Miya | PV / vitesse | 2.1.67 | 2320 / 250 | 2225 / 240 | 2320 / 250 |
  | Ixia | PV | 2.1.67 | 2260 | 2620 | 2260 |
  | Wanwan | PV | 2.1.67 | 2320 | 2540 | 2320 |
  | Kadita | Vitesse | 2.2.16 | 240 | 255 | 240 |
  | Gatotkaca | Défense physique | 2.1.88 | 15 | 10 | 15 |

- **Autres valeurs impossibles** :
  - Zetian : attaque physique de base `0` (Liquipedia : 95).
  - Masha, après son revamp de la 2.2.16 : PV 2043 contre 1100 sur Liquipedia.
- **Au total** : 106 des 133 héros diffèrent de Liquipedia sur au moins un
  attribut. Le relevé complet a été produit par le script d'audit (voir
  « Méthode »).
- **Preuves** :
  - https://mobile-legends.fandom.com/wiki/Patch_Notes_2.1.88
  - https://mobile-legends.fandom.com/wiki/Patch_Notes_2.1.67
  - https://liquipedia.net/mobilelegends/Saber (infobox)
- **Correction** (script) :
  - Prendre les attributs sur Liquipedia (champs `hp`, `phyatk`, `phydef`,
    `magdef`, `movespeed`, `hpreg`, `mana` de `{{Infobox hero}}`), ou à défaut
    appliquer les valeurs « après » des notes de patch.
  - Ajouter un contrôle à la synchronisation : si un patch récent donne une
    valeur et que la source en donne une autre, faire échouer la
    synchronisation ou signaler l'écart.

### B3. Les compétences s'affichent sans leurs chiffres, sans recharge, et parfois périmées

- **Où** :
  - `skills.json` et `skills/<langue>.json`, affichés dans l'onglet
    « Compétences » de chaque fiche ;
  - le code en cause : `scripts/wikitext.mjs`, qui supprime le modèle
    `{{scale}}` (`.replace(/\{\{scale\|[^}]*\}\}/gi, "")`).
- **Mesure** :
  - **265 des 627 descriptions** ont perdu leurs dégâts, soins ou boucliers.
  - **Aucune recharge ni aucun coût** n'est affiché, alors que le texte
    officiel les donne.
  - Sur les 566 descriptions qui gardent des chiffres, **185** contiennent au
    moins un chiffre absent du texte officiel de la 2.2.16.
- **Exemples en ligne** :
  - Fanny, Tornado Strike : « Fanny spins her blades, dealing damage to nearby
    enemies. » Texte officiel : « dealing 275 (+85% Total Physical Attack)
    Physical Damage », recharge 3,5 s, 12 d'énergie.
    https://mlbbdex.com/en/heroes/fanny
  - Aamon, Invisible Armor : le site dit « restores every 0.6 seconds … 60%
    extra Movement Speed ». L'officiel dit « 25 (+15% Total Magic Power)
    every 0.5s … 80% Movement Speed ».
  - Layla, Malefic Gun : le site dit « increasing to 130% » ; l'officiel dit 115 %.
  - Chou, Only Fast : le site dit ralentissement 80 % ; l'officiel dit 90 %.
  - Tigreal, Implosion : le site dit étourdissement 2 s ; l'officiel dit 1,8 s.
  - Lukas, Hero's Resolve : le site dit « 1 Resolve per second … additional 2 » ;
    l'officiel dit 0,5 par seconde et 3,5.
  - Kagura, Yin Yang Overturn : la description du site décrit l'ancienne
    version (renvoi et ralentissement de 0,5 s). L'officiel dit « resets the
    cooldown of Seimei Umbrella Open, dealing 235 (+60% Total Magic Power) ».
  - Masha, Feral Swipe : le site décrit la version d'avant le revamp
    (ralentissement de 50 %). L'officiel dit « 250 (+55% Total Physical
    Attack) … 150% damage to minions ».
- **Restes du wiki dans les textes** :
  - « Prey Mark|mark », « [unknown speed] », « [amount unknown] » (Fanny) ;
  - « Used Again:|e » (Tigreal) ;
  - 112 descriptions contiennent une barre `|`.
- **Preuves** :
  - https://mobile-legends.fandom.com/wiki/Fanny (wikitext de Tornado Strike,
    qui contient le `{{scale}}`)
  - `https://arena.rone.dev/api/heroes/Fanny?lang=en`, champ
    `heroskilllist[].skilllist[]`, avec `skilldesc` et `skillcd&cost`.
- **Correction** (script) :
  - Prendre la description et la recharge officielles (`skilldesc`,
    `skillcd&cost`), déjà interrogées par `sync.mjs` pour les combos.
  - Garder le wiki seulement en complément.
  - À défaut, convertir `{{scale|base=…|total-mp=…}}` en « 25 (+15 % PM) » au
    lieu de le supprimer.
  - Retirer les `[… unknown]` et les `x|y`.
  - Retraduire ensuite les langues.

### B4. Illustrations non définitives, et versions provisoires jamais remplacées

Ce point correspond directement au reproche de « visuels non officiels ou non
définitifs ». Il a deux causes.

**a) Des visuels de contenus non sortis ou explicitement provisoires**

| Fichier du site | Fichier source | Problème | Preuve |
| --- | --- | --- | --- |
| `public/visuels/heros/thamuz/illustrations/lord-lava.webp` | `File:Thamuz (Lord Lava; unreleased revamp).jpg` | Le nom du fichier sur le wiki l'indique : illustration d'un revamp **non sorti**, affichée comme skin de base actuel | https://mobile-legends.fandom.com/wiki/File:Thamuz_(Lord_Lava;_unreleased_revamp).jpg |
| `public/visuels/heros/dori/illustrations/shepherd-of-smiles.webp`, `public/visuels/heros/dori/portrait.webp` | `File:Dori (Shepherd of Smiles).jpg`, `File:Hero1341-portrait.png` | Héros non sorti (voir B1) | https://mobile-legends.fandom.com/wiki/File:Dori_(Shepherd_of_Smiles).jpg |
| `public/visuels/heros/bruno/illustrations/the-purifier.webp`, `public/visuels/heros/bruno/skins/101210-the-purifier.webp` | `File:Bruno (The Purifier).jpg` | Le skin est daté `202X-XX-XX` dans la source. L'image a été envoyée sur le wiki en juin 2025, bien avant toute sortie : c'est une fuite | https://mobile-legends.fandom.com/wiki/File:Bruno_(The_Purifier).jpg |
| `public/visuels/heros/helcurt/skins/517-cyber-infiltrator.webp` | `File:Hero517-portrait.png` | Skin marqué `Upcoming`, date `202X`, mais listé parmi les skins de Helcurt sans aucune mention | https://mlbbdex.com/en/heroes/helcurt |
| `public/visuels/heros/masha/illustrations/rogue-talon.webp` | `File:Masha Rogue Talon (Original).jpg` | Illustration d'avant le revamp de Masha (2.2.16), nommée « Original » sur le wiki | https://mobile-legends.fandom.com/wiki/Masha |

**b) Des illustrations remplacées sur le wiki après leur téléchargement par le site**

Dans `scripts/sync.mjs`, la fonction `download()` renvoie `"exists"` dès que
le fichier local existe. Une image téléchargée une fois n'est donc jamais
mise à jour. Or le wiki publie souvent d'abord une version provisoire
(serveur avancé, première version, basse résolution), puis la remplace par la
version définitive.

Méthode de vérification :

- Les 1 145 illustrations du site ont été comparées à la version actuelle du
  fichier sur le wiki, avec une empreinte d'image calculée sur des miniatures.
- 1 102 ont pu être comparées.
- Les 25 écarts ont été contrôlés à l'œil.

Résultat : **15 illustrations du site sont une version antérieure, différente
de l'illustration actuelle**. Les 10 autres écarts ne sont qu'un recadrage ou
le logo du jeu.

| Fichier du site (`public/visuels/heros/…`) | Ce qui a changé | Preuve (page du fichier, onglet historique) |
| --- | --- | --- |
| `clint/illustrations/west-justice.webp` | Ancienne illustration ; le wiki a la nouvelle (refonte) | https://mobile-legends.fandom.com/wiki/File:Clint_(West_Justice).jpg |
| `eudora/illustrations/lightning-weaver.webp` | Ancienne illustration ; nouvelle composition sur le wiki | https://mobile-legends.fandom.com/wiki/File:Eudora_(Lightning_Weaver).jpg |
| `brody/illustrations/the-lone-star.webp` | Ancienne illustration | https://mobile-legends.fandom.com/wiki/File:Brody_(The_Lone_Star).jpg |
| `brody/illustrations/nameless-stray.webp` | Ancienne illustration | https://mobile-legends.fandom.com/wiki/File:Brody_(Nameless_Stray).jpg |
| `fanny/illustrations/skylark.webp` | Ancienne illustration | https://mobile-legends.fandom.com/wiki/File:Fanny_(Skylark).jpg |
| `miya/illustrations/christmas-carnival.webp` | Ancienne illustration | https://mobile-legends.fandom.com/wiki/File:Miya_(Christmas_Carnival).jpg |
| `lesley/illustrations/falcon-mistress.webp` | Ancienne illustration | https://mobile-legends.fandom.com/wiki/File:Lesley_(Falcon_Mistress).jpg |
| `lesley/illustrations/angelic-agent.webp` | Ancienne illustration | https://mobile-legends.fandom.com/wiki/File:Lesley_(Angelic_Agent).jpg |
| `paquito/illustrations/death-blow.webp` | Ancienne illustration ; remplacée le 25/09/2026 | https://mobile-legends.fandom.com/wiki/File:Paquito_(Death_Blow).jpg |
| `masha/illustrations/wild-oats-fist.webp` | Illustration d'avant le revamp ; nouvelle version, puis version « HD » 2560×1440, le 19/09/2026 | https://mobile-legends.fandom.com/wiki/File:Masha_(Wild-oats_Fist).jpg |
| `masha/illustrations/winter-guard.webp` | Illustration d'avant le revamp | https://mobile-legends.fandom.com/wiki/File:Masha_(Winter_Guard).jpg |
| `bruno/illustrations/the-protector.webp` | Version provisoire : 1024×637 le 16/09, 1920×1080 puis « HD » le 19/09/2026 ; le fichier du site est antérieur | https://mobile-legends.fandom.com/wiki/File:Bruno_(The_Protector).jpg |
| `valir/illustrations/demonlord.webp` | Version retouchée sur le wiki (couleurs, détails) | https://mobile-legends.fandom.com/wiki/File:Valir_(Demonlord).jpg |
| `zilong/illustrations/spear-of-dragon.webp` | Version retouchée sur le wiki | https://mobile-legends.fandom.com/wiki/File:Zilong_(Spear_of_Dragon).jpg |
| `benedetta/illustrations/death-oath.webp` | Version retouchée sur le wiki | https://mobile-legends.fandom.com/wiki/File:Benedetta(Death_Oath).jpg |

Les portraits de skins (`skins/*.webp`), qui suivent la même règle de
téléchargement, n'ont pas été comparés un par un. Ils ont très probablement le
même défaut pour les héros revus en 2026 (Masha, Bruno).


- **Correction** (script) :
  1. Dans `download()`, comparer l'empreinte (`sha1` de l'API `imageinfo`) ou
     la date de la version du wiki à celle enregistrée lors du dernier
     téléchargement. Retélécharger quand elles diffèrent, et garder la source,
     la date et l'empreinte dans `visuals.json`.
  2. Écarter les fichiers dont le nom ou la légende contient « unreleased »,
     « Original », « Advance », « leak », « concept ».
  3. Écarter les skins dont la date n'est pas une date passée (`202X`,
     `Upcoming`).
  4. Ponctuellement, supprimer les fichiers des tableaux ci-dessus et relancer
     la synchronisation avec `--images`.

### B5. Un article de patch inventé : « Patch 1.9.40 »

- **Où** :
  - `content/fr/patch-notes/2026-08-28-patch-1-9-40.md` et ses traductions ;
  - en ligne : https://mlbbdex.com/fr/patch-notes/patch-1-9-40.
- **Problème** :
  - L'article se présente comme « rédigé à partir des notes officielles
    publiées par Moonton ».
  - Il est daté du 28 août 2026, alors que la version 1.9.x date de 2024–2025.
  - Il ne contient aucun chiffre (« augmente légèrement »).
  - Il parle d'un objet « Réduction de soins » qui n'existe pas sous ce nom.
  - Le patch 1.9.40 n'a pas de page sur le wiki : seuls 1.9.20, 1.9.42 et
    1.9.47 existent.
  - Pour une communauté officielle, c'est la preuve la plus visible d'un
    manque de contrôle.
- **Preuve** : https://mobile-legends.fandom.com/wiki/Special:PrefixIndex/Patch_Notes_1.9.
  La page « Patch Notes 1.9.40 » est absente.
- **Correction** (ponctuelle) :
  - Supprimer l'article dans toutes les langues.
  - Vérifier les autres articles de `content/` contre leurs notes officielles,
    par exemple `content/*/news/2026-09-08-khufra-domine-la-file-classee.md`
    (voir I14).

### B6. Restes de code du wiki visibles sur les fiches

- **Où et quoi** :
  - **Lore** (`stories.json` et `stories/<langue>.json`) :
    - « souhaite que name=Lunox|image=Lunox le rejoigne » : 21 fois sur
      https://mlbbdex.com/fr/heroes/thamuz ; 50 `name=` en français, 86 en
      anglais ;
    - des titres de section bruts, « === Duc des Éclats === » et
      « ===Dénieurs du destin=== » (https://mlbbdex.com/fr/heroes/aamon) :
      120 titres `===` sur 48 héros ;
    - des entités `&amp;#8230;` (bane, julian, guinevere, xavier).
  - **Objets** (`items.json`, champ `passive`) : un « @ » au milieu du texte
    sur 19 objets, par exemple « …for 2 seconds.@ Redemption: … » sur
    https://mlbbdex.com/en/items/chastise-pauldron.
  - **Héros** (`heroes.json`) :
    - `resource: "Resource#Rage/Indicator|None"` sur 19 héros (Lukas, Sora,
      Chou, Masha…), affiché « None » : la ressource Rage est perdue ;
    - `xavier.release: "[[Patch Notes/1.6.66|22 March 2022]]"`.
  - **Skins** (`skins.json`, champ `price.other`) : 18 skins avec des liens
    bruts, par exemple « Obtained via the [[MLBB × Jujutsu Kaisen|MLBB X
    Jujutsu Kaisen]] event ».
  - **Modes de jeu** (`modes.json`) :
    - « Category:Custom Category:Game Mode »
      (https://mlbbdex.com/en/game-modes/custom) ;
    - « {|class="article-table" !Heroes!! » (…/brawl) ;
    - « led by the name =Dyrroth » et « In this mode, 6 will be spread across
      6 maps » (…/arcade-mode).
- **Correction** (script) :
  - Compléter le nettoyage de `scripts/wikitext.mjs` : paramètres `name=` et
    `image=` des modèles, titres `===`, liens `[[a|b]]`, tableaux `{| |}`,
    catégories, entités HTML, séparateur `@`.
  - Ajouter à `scripts/smoke-check-rules.mjs` une règle qui fait échouer la
    construction si le texte visible contient `name=`, `===`, `[[`, `{{`, `|}`
    ou `Category:`.

### B7. Traduction française : contresens et phrases incompréhensibles dans le lore

- **Exemples** :
  - https://mlbbdex.com/fr/heroes/aurora : « Le Madien du Glacier qui accorde
    le remebrane sternal dans les légendes du Nord » (première phrase du lore).
  - Aamon : « Dénieurs du destin », « De la même manière, pour son frère
    Gusion, Aamon porte le nom du démon ».
  - Layla : « le titre honorifique d'"Étoile brillante" a été donné à elle »,
    « Novarie (enseignant) » au lieu de « Novaria (enseignante) ».
- **Origine** : traduction automatique (`scripts/translations.json`), sans
  relecture et sans règle française dans `scripts/translation-glossary.mjs`.
  Ce fichier contient des règles pour id, fil, th, pt et ru, mais aucune pour fr.
- **Aggravant** : l'anglais du lore, des modes et des compétences est lui-même
  **retraduit depuis le français** (`scripts/translate-data.mjs`, `stories`,
  `modes` et `skills` avec `source: "fr"`). Résultat sur la page anglaise :
  - « The aloof Duke of Castle Aberleen » devient « The distant Duke of
    Aberleen Castle » ;
  - « Fate Deniers » devient « Destiny Deniers » ;
  - dans le mode Arcade, « Boommander » devient « Boummandre », « Tank »
    devient « Reservoir » et « Marksman » devient « Sniper ».
- **Correction** :
  - Script : l'anglais doit être le texte source du wiki ou le texte officiel,
    jamais une retraduction.
  - Glossaire français dans `translation-glossary.mjs`.
  - Relecture humaine du lore français, au moins pour les héros les plus
    consultés.

---

## Important

### I1. Six objets retirés du jeu affichés comme actuels

- **Objets** : Bloodlust Axe, Calamity Reaper, Necklace of Durance, Scarlet
  Phantom, Shadow Twinblades, Twilight Armor.
- **Où** :
  - `items.json` : le statut du wiki (`Removed`) a été rangé dans le champ
    `bestFor` ;
  - en ligne, ces objets apparaissent dans https://mlbbdex.com/en/items, sur
    leur fiche (« Calamity Reaper (Magic, 1,950 gold) … Patch 2.2.16 ») et dans
    les « autres objets ».
- **Réalité** :
  - Liquipedia : `status=Removed` pour les six.
  - Bloodlust Axe a été fusionnée avec War Axe en 1.8.92.
  - Calamity Reaper et Shadow Twinblades ont été fusionnés en Starlium Scythe.
- **Preuves** :
  - https://liquipedia.net/mobilelegends/Calamity_Reaper
  - https://mobile-legends.fandom.com/wiki/Category:Removed_equipment
- **Correction** (script) :
  - Lire le statut dans un champ à part.
  - Exclure les objets retirés des listes, ou les étiqueter « Retiré du jeu »
    sur leur fiche.
  - Ne garder `bestFor` que pour son vrai sens. Bud of Hope et Shimmering
    Lantern sont aussi marqués `Removed` à tort dans ce champ.

### I2. Builds qui citent des objets et emblèmes que le site ne connaît pas

- **Athena's Shield**, renommé **Valkyrie's Shield** dans le jeu :
  - le wiki redirige l'ancien nom vers le nouveau depuis le 24/09/2026 ;
  - l'API des statistiques utilise encore l'ancien nom, dans 67 builds les
    plus joués et 115 guides ;
  - le site affiche alors une pastille « A » sans icône, avec un lien vers
    `/en/items/athena-s-shield`, qui ne mène pas à la fiche de l'objet
    (exemple : https://mlbbdex.com/en/heroes/atlas, onglet builds) ;
  - `src/lib/counters.ts` code aussi `"athena-s-shield"` en dur.
- **Autres noms inconnus dans les guides** (`statistics.json`, `guides`) :
  - Magic Boots et Demon Boots, alors que le site dit Magic Shoes et Demon Shoes ;
  - les bottes bénies (« Ice Hunter's Tough Boots », « Demon Boots - Favor »…) ;
  - « Twilight Armor (Discarded) » ;
  - « Resonating Heart ».
- **Emblème commun** :
  - 229 builds utilisent `"emblem": "All"` ;
  - le site ne connaît que 6 emblèmes (`src/data/emblems.ts`) et affiche
    « A / Emblème All » (https://mlbbdex.com/fr/heroes/gusion).
- **Correction** (script) :
  - Une table de correspondance des noms dans `sync.mjs` (anciens noms vers
    noms actuels, bottes bénies vers botte de base plus bénédiction).
  - Ajouter l'emblème commun.
  - Faire échouer la synchronisation sur un nom inconnu au lieu d'afficher une
    pastille.

### I3. Prix d'objets divergents entre le wiki et Liquipedia (à trancher en jeu)

- **Objets concernés** (site / Liquipedia) :

  | Objet | Site | Liquipedia |
  | --- | ---: | ---: |
  | Guardian Helmet | 2500 | 2200 |
  | Ares Belt | 700 | 900 |
  | Black Ice Shield | 780 | 880 |
  | Brute Force Breastplate | 2070 | 1870 |
  | Enchanted Talisman | 2070 | 1870 |
  | Rose Gold Meteor | 2030 | 1820 |
  | Starlium Scythe | 2120 | 2220 |
  | Arcane Boots | 720 | 690 |
  | Tough Boots | 720 | 700 |
  | Rapid Boots | 720 | 750 |
  | Swift Boots | 720 | 710 |
  | Magic Shoes | 720 | 710 |

- **Pourquoi c'est à trancher** : la source du site
  (`Module:Equipment/data`, dernière modification le 24/09/2026) indique 720
  pour toutes les bottes, ce qui est suspect. Les deux sources ne peuvent pas
  avoir raison en même temps.
- **Correction** :
  - Vérifier en jeu sur le patch actuel.
  - Puis choisir la source la plus fiable pour les prix et ajouter un contrôle
    de cohérence : prix égal à la somme des composants plus le coût
    d'assemblage.
- **Preuve** : https://liquipedia.net/mobilelegends/Guardian_Helmet

### I4. Skins récents absents (la source n'est plus mise à jour depuis le 5 octobre)

- **Où** : `skins.json`, qui vient de `Module:Skin/data`, dernière
  modification du 5 octobre 2026.
- **Mesure** : environ 80 skins figurent dans la galerie d'icônes de leur page
  de héros sur le wiki, mais pas dans `skins.json`. Quelques-uns sont des
  variantes de nom.
- **Parmi eux** :
  - le skin **StarLight du mois en cours**, Kalea « Tideborn Sailor » ;
  - Kagura « Feast of Eternity » (Legend, sorti le 6 novembre 2026) ;
  - Hilda « Guardian Battalion », Freya « Starborn Resolve », Harith « Rebel
    Emberfang », Aulus « Starwake Corsair » (StarLight 2026) ;
  - Gusion « Minato Namikaze » et Julian « Itachi Uchiha » (collaboration
    Naruto) ;
  - Aamon « Falcon of Light » : le site affiche « Skins 6 » puis « Voir les
    7 skins ».
- **Événements** : les skins Collector de février à novembre 2026 manquent
  dans `events.json`.
  - Cause : la regex de `scripts/events.mjs` (ligne 91) exige un `<br>` que le
    wiki n'écrit plus depuis février 2026.
  - Conséquence : la page https://mlbbdex.com/en/events/2026-11 n'affiche
    qu'un skin.
- **Preuves** :
  - https://mobile-legends.fandom.com/wiki/Kalea (galerie d'icônes)
  - https://mobile-legends.fandom.com/wiki/Collector_Skins
  - https://esports.gg/guides/mobile-legends-bang-bang/mlbb-november-2026-starlight-pass-kalea-skin-rewards/
- **Correction** (script) :
  - Compléter `Module:Skin/data` avec les galeries des pages de héros, ou avec
    la liste officielle des skins.
  - Rendre le `<br>` facultatif dans `events.mjs`.
  - Faire échouer la synchronisation si le mois en cours n'a aucun skin.

### I5. Dates et statuts de skins faux, repris tels quels de la source

Exemples dans `skins.json` :

- Sora « Azure Cloud » est daté du 18/12/2026, donc dans le futur, mais il est
  marqué « Available » à 269 diamants. Il s'agit probablement du 18/12/2025,
  date de sortie de Sora.
- Balmond « Ironhide Berserker » : `2026-12-18`, label « S39 », mais
  acquisition « Season 31 ».
- Bruno « The Purifier » (`202X`) et Helcurt « Cyber Infiltrator »
  (`Upcoming`, `202X`) sont listés comme les autres skins, sans aucune
  mention (voir B4).
- L'identifiant Obsidia `1303` correspond à « Magitech Wraith » dans
  `events.json`, mais à « Imperatrix Arashi » dans `skins.json`.
- Fredrinn « Royal Marshal » est daté de novembre 2025 dans `skins.json`,
  alors que le wiki StarLight indique décembre 2025.
- « Avaliable via the Bang Bang Card » (Mathilda) : la faute de frappe du wiki
  est affichée telle quelle.

**Correction** :

- Script : écarter ou étiqueter « À venir » les dates futures ou inconnues, et
  contrôler la cohérence entre label et acquisition.
- Correction ponctuelle des dates connues.

### I6. Images de collaborations sous licence, et mention de licence inexacte

- **Images de collaborations** : le site héberge les illustrations et
  portraits de **56 skins de collaboration**, avec des personnages sous licence
  de tiers. Exemples : Naruto, Jujutsu Kaisen, Attack on Titan, Star Wars,
  Transformers, SpongeBob, Sanrio, The King of Fighters, Saint Seiya,
  HUNTER×HUNTER, Kung Fu Panda, Ducati, Neymar Jr, Manny Pacquiao. La liste
  vient de `skins.json`, labels de collaboration.
- **Mention de licence** : le pied de page dit « Game data from the Mobile
  Legends wiki (CC BY-SA) ». Or les pages de fichiers du wiki classent ces
  images dans « Assets copyrighted to Moonton Games » sous le modèle
  `{{Fairuse}}`. Elles ne sont pas sous CC BY-SA et ne peuvent pas être
  redistribuées sous cette licence.
- **Preuve** : https://mobile-legends.fandom.com/wiki/File:Bruno_(The_Purifier).jpg
  (section « Licensing »).
- **Correction** :
  - Corriger la mention du pied de page : données textuelles CC BY-SA ; images
    © Moonton et ayants droit, utilisées à titre d'illustration.
  - Demander à la communauté officielle ou à Moonton ce qui est toléré pour
    les collaborations.
  - Si besoin, ne pas afficher les illustrations en grand des skins de
    collaboration.

### I7. La page Advance Server est figée en juin 2024

- **Ce que montre le site** : https://mlbbdex.com/en/patch-notes/advance-server
  indique « Latest documented version: Advance Server 1.8.92 — June 15, 2024 ».
- **Dans les données** : `advance-server.json` a `syncedAt: 2026-09-11`. Le
  wiki ne documente plus le serveur avancé.
- **Pourquoi c'est important** : la page est mise en avant dans le menu
  « News ».
- **Correction** : masquer la page tant qu'il n'y a pas de source récente, ou
  changer de source.

### I8. Modes de jeu retirés présentés comme jouables

- **Où** : https://mlbbdex.com/en/game-modes/arcade-mode. Survival, Evolve,
  Ravage, TD Chess et Arena sont listés comme « can be played from time to
  time ».
- **Cas de Magic Chess** : il est devenu un jeu à part, Magic Chess: Go Go,
  sorti mondialement le 28 mai 2025.
- **Preuve** : https://gosugamers.net/news/74351-magic-chess-go-go-launches-in-the-apac-region-this-week
- **Correction** (ponctuelle) : un statut « retiré » par sous-mode.

### I9. Dates contradictoires sur les pages de patch

- **Sur la page 2.2.16** (https://mlbbdex.com/fr/patch-notes/2.2.16), trois
  dates différentes :
  - « Notes publiées le 3 octobre 2026 » ;
  - « La mise à jour a été publiée le 16 septembre 2026 » ;
  - « pour le mois de septembre 2026 ».
- **Dans `patches.json`** :
  - 1.9.42 est daté du `2026-11-04` et 1.9.20 du `2026-11-11` (des patchs de
    2024–2025) ;
  - 2.1.40 à 2.1.67 sont tous datés de début mai 2026.
- **À traiter avec** la correction de la liste des patchs en cours.

### I10. Vocabulaire français du jeu faux ou incohérent

- **Voies** : « Position Or », « Position Expérience », « Milieu »
  (`src/i18n/messages/fr.json`, clés `lanes.*`). La communauté dit « Gold
  lane », « EXP lane », « Mid », et la page esport du site le dit déjà.
- **Sorts** : « Test de Châtiment » dans le menu, mais « Sort Retribution » sur
  les fiches.
- **Lore** : « tradition » pour « lore » (59 fois dans `stories/fr.json`).
- **Mélanges** :
  - « HP » et « PV » (`items/fr.json` : 46 « HP » et 34 « PV ») ;
  - « creeps » et « sbires » ;
  - « counters » et « contres ».
- **Contresens** : « immunité lente » au lieu d'« immunité aux
  ralentissements » (Akai, Atlas, Cecilion, Hylos).
- **Rangs en anglais** dans les notes de tier list (« Mythic Glory ») alors que
  le site dit ailleurs « Gloire mythique ».
- **Correction** : un glossaire français dans `translation-glossary.mjs`, puis
  retraduction.

### I11. Nombres au format anglais sur les pages françaises

- **Exemples** : sur la même fiche, « +4,5 pts » et « + 4.5 pts »,
  « 54.7 % de victoire ».
- **Ampleur** : environ 25 nombres avec un point par fiche héros.
- **Origine** : des `toFixed(1)` sans formatage selon la langue, dans :
  - `src/components/measured-counters.tsx:137` ;
  - `src/components/builds-by-rank.tsx:123,129` ;
  - `src/components/hero-card.tsx:78`.
- **Correction** (code) : formater avec `Intl.NumberFormat` selon la langue.

### I12. Texte de remplissage sur environ 95 fiches héros

- **Le texte** : « Analyse en cours de rédaction — Les données de Aamon sont à
  jour — elles viennent directement du wiki. Ce qui manque, c'est le
  commentaire… Cela ne s'extrait pas, cela s'écrit. » (clés `analysisPending`
  et `analysisText`).
- **Pourquoi c'est important** : il affirme une fraîcheur que le point B2
  dément, et il a un ton de texte généré.
- **Phrases automatiques vides** : « le taux de victoire de Aamon est passé de
  50,3 % à 50,3 % (0,0 pts) ».
- **Correction** :
  - Retirer l'affirmation « à jour ».
  - Afficher un encart sobre, ou rien.
  - Masquer les évolutions nulles.

### I13. Tier list : un S+ sur un échantillon infime

- **Où** : https://mlbbdex.com/fr/tier-list. Masha est en **S+** (« Domine le
  patch. À prendre ou à bannir. »), avec 0,47 % de choix. Le site note
  lui-même que « la mesure est trop fragile ». Marcel (0,28 %) est dans le
  même cas.
- **Pourquoi c'est important** : un joueur lira cette tier list comme absurde.
- **Correction** (code) : une taille d'échantillon minimale pour entrer en S+
  ou S, sinon une mention « échantillon insuffisant » à la place du rang.

### I14. Article d'actualité contredit par les données du site

- **Où** : https://mlbbdex.com/fr/news/khufra-domine-la-file-classee.
- **Problème** :
  - L'article parle d'une « présence quasi systématique en file classée
    haute », alors que la tier list du site lui donne 2,4 % de bannissement et
    0,4 % de choix.
- **Correction** (ponctuelle) : relire ou retirer l'article.

### I15. La page « Roundup » ne montre que des messages Reddit, dont certains grossiers

- **Où** : https://mlbbdex.com/en/watch (`watch.json`). Les 25 éléments sur 25
  viennent de r/MobileLegendsGame, par exemple « his wave clear is ass ».
- **Le décalage** : la page se présente comme une revue de presse.
- **Correction** (script) : réparer la source Esports.gg dans
  `scripts/watch.mjs`, filtrer ou retirer Reddit.

---

## Mineur

**M1. Titres de héros différents de Liquipedia, à vérifier en jeu.** Les
écarts relevés (site / Liquipedia) :

| Héros | Site | Liquipedia |
| --- | --- | --- |
| Clint | West Justice | Wild Wanderer |
| Claude | Master Thief | Partners in Crime |
| Gatotkaca | Mighty Legend | Iron Steel |
| Zhask | The King of Swarms | Planes Dominator |
| Martis | Ashura King | Asura King |
| Uranus | Aesthereal Defender | Aethereal Defender |
| Gord | Professor of the Mystics | Professor of the Mystic |

Le wiki lui-même légende « Iron Steel » (Gatotkaca) et « Asura King »
(Martis) dans les galeries de skins.

**M2. Dates de sortie différentes de Liquipedia.**

- Écarts relevés : Belerick (site 17/08/2018, Liquipedia 17/12/2018), Harley
  (29/07/2017 contre 04/08/2017), Selena (10/07/2018 contre 18/07/2018),
  Yu Zhong (16/06/2020 contre 19/06/2020).
- Un jour d'écart pour Aamon et Esmeralda.
- 46 héros n'ont qu'une année ou un mois (« 2016 », « December 2016 »).

**M3. Spécialités et voies secondaires différentes du texte officiel.**

- Spécialités (site / officiel) :
  - Cyclops : Poke/Control contre Damage/Control ;
  - Popol and Kupa : Push/Burst contre Control/Burst ;
  - Xavier : Damage/Guard contre Damage/Burst.
- Voies : le site ajoute des voies secondaires que le jeu n'affiche pas
  (Balmond EXP, Baxia Roam, Faramis Roam, Gusion Mid, Julian EXP, Kimmy Gold).
- **Correction** : prendre les champs officiels (`speciality`,
  `roadsortlabel`).

**M4. Noms de compétences différents du texte officiel.**

- Bane : « Ale » au lieu de « Sea Ink ».
- « Instantaneous Move » (Sun), « Furious Dive » (Yu Zhong) et « Hive
  Clones » (Zhask) sont absents.
- « Life Recovery » (Masha) n'existe plus depuis le revamp.

**M5. Illustrations en basse résolution** (largeur source inférieure à 1000 px) :

| Fichier (`public/visuels/heros/…`) | Largeur source |
| --- | ---: |
| `miya/illustrations/captain-thorns.webp` | 554 px |
| `hanzo/illustrations/the-pale-phantom.webp` | 607 px |
| `akai/illustrations/street-enforcer.webp` | 696 px |
| `clint/illustrations/summer-blast.webp` | 739 px |
| `fanny/illustrations/summer-rescue.webp` | 739 px |
| `bruno/illustrations/street-football.webp` | 768 px |
| `baxia/illustrations/black-tortoise.webp` | 800 px |
| `arlott/illustrations/lone-lancer.webp` | 890 px |
| `x-borg/illustrations/invoker-s-flame.webp` | 960 px |
| `beatrix/illustrations/sky-force-maverick.webp` | 960 px |
| `nana/illustrations/summer-fun.webp` | 960 px |
| `roger/illustrations/invoker-s-restraint.webp` | 960 px |

S'y ajoute `sora/illustrations/azure-cloud.webp` (1024 px). À remplacer quand
une version haute définition existe.

**M6. Talents : doublon** `weapon-master` / `weapons-master` dans
`visuals.json` (27 entrées pour 26 talents).

**M7. Sorts de combat.**

- /fr/emblems annonce 11 sorts, alors que /fr/spells en annonce 12.
- Flameshot n'a pas de recharge affichée sur /fr/spells.

**M8. Date « Mis à jour ».** Les pages d'événements affichent « Updated
November 18, 2026 », alors que `events.json` date du 16 novembre. La date
affichée est celle du calcul des taux, pas celle des données de la page.

**M9. Esport.**

- Lieu affiché « Istanbul, tr » (code pays brut) et « Paris, france »
  (minuscule).
- La phase Wildcard du M8 se joue à Bangkok, pas à Istanbul.

**M10. Décembre (Suyou « Frostblade Duelist »)** porte le badge « Announced »
sans annonce officielle. Mieux vaut un badge « Prévu ».

**M11. Libellés en double** : « Rang Rang », « Position Position »,
« Rôle Rôle ». Le pied de page annonce 5 langues alors que le site en propose 9.

**M12. Ton de texte généré** sur les pages de guide : « La vraie question
n'est pas quels talents existent, mais lesquels prendre… », « Vous jouez un
rôle, pas un catalogue. »

**M13. Élisions manquantes**, venant des gabarits : « Les données de Aamon »,
« Voir le détail de octobre 2026 ».

**M14. Esport : couverture limitée.** Seuls 6 tournois sont suivis : pas de
MPL MENA, KH, SG, ni MDL. Le titre « Current MPL seasons » laisse croire à une
couverture complète.

---

## Ce qui a été vérifié et est correct

- **Liste des héros** : 133 héros sortis, identiques à Liquipedia
  (`Category:Hero`) et à l'API officielle. Aucun héros manquant ou renommé.
  Dori est le seul en trop (B1).
- **Rôles** : conformes au texte officiel pour les 133 héros.
- **Noms de compétences** : identiques au texte officiel pour 128 héros sur 133.
- **Statistiques de parties** :
  - mesurées le 18/11/2026 ;
  - 133 héros couverts ;
  - victoire de 41,8 % à 58,6 % ;
  - bannissement de 0,04 % à 67,7 % ;
  - la somme des parts de choix fait 100 %.
- **Contres** : aucun contre ni coéquipier ne cite un héros inexistant.
- **Builds** : en dehors des noms listés en I2, tous les objets cités existent.
- **Sorts de combat** : les 12 sont présents.
- **Esport** : statuts et vainqueurs corrects pour MPL ID S18 (Bigetron by
  Vitality), MPL PH S18 (Aurora Gaming PH) et MSC 2026 (Team Spirit). M8
  est bien à venir (17/12/2026). `updatedAt` date du 15/11.
- **Duos d'illustrations** : les illustrations partagées entre deux héros
  (Alucard et Miya, Freya et Zilong, Karina et Selena) sont de vraies
  illustrations communes aux deux skins, pas des erreurs d'association.

## Méthode

- **Pages de héros, fichiers et modules Fandom** : lus par l'API MediaWiki
  (`action=query`, `prop=revisions|imageinfo|categories`).
- **Origine de chaque illustration** : retrouvée en rejouant la règle de
  `scripts/gallery.mjs` (première ligne de la galerie « Splash art » pour
  chaque skin), puis comparée à l'historique du fichier sur le wiki et à la
  date du fichier dans le dépôt (`git log`).
- **Liquipedia** : les 133 pages de héros et les 110 pages d'objets, lues en
  6 requêtes groupées (`prop=revisions`, 50 titres par requête), à moins
  d'une requête toutes les 2,5 s.
- **Texte officiel** : les 133 fiches de l'API arena.rone.dev, qui reprend les
  données publiées par Moonton (images `homepage_2_2_16`).
- **Notes de patch** : les valeurs « avant / après » viennent de
  `patches.json`, c'est-à-dire des notes officielles reprises par le wiki.
- **Textes français** : relevés sur les pages en ligne le 19/11/2026.
