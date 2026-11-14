import { EXTRA_COLUMNS, type MapRow } from "./types";
import { AppError } from "../i18n/errors";

type Value = string | number | boolean | null;

export class MapSqlParseError extends AppError {}

const ESCAPES: Record<string, string> = { n: "\n", r: "\r", t: "\t", "0": "\0", b: "\b", Z: "\x1a" };

/** Liest ein Wert-Token ab `i`; liefert Wert und Folgeposition. */
function readValue(s: string, i: number): [Value, number] {
  if (s[i] === "'") {
    let out = "";
    let j = i + 1;
    for (;;) {
      const c = s[j];
      if (c === undefined) throw new MapSqlParseError("err.mapsql.unterminatedString");
      if (c === "\\") {
        const n = s[j + 1];
        if (n === undefined) throw new MapSqlParseError("err.mapsql.danglingBackslash");
        out += ESCAPES[n] ?? n;
        j += 2;
      } else if (c === "'") {
        if (s[j + 1] === "'") {
          out += "'";
          j += 2;
        } else return [out, j + 1];
      } else {
        out += c;
        j++;
      }
    }
  }
  let j = i;
  while (j < s.length && s[j] !== "," && s[j] !== ")") j++;
  const tok = s.slice(i, j).trim();
  if (tok === "NULL") return [null, j];
  if (tok === "TRUE") return [true, j];
  if (tok === "FALSE") return [false, j];
  const num = Number(tok);
  if (tok === "" || Number.isNaN(num)) throw new MapSqlParseError("err.mapsql.unexpectedToken", { tok: tok.slice(0, 40) });
  return [num, j];
}

function skipWs(s: string, i: number) {
  while (i < s.length && /\s/.test(s[i] as string)) i++;
  return i;
}

function toRow(v: Value[]): MapRow {
  if (v.length < 11) throw new MapSqlParseError("err.mapsql.columns", { n: v.length });
  const num = (idx: number, name: string) => {
    const x = v[idx];
    if (typeof x !== "number") throw new MapSqlParseError("err.mapsql.colNumber", { name, got: JSON.stringify(x) });
    return x;
  };
  const str = (idx: number, name: string) => {
    const x = v[idx];
    if (typeof x !== "string") throw new MapSqlParseError("err.mapsql.colString", { name, got: JSON.stringify(x) });
    return x;
  };
  const extra: MapRow["extra"] = {};
  for (let k = 11; k < v.length; k++) extra[EXTRA_COLUMNS[k - 11] ?? `col${k}`] = v[k] as Value;
  return {
    fieldId: num(0, "fieldId"),
    x: num(1, "x"),
    y: num(2, "y"),
    tribe: num(3, "tribe"),
    villageId: num(4, "villageId"),
    villageName: str(5, "villageName"),
    playerId: num(6, "playerId"),
    playerName: str(7, "playerName"),
    allianceId: num(8, "allianceId"),
    allianceName: str(9, "allianceName"),
    population: num(10, "population"),
    extra,
  };
}

/** Parst `INSERT INTO \`x_world\` VALUES (...)[,(...)];`-Statements. Zusatzspalten werden gespeichert, nicht verworfen. */
export function parseMapSql(text: string): MapRow[] {
  const rows: MapRow[] = [];
  const re = /INSERT\s+INTO\s+`?[\w.]+`?\s+VALUES\s*/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let i = m.index + m[0].length;
    for (;;) {
      i = skipWs(text, i);
      if (text[i] !== "(") throw new MapSqlParseError("err.mapsql.expectedParen", { i });
      i++;
      const vals: Value[] = [];
      for (;;) {
        i = skipWs(text, i);
        const [val, next] = readValue(text, i);
        vals.push(val);
        i = skipWs(text, next);
        if (text[i] === ",") i++;
        else if (text[i] === ")") {
          i++;
          break;
        } else throw new MapSqlParseError("err.mapsql.expectedCommaOrParen", { i });
      }
      rows.push(toRow(vals));
      i = skipWs(text, i);
      if (text[i] === ",") i++;
      else break;
    }
    re.lastIndex = i;
  }
  return rows;
}
