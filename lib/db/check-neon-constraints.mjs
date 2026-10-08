import pg from 'pg';

const NEON_URL = 'postgresql://neondb_owner:npg_iCEzx0sqaL9S@ep-round-dawn-aexfn52a-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';
const { Pool } = pg;
const pool = new Pool({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  try {
    const res = await pool.query(`
      SELECT conname, contype, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = 'products'::regclass;
    `);
    console.log('Constraints on Neon products:');
    console.table(res.rows);
  } finally {
    await pool.end();
  }
}

check();
