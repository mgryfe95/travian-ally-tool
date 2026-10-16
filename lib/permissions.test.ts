import { describe, expect, it } from "vitest";
import {
  assertCanAssignRole, assertCanEditPermission, assertCanModerateUser, defaultMatrix, effectiveRole, ForbiddenError,
  hasPermission, PERMISSIONS, ROLES, type Role,
} from "./permissions";

const m = defaultMatrix();
const forbidden = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    return e instanceof ForbiddenError && e.status === 403;
  }
  return false;
};

describe("effectiveRole", () => {
  it("Notzugangs-Adressen aus der ENV sind immer ADMIN, case-insensitiv", () => {
    expect(effectiveRole({ email: " Max@Example.com ", role: "GUEST" }, ["max@example.com"])).toBe("ADMIN");
    expect(effectiveRole({ email: "x@example.com", role: "MEMBER" }, ["max@example.com"])).toBe("MEMBER");
  });
  it("Unbekannte DB-Rollen werden GUEST (auch das alte SYSTEMADMIN)", () => {
    expect(effectiveRole({ email: "x@example.com", role: "SYSTEMADMIN" }, [])).toBe("GUEST");
    expect(effectiveRole({ email: "x@example.com", role: "???" }, [])).toBe("GUEST");
  });
});

describe("Rechte-Matrix", () => {
  it("Admins haben immer alle Rechte", () => {
    expect(PERMISSIONS.every((p) => hasPermission("ADMIN", p, m))).toBe(true);
  });
  it("Defaults: Member chattet, Guest nicht, Moderator moderiert, nur Admin vergibt Rollen", () => {
    expect(hasPermission("MEMBER", "chat.write", m)).toBe(true);
    expect(hasPermission("GUEST", "chat.read", m)).toBe(false); // unverifizierte Gäste sind gesperrt
    expect(hasPermission("GUEST", "chat.write", m)).toBe(false);
    expect(hasPermission("MODERATOR", "chat.moderate", m)).toBe(true);
    expect(hasPermission("MODERATOR", "roles.assign", m)).toBe(false);
    expect(hasPermission("ADMIN", "alliances.classify", m)).toBe(true);
    expect(hasPermission("MEMBER", "chat.upload", m)).toBe(true);
    expect(hasPermission("MODERATOR", "troops.view", m)).toBe(true);
    expect(hasPermission("MEMBER", "troops.view", m)).toBe(false);
    expect(hasPermission("GUEST", "troops.view", m)).toBe(false);
  });
});

describe("Admin-Regeln", () => {
  it("Admins dürfen jede Rolle vergeben und ändern – auch andere Admins", () => {
    expect(() => assertCanAssignRole("ADMIN", "GUEST", "MODERATOR", m)).not.toThrow();
    expect(() => assertCanAssignRole("ADMIN", "MEMBER", "ADMIN", m)).not.toThrow();
    expect(() => assertCanAssignRole("ADMIN", "ADMIN", "MEMBER", m)).not.toThrow();
    expect(() => assertCanModerateUser("ADMIN", "ADMIN", m)).not.toThrow();
  });
  it("Rechte-Matrix: Admins ändern Moderator/Member/Gast frei, die Admin-Spalte gibt es nicht", () => {
    for (const role of ["MODERATOR", "MEMBER", "GUEST"] as Role[]) expect(() => assertCanEditPermission("ADMIN", role, "permissions.edit", m)).not.toThrow();
    expect(forbidden(() => assertCanEditPermission("ADMIN", "ADMIN", "chat.read", m))).toBe(true);
  });
  it("ohne roles.assign / permissions.edit geht nichts; Nicht-Admins nur unterhalb ihres Rangs", () => {
    expect(forbidden(() => assertCanAssignRole("MODERATOR", "GUEST", "MEMBER", m))).toBe(true);
    expect(forbidden(() => assertCanModerateUser("MODERATOR", "GUEST", m))).toBe(true);
    expect(forbidden(() => assertCanEditPermission("MODERATOR", "MEMBER", "chat.read", m))).toBe(true);
    const mm = { ...m, MODERATOR: new Set([...m.MODERATOR, "roles.assign" as const]) };
    expect(() => assertCanAssignRole("MODERATOR", "GUEST", "MEMBER", mm)).not.toThrow();
    expect(forbidden(() => assertCanAssignRole("MODERATOR", "MEMBER", "ADMIN", mm))).toBe(true);
    expect(forbidden(() => assertCanAssignRole("MODERATOR", "ADMIN", "MEMBER", mm))).toBe(true);
  });
  it("Rollenrang ist aufsteigend", () => {
    expect([...ROLES]).toEqual(["GUEST", "MEMBER", "MODERATOR", "ADMIN"]);
  });
});
