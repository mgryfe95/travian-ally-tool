/** Skizze für die Hilfe: Welche Daten wohin fließen (OCR → KI/Admins, Ziele A/B → KI, Incidents → KI und Call). */
export type FlowLabels = Record<"title" | "ocr" | "res" | "bld" | "trp" | "a" | "b1" | "b2" | "inc" | "incSub" | "ai" | "aiSub" | "out" | "outSub" | "admins" | "adminsSub" | "call" | "callSub", string>;

export function HelpFlow({ l }: { l: FlowLabels }) {
  return (
    <figure className="flow" aria-label={l.title}>
      <figcaption className="lbl" style={{ marginBottom: 8 }}>{l.title}</figcaption>
      <div className="flow-main">
        <div className="flow-col">
          <div className="flow-box"><b>{l.ocr}</b><div className="flow-chips"><span>{l.res}</span><span>{l.bld}</span><span className="hl">{l.trp}</span></div></div>
          <div className="flow-box"><b>A</b> {l.a}</div>
          <div className="flow-box"><b>B1</b> {l.b1} · <b>B2</b> {l.b2}</div>
          <div className="flow-box inc"><b>{l.inc}</b><div className="sub">{l.incSub}</div></div>
        </div>
        <div className="flow-arrow" aria-hidden="true">➜</div>
        <div className="flow-col mid"><div className="flow-box ai"><b>{l.ai}</b><div>{l.aiSub}</div></div></div>
        <div className="flow-arrow" aria-hidden="true">➜</div>
        <div className="flow-col mid"><div className="flow-box out"><b>{l.out}</b><div>{l.outSub}</div></div></div>
      </div>
      <div className="flow-branch"><span className="hl">{l.trp}</span><span className="flow-arrow" aria-hidden="true">➜</span><div className="flow-box"><b>{l.admins}</b><div className="sub">{l.adminsSub}</div></div></div>
      <div className="flow-branch"><span className="inc-chip">{l.inc}</span><span className="flow-arrow" aria-hidden="true">➜</span><div className="flow-box"><b>{l.call}</b><div className="sub">{l.callSub}</div></div></div>
    </figure>
  );
}
