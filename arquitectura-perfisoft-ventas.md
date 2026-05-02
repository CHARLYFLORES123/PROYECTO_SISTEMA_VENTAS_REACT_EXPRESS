# Arquitectura — Sistema de Ventas Perfisoft
## Stack: .NET 9 Web API · Angular 18 · SQL Server · EF Core

---

## 1. ESTRUCTURA DE LA SOLUCIÓN VISUAL STUDIO

```
Perfisoft.Ventas.sln
│
├── src/
│   │
│   ├── Core/                                    ← Sin dependencias externas
│   │   ├── Perfisoft.Ventas.Domain/
│   │   │   ├── Entities/
│   │   │   │   ├── Common/         (BaseEntity, AuditableEntity)
│   │   │   │   ├── Identity/       (AppUser, AppRole)
│   │   │   │   ├── Aodb/           (Vuelo, Aeronave, Aerolinea, Terminal, Puerta)
│   │   │   │   ├── Rms/            (Tarifa, ClaseTarifa, ReglaTarifa, Promocion)
│   │   │   │   ├── Fids/           (PantallaDisplay, MensajeDisplay)
│   │   │   │   └── Ventas/         (Reserva, Pasajero, Boleto, Pago, Factura)
│   │   │   ├── ValueObjects/
│   │   │   │   ├── Dinero.cs
│   │   │   │   ├── CodigoIATA.cs
│   │   │   │   └── PeriodoFecha.cs
│   │   │   ├── Enums/
│   │   │   │   ├── EstadoVuelo.cs
│   │   │   │   ├── EstadoReserva.cs
│   │   │   │   ├── TipoPago.cs
│   │   │   │   └── TipoMovimiento.cs
│   │   │   ├── Events/              (Domain Events)
│   │   │   └── Exceptions/          (DomainException, NotFoundException)
│   │   │
│   │   └── Perfisoft.Ventas.Application/
│   │       ├── Common/
│   │       │   ├── Interfaces/      (IAppDbContext, ICurrentUser, IEmailService, ITokenService)
│   │       │   ├── Behaviors/       (ValidationBehavior, LoggingBehavior — MediatR Pipeline)
│   │       │   └── Mappings/        (AutoMapper Profiles)
│   │       ├── Auth/
│   │       │   ├── Commands/        (LoginCommand, RefreshTokenCommand, ForgotPasswordCommand)
│   │       │   └── Queries/
│   │       ├── Aodb/
│   │       │   ├── Commands/        (CreateVuelo, UpdateVuelo, DeleteVuelo, RegistrarMovimiento)
│   │       │   └── Queries/         (GetVuelos, GetVueloById, GetVueloPorRuta)
│   │       ├── Rms/
│   │       │   ├── Commands/        (SetTarifa, CreatePromocion, AjustarDisponibilidad)
│   │       │   └── Queries/         (GetTarifas, GetDisponibilidad, GetPromociones)
│   │       ├── Fids/
│   │       │   ├── Commands/        (UpdatePantalla, PublicarMensaje)
│   │       │   └── Queries/         (GetPantallasByTerminal, GetMensajesActivos)
│   │       └── Ventas/
│   │           ├── Commands/        (CrearReserva, ConfirmarPago, EmitirBoleto, AnularReserva)
│   │           └── Queries/         (GetReservas, GetPasajero, GetReporte)
│   │
│   ├── Infrastructure/
│   │   ├── Perfisoft.Ventas.Infrastructure/
│   │   │   ├── Persistence/
│   │   │   │   ├── AppDbContext.cs
│   │   │   │   ├── Configurations/  (IEntityTypeConfiguration por entidad)
│   │   │   │   ├── Repositories/    (implementaciones concretas)
│   │   │   │   ├── Migrations/
│   │   │   │   └── Seeders/         (RoleSeeder, UserSeeder, CatalogoSeeder)
│   │   │   ├── Services/
│   │   │   │   ├── EmailService.cs  (SMTP / SendGrid)
│   │   │   │   ├── TokenService.cs  (JWT + Refresh)
│   │   │   │   └── CurrentUserService.cs
│   │   │   └── DependencyInjection.cs
│   │   │
│   │   └── Perfisoft.Ventas.Identity/
│   │       ├── AppIdentityDbContext.cs  (extiende AppDbContext con ASP.NET Identity)
│   │       ├── Entities/               (AppUser : IdentityUser, AppRole : IdentityRole)
│   │       └── DependencyInjection.cs
│   │
│   └── Presentation/
│       └── Perfisoft.Ventas.API/       ← .NET 9 Web API
│           ├── Controllers/
│           │   ├── AuthController.cs
│           │   ├── Aodb/
│           │   │   ├── VuelosController.cs
│           │   │   ├── AeronavesController.cs
│           │   │   ├── AerolineasController.cs
│           │   │   ├── TerminalesController.cs
│           │   │   └── PuertasController.cs
│           │   ├── Rms/
│           │   │   ├── TarifasController.cs
│           │   │   ├── ClasesController.cs
│           │   │   ├── DisponibilidadController.cs
│           │   │   └── PromocionesController.cs
│           │   ├── Fids/
│           │   │   ├── PantallasController.cs
│           │   │   └── MensajesController.cs
│           │   └── Ventas/
│           │       ├── ReservasController.cs
│           │       ├── PasajerosController.cs
│           │       ├── PagosController.cs
│           │       └── ReportesController.cs
│           ├── Filters/               (GlobalExceptionFilter, ValidationFilter)
│           ├── Middlewares/           (JwtMiddleware, CorrelationIdMiddleware)
│           └── Program.cs             (Minimal Hosting, Swagger, CORS)
│
└── tests/
    ├── Perfisoft.Ventas.Domain.Tests/
    ├── Perfisoft.Ventas.Application.Tests/
    └── Perfisoft.Ventas.Integration.Tests/
```

