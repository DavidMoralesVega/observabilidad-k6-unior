// Corre la prueba de estrés y manda las métricas de k6 a Prometheus (remote write).
// Funciona igual en Windows, macOS y Linux (no hace falta bash).
// Uso (desde la raíz del repo):
//   npm run estres                 → testid = estres-HHMM
//   npm run estres -- estres-1     → testid = estres-1
import { spawn } from 'node:child_process';

const ahora = new Date();
const hhmm = String(ahora.getHours()).padStart(2, '0') + String(ahora.getMinutes()).padStart(2, '0');
const testid = process.argv[2] || `estres-${hhmm}`;

const env = {
  ...process.env,
  // a dónde mandar las métricas (el Prometheus de otel-lgtm)
  K6_PROMETHEUS_RW_SERVER_URL: 'http://localhost:9090/api/v1/write',
  // lo que lee el dashboard 19665: k6_http_req_duration_p95, etc.
  K6_PROMETHEUS_RW_TREND_STATS: 'p(95),p(99),min,max,avg',
  // al terminar la prueba, las líneas del tablero se cortan (no quedan planas)
  K6_PROMETHEUS_RW_STALE_MARKERS: 'true',
};

const args = ['run', '-o', 'experimental-prometheus-rw', '--tag', `testid=${testid}`, 'k6/03-estres.js'];
console.log(`> k6 ${args.join(' ')}`);
console.log(`> testid: ${testid}  (elíjalo en «Test ID» del tablero)\n`);

const k6 = spawn('k6', args, { env, stdio: 'inherit' });
k6.on('error', (e) => {
  console.error(e.code === 'ENOENT' ? 'No se encontró k6. Instálelo y abra una terminal nueva.' : e.message);
  process.exit(1);
});
// El mismo código de salida que k6: 0 aprobó, 99 reprobó un umbral
k6.on('exit', (code) => process.exit(code ?? 1));
