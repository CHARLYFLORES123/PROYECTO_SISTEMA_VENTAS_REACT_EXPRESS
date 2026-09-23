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

const NEON_URL = process.env.NEON_DATABASE_URL || getEnvVar('NEON_DATABASE_URL');
if (!NEON_URL) {
  console.error("❌ NEON_DATABASE_URL no está configurada en variables de entorno ni en .env");
  process.exit(1);
}
const { Pool } = pg;
const pool = new Pool({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });

async function checkNeon() {
  try {
    const res = await pool.query('SELECT count(*) FROM products');
    console.log('Neon product count:', res.rows[0].count);
    const catRes = await pool.query('SELECT count(*) FROM categories');
    console.log('Neon category count:', catRes.rows[0].count);
  } finally {
    await pool.end();
  }
}

checkNeon();
