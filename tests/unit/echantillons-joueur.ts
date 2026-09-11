/**
 * Reponses d'exemple de l'API de statistiques joueur (arena.rone.dev).
 *
 * Reprises des exemples du schema OpenAPI du service, puis etendues : plusieurs
 * heros et parties, des entrees abimees comme le service peut en renvoyer, et
 * le detail d'une partie a dix joueurs. Aucune n'a ete relevee sur un compte
 * reel — la connexion demande un code recu dans la messagerie du jeu.
 */

/** Joueur fictif, avec l'identifiant d'exemple du formulaire de connexion. */
export const MOI = { roleId: 123456789, zoneId: 6021 };

const CDN = "https://akmweb.youngjoygame.com/web/svnres/img/mlbb/community";

const NOMS: Record<number, string> = {
  1: "Miya",
  17: "Fanny",
  20: "Lolita",
  30: "Yi Sun-shin",
  31: "Moskov",
  36: "Aurora",
  65: "Claude",
  84: "Ling",
  109: "Aamon",
};

const entite = (hid: number) => ({ id: hid, n: NOMS[hid] ?? `Heros ${hid}`, ix: `${CDN}/100_${hid}.png`, i2x: "" });

/** `/api/user/stats`, exemple du schema. */
export const STATS = {
  code: 0,
  message: "Success",
  traceID: "b506b47e790797eb1f9762d2f1586496",
  data: {
    wc: 188,
    tc: 308,
    as: 762.3552,
    gt: 77.95,
    mvpc: 73,
    wsc: 11,
    mo: { v: 112848, ts: 1726010389, hid: 36, bid: 4110381620662451700, sid: 0, hid_e: entite(36), bid_s: "4110381620662451526" },
    sids: [40, 39, 38, 37],
  },
};

/** `/api/user/season`, exemple du schema. */
export const SAISONS = { code: 0, message: "Success", data: { sids: [40, 39, 38, 37] } };

/**
 * `/api/user/matches`, en texte brut : curseur et identifiants depassent 2^53
 * et ne doivent pas etre arrondis a la lecture. La deuxieme partie n'a que son
 * `bid` numerique ; les deux avant-dernieres sont illisibles ; la derniere
 * melange chaines, millisecondes et issue inconnue.
 */
export const PARTIES_TEXTE = `{"code":0,"message":"Success","traceID":"53cd62802d24dc512ffd908e1d6d06bc","data":{
"pageInfo":{"nextCursor":4143043017340290910,"hasNext":true,"count":7},
"result":[
{"sid":40,"bid":4132717739868068534,"hid":17,"k":14,"d":1,"a":11,"lid":4,"s":1180,"mvp":1,"res":1,"ts":1774857999,
 "hid_e":${JSON.stringify(entite(17))},"bid_s":"4132717739868068534"},
{"sid":40,"bid":4132717739868068601,"hid":84,"k":3,"d":7,"a":4,"lid":4,"s":540,"mvp":0,"res":0,"ts":1774851000,
 "hid_e":${JSON.stringify(entite(84))}},
{"sid":40,"bid":4132717739868068702,"hid":20,"k":1,"d":5,"a":12,"lid":3,"s":690,"mvp":0,"res":0,"ts":1774840000,
 "hid_e":${JSON.stringify(entite(20))},"bid_s":"4132717739868068702"},
{"sid":40,"bid":4132717739868068803,"hid":36,"k":6,"d":2,"a":9,"lid":2,"s":910,"mvp":0,"res":1,"ts":1774830000,
 "hid_e":{"id":36,"n":"Aurora","ix":"https://exemple.invalid/aurora.png"},"bid_s":"4132717739868068803"},
{"sid":40,"bid_s":"4132717739868068904","hid":null,"hid_e":null,"res":1},
{"sid":40,"bid_s":"pas-un-identifiant","hid":17,"res":1},
{"sid":40,"bid_s":"4132717739868069005","hid":999,"k":"4","d":null,"a":2,"lid":9,"s":null,"mvp":null,"res":2,
 "ts":1774820000000,"hid_e":{"id":999,"n":"Nouveau Heros","ix":""}}
]}}`;

/** Derniere page : plus de suite. */
export const PARTIES_FIN = {
  code: 0,
  data: { pageInfo: { nextCursor: "", hasNext: false, count: 0 }, result: [] },
};

/**
 * `/api/user/heroes/frequent`. Le curseur vide avec `hasNext` vrai vient tel
 * quel de l'exemple du schema.
 */
