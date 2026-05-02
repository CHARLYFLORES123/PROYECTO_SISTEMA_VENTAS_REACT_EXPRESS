# 📊 Análisis Completo — Sistema de Ventas Perfisoft
**Stack:** Backend .NET 9 | Frontend Angular 18 | PWA instalable  
**URL Demo:** ventas.perfisoft.com | **Repositorio:** github.com/slizarzaburupezua/sistemadeventas

---

## 🗂️ MÓDULOS DEL SISTEMA (7 módulos principales)

| # | Módulo | Ruta | Descripción |
|---|--------|------|-------------|
| 1 | **Inicio** (Dashboard) | `/admin/inicio` | Panel principal con KPIs y gráficas |
| 2 | **Ventas** | `/admin/ventas/*` | Registro, historial y reportes de ventas |
| 3 | **Inventario** | `/admin/inventario/*` | Productos, categorías y marcas |
| 4 | **Clientes** | `/admin/clientes/*` | Gestión de clientes |
| 5 | **Usuarios** | `/admin/usuarios/*` | Gestión de usuarios y roles |
| 6 | **Negocio** | `/admin/negocio` | Configuración de la empresa |
| 7 | **Contacto** | `/admin/contacto` | Formulario de contacto/soporte |

---

## 1️⃣ MÓDULO: AUTENTICACIÓN

### Pantallas
- **Login** (`/sign-in`): Email + contraseña, checkbox "Recuérdame", link "¿Olvidaste tu contraseña?"
- **Recuperar contraseña** (`/forgot-password`): Ingresa email, botón "Enviar enlace"
- **Restablecer contraseña**: Formulada desde enlace enviado por correo

### Características
- JWT Authentication
- Remember me (persistencia de sesión)
- Reset por email (correo automático con enlace)
- Validaciones en tiempo real (campos requeridos marcados en rojo)

---

## 2️⃣ MÓDULO: DASHBOARD / INICIO

### Sección "Inicio" (KPIs)
| Card | Dato | Color |
|------|------|-------|
| Total Productos | 52 Registrados | Azul |
| Total Clientes | 17 Registrados | Naranja |
| Total Ventas Realizadas | GTQ/USD 481.40 | Verde |
| Total Ventas Anuladas | GTQ/USD 131,065.80 | Rojo |

### Filtro de Fechas
- Botón "Filtrar" → panel lateral con rango de fechas (Fecha Inicio / Fecha Fin)
- Actualiza todos los KPIs y gráficas en tiempo real

### Gráficas
1. **Línea** — "Total Ventas Realizadas por Fechas" (interactivo con tooltip de fecha y monto)
2. **Barras horizontales** — "Top Productos Más Vendidos" (por monto en USD)
3. **Barras horizontales** — "Top Marcas Más Vendidas" (por monto en USD)

### Sección "Colaboradores"
- Grid de tarjetas con foto de perfil, nombre y rol de cada usuario del sistema
- Roles visibles: Administrador del sistema, Vendedor, Gerente de Ventas, Encargado de Stock

### Multi-moneda
- El sistema cambia el símbolo de moneda según configuración en "Negocio"
- Visto: GTQ (Quetzal guatemalteco), USD (Dólar), EUR (Euro)

---

## 3️⃣ MÓDULO: VENTAS

### Sub-módulos (dropdown del menú)
```
Ventas
 ├── Nueva Venta         (/admin/ventas/registro)
 ├── Historial           (/admin/ventas/historial)
 ├── Reporte por Productos   (/admin/ventas/reporte-productos)
 ├── Reporte por Categorías  (/admin/ventas/reporte-categorias)
 └── Reporte por Marcas      (/admin/ventas/reporte-marcas)
```

### 3.1 Nueva Venta (`/admin/ventas/registro`)

**Panel izquierdo — Catálogo de Productos:**
- Buscador de productos (search en tiempo real con dropdown de resultados que muestra: código, nombre, stock)
- Filtros por categoría como chips/tabs: `Todos (49)`, `Aceite (9)`, `Arroz (13)`, `Condimentos (5)`, `Menestras (6)`, `Pasta (9)`, `Sal (7)`
- Grid de productos (tarjetas): Imagen, Nombre, Precio (USD/GTQ), Stock, botón "Agregar"
- La tarjeta muestra stock en 0 pero igual permite agregar (depende de configuración)

