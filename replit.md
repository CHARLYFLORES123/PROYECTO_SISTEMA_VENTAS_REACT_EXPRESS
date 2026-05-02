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

## Database Schema (14 tables)

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
- `business_settings` — company name, RUC/NIT, logo, currency, loyalty config (loyaltyEnabled, pointsPerUnit, pointsRedemptionRate)
- `payment_methods` — configurable payment methods (name, description, isActive)
- `customer_points` — points balance per customer (points, lifetimeEarned, lifetimeRedeemed)
- `points_transactions` — points history (delta, type: earned|redeemed|adjusted, saleId, notes)

## API Endpoints (all under /api, JWT required except auth)

- `POST /auth/login` / `POST /auth/register` / `GET /auth/me`
- `GET|POST|PUT|DELETE /categories`
- `GET|POST|PUT|DELETE /brands`
- `GET|POST|PUT|DELETE /products`, `GET /products/inventory-report`
- `GET|POST|PUT|DELETE /customers`
- `GET|POST|PUT|DELETE /suppliers`
- `GET|POST /sales`, `GET /sales/:id`, `POST /sales/:id/cancel`
- `GET|POST /quotes`, `GET /quotes/:id`, `POST /quotes/:id/convert`
- `GET|PUT /business-settings` (auto-init default on first GET; includes loyaltyEnabled, pointsPerUnit, pointsRedemptionRate)
- `GET /loyalty/leaderboard`, `GET /loyalty/balance/:id`, `GET /loyalty/history/:id`, `GET /loyalty/tiers`, `POST /loyalty/redeem`, `POST /loyalty/adjust`
- `GET /coupons`, `GET /coupons/customer/:id`, `POST /coupons/validate`, `POST /coupons/redeem`
- `GET|POST|PUT|DELETE /payment-methods`
- `GET|POST|PUT|DELETE /users` (user management)
- `GET /dashboard/stats`, `/dashboard/sales-chart`, `/dashboard/top-products`, `/dashboard/recent-sales`
- `GET /reports/sales-by-user`, `/reports/by-category`, `/reports/stock-alerts`

## Visual Design (Phase 3 — Perfisoft Clone)

Implemented full Perfisoft visual redesign:
- **Colors:** Primary `#4F46E5` (indigo), Background `#EEF0F5` (light blue-gray), White cards
- **Sidebar:** White background, grouped nav sections, indigo active items with chevron
- **Buttons:** Pill-shaped (`rounded-full`) for primary actions, matching Perfisoft exactly
- **Login:** Floating labels, eye toggle, pill button, logo icon, demo credentials hint
- **Dashboard:** 4 KPI cards, area chart (sales by date), top products bar, top sellers bar, recent sales table
- **POS:** Category chip filters (pill-shaped), product grid with stock badges, cart panel with thumbnails
- **Sales:** Formatted sale numbers (#000001), action menu (view/cancel), export to Excel, filter panel

## Frontend Pages (19 total)

- `/` — Login (JWT stored in localStorage as "pos_token")
- `/register` — Register
- `/dashboard` — 4 KPI cards + area chart + top products + top sellers + recent sales table
- `/pos` — Point of Sale (category chips filter, product grid, cart panel, pill pay button, loyalty points display + redemption)
- `/products` — CRUD with category/brand filter, imageUrl, low stock badge
- `/categories` — CRUD
- `/customers` — CRUD with NIT/CI + "Extracto" button
- `/customers/:id/statement` — Customer account statement with PDF export
- `/sales` — Sales history with date/customer/user filter
- `/sales/:id` — Sale detail view
- `/inventory` — Inventory report + Excel download (SheetJS)
- `/brands` — Brand management CRUD
- `/suppliers` — Supplier management CRUD
- `/quotes` — Quotes/proformas with convert-to-sale action
- `/loyalty` — Loyalty/points program leaderboard with history + manual adjust
- `/settings` — Business settings + loyalty program configuration (toggle, pointsPerUnit, redemptionRate)
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
- Loyalty: `pointsPerUnit` points earned per currency unit of `total`; `pointsRedemptionRate` = value in currency per point; redemption is transactional (deducted before sale creation); points awarded non-fatally after sale; manual adjust available from /loyalty page

## Demo Credentials

- Email: `admin@demo.com`
- Password: `admin123`

## DB Operations

```bash
pnpm --filter @workspace/db run push    # push schema changes
pnpm --filter @workspace/db run studio  # open Drizzle Studio
pnpm --filter @workspace/api-spec run codegen  # regenerate API hooks from OpenAPI
```
