import pg from 'pg';
import fs from 'fs';

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
if (!NEON_URL) {
  console.error("❌ NEON_DATABASE_URL no está configurada en variables de entorno ni en .env");
  process.exit(1);
}

const { Pool } = pg;

async function testConnection(name, url, isSsl = false) {
  const pool = new Pool({
    connectionString: url,
    ssl: isSsl ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 5000,
  });

  try {
    const res = await pool.query('SELECT current_database(), count(*) as prod_count FROM products');
    console.log(`[${name}] Conectado a DB "${res.rows[0].current_database}". Cantidad de productos: ${res.rows[0].prod_count}`);
    const cats = await pool.query('SELECT count(*) as cat_count FROM categories');
    console.log(`[${name}] Cantidad de categorias: ${cats.rows[0].cat_count}`);
    return pool;
  } catch (err) {
    console.error(`[${name}] Error:`, err.message);
    return null;
  }
}

async function run() {
  console.log('--- Probando Local (' + LOCAL_URL + ') ---');
  const local = await testConnection('LOCAL', LOCAL_URL, false);
  if (local) await local.end();

  console.log('\n--- Probando Neon ---');
  const neon = await testConnection('NEON', NEON_URL, true);
  if (neon) await neon.end();
}

run();
