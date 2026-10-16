"use client";

import { Fragment } from "react";
import { CoordLink } from "@/components/CoordLink";
import { parseMarkdown, type MdNode } from "@/lib/chat/markdown";

function render(nodes: MdNode[]) {
  return nodes.map((n, i) => {
    switch (n.t) {
      case "text": return <Fragment key={i}>{n.v}</Fragment>;
      case "br": return <br key={i} />;
      case "bold": return <strong key={i}>{render(n.c)}</strong>;
      case "italic": return <em key={i}>{render(n.c)}</em>;
      case "code": return <code key={i} className="mono" style={{ background: "var(--raised)", padding: "0 4px", borderRadius: 4 }}>{n.v}</code>;
      case "link": return <a key={i} href={n.href} target="_blank" rel="noopener noreferrer nofollow ugc">{render(n.c)}</a>;
      case "coord": return <CoordLink key={i} x={n.x} y={n.y} text={n.v} />;
    }
  });
}

/** Nachrichtentext: React escaped alles; es gibt nirgends dangerouslySetInnerHTML. */
export function Md({ text }: { text: string }) {
  return <>{render(parseMarkdown(text))}</>;
}
