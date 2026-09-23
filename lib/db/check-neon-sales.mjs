import pg from 'pg';
import fs from 'fs';
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

const NEON_URL = process.env.NEON_DATABASE_URL || getEnvVar('NEON_DATABASE_URL');
if (!NEON_URL) {
  console.error("❌ NEON_DATABASE_URL no está configurada en variables de entorno ni en .env");
  process.exit(1);
}

async function check() {
  const neon = new Pool({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const customers = await neon.query('SELECT id, name, email FROM customers ORDER BY id');
    console.log('=== CLIENTES EN NEON ===');
    console.table(customers.rows);

    const sales = await neon.query(`
      SELECT s.id, s.customer_id, c.name as customer_name, c.email as customer_email, s.total, s.created_at 
      FROM sales s 
      LEFT JOIN customers c ON s.customer_id = c.id 
      ORDER BY s.id DESC LIMIT 5
    `);
    console.log('=== ÚLTIMAS VENTAS EN NEON ===');
    console.table(sales.rows);
  } finally {
    await neon.end();
  }
}

check();
