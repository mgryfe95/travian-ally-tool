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
  it("SYSTEMADMIN nur aus ENV-Liste, case-insensitiv", () => {
    expect(effectiveRole({ email: " Max@Example.com ", role: "GUEST" }, ["max@example.com"])).toBe("SYSTEMADMIN");
    expect(effectiveRole({ email: "x@example.com", role: "ADMIN" }, ["max@example.com"])).toBe("ADMIN");
  });
  it("SYSTEMADMIN in der DB-Spalte hat keine Wirkung; Unbekanntes wird GUEST", () => {
    expect(effectiveRole({ email: "x@example.com", role: "SYSTEMADMIN" }, [])).toBe("GUEST");
    expect(effectiveRole({ email: "x@example.com", role: "???" }, [])).toBe("GUEST");
  });
});

describe("Rechte-Matrix", () => {
  it("SYSTEMADMIN hat immer alles", () => {
    expect(PERMISSIONS.every((p) => hasPermission("SYSTEMADMIN", p, m))).toBe(true);
  });
  it("Defaults: Member chattet, Guest nicht, Moderator moderiert, nur Admin vergibt Rollen", () => {
    expect(hasPermission("MEMBER", "chat.write", m)).toBe(true);
    expect(hasPermission("GUEST", "chat.read", m)).toBe(true);
    expect(hasPermission("GUEST", "chat.write", m)).toBe(false);
    expect(hasPermission("MODERATOR", "chat.moderate", m)).toBe(true);
    expect(hasPermission("MODERATOR", "roles.assign", m)).toBe(false);
    expect(hasPermission("ADMIN", "alliances.classify", m)).toBe(true);
    expect(hasPermission("MEMBER", "chat.upload", m)).toBe(true);
  });
});

describe("SYSTEMADMIN-Schutzregeln (ADMIN → 403)", () => {
  it("ADMIN kann SYSTEMADMIN nicht ändern, degradieren, sperren oder löschen", () => {
    expect(forbidden(() => assertCanAssignRole("ADMIN", "SYSTEMADMIN", "MEMBER", m))).toBe(true);
    expect(forbidden(() => assertCanModerateUser("ADMIN", "SYSTEMADMIN", m))).toBe(true);
  });
  it("niemand kann SYSTEMADMIN vergeben — auch SYSTEMADMIN nicht", () => {
    expect(forbidden(() => assertCanAssignRole("ADMIN", "MEMBER", "SYSTEMADMIN", m))).toBe(true);
    expect(forbidden(() => assertCanAssignRole("SYSTEMADMIN", "MEMBER", "SYSTEMADMIN", m))).toBe(true);
    expect(forbidden(() => assertCanAssignRole("SYSTEMADMIN", "SYSTEMADMIN", "MEMBER", m))).toBe(true);
  });
  it("Rechte der Rolle SYSTEMADMIN sind für niemanden änderbar", () => {
    for (const actor of ["ADMIN", "SYSTEMADMIN"] as Role[])
      expect(forbidden(() => assertCanEditPermission(actor, "SYSTEMADMIN", "chat.read", m))).toBe(true);
  });
});

describe("weitere Regeln", () => {
  it("ADMIN darf Rollen unterhalb von ADMIN vergeben, aber keine ADMINs ernennen oder ändern", () => {
    expect(() => assertCanAssignRole("ADMIN", "GUEST", "MODERATOR", m)).not.toThrow();
    expect(forbidden(() => assertCanAssignRole("ADMIN", "MEMBER", "ADMIN", m))).toBe(true);
    expect(forbidden(() => assertCanAssignRole("ADMIN", "ADMIN", "MEMBER", m))).toBe(true);
    expect(() => assertCanAssignRole("SYSTEMADMIN", "MEMBER", "ADMIN", m)).not.toThrow();
    expect(() => assertCanAssignRole("SYSTEMADMIN", "ADMIN", "MEMBER", m)).not.toThrow();
  });
  it("ohne roles.assign / permissions.edit geht nichts", () => {
    expect(forbidden(() => assertCanAssignRole("MODERATOR", "GUEST", "MEMBER", m))).toBe(true);
    expect(forbidden(() => assertCanModerateUser("MODERATOR", "GUEST", m))).toBe(true);
    expect(forbidden(() => assertCanEditPermission("MODERATOR", "MEMBER", "chat.read", m))).toBe(true);
  });
  it("ADMIN darf Matrix bearbeiten, aber sich nicht aussperren", () => {
    expect(() => assertCanEditPermission("ADMIN", "MEMBER", "chat.upload", m)).not.toThrow();
    expect(forbidden(() => assertCanEditPermission("ADMIN", "ADMIN", "permissions.edit", m))).toBe(true);
    expect(forbidden(() => assertCanEditPermission("ADMIN", "ADMIN", "roles.assign", m))).toBe(true);
    expect(() => assertCanEditPermission("SYSTEMADMIN", "ADMIN", "permissions.edit", m)).not.toThrow();
  });
  it("Rollenrang ist aufsteigend", () => {
    expect([...ROLES]).toEqual(["GUEST", "MEMBER", "MODERATOR", "ADMIN", "SYSTEMADMIN"]);
  });
});
