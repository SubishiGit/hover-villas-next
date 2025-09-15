export function extractVillaKey(id) {
  const s = String(id || "").toUpperCase();
  if (/CANAL|LANDSCAPE|CLUBHOUSE/.test(s)) return null;
  const m = s.match(/[0-9]+[A-Z]?/);
  return m ? m[0] : null;
}