export const HEROS_FREQUENTS = {
  code: 0,
  message: "Success",
  data: {
    pageInfo: { nextCursor: "", hasNext: true, count: 0 },
    result: [
      { hid: 84, tc: 25, wc: 17, bs: 902.5, mr: 7000, mrp: 0.7, hid_e: entite(84), p: 1600 },
      { hid: 20, tc: 12, wc: 4, bs: 650, mr: 5000, mrp: 0.4, hid_e: entite(20), p: 1200 },
      { hid: 17, tc: 8, wc: 7, bs: 844.875, mr: 6626, mrp: 0.6188, hid_e: entite(17), p: 1460 },
      { hid: 36, tc: 6, wc: 2, bs: 700, mr: 4000, mrp: 0.3, hid_e: entite(36), p: 1100 },
      { hid: 65, tc: 3, wc: 1, bs: 600, mr: 3000, mrp: 0.2, hid_e: entite(65), p: 1000 },
      { hid: null, tc: 5, wc: 5, hid_e: null },
      { hid: 31, tc: 0, wc: 0, hid_e: entite(31) },
      "n'importe quoi",
      { hid: "1", tc: "4", wc: 9, hid_e: { id: 1, n: "Miya" } },
    ],
  },
};

/** `/api/user/matches/{match_id}`, exemple du schema : un seul participant, sans le joueur. */
export const DETAIL_SCHEMA = {
  code: 0,
  message: "Success",
  data: {
    result: [
      {
        f: 2, hid: 31, rid: 1880233572, zid: 57027, k: 4, d: 9, a: 6, tfr: 0.4167, o: 83974, op: 0.2202, s: 509,
        mvp: 0, its: [2305, 3002, 3005, 3015, 3003, 3013, 0], eq: 0, ts: 1773837471, bd: 1292, fk: 24, fw: 0,
        hid_e: entite(31), its_e: [{ id: 2305, n: "Swift Boots", ix: "", i2x: "" }, null], hlvl: 15, rname: "Jungle",
      },
    ],
  },
};

/**
 * Une partie de `/api/user/matches`, au format du schema : `res` 1 victoire,
 * 0 defaite, null issue absente ; `lid` la position, null quand le service ne
 * la donne pas.
 */
export function partieBrute(i: number, hid: number, lid: number | null, res: 0 | 1 | null, ts: number | null) {
  return {
    sid: 40, bid_s: `41327177398680${String(i).padStart(5, "0")}`, hid, k: 5, d: 3, a: 7, lid, s: 800, mvp: 0, res, ts,
    hid_e: entite(hid),
  };
}

/**
 * Page de `/api/user/matches` en texte brut, curseur numerique non cite comme
 * le rend le service : il depasse 2^53 et doit survivre a la lecture.
 */
export function pageHistorique(parties: object[], suivant: string | null) {
  const pageInfo = { nextCursor: suivant ?? "", hasNext: suivant !== null, count: parties.length };
  const texte = JSON.stringify({ code: 0, message: "Success", data: { pageInfo, result: parties } });
  return texte.replace(/"nextCursor":"(\d+)"/, '"nextCursor":$1');
}

/**
 * Historique de saison, de la plus ancienne partie a la plus recente : 4
 * defaites, 7 victoires, 1 defaite, 14 parties en alternance, puis 4
 * victoires. 30 parties, 18 victoires ; forme 7 sur les 10 dernieres.
 */
export const HISTOIRE = "DDDDVVVVVVVD" + "VDVDVDVDVDVDVD" + "VVVV";

/** Debut de l'historique : quatre parties par jour a partir du 1er mars 2026. */
export const DEBUT_HISTOIRE = Date.UTC(2026, 2, 1) / 1000;

/**
 * `HISTOIRE` au format du service, des plus recentes aux plus anciennes. Une
 * partie a l'issue inconnue s'intercale, une autre n'a pas de date.
 */
export function historiqueBrut() {
  const chrono = HISTOIRE.split("").map((c, i) =>
    partieBrute(i, [84, 20, 17, 36][i % 4], [4, 3, 4, 2][i % 4], c === "V" ? 1 : 0, DEBUT_HISTOIRE + i * 6 * 3600),
  );
  chrono.splice(20, 0, partieBrute(900, 84, 4, null, DEBUT_HISTOIRE + 19 * 6 * 3600 + 60));
  chrono[5].ts = null;
  return chrono.reverse();
}

/** Detail complet d'une partie a dix : le joueur et quatre allies en equipe 1, cinq adversaires en equipe 2. */
export function detailPartie(monHeros: number, ennemis: number[], victoire: boolean, avecEquipes = true) {
  const joueur = (hid: number, f: number | null, rid: number, gagne: boolean) => ({
    f, hid, rid, zid: MOI.zoneId, k: 3, d: 4, a: 5, tfr: 0.4, o: 50000, op: 0.2, s: 700, mvp: 0, its: [2305], eq: 0,
    ts: 1774857999, bd: 1200, fk: 20, fw: gagne ? 1 : 0, hid_e: entite(hid), its_e: [null], hlvl: 15, rname: "x",
  });
  const allies = [2, 3, 4, 5];
  return {
    code: 0,
    data: {
      result: [
        joueur(monHeros, avecEquipes ? 1 : null, MOI.roleId, victoire),
        ...allies.map((h, i) => joueur(h, avecEquipes ? 1 : null, 1000 + i, victoire)),
        ...ennemis.map((h, i) => joueur(h, avecEquipes ? 2 : null, 2000 + i, !victoire)),
      ],
    },
  };
}