**Tabla de productos seleccionados:**
- Columnas: Imagen | Nombre | Stock (badge) | Precio | [−] Cantidad [+] | Total | Acciones (eliminar)
- Totales se recalculan en tiempo real al cambiar cantidades

**Panel derecho — Datos de la Venta:**
- **Total** (verde, prominente): se actualiza en tiempo real (USD 0.00 → USD 63.60 → USD 102.30...)
- **Fecha De Venta**: date-time picker (editable)
- **Buscar Cliente**: campo de búsqueda por Núm. Documento o Correo → muestra tarjeta con nombre y email del cliente encontrado (con botón eliminar cliente de la venta)
- **Nota adicional**: textarea libre
- **Enviar Comprobante**: checkbox — si está marcado, envía PDF por email al cliente automáticamente
- **Botón Pagar**: finaliza la venta, genera número correlativo (001-000265)

### 3.2 Historial de Ventas (`/admin/ventas/historial`)

**Tabla principal:**
| Columna | Descripción |
|---------|-------------|
| Número de Venta | Formato: `001-000265` |
| Nombre Cliente | Nombre completo (si fue asociado) |
| Correo Usuario | Email del vendedor que realizó la venta |
| Fecha Venta | Fecha y hora |
| Total Venta | Monto en moneda configurada |
| Estado | Badge: `COMPLETADO` (verde) / `ANULADO` (rojo) |
| Acciones | Menú de 3 puntos |

**Acciones por venta (menú 3 puntos):**
- Ver detalle de la venta
- Ver/Descargar boleta PDF
- **Anular venta** (cambia estado a ANULADO, muestra toast "La Venta Nro. 001-000265 ha sido anulada correctamente")

**Filtros (panel lateral):**
- Usuarios (multi-select con checkboxes: Seleccionar todos, lista de emails)
- Fecha Venta Inicio / Fecha Venta Fin
- Monto Venta Inicio / Monto Venta Fin
- Botón "Buscar"

**Exportar:** Botón para exportar a Excel/CSV

**Paginación:** Configurable (10/25/50 por página), "Página 1 de 25"

### 3.3 Boleta de Venta (PDF generado)

**Estructura del PDF:**
```
[Logo empresa]          [RUC: 05019045678655]
Nombre de la empresa    [Boleta de venta     ]
Dirección empresa       [001-000265          ]
Teléfono | Email

Cliente: [Nombre completo]        Doc: [número]
Dirección: [dirección]            Contacto: [celular]

CANT | PRODUCTO          | P.UNITARIO | TOTAL
  2  | Arroz Superior 10Kg |  $38.70   | $77.40
  1  | Aceite 250mL        |  $24.90   | $24.90
                                        $102.30

Nota Adicional:
[texto libre]
```

**Envío automático:** Si el checkbox "Enviar Comprobante" está activo, el PDF llega al email del cliente con asunto "Boleta de Venta - 001-000265"

### 3.4 Reportes de Ventas

**Reporte por Productos** (`/admin/ventas/reporte-productos`):
- Período: Desde [fecha] Hasta [fecha]
- Gráfica 1: **Barras apiladas** — "Evolución por Productos y Fechas" (cada barra = una fecha, segmentos = productos, colores únicos por producto)
- Gráfica 2: **Donut** — "Totalizado por Productos" (% de cada producto sobre el total)
- Gráfica 3: **Barras horizontales** — "Productos Destacados" (ranking por monto)
- Filtros: Fecha Inicio/Fin + multi-select de Productos (checkboxes)
- Exportar a Excel

**Reporte por Categorías** (`/admin/ventas/reporte-categorias`):
- Misma estructura visual pero agrupado por categorías

**Reporte por Marcas** (`/admin/ventas/reporte-marcas`):
- Misma estructura visual pero agrupado por marcas
- Gráfica: "Evolución por Marcas y Fechas" | "Totalizado por Marcas" | "Marcas Destacadas"

---

## 4️⃣ MÓDULO: INVENTARIO

### Sub-módulos
```
Inventario
 ├── Marcas       (/admin/inventario/marca)
 ├── Categorías   (/admin/inventario/categoria)
 └── Productos    (/admin/inventario/productos)
```

### 4.1 Marcas (`/admin/inventario/marca`)

