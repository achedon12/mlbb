/**
 * The soft "save your progress on all your devices" prompt: when it may show.
 *
 * Only at a moment that earned it (the third MLBBdle solve and after, a quiz
 * streak of two days or more, a favourite added), only to a visitor who is
 * signed out on a site that keeps account copies, at most once per visit,
 * never again for two months after it was closed, and never once its visitor
 * followed it to sign in. Never when storage refuses: nothing would remember
 * the "no".
 */

export const PROMPT_MOMENTS = ["mlbbdle", "quiz", "favourite"] as const;
export type PromptMoment = (typeof PROMPT_MOMENTS)[number];

const KEY = "mlbbdex:account-prompt";
const SESSION_KEY = "mlbbdex:account-prompt-session";
export const DISMISS_MS = 60 * 86_400_000;
/** Solves before the MLBBdle moment counts: the third one is where a habit starts. */
export const MLBBDLE_SOLVES = 3;
/** Streak before the quiz moment counts. */
export const QUIZ_STREAK = 2;

export interface PromptMemory {
  dismissedUntil?: number;
  /** Followed to sign in: never asked again. */
  followed?: boolean;
}

/** Whether the moment itself is worth a prompt, from what was just played. */
export function momentEarned(moment: PromptMoment, o: { solves?: number; streak?: number }): boolean {
  if (moment === "mlbbdle") return (o.solves ?? 0) >= MLBBDLE_SOLVES;
  if (moment === "quiz") return (o.streak ?? 0) >= QUIZ_STREAK;
  return true;
}

/** Pure rule, testable: may the prompt show, given the sync state and what the browser remembers? */
export function promptAllowed(c: {
  status: string;
  memory: PromptMemory | null;
  shownThisVisit: boolean | null;
  now: number;
}): boolean {
  if (c.status !== "signedOut") return false;
  if (!c.memory || c.shownThisVisit === null || c.shownThisVisit) return false;
  if (c.memory.followed) return false;
  if (c.memory.dismissedUntil !== undefined && c.now < c.memory.dismissedUntil) return false;
  return true;
}

/** What the browser remembers; null when storage refuses. */
export function readPromptMemory(): PromptMemory | null {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : {};
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const m = v as Record<string, unknown>;
    return {
      ...(typeof m.dismissedUntil === "number" ? { dismissedUntil: m.dismissedUntil } : {}),
      ...(m.followed === true ? { followed: true } : {}),
    };
  } catch {
    return null;
  }
}

function writePromptMemory(m: PromptMemory) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* nothing to remember with */
  }
}

/** Whether the prompt already showed during this visit; null when storage refuses. */
export function readShownThisVisit(): boolean | null {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return null;
  }
}

export function markShownThisVisit() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* refused: `promptAllowed` already said no */
  }
}

export function rememberDismissed(now = Date.now()) {
  writePromptMemory({ ...(readPromptMemory() ?? {}), dismissedUntil: now + DISMISS_MS });
}

export function rememberFollowed() {
  writePromptMemory({ ...(readPromptMemory() ?? {}), followed: true });
}
