/**
 * Error reports on the data pages: a visitor says what is wrong on a hero,
 * item, emblem, spell or patch notes page, anonymously. Sizes and the pages
 * that take reports, shared by the form, the route and the moderation page.
 * No dependency: the browser form imports it.
 */

export const DATA_REPORT_TEXT_MIN = 10;
export const DATA_REPORT_TEXT_MAX = 1000;
export const DATA_REPORT_CORRECTION_MAX = 300;
export const DATA_REPORT_SOURCE_MAX = 300;
export const DATA_REPORT_PATH_MAX = 200;
/** Open reports kept at most: past that, new ones wait until some are closed (a flood stops there). */
export const DATA_REPORT_OPEN_MAX = 500;

/** Pages that offer the form, as paths without the locale. */
const PAGES = /^\/(?:heroes|items|emblems|spells|patch-notes)\/[a-z0-9][a-z0-9./-]*$/;

export const isReportablePath = (path: string) => path.length <= DATA_REPORT_PATH_MAX && PAGES.test(path) && !path.includes("..");
