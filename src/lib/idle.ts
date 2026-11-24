/**
 * Scheduling for work the first screen does not need (extra mascot drawings,
 * the service worker, popups): it waits so that, on a phone, it neither
 * shares the network with the poster art (the LCP) nor lengthens hydration.
 * Browser only; each function returns its cancel function.
 */

/** Runs `run` when the main thread is idle, at most `timeout` ms later. */
export function whenIdle(run: () => void, timeout = 2000): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  // Safari has no idle callback: a short delay keeps it off the page's own work.
  const id = setTimeout(run, 200);
  return () => clearTimeout(id);
}

/** Runs `run` once the page has loaded (`load` event), then when the main thread is idle. */
export function afterLoad(run: () => void, timeout = 2000): () => void {
  let cancel = () => {};
  const schedule = () => {
    cancel = whenIdle(run, timeout);
  };
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
  return () => {
    window.removeEventListener("load", schedule);
    cancel();
  };
}
