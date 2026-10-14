// ¿Dónde se va el tiempo en los logins lentos? Resume las últimas trazas de Tempo
// (a través de Grafana). Node 20+ (usa fetch), sin dependencias.
// Uso (desde la raíz del repo):
//   npm run resumen-trazas                → logins de más de 500ms, últimos 10 min
//   npm run resumen-trazas -- 1s 15       → más de 1s, últimos 15 min
const umbral = process.argv[2] || '500ms';
const minutos = Number(process.argv[3] || 10);
const G = 'http://localhost:3000/api/datasources/proxy/uid/tempo/api';
const SPANS = ['pg-pool.connect', 'pg.query:SELECT todo', 'argon2.verify'];

const fin = Math.floor(Date.now() / 1000);
const q = new URLSearchParams({
  q: `{ span.http.route = "/api/auth/login" && duration > ${umbral} }`,
  limit: '60',
  start: String(fin - minutos * 60),
  end: String(fin),
});

const traer = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} en ${url}`);
  return r.json();
};

try {
  const { traces = [] } = await traer(`${G}/search?${q}`);
  const suma = {};
  const dominante = {};
  for (const t of traces) {
    const d = await traer(`${G}/traces/${t.traceID}`);
    const por = {};
    for (const b of d.batches ?? []) {
      for (const ss of b.scopeSpans ?? []) {
        for (const s of ss.spans) {
          if (SPANS.includes(s.name)) {
            por[s.name] = Number(BigInt(s.endTimeUnixNano) - BigInt(s.startTimeUnixNano)) / 1e6;
          }
        }
      }
    }
    for (const [k, v] of Object.entries(por)) suma[k] = (suma[k] ?? 0) + v;
    const mayor = Object.keys(por).sort((a, b) => por[b] - por[a])[0];
    if (mayor) dominante[mayor] = (dominante[mayor] ?? 0) + 1;
  }
  const n = Math.max(traces.length, 1);
  const promedio = Object.fromEntries(Object.entries(suma).map(([k, v]) => [k, Math.round(v / n)]));
  console.log(`${traces.length} logins con duración > ${umbral} (últimos ${minutos} min)`);
  console.log('span que más pesa en cada traza:', dominante);
  console.log('promedio por span (ms):', promedio);
} catch (e) {
  console.error('No se pudo consultar Tempo. ¿Está levantado el laboratorio (npm run levantar)?');
  console.error(e.message);
  process.exit(1);
}