**Tabla:**
| Columna | Descripción |
|---------|-------------|
| Nombre | Nombre de la marca (con dot de color) |
| Descripción | Texto descriptivo |
| Fecha Registro | Fecha y hora |
| Activo | Toggle on/off |
| Acciones | 👁️ Ver | ✏️ Editar | 🗑️ Eliminar |

**Crear/Editar Marca (modal):**
- Nombre*
- Descripción
- Color (picker de colores + campo HEX, paleta predefinida)
- Activo (checkbox)
- Botón Guardar / Cancelar

**Funciones adicionales:**
- Botón "+ Nuevo"
- Filtrar (panel lateral)
- **Exportar** → genera archivo `.xlsx` con columnas: Nombre Marca, Descripción, Fecha Registro, ¿Activo?
- Paginación configurable (5 por página, "Página 2 de 3")

### 4.2 Categorías (`/admin/inventario/categoria`)

**Tabla:**
| Columna | Descripción |
|---------|-------------|
| Nombre | Nombre (con dot de color) |
| Medida | Unidad de medida (ej: "Unidad") |
| [otros campos] | - |
| Activo | Toggle |
| Acciones | Ver / Editar / Eliminar |

**Crear/Editar Categoría (modal):**
- Nombre*
- Medida* (dropdown: Unidad, Kg, Litro, etc.)
- Descripción (textarea)
- Color (color picker idéntico al de Marcas, con HEX)
- Activo (checkbox)

### 4.3 Productos (`/admin/inventario/productos`)

**Tabla:**
| Columna | Descripción |
|---------|-------------|
| Imagen | Thumbnail del producto |
| Código | Ej: `00007`, `00054` (auto-generado correlativo) |
| Nombre | Nombre con dot de color de la categoría |
| Categoría | Nombre de categoría con dot de color |
| Marca | Nombre de marca con dot de color |
| Stock | Badge numérico (verde si hay stock, rojo/naranja si bajo) |
| Precio Compra | Precio en moneda configurada |
| Precio Venta | Precio en moneda configurada |
| Fecha Registro | Fecha y hora |
| Activo | Toggle |
| Acciones | Menú de 3 puntos |

**Crear Producto (modal):**
- Código* (auto-generado pero editable)
- Nombre*
- Categoría* (dropdown)
- Marca* (dropdown)
- Precio Compra*
- Precio Venta*
- Stock*
- Descripción (textarea)
- Color (picker)
- Imagen (upload — muestra "SIN IMAGEN" si no hay, se sube desde archivo)
- Botón Guardar / Cancelar

**Filtros avanzados (panel lateral):**
- Nombre (texto libre)
- Categorías (multi-select con dots de colores)
- Marcas (multi-select con dots de colores)
- Fecha Registro Inicio / Fin
- Precio Compra Inicio / Fin
- Precio Venta Inicio / Fin

**Exportar:** Genera `.xlsx`

---

## 5️⃣ MÓDULO: CLIENTES (`/admin/clientes/lista`)

**Tabla:**
| Columna | Descripción |
|---------|-------------|
| Nombres | Primer nombre |
| Apellidos | Apellido completo |
| Correo | Email (clickeable) |
| Número de Documento | DNI/RUC/Pasaporte |
| Fecha Registro | Fecha y hora |
| Activo | Toggle |
| Acciones | 👁️ Ver | ✏️ Editar | 🗑️ Eliminar |

**Crear/Editar Cliente (modal o página):**
- Nombres*
- Apellidos*
- Correo*
- Número de Documento
- Dirección
- Celular
- Activo

**Funciones:**
- Botón "+ Nuevo"
- Filtrar
- **Exportar** a Excel
- Paginación (10 por página, "Página 1 de 2")

---

## 6️⃣ MÓDULO: USUARIOS (`/admin/usuarios/lista`)

**Tabla:**
| Columna | Descripción |
|---------|-------------|
| Nombres | Primer nombre |
| Apellidos | Apellido completo |
| Rol | Rol asignado |
| Correo | Email |
| Celular | Teléfono |
| Fecha Registro | Fecha y hora |
| Activo | Toggle |
| Acciones | 👁️ Ver | ✏️ Editar | 🗑️ Eliminar |

**Roles disponibles (4 roles):**
1. **Administrador del sistema** — acceso total
2. **Encargado de Stock** — gestión de inventario
3. **Gerente de Ventas** — reportes y historial
4. **Vendedor** — solo nueva venta

