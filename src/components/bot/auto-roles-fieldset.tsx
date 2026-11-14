"use client";

import { useId, useRef, useState } from "react";
import { useT } from "@/i18n/provider";
import {
  AUTO_ROLE_TARGETS,
  MAX_AUTO_ROLES,
  type AutoRoleFailure,
  type AutoRoleRefusal,
  type AutoRoleTarget,
  type GranterRefusal,
} from "@/lib/bot/kinds";
import { cn } from "@/lib/utils";

/**
 * "Auto-roles" part of a server's settings form: a switch, then up to 3
 * roles for the people who join and up to 3 for the bots added. The roles
 * come from the bot with whether it may give each one, and whether the
 * signed-in manager may (Manage Roles and below their highest role, or
 * owner): the others are listed but disabled, with the reason. The save
 * checks it all again with the bot (`checkAgainstGuild`, `autoRoleWrite`),
 * whatever this page sends.
 */

export type AutoRolesValue = { roleIds: string[]; botRoleIds: string[] };
export type AutoRoleChoice = {
  id: string;
  name: string;
  assignable: boolean;
  refusal: AutoRoleRefusal | null;
  /** Why the signed-in manager may not give it, or null. */
  granterRefusal: GranterRefusal | null;
};

/** The first reason a role cannot be picked: the bot's, then the manager's. */
const reasonOf = (r: AutoRoleChoice) => r.refusal ?? r.granterRefusal;

const FIELD = "bevel-sm w-full border border-night-700 bg-night-900 px-3 py-2 text-sm text-chalk-100 outline-none transition-colors focus:border-gold-500";

const FIELD_OF: Record<AutoRoleTarget, keyof AutoRolesValue> = { humans: "roleIds", bots: "botRoleIds" };

function RolePickers({
  target,
  ids,
  roles,
  onChange,
}: {
  target: AutoRoleTarget;
  ids: string[];
  roles: AutoRoleChoice[];
  onChange: (ids: string[]) => void;
}) {
  const t = useT();
  const base = useId();
  // The chosen roles, then one empty picker while there is room.
  const slots = ids.length < MAX_AUTO_ROLES ? [...ids, ""] : ids;
  return (
    <div>
      <p className="text-xs font-semibold text-chalk-300">{t(`pages.botUI.autoRolesTargets.${target}`)}</p>
      <div className="mt-1 grid gap-2 sm:grid-cols-3">
        {slots.map((current, slot) => (
          <div key={slot}>
            <label htmlFor={`${base}-${slot}`} className="sr-only">
              {t(`pages.botUI.autoRolesTargets.${target}`)} {slot + 1}
            </label>
            <select
              id={`${base}-${slot}`}
              value={current}
              onChange={(e) => {
                const next = [...ids];
                if (e.target.value) next[slot] = e.target.value;
                else next.splice(slot, 1);
                onChange(next);
              }}
              className={cn(FIELD, "disabled:opacity-50")}
            >
              <option value="">{t("pages.botUI.autoRolesNone")}</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id} disabled={!r.assignable || r.granterRefusal !== null || (r.id !== current && ids.includes(r.id))}>
                  @{r.name}
                  {reasonOf(r) ? ` (${t(`pages.botUI.autoRoleRefusals.${reasonOf(r)}`)})` : ""}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AutoRolesFieldset({
  value,
  roles,
  manageRoles,
  failing,
  onChange,
}: {
  value: AutoRolesValue;
  roles: AutoRoleChoice[];
  /** Does the bot hold Manage Roles in this server? */
  manageRoles: boolean;
  /** Why the bot stopped giving them, or null. */
  failing: AutoRoleFailure | null;
  onChange: (value: AutoRolesValue) => void;
}) {
  const t = useT();
  const configured = value.roleIds.length > 0 || value.botRoleIds.length > 0;
  const [open, setOpen] = useState(configured);
  // Switching off empties both lists (that is what "off" is); switching
  // back on before saving finds them again.
  const kept = useRef<AutoRolesValue>(value);
  const on = open || configured;
  const above = roles.some((r) => r.refusal === "above_bot");

  return (
    <fieldset>
      <legend className="font-heading text-lg font-bold text-chalk-100">{t("pages.botUI.autoRolesTitle")}</legend>
      <p className="mt-1 text-sm text-chalk-500">{t("pages.botUI.autoRolesLead")}</p>
      <div className="bevel-sm mt-4 border border-night-700/70 bg-night-900/60 p-4">
        {failing && configured && (
          <p role="alert" className="mb-3 text-sm text-blood-400">
            {t(failing === "granter" ? "pages.botUI.autoRolesFailingGranter" : "pages.botUI.autoRolesFailing")}
          </p>
        )}
        <label className="flex items-center gap-2 text-sm text-chalk-100">
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => {
              if (e.target.checked) {
                setOpen(true);
                onChange(kept.current);
              } else {
                kept.current = value;
                setOpen(false);
                onChange({ roleIds: [], botRoleIds: [] });
              }
            }}
            className="size-4 accent-gold-500"
          />
          {t("pages.botUI.autoRolesToggle")}
        </label>

        {on && (
          <div className="mt-3 space-y-4">
            {!manageRoles ? (
              <p role="alert" className="text-sm text-blood-400">
                {t("pages.botUI.autoRolesNoPermission")}
              </p>
            ) : above ? (
              <p className="text-sm text-gold-400">{t("pages.botUI.autoRolesAbove")}</p>
            ) : null}
            {AUTO_ROLE_TARGETS.map((target) => (
              <RolePickers
                key={target}
                target={target}
                ids={value[FIELD_OF[target]]}
                roles={roles}
                onChange={(ids) => onChange({ ...value, [FIELD_OF[target]]: ids })}
              />
            ))}
            <p className="text-xs text-chalk-500">{t("pages.botUI.autoRolesHelp")}</p>
          </div>
        )}
      </div>
    </fieldset>
  );
}