---

## 2. ENDPOINTS API (.NET 9)

### Auth — `/api/auth`
| Método | Ruta                  | Acción                        |
|--------|-----------------------|-------------------------------|
| POST   | `/login`              | Login → JWT + RefreshToken    |
| POST   | `/refresh`            | Rotar access token            |
| POST   | `/forgot-password`    | Enviar email de reset         |
| POST   | `/reset-password`     | Aplicar nueva contraseña      |
| POST   | `/logout`             | Revocar refresh token         |

### AODB — `/api/aodb`
| Método | Ruta                            | Acción                        |
|--------|---------------------------------|-------------------------------|
| GET    | `/vuelos`                       | Listar vuelos (paginado)      |
| GET    | `/vuelos/{id}`                  | Detalle de vuelo              |
| POST   | `/vuelos`                       | Crear vuelo                   |
| PUT    | `/vuelos/{id}`                  | Actualizar vuelo              |
| DELETE | `/vuelos/{id}`                  | Eliminar vuelo                |
| POST   | `/vuelos/{id}/movimientos`      | Registrar llegada/salida      |
| GET    | `/aeronaves`                    | Catálogo de aeronaves         |
| GET    | `/aerolineas`                   | Catálogo de aerolíneas        |
| GET    | `/terminales`                   | Terminales y puertas          |
| GET    | `/programacion`                 | Grilla de horarios            |

### RMS — `/api/rms`
| Método | Ruta                            | Acción                        |
|--------|---------------------------------|-------------------------------|
| GET    | `/tarifas`                      | Listar tarifas                |
| POST   | `/tarifas`                      | Crear tarifa                  |
| PUT    | `/tarifas/{id}`                 | Actualizar tarifa             |
| GET    | `/clases`                       | Clases tarifarias             |
| GET    | `/disponibilidad`               | Consultar disponibilidad      |
| POST   | `/disponibilidad/ajustar`       | Ajustar cupos                 |
| GET    | `/promociones`                  | Listar promociones            |
| POST   | `/promociones`                  | Crear promoción               |

### FIDS — `/api/fids`
| Método | Ruta                            | Acción                        |
|--------|---------------------------------|-------------------------------|
| GET    | `/pantallas`                    | Listar pantallas              |
| PUT    | `/pantallas/{id}`               | Configurar pantalla           |
| GET    | `/mensajes`                     | Mensajes activos              |
| POST   | `/mensajes`                     | Publicar mensaje              |
| DELETE | `/mensajes/{id}`                | Retirar mensaje               |
| GET    | `/tablero`                      | Datos en tiempo real (FIDS)   |