**Crear Usuario (modal):**
- Tipo de Documento* (dropdown)
- Número de Documento*
- Rol* (dropdown con los 4 roles)
- Género* (dropdown)
- Nombres*
- Apellidos*
- Celular
- Dirección
- Correo Electrónico*
- Contraseña nueva*
- Confirmar Contraseña Nueva*

**Funciones:**
- Botón "+ Nuevo"
- Filtrar
- Exportar
- Paginación

---

## 7️⃣ MÓDULO: NEGOCIO (`/admin/negocio`)

**Sección "Información"** (configuración de la empresa):

**Datos de Boleta** (se muestran en todos los PDFs generados):
- Logo de la empresa (upload de imagen, recomendado 272×315px, máx 250KB)
- Razón Social*
- RUC* (número fiscal)
- Celular*
- Correo*
- Moneda* (dropdown: USD, EUR, GTQ, PEN, etc. — **afecta todo el sistema en tiempo real**)
- Fecha de Registro (auto)
- Dirección (textarea)
- Botón "Guardar"

---

## 8️⃣ CARACTERÍSTICAS TÉCNICAS / TRANSVERSALES

### PWA (Progressive Web App)
- El sistema es instalable como app de escritorio/móvil
- Muestra prompt "Instalar la app — TuPlataformaVentas (ventas.perfisoft.com)"
- Funciona offline (parcialmente)
- Responsive: adaptado para mobile (iPhone 14 Pro Max), tablet (iPad Pro), desktop

