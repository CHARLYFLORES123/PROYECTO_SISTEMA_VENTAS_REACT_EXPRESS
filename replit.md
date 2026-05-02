# Sistema POS Ventas — Perfisoft

Full-stack commercial Point of Sale (POS) management system. Inspired by ventas.perfisoft.com.

## Stack

- **Frontend:** React 18 + Vite, TailStack Query, Recharts, SheetJS (xlsx) — artifact at `/`
- **Backend:** Node.js + Express, Drizzle ORM, Pino logger — artifact at `/api`
- **Database:** PostgreSQL (Replit managed)
- **Auth:** JWT (jsonwebtoken) + bcryptjs, 7-day expiry

## Architecture

```
artifacts/
  api-server/       — Express REST API (port via $PORT, base /api)
  pos-ventas/       — React/Vite SPA (port via $PORT, base /)
lib/
  db/               — Drizzle ORM schema + migrations (drizzle-kit)
  api-spec/         — OpenAPI YAML spec + Orval codegen config
  api-zod/          — Zod schemas generated from OpenAPI
  api-client-react/ — TanStack Query hooks generated from OpenAPI
```

## Database Schema

- `users` — admin accounts (email unique, bcryptjs password_hash)
- `categories` — product categories
- `products` — inventory with purchase/sale price, stock, minStock, barcode, categoryId
- `customers` — clients with NIT/CI field
- `sales` — sale header (subtotal, IVA 13%, total, paymentMethod, status)
- `sale_details` — line items per sale (productName snapshot, quantity, unitPrice)

## API Endpoints (all under /api)

- `POST /auth/login` / `POST /auth/register` / `GET /auth/me`
- `GET|POST|PUT|DELETE /categories`
- `GET|POST|PUT|DELETE /products`, `GET /products/inventory-report`
- `GET|POST|PUT|DELETE /customers`
- `GET|POST /sales`, `GET /sales/:id`, `POST /sales/:id/cancel`
- `GET /dashboard/stats`, `/dashboard/sales-chart`, `/dashboard/top-products`, `/dashboard/recent-sales`

## Frontend Pages

- `/` — Login (JWT stored in localStorage as "pos_token")
- `/register` — Register
- `/dashboard` — Stats cards + Recharts sales chart + top products + recent sales
- `/pos` — Point of Sale (reactive search, cart, IVA 13% breakdown, customer selector)
- `/products` — CRUD with category filter, low stock badge
- `/categories` — CRUD
- `/customers` — CRUD with NIT/CI
- `/sales` — Sales history with date/customer filter
- `/sales/:id` — Sale detail view
- `/inventory` — Inventory report + Excel download (SheetJS)

## Business Rules

- IVA: 13% (subtotal × 0.13 = iva, total = subtotal + iva)
- Sale transaction: validates stock → inserts sale + details → reduces stock (db.transaction)
- Sale cancel: restores stock atomically

## Demo Credentials

- Email: `admin@demo.com`
- Password: `admin123`

## DB Operations

```bash
pnpm --filter @workspace/db run push    # push schema changes
pnpm --filter @workspace/db run studio  # open Drizzle Studio
pnpm --filter @workspace/api-spec run codegen  # regenerate API hooks from OpenAPI
```
