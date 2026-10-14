# observabilidad-k6-unior

Laboratorio de la **Sesión 6** del **Módulo IV · Automatización avanzada de QA y pruebas de rendimiento**
(Diplomado en Desarrollo de Aplicaciones Full Stack, UNIOR). Docente: David Morales Vega.

De «es lento» a «por qué es lento»:

1. **k6 → Prometheus → Grafana**: la prueba de estrés de la Sesión 5, en un tablero en vivo.
2. **OpenTelemetry → Tempo**: la traza de un login lento dice en qué se fue cada milisegundo.
3. **Lighthouse, Lighthouse CI y Web Vitals** sobre la app Angular `learn-unior.web.app`.

Funciona igual en **Windows, macOS y Linux**: todo se corre con `docker compose`, `k6` o `npm run …`
(no hace falta bash ni Python).

## Requisitos

| Qué | Para qué | Cómo comprobarlo |
|---|---|---|
| **Docker Desktop** abierto, con **4 GB de memoria** o más (Settings → Resources) | API, Postgres y Grafana | `docker --version` |
| **k6** v1 o más nuevo | las pruebas de carga | `k6 version` |
| **Node 20** o más nuevo | los scripts `npm run …` y la parte del front | `node -v` |
| **Google Chrome** | Lighthouse y Lighthouse CI | — |
| Git | clonar el repositorio | `git --version` |

Instalar k6: macOS `brew install k6` · Windows `winget install k6 --source winget` (después abra una
terminal nueva) · Linux: https://grafana.com/docs/k6/latest/set-up/install-k6/

> **Antes de la clase:** la imagen `grafana/otel-lgtm` pesa **3,5 GB**. Descárguela con buena conexión:
> `docker pull grafana/otel-lgtm:0.36.0`

## Levantar todo (un comando)

```bash
git clone https://github.com/DavidMoralesVega/observabilidad-k6-unior.git
cd observabilidad-k6-unior
docker compose up -d --build
```

(Es lo mismo que `npm run levantar`.) La primera vez construye la imagen de la API (1 a 2 minutos) y, si
no la tiene, descarga la de Grafana. Las siguientes, segundos.

| Dirección | Qué es |
|---|---|
| http://localhost:3000 | **Grafana** (sin usuario ni contraseña; abre directo en el tablero «k6 Prometheus») |
| http://localhost:3060/docs | Swagger de la API de tareas |
| http://localhost:3060/api | la API (usuario del seed: `admin@todo.com` / `admin123`) |
| http://localhost:9090 | Prometheus (k6 le escribe aquí) |
| 4317 / 4318 | OTLP gRPC / HTTP: la API manda sus trazas aquí |
| 5435 | Postgres |

No usa los puertos 3050 ni 5433 del repositorio `api-tareas-k6-unior`: los dos pueden estar encendidos a la vez.

## Los comandos

Todos se corren **desde la raíz del repositorio**.

| Comando | Qué hace |
|---|---|
| `npm run humo` | `k6 run k6/01-humo.js`: un usuario, tres vueltas. Debe dar **12 out of 12** checks |
| `npm run estres` | el estrés (100 → 200 → 350 usuarios, 75 s) mandando las métricas a Prometheus. Véalo en Grafana |
| `npm run estres -- estres-1` | lo mismo, con el nombre `estres-1` en el selector «Test ID» del tablero |
| `npm run trazas` | `k6 run k6/08-trazas.js`: k6 manda la cabecera `traceparent`; la traza en Tempo empieza en k6 |
| `npm run resumen-trazas` | resume los logins de más de 500 ms de los últimos 10 min: qué span pesa más |
| `npm run resumen-trazas -- 1s 15` | lo mismo, más de 1 s en los últimos 15 min |
| `npm run arbol -- <traceID>` | imprime el árbol de spans de una traza |
| `npm run estado` | `docker compose ps` |
| `npm run apagar` | `docker compose down` |

`npm run estres` corre `scripts/estres-a-grafana.mjs`, que pone estas variables y llama a k6:

```text
K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write
K6_PROMETHEUS_RW_TREND_STATS=p(95),p(99),min,max,avg
K6_PROMETHEUS_RW_STALE_MARKERS=true
k6 run -o experimental-prometheus-rw --tag testid=<nombre> k6/03-estres.js
```

El umbral `p(95)<200` del login **falla a propósito**: k6 termina con código 99. Es lo esperado.

### Las trazas en Grafana

**Explore → Tempo → TraceQL**:

```text
{ span.http.route = "/api/auth/login" && duration > 1s }
```

El único cambio en el código de la API es un span manual alrededor de `argon2.verify`
(`api/packages/backend/src/contexts/identity-access/auth/application/auth.service.ts`). HTTP, Express,
Nest y Postgres los mide solo `@opentelemetry/auto-instrumentations-node`, que se carga al arrancar
(`node --require @opentelemetry/auto-instrumentations-node/register …`, en `docker-compose.yml`).

`k6/08-trazas.js` usa el módulo `http-instrumentation-tempo` de `jslib.k6.io`: **necesita internet**.

## El front: Lighthouse, Lighthouse CI y Web Vitals

```bash
cd front
npm install
npx playwright install chromium
```

| Comando (desde `front/`) | Qué hace |
|---|---|
| `npm run lighthouse` | una corrida de Lighthouse (móvil simulado) contra `learn-unior.web.app/programas/`. Informe en `informes/movil.html` |
| `npx lhci autorun` | 3 corridas de Lighthouse contra `learn-unior.web.app/programas/` con presupuesto (`lighthouserc.json`). Pasa: código 0 |
| `npx lhci autorun --config=./lighthouserc.falla.json` | un presupuesto imposible (LCP ≤ 500 ms). Falla a propósito: código 1 |
| `node web-vitals-playwright.cjs` | LCP, CLS e INP medidos con la librería `web-vitals` desde Playwright |
| `node web-vitals-playwright.cjs --lento` | lo mismo, con un clic que bloquea 300 ms: INP de unos 300 ms (needs-improvement) |

Los informes quedan en `front/informes/` (no se suben a ningún servidor).

## Apagar

```bash
docker compose down        # apaga y borra los contenedores; las imágenes quedan
docker compose down -v     # además borra la base de datos (se vuelve a sembrar al levantar)
```

Prometheus, Tempo y Loki guardan dentro del contenedor: al apagar se pierden las métricas y trazas
anteriores. Cada vez se empieza limpio.

## Si algo falla

| Síntoma | Qué hacer |
|---|---|
| `Cannot connect to the Docker daemon` / `error during connect` | Abra Docker Desktop y espere a que diga «running» |
| `port is already allocated` (3000, 3060, 9090…) | Otro programa usa ese puerto (¿otro Grafana?). Apáguelo y repita `docker compose up -d` |
| `connection refused` en `npm run humo` | La API aún arranca (migraciones y seed): espere 10 s. Si sigue: `docker compose logs api` |
| El primer estrés sale **mucho** peor que los siguientes | Es el arranque en frío. Corra el estrés una vez para calentar y mire la segunda corrida |
| La máquina se pone muy lenta o un contenedor se reinicia | Poca memoria para Docker: súbala a 4 GB o más (Settings → Resources) y cierre otros contenedores |
| El tablero no muestra nada | Ponga el rango «Last 15 minutes» y elija su «Test ID» arriba |
| TraceQL no encuentra trazas | Amplíe el rango de tiempo; baje el umbral (`duration > 300ms`); confirme que corrió el estrés |
| `k6: command not found` / «no se reconoce» | Instale k6 y abra una terminal nueva |
| `npm run trazas` falla al importar `https://jslib.k6.io/...` | Necesita internet |
| `Executable doesn't exist` (Playwright) | `npx playwright install chromium` en `front/` |
| Lighthouse CI: `Chrome installation not found` | Instale Google Chrome |
| En PowerShell no corre `npx` («ejecución de scripts deshabilitada») | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, o use `npx.cmd` |

## Créditos

La API de tareas (`api/`) es el proyecto *todo-backend* del Módulo II, de
[omarmus/todo-backend](https://github.com/omarmus/todo-backend) (NestJS + Prisma + PostgreSQL), el mismo de
[DavidMoralesVega/api-tareas-k6-unior](https://github.com/DavidMoralesVega/api-tareas-k6-unior). Para este
laboratorio se le agregó OpenTelemetry (dependencias, arranque con `--require` y un span manual en el login);
el resto del código es el original.

El tablero de Grafana es el oficial de k6, «k6 Prometheus» (grafana.com, n.º 19665), con dos ajustes:
el datasource de Prometheus con `timeInterval: 5s` (otel-lgtm trae 60 s) y la variable «Trend Metrics
Query» como lista fija (`p95,p99,avg,min,max`). La imagen `grafana/otel-lgtm` es de Grafana Labs.