### UI/UX Patterns
- **Color principal:** Azul/Índigo (#5B21B6 aprox — botones primarios)
- **Sidebar/Nav:** Horizontal top navbar con dropdowns
- **Modales:** Para crear/editar registros (no páginas separadas)
- **Toasts/Notificaciones:** Confirmaciones de acciones (verde con ✓)
- **Dot indicators:** Puntos de color para categorías y marcas (consistente en toda la app)
- **Badges de stock:** Números en círculo (verde normal, rojo/naranja bajo)
- **Toggles:** Para activar/desactivar registros
- **Breadcrumbs:** En todas las páginas interiores
- **Paginación:** Con selector de items por página

### Exportación
- Todos los módulos de lista tienen botón "Exportar" → genera `.xlsx`
- Las boletas de venta generan `.pdf` (almacenado en Cloudinary según URL visible en el video)

### Almacenamiento de Imágenes
- Cloudinary para imágenes de productos y boletas PDF
- URL patrón: `res.cloudinary.com/dvzkgpiv3/raw/upload/v.../VentasPlatformDemo/BoletasFacturas/`

---

## 🗄️ MODELO DE BASE DE DATOS (inferido)

```sql
-- Tablas principales
Usuarios (Id, TipoDocumento, NumeroDocumento, Rol, Genero, Nombres, 
          Apellidos, Celular, Direccion, Correo, PasswordHash, Activo, FechaRegistro)

Clientes (Id, Nombres, Apellidos, Correo, NumeroDocumento, Celular, 
          Direccion, Activo, FechaRegistro)

Marcas (Id, Nombre, Descripcion, Color, Activo, FechaRegistro)

Categorias (Id, Nombre, Medida, Descripcion, Color, Activo, FechaRegistro)

Productos (Id, Codigo, Nombre, CategoriaId, MarcaId, PrecioCompra, 
           PrecioVenta, Stock, Descripcion, Color, ImagenUrl, Activo, FechaRegistro)

Ventas (Id, NumeroVenta, ClienteId, UsuarioId, FechaVenta, 
        TotalVenta, Estado, NotaAdicional, EnviarComprobante, BoletaUrl)

DetalleVentas (Id, VentaId, ProductoId, Cantidad, PrecioUnitario, Total)

Negocio (Id, RazonSocial, RUC, Celular, Correo, Moneda, 
         Direccion, LogoUrl, FechaRegistro)
```

---

## 🔑 ROLES Y PERMISOS (estimado)

| Módulo | Admin | Gerente Ventas | Vendedor | Encargado Stock |
|--------|-------|----------------|----------|-----------------|
| Dashboard | ✅ Full | ✅ Full | ✅ Limitado | ✅ Limitado |
| Nueva Venta | ✅ | ✅ | ✅ | ❌ |
| Historial | ✅ All | ✅ Sus ventas | ✅ Sus ventas | ❌ |
| Reportes | ✅ | ✅ | ❌ | ❌ |
| Inventario | ✅ | ❌ | ❌ | ✅ |
| Clientes | ✅ | ✅ | ✅ Ver | ❌ |
| Usuarios | ✅ | ❌ | ❌ | ❌ |
| Negocio | ✅ | ❌ | ❌ | ❌ |

---

## 🏗️ ARQUITECTURA DEL PROYECTO

### Estructura de Carpetas (GitHub: slizarzaburupezua/sistemadeventas)
```
sistemadeventas/
├── 0-documentacion/
│   ├── 1-Requerimientos-de-Desarrollo-Ejecucion.docx
│   ├── 2-Manual-Instalacion.docx
│   ├── 3-Video Manual de Instalación.txt
│   └── 4-Video Manual de Publicación y Despliegue en Hosting Smarte...
├── 1-scripts/          (scripts SQL)
├── 2-backend/          (.NET 9 API)
├── 3-frontend/         (Angular 18)
├── .gitignore
└── README.md
```

### Backend (.NET 9)
- **Arquitectura:** API REST
- **Autenticación:** JWT Bearer Tokens
- **ORM:** Entity Framework Core (SQL Server — visto "SQL Server Management Studio" en desktop)
- **Servicios externos:** Cloudinary (imágenes y PDFs), SendGrid o similar (emails)
- **Patrón:** Repository Pattern + Service Layer

**Endpoints inferidos:**
```
POST   /api/auth/login
POST   /api/auth/forgot-password
POST   /api/auth/reset-password

GET    /api/dashboard?fechaInicio=&fechaFin=
GET    /api/dashboard/top-productos
GET    /api/dashboard/top-marcas

GET    /api/ventas/historial
POST   /api/ventas
PUT    /api/ventas/{id}/anular
GET    /api/ventas/reporte-productos
GET    /api/ventas/reporte-categorias
GET    /api/ventas/reporte-marcas
GET    /api/ventas/exportar

GET    /api/clientes
POST   /api/clientes
PUT    /api/clientes/{id}
DELETE /api/clientes/{id}

GET    /api/inventario/marcas
POST   /api/inventario/marcas
PUT    /api/inventario/marcas/{id}
DELETE /api/inventario/marcas/{id}
GET    /api/inventario/marcas/exportar

GET    /api/inventario/categorias
POST   /api/inventario/categorias
[...]

GET    /api/inventario/productos
POST   /api/inventario/productos
[...]

GET    /api/usuarios
POST   /api/usuarios
[...]

GET    /api/negocio
PUT    /api/negocio
```

### Frontend (Angular 18)
- **Arquitectura:** Standalone Components + Signals
- **Routing:** Lazy loading por módulo
- **Estado:** Servicios + RxJS
- **UI Library:** Angular Material o equivalente personalizado
- **Charts:** Chart.js o NgRx Charts (gráficas de barras, línea, donut)
- **PDF:** PDF viewer nativo del browser (boletas desde Cloudinary)
- **Export Excel:** SheetJS o similar
- **PWA:** @angular/pwa configurado

---

## 🚀 PLAN DE RECREACIÓN — ORDEN DE DESARROLLO

### FASE 1 — Base del Proyecto
1. Setup .NET 9 API + Entity Framework + SQL Server
2. Setup Angular 18 + estructura de módulos
3. Base de datos + migraciones
4. Autenticación JWT completa

### FASE 2 — Módulos Core
5. CRUD Marcas
6. CRUD Categorías  
7. CRUD Productos (con upload de imagen a Cloudinary)
8. CRUD Clientes
9. CRUD Usuarios + roles

### FASE 3 — Ventas
10. Nueva Venta (el más complejo — catálogo + carrito + pago)
11. Generación de PDF (boleta)
12. Envío por email (SendGrid/SMTP)
13. Historial de Ventas + anulación

### FASE 4 — Reportes y Dashboard
14. Dashboard KPIs + gráficas
15. Reporte por Productos
16. Reporte por Categorías
17. Reporte por Marcas
18. Exportación a Excel

### FASE 5 — Configuración y PWA
19. Módulo Negocio (configuración empresa + moneda)
20. PWA manifest + service worker
21. Responsive (mobile/tablet)
22. Guards de roles y permisos

---

*Análisis basado en video demo del sistema — 40 frames analizados, ~10 minutos de contenido*
