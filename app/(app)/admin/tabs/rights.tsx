import { PermToggle } from "@/components/AdminControls";
import { db } from "@/lib/db";
import { ADMIN_LOCKED_PERMISSIONS, PERMISSIONS, STORED_ROLES, type Permission } from "@/lib/permissions";
import { loadMatrix, type Actor } from "@/lib/services/context";

const DESC: Record<Permission, string> = {
  "chat.read": "Kanäle lesen", "chat.write": "In Kanälen schreiben", "chat.moderate": "Nachrichten anderer bearbeiten/löschen", "chat.upload": "Dateien im Chat anhängen",
  "tags.manage": "Tags anlegen und ändern", "taskforce.create": "Task-Forces anlegen", "taskforce.manage": "Task-Forces verwalten", "members.invite": "Einladungslinks erzeugen",
  "members.approve": "Verifizierung manuell bestätigen", "roles.assign": "Rollen vergeben (nie Systemadmin)", "permissions.edit": "Diese Matrix bearbeiten",
  "map.view": "Karte, Inaktive, Ereignisse sehen", "settings.edit": "Einstellungen ändern", "alliances.classify": "Allianz-Typen / Allianz-Gruppe festlegen", "gamedata.edit": "Spieldaten pflegen",
};
const COLS = ["ADMIN", "MODERATOR", "MEMBER", "GUEST"] as const;

export async function RightsTab({ actor }: { actor: Actor }) {
  const matrix = await loadMatrix(db);
  return (
    <section className="card flush">
      <div style={{ margin: 12 }}>
        <h2>Rechte-Matrix</h2>
        <div className="sub">Systemadmin-Rechte sind gesperrt und können von Admins nicht geändert werden.</div>
      </div>
      <div className="scroll">
        <table style={{ minWidth: 720 }}>
          <thead>
            <tr><th>Recht</th><th style={{ textAlign: "center" }}>Systemadmin</th>{COLS.map((c) => <th key={c} style={{ textAlign: "center" }}>{c[0] + c.slice(1).toLowerCase()}</th>)}</tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((p) => (
              <tr key={p}>
                <td><span className="mono" style={{ fontSize: 13 }}>{p}</span><div className="sub" style={{ fontSize: 12 }}>{DESC[p]}</div></td>
                <td style={{ textAlign: "center" }}><input type="checkbox" checked disabled readOnly aria-label={`${p} Systemadmin (gesperrt)`} style={{ width: 18, height: 18 }} /></td>
                {COLS.map((c) => (
                  <td key={c} style={{ textAlign: "center" }}>
                    <PermToggle
                      role={c} permission={p} checked={(STORED_ROLES as readonly string[]).includes(c) && matrix[c].has(p)}
                      disabled={actor.role !== "SYSTEMADMIN" && c === "ADMIN" && ADMIN_LOCKED_PERMISSIONS.includes(p)} label={`${p} ${c}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
