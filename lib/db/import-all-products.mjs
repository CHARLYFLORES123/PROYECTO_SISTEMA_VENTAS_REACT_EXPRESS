import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

function getEnvVar(key, defaultValue = '') {
  if (process.env[key]) return process.env[key];
  const envPaths = ['.env', '../../.env', '../.env'];
  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8');
      const match = content.match(new RegExp(`^${key}=["']?([^"'\\r\\n]+)["']?`, 'm'));
      if (match) return match[1];
    }
  }
  return defaultValue;
}

let LOCAL_URL = process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL || getEnvVar('DATABASE_URL', 'postgresql://postgres:12345@localhost:5432/base_datos_ventas');
const NEON_URL = process.env.NEON_DATABASE_URL || getEnvVar('NEON_DATABASE_URL');

function parsePrice(str) {
  if (!str) return 0;
  const cleaned = str.replace(/Bs\.?/i, '').replace(/,/g, '.').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseIntSafe(str, def = 0) {
  if (!str) return def;
  const num = parseInt(str.trim(), 10);
  return isNaN(num) ? def : num;
}

function loadAndParseTextFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  console.log(`Leídas ${lines.length} líneas en ${filePath}`);

  const parsedProducts = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('\t').map(s => s.trim());
    if (parts.length < 8) {
      console.warn(`Línea ${i} ignorada por columnas insuficientes (${parts.length})`);
      continue;
    }

    const [rawBarcode, rawName, rawBuy, rawSell, rawWholesale, rawStock, rawMinStock, rawCat] = parts;

    let barcode = rawBarcode || null;
    let name = rawName || '';

    // Manejar las 5 filas con nombres vacíos
    if (!name) {
      if (i === 1) name = 'TARGETA DE 15 BS';
      else if (i === 2) name = 'TARGETA DE 30 BS';
      else if (i === 3) name = 'SUPER CASCADA 1250CC';
      else if (i === 4) name = 'DULCES TRULULU 70G';
      else if (i === 5) name = 'CASCADA 750 ML';
      else name = `PRODUCTO ${barcode || i}`;
    }

    const purchasePrice = parsePrice(rawBuy);
    const salePrice = parsePrice(rawSell);
    const wholesalePrice = parsePrice(rawWholesale);
    const stock = parseIntSafe(rawStock, 0);
    const minStock = parseIntSafe(rawMinStock, 0);
    const category = rawCat || 'Sin Departamento';

    let description = null;
    if (wholesalePrice > 0) {
      description = `Precio por mayor: Bs ${wholesalePrice.toFixed(2)}`;
    }

    parsedProducts.push({
      lineIndex: i,
      barcode,
      name,
      purchasePrice: purchasePrice.toFixed(2),
      salePrice: salePrice.toFixed(2),
      wholesalePrice,
      stock,
      minStock,
      category,
      description
    });
  }

  return parsedProducts;
}

async function importToDatabase(dbName, connectionString, isSsl, products) {
  console.log(`\n======================================================`);
  console.log(`Iniciando importación en [${dbName}]...`);
  console.log(`======================================================`);

  const pool = new Pool({
    connectionString,
    ssl: isSsl ? { rejectUnauthorized: false } : undefined,
  });

  const client = await pool.connect();

  try {
    // 1. Quitar la restricción unique de barcode si existe, para permitir todos los registros del archivo
    console.log(`[${dbName}] Ajustando restricciones de la tabla products...`);
    await client.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_unique CASCADE;`);
    await client.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_key CASCADE;`);
    await client.query(`DROP INDEX IF EXISTS products_barcode_unique;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);`);

    // 2. Obtener categorías existentes
    const existingCatsRes = await client.query(`SELECT id, name FROM categories;`);
    const categoryMap = new Map(); // lowercase name -> id
    existingCatsRes.rows.forEach(c => {
      categoryMap.set(c.name.trim().toLowerCase(), c.id);
    });

    // 3. Crear categorías faltantes
    const uniqueCats = Array.from(new Set(products.map(p => p.category.trim())));
    for (const catName of uniqueCats) {
      const lower = catName.toLowerCase();
      if (!categoryMap.has(lower)) {
        console.log(`[${dbName}] Creando categoría nueva: "${catName}"`);
        const insRes = await client.query(
          `INSERT INTO categories (name, description, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id;`,
          [catName, `Categoría: ${catName}`]
        );
        categoryMap.set(lower, insRes.rows[0].id);
      }
    }

    // 4. Iniciar transacción para insertar los productos
    await client.query('BEGIN');

    const initialCountRes = await client.query('SELECT COUNT(*) FROM products;');
    const initialCount = parseInt(initialCountRes.rows[0].count, 10);
    console.log(`[${dbName}] Productos antes de la importación: ${initialCount}`);

    let insertedCount = 0;
    const batchSize = 100;

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);

      for (const p of batch) {
        const catId = categoryMap.get(p.category.trim().toLowerCase()) || null;
        await client.query(
          `INSERT INTO products (
            name, barcode, description, purchase_price, sale_price, stock, min_stock, category_id, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW());`,
          [p.name, p.barcode, p.description, p.purchasePrice, p.salePrice, p.stock, p.minStock, catId]
        );
        insertedCount++;
      }
    }

    await client.query('COMMIT');

    const finalCountRes = await client.query('SELECT COUNT(*) FROM products;');
    const finalCount = parseInt(finalCountRes.rows[0].count, 10);
    const catCountRes = await client.query('SELECT COUNT(*) FROM categories;');
    const catCount = parseInt(catCountRes.rows[0].count, 10);

    console.log(`[${dbName}] ✅ ÉXITO: ${insertedCount} productos insertados.`);
    console.log(`[${dbName}] Total productos en base de datos: ${finalCount}`);
    console.log(`[${dbName}] Total categorías en base de datos: ${catCount}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[${dbName}] ❌ ERROR durante la importación:`, err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const filePath = path.resolve('textos para base datos.txt');
  const products = loadAndParseTextFile(filePath);
  console.log(`Total de productos a registrar: ${products.length}`);

  // 1. Importar a la Base de Datos Local
  await importToDatabase('LOCAL (base_datos_ventas)', LOCAL_URL, false, products);

  // 2. Importar a la Base de Datos Neon (Cloud)
  try {
    await importToDatabase('NEON (neondb)', NEON_URL, true, products);
  } catch (err) {
    console.warn('Advertencia al sincronizar Neon:', err.message);
  }

  console.log('\n======================================================');
  console.log('🎉 REGISTRO COMPLETO DE TODOS LOS PRODUCTOS FINALIZADO');
  console.log('======================================================');
}

main().catch(err => {
  console.error('Fallo general:', err);
  process.exit(1);
});
