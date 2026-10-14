// 03 · Prueba de estrés (stress test) — copia para observabilidad
// ¿Dónde se rompe? Subimos MÁS ALLÁ del tráfico esperado, por escalones,
// y miramos en qué escalón el p95 se dispara.
// Cada usuario virtual inicia sesión y lista sus tareas (como en la vida real).
// El login es caro a propósito: argon2 calcula el hash de la contraseña
// con CPU y memoria.
// Versión corta (~75 s) para verla en Grafana. Ejecutar (desde la raíz del repo):
//   npm run estres
//   (scripts/estres-a-grafana.mjs pone las variables K6_PROMETHEUS_RW_* y llama a
//    k6 run -o experimental-prometheus-rw --tag testid=... k6/03-estres.js)
//   Después: http://localhost:3000 → dashboard «k6 Prometheus»
import http from 'k6/http';
import { check, sleep } from 'k6';

const API = __ENV.API || 'http://localhost:3060/api';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const options = {
  // Escalones: cada uno sube y se mantiene un rato para poder comparar
  stages: [
    { duration: '5s', target: 100 },
    { duration: '15s', target: 100 }, // cómodo
    { duration: '5s', target: 200 },
    { duration: '15s', target: 200 }, // al borde
    { duration: '5s', target: 350 },
    { duration: '20s', target: 350 }, // pasado el límite
    { duration: '10s', target: 0 }, // recuperación
  ],
  thresholds: {
    // Umbral por petición, usando la etiqueta "name" que ponemos abajo
    'http_req_duration{name:login}': ['p(95)<200'],
    'http_req_duration{name:listar}': ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const login = http.post(
    `${API}/auth/login`,
    JSON.stringify({ email: 'admin@todo.com', password: 'admin123' }),
    { headers: JSON_HEADERS, tags: { name: 'login' } },
  );
  check(login, { 'login 201': (r) => r.status === 201 });

  const lista = http.get(`${API}/todo`, {
    headers: { Authorization: `Bearer ${login.json('accessToken')}` },
    tags: { name: 'listar' },
  });
  check(lista, { 'listar tareas 200': (r) => r.status === 200 });

  sleep(1);
}
