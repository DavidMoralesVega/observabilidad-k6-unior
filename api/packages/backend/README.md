<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

# Todo Backend — NestJS + Prisma + PostgreSQL (DDD)

Backend de tareas construido con NestJS, Prisma ORM y PostgreSQL, siguiendo los principios de **Domain-Driven Design (DDD)** con **Hexagonal Architecture**.

> Este backend forma parte de un monorepo. El frontend está en `packages/frontend/` y el servicio de notificaciones en `packages/notification/`.

## Índice

- [Requisitos previos](#requisitos-previos)
- [Instalación y configuración](#instalación-y-configuración)
- [Paquetes de Prisma](#paquetes-de-prisma)
- [Evolución de la estructura](#evolución-de-la-estructura)
- [Estructura final del proyecto](#estructura-final-del-proyecto)
- [Seguridad](#seguridad)
  - [CORS](#cors-cross-origin-resource-sharing)
  - [Prefijo global /api](#prefijo-global-api)
  - [Autenticación JWT](#autenticación-y-seguridad-de-apis)
  - [Validación de entrada](#validación-de-entrada)
  - [Seguridad de la contraseña](#seguridad-de-la-contraseña)
- [Integración con Notification Service](#integración-con-notification-service)
- [WebSocket — Notificaciones en Tiempo Real](#websocket--notificaciones-en-tiempo-real)
- [API Endpoints](#api-endpoints)
- [Swagger](#swagger)
- [Árbol de Módulos](#árbol-de-módulos)
- [Tests](#tests)
- [Prisma Commands](#prisma-commands)
- [Recursos](#recursos)

## Requisitos previos

- Node.js >= 20
- pnpm
- PostgreSQL corriendo localmente (o una instancia en la nube)

### Instalar PostgreSQL

**macOS (Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib

# Iniciar servicio
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Crear usuario y base de datos
sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'postgres';"
sudo -u postgres psql -c "ALTER USER postgres CREATEDB SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE todo OWNER postgres;"
```

**Windows:**
1. Descargar el instalador desde https://www.postgresql.org/download/windows/
2. Ejecutar el `.exe` y seguir el asistente
3. Seleccionar puerto `5432`, establecer contraseña del usuario `postgres`
4. Marcar para iniciar en boot
5. Crear la base de datos desde pgAdmin (se instala junto con PostgreSQL) o PowerShell:
```powershell
# Abrir psql (está en PATH tras instalar)
psql -U postgres -c "CREATE DATABASE todo;"
```

**Verificar (todos los SO):**
```bash
psql -U postgres -c "SELECT version();"
# PostgreSQL 16.x ...
```

Si la conexión por defecto falla (requiere password), prueba con:
```bash
psql -U postgres -h localhost -c "SELECT 1;"
```

## Instalación y configuración

```bash
# 1. Instalar dependencias
pnpm install

# 2. Aprobar builds nativos (argon2, esbuild, etc.)
pnpm approve-builds argon2 esbuild @parcel/watcher @prisma/engines prisma unrs-resolver

# 3. Configurar DATABASE_URL en .env
cp .env.sample .env

# 4. Generar client de Prisma
npx prisma generate

# 5. Crear migración inicial
npx prisma migrate dev --name init
```

### Variables de entorno (`.env`)

```env
PORT=3050
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/todo?schema=public"
JWT_SECRET=your_jwt_secret_key
```

Formato general:
```
postgresql://USUARIO:CONTRASEÑA@HOST:PUERTO/NOMBRE_DB?schema=public
```

## Paquetes de Prisma

| Paquete | Propósito |
|---------|-----------|
| `prisma` | CLI de Prisma para migraciones, generación de client, etc. |
| `@prisma/client` | Cliente generado para consultar la base de datos |
| `@prisma/adapter-pg` | Driver adapter para usar `pg` (node-postgres) como transport |
| `pg` | Driver PostgreSQL puro para Node.js |

> **Nota:** En Prisma 7, el client se importa desde `generated/prisma/client` (no desde `@prisma/client`) por el custom output en el schema.

---

## Evolución de la estructura

Este proyecto evolucionó paso a paso desde una estructura simple hasta DDD. A continuación se muestra cada fase.

### Fase 1: Estructura inicial (NestJS flat)

La estructura original del proyecto era plana, sin separación por capas:

```
src/
├── prisma/
│   ├── prisma.module.ts       # Módulo global de Prisma
│   └── prisma.service.ts      # Service que extiende PrismaClient
├── todo/
│   ├── todo.module.ts
│   ├── todo.controller.ts
│   ├── todo.service.ts
│   └── dto/
├── app.module.ts              # Módulo raíz
└── main.ts
```

**Problema:** Todo vivía en el mismo nivel. No había separación entre dominio, aplicación e infraestructura. Agregar una segunda feature (ej. users) habría crecido la confusión rápidamente.

### Fase 2: Extracción de Prisma a shared infrastructure

El primer paso fue mover `PrismaService` y `PrismaModule` a una capa compartida (`shared/`), sacándolos del módulo de dominio:

```
src/
├── shared/
│   └── infrastructure/
│       └── prisma/
│           ├── prisma.module.ts    # @Global — disponible en toda la app
│           └── prisma.service.ts   # Extiende PrismaClient con driver adapter
└── todo/                           # (todavía flat en src/)
```

**Por qué:** Prisma es infraestructura, no pertenece a ninguna feature. Al ser `@Global()`, se inyecta en cualquier módulo sin importarlo explícitamente.

### Fase 3: Creación de bounded contexts (contexts)

Se creó la capa `contexts/` para agrupar **bounded contexts** — dominios de negocio que se comunican entre sí pero son independientes internamente:

```
src/
├── contexts/
│   └── tasks/                    # Bounded context: "Tasks"
│       └── todo/                 # Aggregate root: Todo
│           ├── domain/           # Entidad + repositorio abstracto
│           ├── application/      # Service + DTOs
│           └── infrastructure/   # Implementación del repositorio
├── shared/
│   └── infrastructure/
│       └── prisma/
└── apps/                         # Capa de delivery
```

**Regla clave:** Los bounded contexts NO importan entre sí. Si `tasks/users` necesitara algo de `tasks/todos`, se comunica por eventos o DTOs compartidos — nunca por imports directos.

### Fase 4: Separación por capas DDD (domain / application / infrastructure)

Dentro de cada aggregate root (`todo/`), se separó la lógica en tres capas:

#### Domain (el corazón)

```typescript
// src/contexts/tasks/todo/domain/todo.entity.ts
export class Todo {
  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly completed: boolean,
  ) {}
}

// src/contexts/tasks/todo/domain/todo.repository.ts
export abstract class TodoRepository {
  abstract findAll(): Promise<Todo[]>;
  abstract getOne(id: number): Promise<Todo | null>;
  abstract create(data: CreateTodoData): Promise<Todo | null>;
  abstract update(id: number, data: UpdateTodoData): Promise<Todo | null>;
  abstract deleteItem(id: number): Promise<void>;
}
```

- **Entidad:** Representación pura del dominio, sin dependencias de frameworks.
- **Repositorio abstracto:** Interfaz que define QUÉ se puede hacer con los datos, no CÓMO se almacenan.

#### Application (casos de uso)

```typescript
// src/contexts/tasks/todo/application/todo.service.ts
@Injectable()
export class TodoService {
  constructor(private readonly todoRepository: TodoRepository) {}
  // Lógica de negocio: validaciones, transformaciones, orquestación
}
```

- Depende del **repositorio abstracto** (domain), NO de Prisma.
- Los DTOs (`create-todo.dto.ts`, `update-todo.dto.ts`) definen la forma de los datos de entrada.

#### Infrastructure (implementación técnica)

```typescript
// src/contexts/tasks/todo/infrastructure/prisma-todo.repository.ts
@Injectable()
export class PrismaTodoRepository implements TodoRepository {
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: any) {
    return new Todo(row.id, row.title, row.completed);
  }

  async findAll() {
    const rows = await this.prisma.todo.findMany();
    return rows.map((r) => this.toDomain(r));
  }
  // ... CRUD operations
}
```

- Implementa el repositorio abstracto usando Prisma.
- El método `toDomain()` traduce los datos de la DB a la entidad del dominio.
- Para cambiar de Prisma a TypeORM, se crea otro archivo en `infrastructure/` que implemente la misma interfaz — el service NO cambia.

### Fase 5: Capa de delivery (apps)

Se creó la capa `apps/` para separar la presentación de la lógica de negocio:

```
src/
├── apps/
│   ├── apps.module.ts           # Agrupa las diferentes "apps"
│   └── api/
│       ├── api.module.ts        # Importa módulos de contextos
│       ├── todo.controller.ts   # HTTP endpoints
│       └── todo.controller.spec.ts
```

El controller depende del **service** (application layer), nunca del repositorio directamente:

```typescript
@Controller('todo')
export class TodoController {
  constructor(private readonly todoService: TodoService) {}
  // Los endpoints delegan al service
}
```

**Por qué `apps/`:** Permite tener múltiples capas de delivery (HTTP API, CLI, gRPC, etc.) sin mezclar controllers con lógica de negocio.

### Fase 6: Árbol de módulos final

La jerarquía de módulos NestJS ahora es:

```
AppModule
├── PrismaModule (@Global)
├── ContextsModule
│   └── TasksModule
│       └── TodoModule
└── AppsModule
    └── ApiModule
        └── TodoController
```

**Flujo de inyección:**
1. `PrismaModule` exporta `PrismaService` (disponible globalmente).
2. `TodoModule` registra `TodoRepository` → `PrismaTodoRepository` y exporta `TodoService`.
3. `ApiModule` importa `TodoModule` para inyectar `TodoService` en el controller.
4. `AppModule` conecta todo: `ContextsModule` (dominio) + `AppsModule` (delivery) + `PrismaModule` (infraestructura compartida).

---

## Estructura final del proyecto

```
packages/backend/
├── prisma/
│   ├── schema.prisma                  # Esquema de modelos
│   └── migrations/                    # Migraciones generadas
├── src/
│   ├── main.ts                        # Bootstrap + Swagger config
│   ├── app.module.ts                  # Módulo raíz
│   │
│   ├── shared/                        # Infraestructura compartida
│   │   └── infrastructure/
│   │       └── prisma/
│   │           ├── prisma.module.ts   # @Global — disponible en toda la app
│   │           └── prisma.service.ts  # Extiende PrismaClient con driver adapter
│   │
│   ├── contexts/                      # Bounded contexts (dominios de negocio)
│   │   ├── contexts.module.ts
│   │   │
│   │   ├── tasks/                     # Bounded context: "Tasks"
│   │   │   ├── tasks.module.ts
│   │   │   └── todo/                  # Aggregate root: Todo
│   │   │       ├── todo.module.ts
│   │   │       ├── domain/            # El corazón — sin dependencias
│   │   │       │   ├── todo.entity.ts        # Entidad del dominio
│   │   │       │   └── todo.repository.ts    # Interfaz del repositorio
│   │   │       ├── application/        # Casos de uso
│   │   │       │   ├── todo.service.ts       # Service (lógica de negocio)
│   │   │       │   └── dto/
│   │   │       │       ├── create-todo.dto.ts
│   │   │       │       └── update-todo.dto.ts
│   │   │       └── infrastructure/    # Implementación técnica
│   │   │           └── prisma-todo.repository.ts  # Repositorio con Prisma
│   │   │
│   │   └── identity-access/           # Bounded context: "Auth & Users"
│   │       ├── identity-access.module.ts
│   │       ├── user/
│   │       │   ├── user.module.ts
│   │       │   ├── domain/
│   │       │   │   ├── user.entity.ts
│   │       │   │   └── user.repository.ts
│   │       │   ├── application/
│   │       │   │   ├── user.service.ts
│   │       │   │   └── dto/create-user.dto.ts
│   │       │   └── infrastructure/
│   │       │       └── prisma-user.repository.ts
│   │       └── auth/
│   │           ├── auth.module.ts
│   │           ├── application/
│   │           │   ├── auth.service.ts
│   │           │   └── dto/login.dto.ts
│   │           └── infrastructure/
│   │               ├── jwt.strategy.ts
│   │               ├── jwt-auth.guard.ts
│   │               └── current-user.decorator.ts
│   │
│   └── apps/                          # Capa de delivery
│       ├── apps.module.ts
│       └── api/
│           ├── api.module.ts
│           ├── auth.controller.ts
│           ├── user.controller.ts
│           ├── todo.controller.ts
│           └── *.spec.ts
│
├── src/__mocks__/                     # Mocks para Jest (ESM packages)
│   ├── @nestjs/jwt.js
│   ├── @nestjs/passport.js
│   ├── argon2.js
│   └── passport-jwt.js
│
├── generated/                         # Client Prisma (no commitear)
├── prisma7.config.ts
├── .env
└── package.json
```

---

## Autenticación y Seguridad de APIs

### Dependencias instaladas

```bash
pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt argon2 @nestjs/config
```

| Paquete | Propósito |
|---------|-----------|
| `@nestjs/jwt` | Integración de JWT con NestJS (firma y verificación de tokens) |
| `@nestjs/passport` | Integración de Passport con NestJS (strategy pattern) |
| `passport` | Framework de autenticación modular |
| `passport-jwt` | Strategy para extraer y verificar tokens JWT del header |
| `argon2` | Hashing de contraseñas (ganador del Password Hashing Competition) |
| `@nestjs/config` | Carga variables de entorno desde `.env` vía `ConfigService` |

### Bounded Context: Identity Access

El sistema de autenticación vive en `src/contexts/identity-access/`, siguiendo los mismos principios DDD del resto del proyecto:

```
src/contexts/identity-access/
├── identity-access.module.ts      # Agrupa User + Auth
├── user/                          # Gestión de usuarios
│   ├── domain/
│   │   ├── user.entity.ts         # Entidad del dominio
│   │   └── user.repository.ts     # Interfaz del repositorio
│   ├── application/
│   │   ├── user.service.ts        # Lógica de negocio (crear, listar)
│   │   └── dto/create-user.dto.ts # Validación de entrada
│   ├── infrastructure/
│   │   └── prisma-user.repository.ts  # Implementación con Prisma
│   └── user.module.ts             # Módulo (exporta UserService + UserRepository)
└── auth/                          # Autenticación y autorización
    ├── application/
    │   ├── auth.service.ts         # Lógica de login
    │   └── dto/login.dto.ts        # Validación de credenciales
    └── infrastructure/
        ├── jwt.strategy.ts         # Estrategia Passport JWT
        ├── jwt-auth.guard.ts       # Guard para proteger endpoints
        └── current-user.decorator.ts  # Decorador para obtener el usuario autenticado
```

### Modelo de Usuario (Prisma Schema)

```prisma
enum Role {
  CLIENT
  ADMIN
}

enum UserStatus {
  ACTIVE
  BLOCKED
}

model User {
  id       String     @id @default(uuid())
  email    String     @unique
  name     String?
  password String     // Hash Argon2id
  role     Role       @default(CLIENT)
  status   UserStatus @default(ACTIVE)
  todos    Todo[]
}
```

**Roles:**
- `CLIENT`: Usuario estándar, solo gestiona sus propios recursos
- `ADMIN`: Acceso administrativo (preparado para futuros endpoints)

**Estados:**
- `ACTIVE`: Puede autenticarse
- `BLOCKED`: No puede autenticarse

### Flujo de Autenticación

#### 1. Registro de Usuario

```typescript
// POST /users
// Body: { email, name, password }
```

- Valida datos de entrada con DTO (`CreateUserDto`)
- Hashea la contraseña con **Argon2id** (memory: 19456, timeCost: 2, parallelism: 1)
- Crea usuario con rol `CLIENT` y estado `ACTIVE`
- Retorna usuario sin contraseña

#### 2. Login

```typescript
// POST /auth/login
// Body: { email, password }
```

- Busca usuario por email
- Verifica contraseña con `argon2.verify()`
- Genera JWT con payload: `{ sub: id, email, role }`
- Retorna `{ accessToken, user }`

#### 3. Acceso a Endpoints Protegidos

```typescript
// GET /todo
// Header: Authorization: Bearer <token>
```

### Componentes de Seguridad

#### JWT Strategy (`jwt.strategy.ts`)

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),  // ← ConfigService, NO process.env
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userRepository.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User not found');
    return { id: user.id, email: user.email, role: user.role };
  }
}
```

**Por qué `ConfigService` y no `process.env`:**
NestJS carga las variables de entorno de forma asíncrona. Si lees `process.env.JWT_SECRET` directamente, puede llegar `undefined` antes de que `ConfigModule` termine de cargar el `.env`. Esto genera un mismatch entre el secret usado para firmar y el usado para validar → siempre 401.

#### JWT Auth Guard (`jwt-auth.guard.ts`)

```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
```

**Uso en controllers:**

```typescript
@UseGuards(JwtAuthGuard)
@Get('protected')
getProtectedResource(@CurrentUser() user: User) {
  return { message: `Hola ${user.email}` };
}
```

#### Current User Decorator (`current-user.decorator.ts`)

```typescript
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

**Uso:** Extrae el usuario validado del request (inyectado por Passport después del `validate()` de JwtStrategy).

### Configuración de Variables de Entorno

```env
# .env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/todo?schema=public"
JWT_SECRET=your_jwt_secret_key    # ← Clave secreta para JWT
PORT=3050
```

**Importante:**
- `JWT_SECRET` se carga vía `ConfigModule` (configurado en `app.module.ts`)
- Nunca uses el mismo secret en desarrollo y producción
- El fallback `'default_secret'` es solo para desarrollo (nunca en producción)

### Módulos y Dependencias

```typescript
// auth.module.ts
@Module({
  imports: [
    UserModule,                                           // Para UserRepository
    PassportModule.register({ defaultStrategy: 'jwt' }),  // Passport JWT
    JwtModule.registerAsync({                             // JWT con ConfigService
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

**Flujo de resolución de dependencias:**
1. `UserModule` provee `UserRepository` (abstracción) → `PrismaUserRepository` (implementación)
2. `UserModule` **exporta** `UserRepository` → `AuthModule` puede resolverlo
3. `AuthModule` inyecta `UserRepository` en `AuthService` y `JwtStrategy`
4. `ConfigModule` (global) provee `ConfigService` → `AuthModule` accede a `JWT_SECRET`

### Hashing de Contraseñas con Argon2id

```typescript
// Crear usuario
const hashedPassword = await argon2.hash(dto.password, {
  type: argon2.argon2id,    // Combina Argon2d + Argon2i
  memoryCost: 19456,        // 19 MB de memoria
  timeCost: 2,              // 2 iteraciones
  parallelism: 1,           // 1 thread
});

// Verificar contraseña
const valid = await argon2.verify(user.password, dto.password);
```

**Por qué Argon2id:**
- Ganador del Password Hashing Competition (2015)
- Resistente a ataques de GPU/ASIC
- Combina las ventajas de Argon2d (resistencia a ataques de tiempo) y Argon2i (resistencia a ataques de memoria)

### Resumen de Seguridad

| Capa | Tecnología | Propósito |
|------|------------|-----------|
| Contraseñas | Argon2id | Hash unidireccional, nunca se almacena texto plano |
| Autenticación | JWT (HS256) | Tokens stateless, verificables sin DB |
| Autorización | Guards + Decorators | Control de acceso por endpoint |
| Validación | DTOs + ValidationPipe | Filtra entradas maliciosas antes de llegar al dominio |
| CORS | enableCors() | Solo permite orígenes específicos |
| Configuración | ConfigService | Variables de entorno seguras, sin hardcoding |

---

## CORS (Cross-Origin Resource Sharing)

### Configuración

```typescript
// main.ts
app.enableCors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:3040',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
});
```

### Por qué importa

Sin CORS, el navegador bloquea las requests del frontend (`http://localhost:3040`) al backend (`http://localhost:3050`) por política same-origin. `enableCors()` agrega los headers necesarios:

```
Access-Control-Allow-Origin: http://localhost:3040
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH
Access-Control-Allow-Credentials: true
```

### En producción

La variable `CORS_ORIGIN` se configura en `docker-compose.yml` con la IP pública del servidor:

```yaml
# docker-compose.yml
backend:
  environment:
    CORS_ORIGIN: http://184.73.194.175:3040
```

**Nunca** se usa `*` como origin en producción — solo en el notification service (WebSocket interno).

---

## Prefijo global `/api`

```typescript
// main.ts
app.setGlobalPrefix('api');
```

Todas las rutas del backend llevan prefijo `/api`:

| Ruta interna | Ruta pública |
|-------------|-------------|
| `POST /auth/login` | `POST /api/auth/login` |
| `GET /users` | `GET /api/users` |
| `GET /todo` | `GET /api/todo` |
| `POST /todo` | `POST /api/todo` |

El frontend usa el prefijo `/api` en todas sus llamadas:

```typescript
// useAuth.tsx
fetch(`${API_BASE}/api/auth/login`, { ... })

// TodosPage.tsx
api("/api/todo", { token })
api(`/api/todo/${id}`, { method: "DELETE", token })
```

---

## Integración con Notification Service

### Cómo se comunica

El backend envía notificaciones al servicio de notification vía HTTP interno (no expuesto al público):

```typescript
// src/contexts/tasks/todo/infrastructure/http-notification.adapter.ts
@Injectable()
export class HttpNotificationAdapter implements NotificationPort {
  private readonly notificationUrl: string;

  constructor(private readonly config: ConfigService) {
    this.notificationUrl = this.config.get<string>(
      'NOTIFICATION_SERVICE_URL',
      'http://localhost:3060',
    );
  }

  async send(data: SendNotificationData): Promise<void> {
    await fetch(`${this.notificationUrl}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }
}
```

### Puerto de notificación (Port Pattern)

El backend define un **puerto abstracto** en el domain layer, no depende directamente del notification service:

```typescript
// src/contexts/tasks/todo/domain/notification.port.ts
export abstract class NotificationPort {
  abstract send(data: SendNotificationData): Promise<void>;
}
```

La implementación (`HttpNotificationAdapter`) vive en `infrastructure/`. Para cambiar de HTTP a RabbitMQ, Redis, o cualquier otro transport, solo se crea otra implementación — el service NO cambia.

### Tipos de notificación

| Tipo | Cuándo se envía | Datos |
|------|----------------|-------|
| `TASK_CREATED` | Al crear una tarea | `{ userId, type, title, message, metadata: { taskId } }` |
| `TASK_COMPLETED` | Al marcar como completada | `{ userId, type, title, message, metadata: { taskId } }` |

### Ejemplo de uso en el service

```typescript
// src/contexts/tasks/todo/application/todo.service.ts
async create(userId: string, dto: CreateTodoDto) {
  const todo = await this.todoRepository.create({ ... });

  await this.notificationPort.send({
    userId,
    type: 'TASK_CREATED',
    title: 'Nueva tarea',
    message: `Se creó la tarea "${dto.title}"`,
    metadata: { taskId: todo.id },
  });

  return todo;
}
```

### Variables de entorno

```env
# .env
NOTIFICATION_SERVICE_URL=http://localhost:3060  # Local
# En Docker: http://notification:3060 (nombre del servicio en compose)
```

### Flujo completo

```
┌─────────────┐     POST /api/todo      ┌──────────────┐
│   Frontend   │ ──────────────────────→ │    Backend    │
│  (React)     │                         │  (NestJS)     │
└──────┬──────┘                         └──────┬───────┘
       │                                       │
       │  WebSocket "notification"             │  POST /notifications
       │  ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │  (HTTP interno)
       │                                       │
       │                                       ▼
       │                                ┌──────────────┐
       │                                │  Notification │
       │                                │  (NestJS)     │
       │                                └──────────────┘
```

1. Frontend envía `POST /api/todo` al backend
2. Backend crea la tarea y llama a `NotificationPort.send()`
3. `HttpNotificationAdapter` hace `POST` al notification service
4. Notification service guarda en MongoDB y emite vía WebSocket
5. Frontend recibe la notificación en tiempo real

---

## WebSocket — Notificaciones en Tiempo Real

### Gateway (Notification Service)

El notification service expone un WebSocket Gateway con Socket.IO:

```typescript
// packages/notification/src/apps/api/notification.gateway.ts
@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  // El cliente se une a una room al conectarse
  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      client.join(`user:${userId}`);
    }
  }

  // Evento "join" para unirse a la room del usuario
  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    client.join(`user:${data.userId}`);
    return { event: 'joined', data: { userId: data.userId } };
  }

  // Enviar notificación a un usuario específico
  sendNotificationToUser(userId: string, notification: unknown) {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }
}
```

### Protocolo WebSocket

| Evento | Dirección | Payload | Descripción |
|--------|-----------|---------|-------------|
| `join` | Frontend → Server | `{ userId: string }` | Unirse a la room del usuario |
| `joined` | Server → Frontend | `{ userId: string }` | Confirmación de unión |
| `notification` | Server → Frontend | `Notification` | Nueva notificación en tiempo real |

### Modelo de notificación

```typescript
interface Notification {
  id: string;
  userId: string;
  type: "TASK_CREATED" | "TASK_COMPLETED" | "TASK_DUE_SOON";
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}
```

### Frontend — Hook `useNotifications`

El frontend consume el WebSocket via un custom hook:

```typescript
// packages/frontend/src/hooks/useNotifications.ts
const WS_URL = import.meta.env.VITE_WS_URL || '';

export function useNotifications() {
  const { token, user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);

  // 1. Cargar notificaciones existentes vía REST
  useEffect(() => {
    fetch(`${WS_URL.replace(/^ws/, "http")}/notifications/${user.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => res.json()).then(setNotifications);
  }, []);

  // 2. Conexión WebSocket
  useEffect(() => {
    const socket = io(WS_URL, {
      query: { userId: user.id },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 3000,
    });

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join", { userId: user.id });
    });

    socket.on("notification", (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnread((prev) => prev + 1);
    });

    return () => socket.disconnect();
  }, [user, token]);

  return { notifications, unread, connected, markAsRead, markAllAsRead };
}
```

### Configuración de conexión

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| `transports` | `["websocket", "polling"]` | Intenta WebSocket primero, fallback a HTTP polling |
| `reconnection` | `true` | Reconexión automática al perder conexión |
| `reconnectionDelay` | `3000` | Espera 3 segundos entre intentos |
| `query.userId` | `user.id` | Se envía en el handshake para unirse a la room |

### Variables de entorno (Frontend)

```env
# packages/frontend/.env
VITE_WS_URL=http://localhost:3060    # Notification service
# En Docker: ws://IP_PUBLICA:3060
```

---

## API Endpoints

### Auth

| Método | Ruta | Autenticado | Descripción |
|--------|------|-------------|-------------|
| POST | `/api/auth/login` | No | Iniciar sesión, retorna JWT |

### Users

| Método | Ruta | Autenticado | Descripción |
|--------|------|-------------|-------------|
| GET | `/api/users` | Sí | Listar todos los usuarios |
| POST | `/api/users` | Sí | Crear usuario |

### Todo

| Método | Ruta | Autenticado | Descripción |
|--------|------|-------------|-------------|
| GET | `/api/todo` | Sí | Listar tareas del usuario |
| GET | `/api/todo/:id` | Sí | Obtener tarea por ID |
| POST | `/api/todo` | Sí | Crear tarea |
| PATCH | `/api/todo/:id` | Sí | Actualizar tarea (parcial) |
| DELETE | `/api/todo/:id` | Sí | Eliminar tarea |

### PATCH /todo/:id — Update Parcial

El endpoint de actualización acepta **cualquier combinación** de campos:

```json
// Solo actualizar completed
{ "completed": true }

// Solo actualizar título
{ "title": "Nuevo título" }

// Actualizar varios campos
{ "title": "Nuevo título", "description": "Nueva descripción", "completed": true }
```

---

## Swagger

### Dependencias instaladas

```bash
pnpm add @nestjs/swagger
```

| Paquete | Propósito |
|---------|-----------|
| `@nestjs/swagger` | Decoradores para documentar endpoints, DTOs y respuestas |

### Configuración en `main.ts`

```typescript
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('Todo API')
  .setDescription('API para manejar tareas de un usuario')
  .setVersion('1.0')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
      in: 'header',
    },
    'jwt',  // ← name del scheme, se usa en @ApiBearerAuth('jwt')
  )
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('docs', app, document);
```

### Decoradores Swagger en Controllers

```typescript
@ApiTags('Todo')           // Agrupa endpoints en Swagger UI
@ApiBearerAuth('jwt')      // Requiere token JWT para todos los endpoints del controller
@UseGuards(JwtAuthGuard)
@Controller('todo')
export class TodoController {

  @Get()
  @ApiOperation({ summary: 'Obtener todas las tareas' })
  @ApiResponse({ status: 200, description: 'Lista de tareas' })
  findAll() { ... }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una tarea por ID' })
  @ApiParam({ name: 'id', description: 'ID de la tarea' })
  @ApiResponse({ status: 200, description: 'Tarea encontrada' })
  @ApiResponse({ status: 404, description: 'Tarea no encontrada' })
  findOne(@Param('id') id: string) { ... }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar parcialmente una tarea' })
  @ApiParam({ name: 'id', description: 'ID de la tarea' })
  @ApiResponse({ status: 200, description: 'Tarea actualizada' })
  update(@Param('id') id: string, @Body() dto: UpdateTodoDto) { ... }
}
```

### Decoradores Swagger en DTOs

```typescript
export class CreateTodoDto {
  @ApiProperty({
    description: 'Título de la tarea',
    example: 'Comprar pan',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({    // ← Para campos opcionales
    description: 'Descripción de la tarea',
    example: 'Comprar pan en la tienda cercana',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
```

### Uso

1. Abrir http://localhost:3050/docs
2. Click en **"Authorize"** (botón superior derecho)
3. Pegar tu token JWT (sin prefijo "Bearer")
4. Click **"Authorize"**
5. Todos los requests incluirán el token automáticamente

---

## Árbol de Módulos

```
AppModule
├── ConfigModule (@Global)
├── PrismaModule (@Global)
├── ContextsModule
│   ├── TasksModule
│   │   └── TodoModule
│   └── IdentityAccessModule
│       ├── UserModule
│       └── AuthModule
└── AppsModule
    └── ApiModule
        ├── AuthController
        ├── UserController
        └── TodoController
```

**Flujo de inyección:**
1. `PrismaModule` exporta `PrismaService` (disponible globalmente).
2. `TodoModule` registra `TodoRepository` → `PrismaTodoRepository` y exporta `TodoService`.
3. `UserModule` registra `UserRepository` → `PrismaUserRepository` y exporta `UserService` + `UserRepository`.
4. `AuthModule` importa `UserModule` para inyectar `UserRepository` en `AuthService` y `JwtStrategy`.
5. `ApiModule` importa los módulos necesarios para inyectar services en controllers.
6. `AppModule` conecta todo: `ContextsModule` (dominio) + `AppsModule` (delivery) + `PrismaModule` (infraestructura compartida).

---

## Tests

```bash
pnpm test           # 32 tests, 7 suites
pnpm test:cov       # coverage
```

### Suites de Test

| Suite | Tests | Qué cubre |
|-------|-------|-----------|
| `TodoController` | 5 | CRUD completo |
| `TodoService` | 6 | Lógica de negocio + NotFoundException |
| `AuthService` | 3 | Login, user not found, wrong password |
| `AuthController` | 2 | Login endpoint |
| `UserController` | 3 | findAll, create |
| `JwtStrategy` | 2 | validate, user not found |
| `UserService` | 4 | findAll, create, duplicate email |

### Mocks ESM

Los paquetes `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt` y `argon2` son ESM puro. Jest (CommonJS) no los parsea. Se resuelven con `moduleNameMapper` en `package.json` apuntando a mocks manuales en `src/__mocks__/`.

---

## Prisma Commands

```bash
npx prisma generate                    # Generar client después de cambiar schema.prisma
npx prisma migrate dev --name nombre   # Crear migración (desarrollo)
npx prisma migrate deploy              # Aplicar migraciones en producción
npx prisma studio                      # Ver y modificar la DB en el navegador
npx prisma migrate reset               # Resetear la DB (borra datos + recrea)
npx prisma format                      # Formatear schema.prisma
```

## Ejecutar el proyecto

```bash
pnpm run start:dev                     # Desarrollo (hot-reload)
pnpm run build && pnpm run start:prod  # Build + producción
```

## Notas

- `generated/` y `.env` están en `.gitignore` — no se commitean.
- Prisma 7 usa `prisma7.config.ts` para configuración.
- El client se importa desde `generated/prisma/client` (no desde `@prisma/client`).
- `prisma generate` corre después de cada `pnpm install` gracias al script `postinstall`.

## Recursos

- [NestJS Docs](https://docs.nestjs.com)
- [Prisma Docs](https://www.prisma.io/docs)
- [Domain-Driven Design — Eric Evans](https://www.domainlanguage.com/ddd/)
