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
import { FIELD, HELP, LABEL, Notice, Toggle } from "@/components/bot/dashboard-ui";

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
    <fieldset>
      <legend className={LABEL}>{t(`pages.botUI.autoRolesTargets.${target}`)}</legend>
      <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
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
              className={FIELD}
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
    </fieldset>
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

  const selectable = roles.filter((r) => r.assignable && r.granterRefusal === null).length;

  return (
    <div className="space-y-4">
      {failing && configured ? (
        <Notice tone="error">{t(failing === "granter" ? "pages.botUI.autoRolesFailingGranter" : "pages.botUI.autoRolesFailing")}</Notice>
      ) : null}
      <Toggle
        checked={on}
        onChange={(checked) => {
          if (checked) {
            setOpen(true);
            onChange(kept.current);
          } else {
            kept.current = value;
            setOpen(false);
            onChange({ roleIds: [], botRoleIds: [] });
          }
        }}
      >
        {t("pages.botUI.autoRolesToggle")}
      </Toggle>

      {on && (
        <div className="space-y-5">
          {!manageRoles ? (
            <Notice tone="error">{t("pages.botUI.autoRolesNoPermission")}</Notice>
          ) : above ? (
            <Notice tone="warning">{t("pages.botUI.autoRolesAbove")}</Notice>
          ) : null}
          {!selectable ? <Notice tone="warning">{t("pages.botUI.autoRolesNoneSelectable")}</Notice> : null}
          {AUTO_ROLE_TARGETS.map((target) => (
            <RolePickers
              key={target}
              target={target}
              ids={value[FIELD_OF[target]]}
              roles={roles}
              onChange={(ids) => onChange({ ...value, [FIELD_OF[target]]: ids })}
            />
          ))}
          <p className={HELP}>{t("pages.botUI.autoRolesHelp")}</p>
        </div>
      )}
    </div>
  );
}