### Ventas — `/api/ventas`
| Método | Ruta                            | Acción                        |
|--------|---------------------------------|-------------------------------|
| GET    | `/reservas`                     | Listar reservas               |
| POST   | `/reservas`                     | Crear reserva                 |
| GET    | `/reservas/{id}`                | Detalle de reserva            |
| POST   | `/reservas/{id}/confirmar`      | Confirmar + emitir boleto     |
| POST   | `/reservas/{id}/anular`         | Anular reserva                |
| GET    | `/pasajeros`                    | Buscar pasajeros              |
| POST   | `/pagos`                        | Registrar pago                |
| GET    | `/reportes/ventas`              | Reporte de ventas             |
| GET    | `/reportes/ocupacion`           | Reporte de ocupación          |

---

## 3. MAPA DE RUTAS — ANGULAR 18

```typescript
// app.routes.ts — Standalone Components, lazy-loaded

export const appRoutes: Routes = [
  {
    path: '',
    redirectTo: 'sign-in',
    pathMatch: 'full'
  },

  // ── AUTH (sin layout de admin) ──────────────────────────────────────────
  {
    path: 'sign-in',
    loadComponent: () =>
      import('./features/auth/sign-in/sign-in.component')
        .then(m => m.SignInComponent)
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component')
        .then(m => m.ForgotPasswordComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password/reset-password.component')
        .then(m => m.ResetPasswordComponent)
  },

  // ── ADMIN (con AuthGuard + ShellLayout) ────────────────────────────────
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/shell/shell.component')
        .then(m => m.ShellComponent),
    children: [

      // Dashboard
      {
        path: 'inicio',
        loadComponent: () =>
          import('./features/dashboard/inicio.component')
            .then(m => m.InicioComponent)
      },

      // ── AODB ────────────────────────────────────────────────────────────
      {
        path: 'aodb',
        children: [
          { path: '', redirectTo: 'vuelos', pathMatch: 'full' },
          {
            path: 'vuelos',
            loadComponent: () =>
              import('./features/aodb/vuelos/vuelos-list.component')
                .then(m => m.VuelosListComponent)
          },
          {
            path: 'vuelos/:id',
            loadComponent: () =>
              import('./features/aodb/vuelos/vuelo-detail.component')
                .then(m => m.VueloDetailComponent)
          },
          {
            path: 'aeronaves',
            loadComponent: () =>
              import('./features/aodb/aeronaves/aeronaves.component')
                .then(m => m.AeronavesComponent)
          },
          {
            path: 'aerolineas',
            loadComponent: () =>
              import('./features/aodb/aerolineas/aerolineas.component')
                .then(m => m.AerolineasComponent)
          },
          {
            path: 'terminales',
            loadComponent: () =>
              import('./features/aodb/terminales/terminales.component')
                .then(m => m.TerminalesComponent)
          },
          {
            path: 'programacion',
            loadComponent: () =>
              import('./features/aodb/programacion/programacion.component')
                .then(m => m.ProgramacionComponent)
          }
        ]
      },

      // ── RMS ─────────────────────────────────────────────────────────────
      {
        path: 'rms',
        children: [
          { path: '', redirectTo: 'tarifas', pathMatch: 'full' },
          {
            path: 'tarifas',
            loadComponent: () =>
              import('./features/rms/tarifas/tarifas.component')
                .then(m => m.TarifasComponent)
          },
          {
            path: 'clases',
            loadComponent: () =>
              import('./features/rms/clases/clases.component')
                .then(m => m.ClasesComponent)
          },
          {
            path: 'disponibilidad',
            loadComponent: () =>
              import('./features/rms/disponibilidad/disponibilidad.component')
                .then(m => m.DisponibilidadComponent)
          },
          {
            path: 'promociones',
            loadComponent: () =>
              import('./features/rms/promociones/promociones.component')
                .then(m => m.PromocionesComponent)
          }
        ]
      },

      // ── FIDS ─────────────────────────────────────────────────────────────
      {
        path: 'fids',
        children: [
          { path: '', redirectTo: 'tablero', pathMatch: 'full' },
          {
            path: 'tablero',
            loadComponent: () =>
              import('./features/fids/tablero/tablero.component')
                .then(m => m.TableroComponent)
          },
          {
            path: 'pantallas',
            loadComponent: () =>
              import('./features/fids/pantallas/pantallas.component')
                .then(m => m.PantallasComponent)
          },
          {
            path: 'mensajes',
            loadComponent: () =>
              import('./features/fids/mensajes/mensajes.component')
                .then(m => m.MensajesComponent)
          }
        ]
      },

      // ── VENTAS ──────────────────────────────────────────────────────────
      {
        path: 'ventas',
        children: [
          { path: '', redirectTo: 'reservas', pathMatch: 'full' },
          {
            path: 'reservas',
            loadComponent: () =>
              import('./features/ventas/reservas/reservas-list.component')
                .then(m => m.ReservasListComponent)
          },
          {
            path: 'reservas/nueva',
            loadComponent: () =>
              import('./features/ventas/reservas/reserva-form.component')
                .then(m => m.ReservaFormComponent)
          },
          {
            path: 'reservas/:id',
            loadComponent: () =>
              import('./features/ventas/reservas/reserva-detail.component')
                .then(m => m.ReservaDetailComponent)
          },
          {
            path: 'pasajeros',
            loadComponent: () =>
              import('./features/ventas/pasajeros/pasajeros.component')
                .then(m => m.PasajerosComponent)
          },
          {
            path: 'reportes',
            loadComponent: () =>
              import('./features/ventas/reportes/reportes.component')
                .then(m => m.ReportesComponent)
          }
        ]
      },

      // ── CONFIGURACIÓN ───────────────────────────────────────────────────
      {
        path: 'configuracion',
        canActivate: [roleGuard('Admin')],
        children: [
          {
            path: 'usuarios',
            loadComponent: () =>
              import('./features/configuracion/usuarios/usuarios.component')
                .then(m => m.UsuariosComponent)
          },
          {
            path: 'roles',
            loadComponent: () =>
              import('./features/configuracion/roles/roles.component')
                .then(m => m.RolesComponent)
          },
          {
            path: 'perfil',
            loadComponent: () =>
              import('./features/configuracion/perfil/perfil.component')
                .then(m => m.PerfilComponent)
          }
        ]
      },

      { path: '', redirectTo: 'inicio', pathMatch: 'full' }
    ]
  },

  { path: '**', redirectTo: 'admin/inicio' }
];
```

