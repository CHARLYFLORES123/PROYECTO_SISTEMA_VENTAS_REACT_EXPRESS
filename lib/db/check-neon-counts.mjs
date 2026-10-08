import pg from 'pg';
import fs from 'fs';

const NEON_URL = 'postgresql://neondb_owner:npg_iCEzx0sqaL9S@ep-round-dawn-aexfn52a-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';
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
