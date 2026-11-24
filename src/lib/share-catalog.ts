import { codeCatalog } from "./build-catalog";
import { allHeroes, patchDetails } from "./data";
import type { ShareCatalog } from "./share-card";

/** What a share image may name, on the server: listed heroes, the build catalog, patches with notes. */
export const shareCatalog: ShareCatalog = {
  heroes: new Set(allHeroes.map((h) => h.slug)),
  build: codeCatalog,
  versions: new Set(Object.keys(patchDetails)),
};