---

## 4. ESTRUCTURA DE SERVICIOS E INTERCEPTORES — ANGULAR 18

### Interceptores (funcionales — Angular 18 style)
```
src/app/core/interceptors/
├── auth.interceptor.ts          // Adjunta Bearer token a todas las peticiones
├── refresh-token.interceptor.ts // 401 → renueva token y reintenta
├── error.interceptor.ts         // Manejo global de errores HTTP
└── loading.interceptor.ts       // Signal global de carga
```

### Servicios (usando Signals para estado)
```
src/app/core/services/
├── auth.service.ts              // login(), logout(), currentUser signal
├── token.service.ts             // Gestión de JWT en localStorage
└── layout.service.ts            // sidebarOpen signal, tema

src/app/features/aodb/services/
├── vuelos.service.ts
├── aeronaves.service.ts
└── aerolineas.service.ts

src/app/features/rms/services/
├── tarifas.service.ts
└── disponibilidad.service.ts

src/app/features/fids/services/
└── fids.service.ts              // WebSocket / SignalR para tiempo real

src/app/features/ventas/services/
├── reservas.service.ts
└── reportes.service.ts
```

### Guards (funcionales)
```
src/app/core/guards/
├── auth.guard.ts                // canActivate: [authGuard]
└── role.guard.ts                // roleGuard('Admin') factory
```

---

## 5. MODELOS DE BASE DE DATOS — SQL SERVER + EF CORE

### Módulo Identity

```csharp
// AppUser : IdentityUser
AppUsers
├── Id              NVARCHAR(450)  PK
├── Nombre          NVARCHAR(100)  NOT NULL
├── Apellido        NVARCHAR(100)  NOT NULL
├── Email           NVARCHAR(256)  UNIQUE
├── FotoUrl         NVARCHAR(500)
├── Activo          BIT            DEFAULT 1
├── CreadoEn        DATETIME2
└── ModificadoEn    DATETIME2

RefreshTokens
├── Id              INT            PK IDENTITY
├── AppUserId       NVARCHAR(450)  FK → AppUsers
├── Token           NVARCHAR(500)  UNIQUE
├── Expiracion      DATETIME2
├── Revocado        BIT            DEFAULT 0
└── CreadoEn        DATETIME2
```

### Módulo AODB

