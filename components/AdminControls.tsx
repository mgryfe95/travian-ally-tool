"use client";

import { setPermissionAction, setRoleAction } from "@/app/(app)/admin/actions";

export function RoleSelect({ userId, current, options, tab }: { userId: string; current: string; options: string[]; tab: string }) {
  return (
    <form action={setRoleAction}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="tab" value={tab} />
      <label className="sr" htmlFor={`role-${userId}`}>Rolle</label>
      <select id={`role-${userId}`} name="role" defaultValue={current} className="field" style={{ width: "auto", minHeight: 36 }} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {[...new Set([current, ...options])].map((r) => (
          <option key={r} value={r} disabled={r === current ? false : !options.includes(r)}>{r}</option>
        ))}
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
        style={{ width: 18, height: 18, accentColor: "#d9a441" }} onChange={(e) => e.currentTarget.form?.requestSubmit()}
      />
    </form>
  );
}
