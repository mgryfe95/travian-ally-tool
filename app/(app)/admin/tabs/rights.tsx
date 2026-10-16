import { PermToggle } from "@/components/AdminControls";
import { db } from "@/lib/db";
import { getT } from "@/lib/i18n/server";
import { PERMISSIONS, STORED_ROLES } from "@/lib/permissions";
import { loadMatrix } from "@/lib/services/context";

const COLS = ["MODERATOR", "MEMBER", "GUEST"] as const;

export async function RightsTab() {
  const { t } = await getT();
  const matrix = await loadMatrix(db);
  return (
    <section className="card flush">
      <div style={{ margin: 12 }}>
        <h2>{t("admin.rights.title")}</h2>
        <div className="sub">{t("admin.rights.hint")}</div>
      </div>
      <div className="scroll">
        <table style={{ minWidth: 720 }}>
          <thead>
            <tr><th>{t("admin.rights.colPermission")}</th>{COLS.map((c) => <th key={c} style={{ textAlign: "center" }}>{t(`admin.role.${c}`)}</th>)}</tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((p) => (
              <tr key={p}>
                <td><span className="mono" style={{ fontSize: 13 }}>{p}</span><div className="sub" style={{ fontSize: 12 }}>{t(`admin.perm.${p}`)}</div></td>
                {COLS.map((c) => (
                  <td key={c} style={{ textAlign: "center" }}>
                    <PermToggle
                      role={c} permission={p} checked={(STORED_ROLES as readonly string[]).includes(c) && matrix[c].has(p)}
                      disabled={false} label={`${p} ${t(`admin.role.${c}`)}`}
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