```csharp
Aerolineas
├── Id              INT            PK IDENTITY
├── CodigoIATA      CHAR(2)        UNIQUE NOT NULL   -- e.g. "AA", "LA"
├── CodigoICAO      CHAR(3)        UNIQUE NOT NULL
├── Nombre          NVARCHAR(200)  NOT NULL
├── PaisOrigen      NVARCHAR(100)
├── LogoUrl         NVARCHAR(500)
└── Activo          BIT            DEFAULT 1

TiposAeronave
├── Id              INT            PK IDENTITY
├── Codigo          NVARCHAR(10)   UNIQUE            -- "B737", "A320"
├── Descripcion     NVARCHAR(200)
├── CapacidadMax    INT
└── FilasAsientos   INT

Aeronaves
├── Id              INT            PK IDENTITY
├── Matricula       NVARCHAR(20)   UNIQUE NOT NULL
├── TipoAeronaveId  INT            FK → TiposAeronave
├── AerolineaId     INT            FK → Aerolineas
├── Capacidad       INT            NOT NULL
└── Activo          BIT            DEFAULT 1

Aeropuertos
├── Id              INT            PK IDENTITY
├── CodigoIATA      CHAR(3)        UNIQUE NOT NULL   -- "MEX", "BOG"
├── CodigoICAO      CHAR(4)        UNIQUE NOT NULL
├── Nombre          NVARCHAR(300)  NOT NULL
├── Ciudad          NVARCHAR(100)
├── Pais            NVARCHAR(100)
├── Zona            NVARCHAR(50)   -- Huso horario
└── Activo          BIT            DEFAULT 1

Terminales
├── Id              INT            PK IDENTITY
├── AeropuertoId    INT            FK → Aeropuertos
├── Nombre          NVARCHAR(100)  NOT NULL           -- "Terminal 1"
└── Tipo            NVARCHAR(50)   -- "Nacional", "Internacional"

Puertas
├── Id              INT            PK IDENTITY
├── TerminalId      INT            FK → Terminales
├── Codigo          NVARCHAR(10)   NOT NULL           -- "A12"
└── TipoPuerta      NVARCHAR(50)   -- "Embarque", "Llegada"

Vuelos
├── Id              INT            PK IDENTITY
├── NumeroVuelo     NVARCHAR(10)   NOT NULL           -- "AA1234"
├── AerolineaId     INT            FK → Aerolineas
├── AeronaveId      INT            FK → Aeronaves
├── AeropuertoOrigenId   INT       FK → Aeropuertos
├── AeropuertoDestinoId  INT       FK → Aeropuertos
├── PuertaOrigenId  INT            FK → Puertas
├── PuertaDestinoId INT            FK → Puertas
├── SalidaProgramada     DATETIME2  NOT NULL
├── LlegadaProgramada    DATETIME2  NOT NULL
├── SalidaReal           DATETIME2
├── LlegadaReal          DATETIME2
├── Estado          NVARCHAR(30)   -- "Programado","EnVuelo","Aterrizado","Cancelado"
└── Observaciones   NVARCHAR(500)

MovimientosVuelo
├── Id              INT            PK IDENTITY
├── VueloId         INT            FK → Vuelos
├── TipoMovimiento  NVARCHAR(30)   -- "Despegue","Aterrizaje","Puerta","Retraso"
├── FechaHora       DATETIME2      NOT NULL
├── RegistradoPor   NVARCHAR(450)  FK → AppUsers
└── Notas           NVARCHAR(500)
```

### Módulo RMS

