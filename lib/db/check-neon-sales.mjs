import pg from 'pg';
const { Pool } = pg;

async function check() {
  const neon = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_iCEzx0sqaL9S@ep-round-dawn-aexfn52a-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require',
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
