// 01 · Prueba de humo (smoke test)
// ¿La API responde bien con UN solo usuario? Si esto falla, no tiene sentido cargarla.
// Ejecutar (desde la raíz del repo):  k6 run k6/01-humo.js   o   npm run humo
import http from 'k6/http';
import { check, sleep } from 'k6';

// La URL base se puede cambiar sin tocar el código:
//   k6 run -e API=http://otra:3060/api k6/01-humo.js
const API = __ENV.API || 'http://localhost:3060/api';

export const options = {
  vus: 1, // un usuario virtual
  iterations: 3, // repite el flujo 3 veces y termina
};

export default function () {
  // 1) Login con el usuario administrador que crea el seed
  const login = http.post(
    `${API}/auth/login`,
    JSON.stringify({ email: 'admin@todo.com', password: 'admin123' }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  check(login, {
    'login responde 201': (r) => r.status === 201,
    'login devuelve accessToken': (r) => !!r.json('accessToken'),
  });

  const token = login.json('accessToken');

  // 2) Listar tareas con el token JWT
  const tareas = http.get(`${API}/todo`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(tareas, {
    'listar tareas responde 200': (r) => r.status === 200,
    'la respuesta es una lista': (r) => Array.isArray(r.json()),
  });

  sleep(1); // un usuario real no hace clic sin pausa
}
