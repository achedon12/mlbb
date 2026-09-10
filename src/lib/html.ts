import sanitizeHtml from "sanitize-html";

/**
 * Assainissement du HTML rendu.
 *
 * Le contenu des notes de patch vient du wiki, editable par n'importe qui : il
 * ne peut pas etre injecte tel quel dans la page. On n'autorise qu'une liste
 * blanche de balises et d'attributs de mise en forme, on force les liens en
 * externes sans reference, et on n'accepte que les schemas d'URL surs — ni
 * `javascript:`, ni gestionnaire d'evenement, ni `<script>` ne survit.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h2", "h3", "h4", "h5", "p", "ul", "ol", "li", "a", "strong", "em", "b", "i",
    "u", "s", "br", "hr", "blockquote", "code", "pre", "span", "div", "sup", "sub",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th",
  ],
  allowedAttributes: {
    a: ["href", "rel", "target"],
    // Les ancres des titres servent le sommaire des notes de patch.
    "*": ["id"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noreferrer nofollow", target: "_blank" }),
  },
};

export function assainirHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

/**
 * Serialise des donnees pour un `<script type="application/ld+json">`.
 *
 * `JSON.stringify` seul ne protege pas : une valeur contenant `</script>`
 * fermerait la balise et permettrait l'injection. On neutralise donc le
 * caractere `<`, ce qui empeche toute sortie de la balise sans alterer la
 * validite du JSON.
 */
export function donneesLd(donnees: unknown): string {
  return JSON.stringify(donnees).replace(/</g, "\\u003c");
}
