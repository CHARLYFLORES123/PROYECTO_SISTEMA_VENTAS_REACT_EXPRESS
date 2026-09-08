# 🌐 Guía de Despliegue Gratuito (Demo para Clientes)

Esta guía te muestra cómo desplegar todo el sistema (**Frontend React + Backend Express + Base de Datos PostgreSQL**) a la nube de forma **100% gratuita**, con **dominio/subdominio HTTPS gratuito** (`.vercel.app` y `.onrender.com`), ideal para que tu cliente pueda probar el sistema 24/7 sin que tengas tu computadora encendida.

---

## 🏗️ Arquitectura del Despliegue Gratuito

| Componente | Servicio Gratuito | Dominio / URL Generada | Costo |
| :--- | :--- | :--- | :--- |
| **Base de Datos** | **Neon.tech** (PostgreSQL Serverless) | Cadena interna `postgresql://...` | $0 (Sin tarjeta) |
| **Backend API** | **Render.com** (Web Service Node.js) | `https://tu-pos-api.onrender.com` | $0 |
| **Frontend React** | **Vercel** (Global Edge CDN) | `https://tu-pos-ventas.vercel.app` | $0 |

> **Nota:** Ya adaptamos el código de tu proyecto (`vite.config.ts`, `lib/db/src/index.ts`, `api-server/src/index.ts` y agregamos `vercel.json`) para que soporte conexiones SSL en la nube y rutas SPA sin errores.

---

## 🚀 Paso 1: Subir tus Cambios a GitHub

Abre una terminal en la raíz del proyecto y sube las mejoras que acabamos de aplicar:

```powershell
cd "C:\Users\HP VICTUS-CORE I7\Documents\PROYECTO_SOFTWARE_VENTAS"
git add .
git commit -m "Preparar proyecto para despliegue en la nube (Vercel, Render y Neon)"
git push origin main
```

---

## 🗄️ Paso 2: Crear la Base de Datos Gratuita en Neon.tech (2 min)

1. Ingresa a **[neon.tech](https://neon.tech)** y haz clic en **Sign up** (puedes iniciar sesión con tu cuenta de GitHub).
2. Crea un nuevo proyecto:
   - **Project name:** `pos-ventas-demo`
   - **Database name:** `neondb` (por defecto)
   - **Region:** Selecciona la más cercana (ej. US East / Ohio o Virginia).
3. Una vez creado, Neon te mostrará la pantalla de conexión. Copia la cadena **Connection string** (asegúrate de que esté en formato `Pooled connection` o `Direct connection`, cualquiera funciona). Se verá algo así:
   ```text
   postgresql://neondb_owner:npg_AbCd123@ep-cool-mountain-a5xyz.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. **Ejecutar migraciones a la base de datos de Neon:**
   En tu terminal local en Windows, ejecuta:
   ```powershell
   cd "C:\Users\HP VICTUS-CORE I7\Documents\PROYECTO_SOFTWARE_VENTAS\lib\db"
   $env:DATABASE_URL="PEGA_AQUI_TU_CONEXION_DE_NEON"
   pnpm run push
   ```
   *Esto creará al instante todas las tablas (`users`, `products`, `sales`, etc.) en la nube.*

---

## ⚙️ Paso 3: Desplegar el Backend en Render.com (3 min)

1. Ingresa a **[render.com](https://render.com)** y haz clic en **Sign In** (con GitHub).
2. Haz clic en **New +** y selecciona **Web Service**.
3. Conecta tu repositorio de GitHub: `CHARLYFLORES123/PROYECTO_SISTEMA_VENTAS_REACT_EXPRESS`.
4. Configura el servicio:
   - **Name:** `pos-ventas-api` (o el nombre que prefieras).
   - **Region:** Ohio (US East) o Frankfurt.
   - **Branch:** `main`
   - **Root Directory:** *(dejar vacío)*
   - **Runtime:** `Node`
   - **Build Command:**
     ```bash
     pnpm install && pnpm --filter @workspace/api-server build
     ```
   - **Start Command:**
     ```bash
     node --enable-source-maps artifacts/api-server/dist/index.mjs
     ```
   - **Instance Type:** `Free` ($0/mo)

5. En la sección **Environment Variables**, agrega las siguientes 3 variables:
   - `DATABASE_URL` = *(Pega aquí la cadena de conexión de Neon con `?sslmode=require`)*
   - `JWT_SECRET` = `25712087eacbfd85c4551de93aaace104a462228de6d63d4cd1aebabdc2586c3`
   - `NODE_ENV` = `production`

6. Haz clic en **Deploy Web Service**.
7. Al cabo de unos 2 minutos, Render te dará tu URL HTTPS gratuita. Ejemplo:
   ```text
   https://pos-ventas-api.onrender.com
   ```
   > 💡 *Guarda esa URL, la usaremos en el Frontend.* Al iniciar, el backend creará automáticamente los usuarios demo (`vendedor@demo.com`, etc.).

---

## 💻 Paso 4: Desplegar el Frontend en Vercel (2 min)

1. Ingresa a **[vercel.com](https://vercel.com)** e inicia sesión con tu GitHub.
2. Haz clic en **Add New...** -> **Project**.
3. Selecciona tu repositorio `PROYECTO_SISTEMA_VENTAS_REACT_EXPRESS`.
4. En la pantalla de configuración:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Haz clic en **Edit** y selecciona `artifacts/pos-ventas`.
   - **Build and Output Settings:**
     - Build Command: `vite build --config vite.config.ts` (o déjalo automático).
     - Output Directory: `dist/public`
     - Install Command: `pnpm install`
5. En la sección **Environment Variables**, agrega:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://tu-pos-api.onrender.com/api` *(Usa la URL de Render que obtuviste en el Paso 3, agregándole `/api` al final)*
6. Haz clic en **Deploy**.

¡Listo! En menos de 60 segundos tendrás tu aplicación publicada con un dominio gratuito como:
👉 **`https://tu-pos-ventas.vercel.app`**

---

## ⚡ Alternativa Ultrarrápida: Demo Temporal en 2 Minutos (Túnel)

Si tienes la reunión con el cliente **hoy mismo** y no tienes tiempo de configurar cuentas en la nube:

1. Ten corriendo tu proyecto localmente (Terminal 1 Frontend en 5173, Terminal 2 API en 5000).
2. En una tercera terminal de PowerShell, ejecuta:
   ```powershell
   npx localtunnel --port 5173
   ```
   o usando **Cloudflare Tunnel** (sin registro):
   ```powershell
   winget install --id Cloudflare.cloudflared -e
   cloudflared tunnel --url http://localhost:5173
   ```
   Te generará un enlace HTTPS público temporal (ej. `https://random-words.trycloudflare.com`) que puedes enviarle a tu cliente de inmediato.

---

## 🔑 Credenciales Demo para el Cliente

| Rol | Correo | Contraseña |
| :--- | :--- | :--- |
| **Vendedor** | `vendedor@demo.com` | `vendedor123` |
| **Inventario** | `inventario@demo.com` | `inventario123` |
| **Compras** | `compras@demo.com` | `compras123` |
