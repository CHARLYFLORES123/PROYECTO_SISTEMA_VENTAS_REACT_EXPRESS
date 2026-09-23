import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
console.log('DATABASE_URL:', process.env.DATABASE_URL);

const isCloudOrProd =
  process.env.NODE_ENV === "production" ||
  Boolean(process.env.DATABASE_URL?.includes("sslmode=require")) ||
  Boolean(process.env.DATABASE_URL?.includes("neon.tech")) ||
  Boolean(process.env.DATABASE_URL?.includes("supabase.co"));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isCloudOrProd ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  try {
    const res = await pool.query('SELECT current_database(), current_user, version()');
    console.log('Connected to DB:', res.rows[0]);

    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Tables:', tables.rows.map(r => r.table_name));

    const productCols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'products'
      ORDER BY ordinal_position;
    `);
    console.log('Columns in products table:');
    console.table(productCols.rows);

    const productCount = await pool.query('SELECT COUNT(*) FROM products');
    console.log('Product count:', productCount.rows[0].count);

    const catCount = await pool.query('SELECT COUNT(*) FROM categories');
    console.log('Category count:', catCount.rows[0].count);

  } catch (err) {
    console.error('Error connecting to DB:', err);
  } finally {
    await pool.end();
  }
}

main();
