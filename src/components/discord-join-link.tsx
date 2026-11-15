"use client";

import type { ReactNode } from "react";
import { trackEvent } from "@/lib/analytics";
import { rememberDiscordPopupJoined } from "@/lib/discord-popup";
import type { DiscordContext, DiscordPlacement } from "@/lib/discord-cta";

/**
 * A link to the community server that counts its clicks: the event action
 * says where it sits ("Header join", "Inline join"…) and the name which
 * invitation it carried, so each one's pull can be compared in Matomo. A
 * click also retires the corner card: whoever joined needs no reminder.
 */
export function DiscordJoinLink({
  href,
  placement,
  context,
  className,
  label,
  title,
  children,
}: {
  href: string;
  placement: Exclude<DiscordPlacement, "Popup">;
  context?: DiscordContext;
  className?: string;
  label?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      rel="noopener"
      target="_blank"
      aria-label={label}
      title={title}
      className={className}
      onClick={() => {
        rememberDiscordPopupJoined();
        trackEvent("Discord", `${placement} join`, context);
      }}
    >
      {children}
    </a>
  );
}
