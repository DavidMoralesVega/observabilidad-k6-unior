// 08 · k6 + trazas: cada petición de k6 lleva la cabecera W3C `traceparent`,
// así la traza en Tempo empieza en k6 y el trace_id queda en los resultados.
// (k6/experimental/tracing fue eliminado; ahora es este módulo de jslib.)
// Ejecutar (desde la raíz del repo):  npm run trazas   (necesita internet)
import http from 'k6/http';
import { check, sleep } from 'k6';
import { instrumentHTTP } from
  'https://jslib.k6.io/http-instrumentation-tempo/1.0.1/index.js';

// Desde aquí, TODAS las peticiones http.* llevan la cabecera traceparent
instrumentHTTP({ propagator: 'w3c' });

const API = __ENV.API || 'http://localhost:3060/api';

export const options = { vus: 1, iterations: 3 };

export default function () {
  const login = http.post(
    `${API}/auth/login`,
    JSON.stringify({ email: 'admin@todo.com', password: 'admin123' }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'login' },
    },
  );
  check(login, { 'login 201': (r) => r.status === 201 });

  // El trace_id viaja en la cabecera que k6 envió: lo mostramos
  // para buscarlo en Grafana (Explore → Tempo)
  const h = login.request.headers;
  const tp = h['Traceparent'] || h['traceparent'];
  console.log(`traceparent enviado: ${tp}`);
  sleep(1);
}
