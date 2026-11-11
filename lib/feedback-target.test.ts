import { describe, expect, it } from "vitest";
import { feedbackPath } from "./feedback-target";

describe("Beta-Feedback: Seite", () => {
  it("behält seitenbestimmende Parameter, verwirft Rückmeldungen", () => {
    expect(feedbackPath({ pathname: "/admin", search: "?tab=users&saved=1&error=x" })).toBe("/admin?tab=users");
    expect(feedbackPath({ pathname: "/villages/12", search: "?saved=1" })).toBe("/villages/12");
    expect(feedbackPath({ pathname: "/messages", search: "?c=4&t=bc" })).toBe("/messages?c=4&t=bc");
  });
});
