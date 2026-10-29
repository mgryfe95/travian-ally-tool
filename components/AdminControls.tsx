"use client";

import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";
import { setPermissionAction, setPlayerRoleAction, setRoleAction } from "@/app/(app)/admin/actions";

export function RoleSelect({ userId, current, options, tab }: { userId: string; current: string; options: string[]; tab: string }) {
  const t = useT();
  return (
    <form action={setRoleAction}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="tab" value={tab} />
      <label className="sr" htmlFor={`role-${userId}`}>{t("admin.role.label")}</label>
      <select id={`role-${userId}`} name="role" defaultValue={current} className="field" style={{ width: "auto", minHeight: 36 }} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {[...new Set([current, ...options])].map((r) => (
          <option key={r} value={r} disabled={r === current ? false : !options.includes(r)}>{t(`admin.role.${r}` as MessageKey)}</option>
        ))}
      </select>
    </form>
  );
}

/** Rolle eines Spielers vorab (ohne/vor Konto): wird bei der Verifizierung übernommen; leer = automatisch. */
export function PlayerRoleSelect({ playerId, current, options }: { playerId: number; current: string; options: string[] }) {
  const t = useT();
  return (
    <form action={setPlayerRoleAction}>
      <input type="hidden" name="playerId" value={playerId} />
      <label className="sr" htmlFor={`prole-${playerId}`}>{t("admin.role.label")}</label>
      <select id={`prole-${playerId}`} name="role" defaultValue={current} className="field" style={{ width: "auto", minHeight: 36 }} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        <option value="">{t("admin.members.roleAuto")}</option>
        {[...new Set([...(current ? [current] : []), ...options])].map((r) => <option key={r} value={r} disabled={r !== current && !options.includes(r)}>{t(`admin.role.${r}` as MessageKey)}</option>)}
      </select>
    </form>
  );
}

export function PermToggle({ role, permission, checked, disabled, label }: { role: string; permission: string; checked: boolean; disabled?: boolean; label: string }) {
  return (
    <form action={setPermissionAction}>
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="permission" value={permission} />
      <input type="hidden" name="enabled" value={checked ? "0" : "1"} />
      <input
        type="checkbox" defaultChecked={checked} disabled={disabled} aria-label={label}
        style={{ width: 18, height: 18, accentColor: "var(--steel)" }} onChange={(e) => e.currentTarget.form?.requestSubmit()}
      />
    </form>
  );
}
