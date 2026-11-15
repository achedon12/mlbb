"use client";

/**
 * Tells the service worker that the visitor is signing out, so it drops any
 * cached copy of a signed-in page (`forgetPrivate`, public/sw.js). The game
 * account signs out through a server action, which the worker cannot tell
 * apart from any other: the page has to say so. Without a worker, or before
 * it controls the page, there is nothing cached to forget.
 */
export function forgetSignedInPages() {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "forget-private" });
  } catch {
    /* no service worker: nothing cached */
  }
}

/** The sign-out form: the server action still works without JavaScript. */
export function SignOutForm({
  action,
  className,
  children,
}: {
  action: (data: FormData) => void | Promise<void>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action} onSubmit={forgetSignedInPages} className={className}>
      {children}
    </form>
  );
}