```csharp
ClasesTarifarias
├── Id              INT            PK IDENTITY
├── Codigo          CHAR(1)        UNIQUE NOT NULL    -- "Y","J","F","Q"
├── Nombre          NVARCHAR(100)  NOT NULL           -- "Economy","Business"
├── Descripcion     NVARCHAR(300)
├── Prioridad       INT            -- orden de preferencia
└── Activo          BIT            DEFAULT 1

Tarifas
├── Id              INT            PK IDENTITY
├── AeropuertoOrigenId   INT       FK → Aeropuertos
├── AeropuertoDestinoId  INT       FK → Aeropuertos
├── ClaseTarifariaId     INT       FK → ClasesTarifarias
├── AerolineaId     INT            FK → Aerolineas
├── Monto           DECIMAL(12,2)  NOT NULL
├── Moneda          CHAR(3)        DEFAULT 'USD'
├── VigenciaDesde   DATE
├── VigenciaHasta   DATE
└── Activo          BIT            DEFAULT 1

ReglasTarifa
├── Id              INT            PK IDENTITY
├── TarifaId        INT            FK → Tarifas
├── TipoRegla       NVARCHAR(50)   -- "Reembolso","Cambio","Equipaje"
├── Descripcion     NVARCHAR(500)
└── PenalizacionPct DECIMAL(5,2)

DisponibilidadVuelo
├── Id              INT            PK IDENTITY
├── VueloId         INT            FK → Vuelos
├── ClaseTarifariaId     INT       FK → ClasesTarifarias
├── CupoTotal       INT            NOT NULL
├── CupoDisponible  INT            NOT NULL
└── UltimaActualizacion DATETIME2

Promociones
├── Id              INT            PK IDENTITY
├── Nombre          NVARCHAR(200)  NOT NULL
├── Codigo          NVARCHAR(20)   UNIQUE
├── DescuentoPct    DECIMAL(5,2)
├── DescuentoFijo   DECIMAL(12,2)
├── VigenciaDesde   DATETIME2
├── VigenciaHasta   DATETIME2
├── UsoMaximo       INT
├── UsosActuales    INT            DEFAULT 0
└── Activo          BIT            DEFAULT 1
```

### Módulo FIDS

```csharp
PantallasDisplay
├── Id              INT            PK IDENTITY
├── TerminalId      INT            FK → Terminales
├── Nombre          NVARCHAR(100)  NOT NULL
├── Ubicacion       NVARCHAR(200)
├── TipoPantalla    NVARCHAR(50)   -- "Salidas","Llegadas","General"
├── Resolucion      NVARCHAR(20)
└── Activo          BIT            DEFAULT 1

MensajesDisplay
├── Id              INT            PK IDENTITY
├── PantallaId      INT            FK → PantallasDisplay (NULL = todas)
├── Tipo            NVARCHAR(30)   -- "Alerta","Info","Emergencia"
├── Contenido       NVARCHAR(1000) NOT NULL
├── InicioDisplay   DATETIME2      NOT NULL
├── FinDisplay      DATETIME2      NOT NULL
├── Prioridad       INT            DEFAULT 0
└── CreadoPor       NVARCHAR(450)  FK → AppUsers
```

### Módulo Ventas

```csharp
Pasajeros
├── Id              INT            PK IDENTITY
├── TipoDocumento   NVARCHAR(20)   -- "Pasaporte","DNI","Cedula"
├── NumeroDocumento NVARCHAR(30)   UNIQUE NOT NULL
├── Nombres         NVARCHAR(100)  NOT NULL
├── Apellidos       NVARCHAR(100)  NOT NULL
├── FechaNacimiento DATE
├── Nacionalidad    NVARCHAR(100)
├── Email           NVARCHAR(256)
├── Telefono        NVARCHAR(30)
└── CreadoEn        DATETIME2

Reservas
├── Id              INT            PK IDENTITY
├── Localizador     NVARCHAR(10)   UNIQUE NOT NULL   -- PNR: "ABC123"
├── VueloId         INT            FK → Vuelos
├── ClaseTarifariaId INT           FK → ClasesTarifarias
├── TarifaId        INT            FK → Tarifas
├── PromocionId     INT            FK → Promociones (nullable)
├── Estado          NVARCHAR(30)   -- "Pendiente","Confirmada","Anulada"
├── MontoBase       DECIMAL(12,2)
├── Impuestos       DECIMAL(12,2)
├── MontoTotal      DECIMAL(12,2)
├── Moneda          CHAR(3)        DEFAULT 'USD'
├── CreadoPor       NVARCHAR(450)  FK → AppUsers
└── CreadoEn        DATETIME2

ReservaPasajeros                   -- Tabla de unión
├── Id              INT            PK IDENTITY
├── ReservaId       INT            FK → Reservas
├── PasajeroId      INT            FK → Pasajeros
├── NumeroAsiento   NVARCHAR(5)
└── TipoPasajero    NVARCHAR(20)   -- "Adulto","Menor","Infante"

Boletos
├── Id              INT            PK IDENTITY
├── NumeroETicket   NVARCHAR(15)   UNIQUE NOT NULL   -- "1234567890123"
├── ReservaId       INT            FK → Reservas
├── PasajeroId      INT            FK → Pasajeros
├── Estado          NVARCHAR(30)   -- "Emitido","Usado","Anulado","Reembolsado"
├── FechaEmision    DATETIME2
└── EmitidoPor      NVARCHAR(450)  FK → AppUsers

Pagos
├── Id              INT            PK IDENTITY
├── ReservaId       INT            FK → Reservas
├── TipoPago        NVARCHAR(30)   -- "Tarjeta","Transferencia","Efectivo","Otro"
├── Referencia      NVARCHAR(100)  -- número de transacción externo
├── Monto           DECIMAL(12,2)  NOT NULL
├── Moneda          CHAR(3)        DEFAULT 'USD'
├── FechaPago       DATETIME2      NOT NULL
├── Estado          NVARCHAR(20)   -- "Aprobado","Rechazado","Pendiente"
└── RegistradoPor   NVARCHAR(450)  FK → AppUsers

Facturas
├── Id              INT            PK IDENTITY
├── ReservaId       INT            FK → Reservas
├── Serie           NVARCHAR(5)    NOT NULL
├── Numero          INT            NOT NULL
├── RazonSocial     NVARCHAR(300)
├── RFC             NVARCHAR(30)
├── Subtotal        DECIMAL(12,2)
├── Impuestos       DECIMAL(12,2)
├── Total           DECIMAL(12,2)
├── FechaEmision    DATETIME2
└── Estado          NVARCHAR(20)   -- "Vigente","Cancelada"
```

