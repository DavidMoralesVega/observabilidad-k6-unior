// Imprime el árbol de spans de una traza de Tempo (a través de Grafana).
// Uso (desde la raíz del repo):  npm run arbol -- <traceID>
const tid = process.argv[2];
if (!tid) {
  console.error('Falta el traceID. Ejemplo: npm run arbol -- dc071818de7d9cb13d702c7a69e9a87e');
  process.exit(1);
}
const url = `http://localhost:3000/api/datasources/proxy/uid/tempo/api/traces/${tid}`;
const r = await fetch(url).catch((e) => ({ ok: false, statusText: e.message }));
if (!r.ok) {
  console.error(`No se pudo leer la traza (${r.status ?? ''} ${r.statusText}). ¿Existe ese traceID?`);
  process.exit(1);
}
const d = await r.json();
const spans = new Map();
for (const b of d.batches ?? []) {
  for (const ss of b.scopeSpans ?? []) for (const s of ss.spans) spans.set(s.spanId, s);
}
const hijos = new Map();
for (const s of spans.values()) {
  const p = s.parentSpanId ?? '';
  hijos.set(p, [...(hijos.get(p) ?? []), s]);
}
const ms = (s) => Number(BigInt(s.endTimeUnixNano) - BigInt(s.startTimeUnixNano)) / 1e6;
const mostrar = (s, nivel) => {
  const nombre = ('  '.repeat(nivel) + s.name).padEnd(28);
  console.log(`${nombre} ${ms(s).toFixed(1).padStart(8)} ms`);
  const h = (hijos.get(s.spanId) ?? []).sort((a, b) => (BigInt(a.startTimeUnixNano) < BigInt(b.startTimeUnixNano) ? -1 : 1));
  for (const k of h) mostrar(k, nivel + 1);
};
for (const s of spans.values()) if (!spans.has(s.parentSpanId ?? '')) mostrar(s, 0);
