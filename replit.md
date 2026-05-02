# Sistema POS Ventas — Perfisoft

Full-stack commercial Point of Sale (POS) and business management system. Inspired by ventas.perfisoft.com.

## Stack

- **Frontend:** React 18 + Vite, TanStack Query, Recharts, SheetJS (xlsx), date-fns — artifact at `/`
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

## Database Schema (12 tables)

- `users` — admin accounts (email unique, bcryptjs password_hash, role: admin|vendedor)
- `categories` — product categories
- `brands` — product brands
- `products` — inventory (purchasePrice, salePrice, stock, minStock, barcode, categoryId, brandId, imageUrl)
- `customers` — clients with NIT/CI field
- `suppliers` — product suppliers (company, contact, phone, email, address)
- `sales` — sale header (subtotal, IVA 13%, total, paymentMethod, status, userId)
- `sale_details` — line items (productName snapshot, quantity, unitPrice)
- `quotes` — quote/proforma header (status: pendiente|convertida|vencida, validUntil, convertedSaleId)
- `quote_details` — quote line items
- `business_settings` — company name, RUC/NIT, logo, currency (auto-created on first GET)
- `payment_methods` — configurable payment methods (name, description, isActive)

## API Endpoints (all under /api, JWT required except auth)

- `POST /auth/login` / `POST /auth/register` / `GET /auth/me`
- `GET|POST|PUT|DELETE /categories`
- `GET|POST|PUT|DELETE /brands`
- `GET|POST|PUT|DELETE /products`, `GET /products/inventory-report`
- `GET|POST|PUT|DELETE /customers`
- `GET|POST|PUT|DELETE /suppliers`
- `GET|POST /sales`, `GET /sales/:id`, `POST /sales/:id/cancel`
- `GET|POST /quotes`, `GET /quotes/:id`, `POST /quotes/:id/convert`
- `GET|PUT /business-settings` (auto-init default on first GET)
- `GET|POST|PUT|DELETE /payment-methods`
- `GET|POST|PUT|DELETE /users` (user management)
- `GET /dashboard/stats`, `/dashboard/sales-chart`, `/dashboard/top-products`, `/dashboard/recent-sales`
- `GET /reports/sales-by-user`, `/reports/by-category`, `/reports/stock-alerts`

## Frontend Pages (17 total)

- `/` — Login (JWT stored in localStorage as "pos_token")
- `/register` — Register
- `/dashboard` — Stats cards + Recharts sales chart + top products + recent sales
- `/pos` — Point of Sale (brand filter, dynamic payment methods, IVA 13%, customer selector)
- `/products` — CRUD with category/brand filter, imageUrl, low stock badge
- `/categories` — CRUD
- `/customers` — CRUD with NIT/CI
- `/sales` — Sales history with date/customer/user filter
- `/sales/:id` — Sale detail view
- `/inventory` — Inventory report + Excel download (SheetJS)
- `/brands` — Brand management CRUD
- `/suppliers` — Supplier management CRUD
- `/quotes` — Quotes/proformas with convert-to-sale action
- `/settings` — Business settings (company name, RUC, logo, currency)
- `/payment-methods` — Payment method configuration with active toggle
- `/users` — User management CRUD (admin/vendedor roles)
- `/reports` — Sales by user, by category (charts + export), stock alerts

## Business Rules

- IVA: 13% (subtotal × 0.13 = iva, total = subtotal + iva)
- Sale transaction: validates stock → inserts sale + details → reduces stock (db.transaction)
- Sale cancel: restores stock atomically
- Quote convert-to-sale: validates stock, creates sale transaction, marks quote as "convertida"
- Business settings: auto-creates default row on first GET if none exists
- Currency: dynamic from business_settings (default BOB / Bs), propagated via CurrencyContext

## Demo Credentials

- Email: `admin@demo.com`
- Password: `admin123`

## DB Operations

```bash
pnpm --filter @workspace/db run push    # push schema changes
pnpm --filter @workspace/db run studio  # open Drizzle Studio
pnpm --filter @workspace/api-spec run codegen  # regenerate API hooks from OpenAPI
```
