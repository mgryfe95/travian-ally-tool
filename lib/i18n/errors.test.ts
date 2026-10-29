import { describe, expect, it } from "vitest";
import { resetMail } from "../mail";
import { ForbiddenError } from "../permissions";
import { ChatError } from "../services/chat";
import { RegisterError } from "../services/register";
import { inviteMessage } from "../services/verification";
import { AppError, localizeError } from "./errors";

describe("AppError", () => {
  it("message ist englisch, localizeError übersetzt mit Parametern", () => {
    const e = new ChatError("err.chat.tooLong", { max: 10 });
    expect(e.message).toBe("Message too long (max. 10 characters)");
    expect(e.status).toBe(400);
    expect(localizeError(e, "de")).toBe("Nachricht zu lang (max. 10 Zeichen)");
    expect(localizeError(e, "en")).toBe(e.message);
  });
  it("Unterklassen erben von AppError; Status wird durchgereicht", () => {
    expect(new ForbiddenError("err.perm.missing", { perm: "x.y" })).toBeInstanceOf(AppError);
    expect(new ForbiddenError("err.perm.missing", { perm: "x.y" }).status).toBe(403);
    expect(new RegisterError("err.register.setupCode", undefined, 403).status).toBe(403);
  });
  it("unbekannte Fehler → generischer Text in der Sprache", () => {
    expect(localizeError(new Error("boom"), "en")).toBe("Something went wrong.");
    expect(localizeError("x", "de")).toBe("Etwas ist schiefgelaufen.");
  });
  it("Mails und Einladungstext folgen der Nutzersprache, Standard Englisch", () => {
    expect(resetMail("a@x.de", "Ann", "https://u", "de").subject).toBe("Ally Tool: Passwort zurücksetzen");
    expect(resetMail("a@x.de", "Ann", "https://u").text).toContain("Hello Ann");
    expect(resetMail("a@x.de", "Ann", "https://u", "fr").subject).toBe("Ally Tool: reset your password");
    expect(inviteMessage({ playerName: "Alpha", token: "t", appUrl: "https://a/", locale: "de" })).toContain("Hallo Alpha");
    expect(inviteMessage({ playerName: "Alpha", token: "t", appUrl: "https://a/" })).toContain("Hello Alpha");
  });
});