---

## 6. ESTADO CON SIGNALS — ANGULAR 18

```typescript
// core/store/auth.store.ts
export const authStore = {
  currentUser: signal<UserDto | null>(null),
  isAuthenticated: computed(() => authStore.currentUser() !== null),
  isLoading: signal(false),
  error: signal<string | null>(null)
};

// features/aodb/store/vuelos.store.ts
export const vuelosStore = {
  vuelos: signal<Vuelo[]>([]),
  selected: signal<Vuelo | null>(null),
  filtros: signal<VueloFiltros>({}),
  isLoading: signal(false),
  total: computed(() => vuelosStore.vuelos().length)
};
```

---

## 7. INTEGRACIÓN ENTRE MÓDULOS

```
                    ┌──────────────┐
                    │  AODB        │
                    │  (fuente de  │
                    │   verdad)    │
                    └──────┬───────┘
                           │  VueloId
              ┌────────────┼────────────┐
              │            │            │
         ┌────▼──┐   ┌─────▼────┐  ┌───▼──┐
         │  RMS  │   │  Ventas  │  │ FIDS │
         │Tarifas│   │Reservas/ │  │Pantas│
         │Disponi│   │ Boletos  │  │llas  │
         └───────┘   └──────────┘  └──────┘
```

- **AODB → RMS**: Vuelos disponibles alimentan el motor de disponibilidad  
- **AODB → FIDS**: Estado de vuelos alimenta tableros en tiempo real (SignalR)  
- **RMS → Ventas**: Tarifas y disponibilidad validan la creación de reservas  
- **Ventas → FIDS**: Reservas confirmadas actualizan contadores de ocupación  

---

## 8. CONFIGURACIÓN CLAVE — .NET 9 Program.cs

```csharp
// Aspectos clave a configurar en Program.cs
builder.Services
    .AddApplicationServices()        // MediatR, AutoMapper, FluentValidation
    .AddInfrastructureServices()     // EF Core, SQL Server, Email
    .AddIdentityServices()           // ASP.NET Identity + JWT
    .AddSwaggerGen(...)              // Swagger con Bearer auth
    .AddCors(...)                    // Política CORS para Angular
    .AddSignalR();                   // Hub para FIDS en tiempo real

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<FidsHub>("/hubs/fids");
```

---

## RESUMEN — PRIMER MÓDULO A IMPLEMENTAR

**Recomendación de secuencia de desarrollo:**

| Orden | Módulo            | Justificación                                  |
|-------|-------------------|------------------------------------------------|
| 1     | Auth / Identity   | Bloquea todo lo demás sin JWT funcionando      |
| 2     | AODB (Catálogos)  | Aerolíneas, Aeronaves, Aeropuertos — seed data |
| 3     | AODB (Vuelos)     | Entidad central del sistema                    |
| 4     | RMS               | Depende de vuelos y catálogos                  |
| 5     | Ventas            | Depende de RMS (tarifas/disponibilidad)        |
| 6     | FIDS              | Depende de vuelos (estado en tiempo real)      |

---

*¿Confirmamos arrancar con el Módulo 1 — Auth e Identity?*
