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

const LOCAL_URL = process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL || getEnvVar('DATABASE_URL', 'postgresql://postgres:12345@localhost:5432/base_datos_ventas');
const NEON_URL = process.env.NEON_DATABASE_URL || getEnvVar('NEON_DATABASE_URL');
if (!NEON_URL) {
  console.error("❌ NEON_DATABASE_URL no está configurada en variables de entorno ni en .env");
  process.exit(1);
}

const TABLES = [
  'business_settings',
  'payment_methods',
  'categories',
  'brands',
  'customers',
  'suppliers',
  'users',
  'products',
  'sales',
  'sale_details',
  'quotes',
  'quote_details',
  'customer_points',
  'points_transactions',
  'coupons',
  'audit_logs'
];

async function migrate() {
  console.log('🔄 Iniciando migración de datos locales hacia Neon...\n');

  const localPool = new Pool({ connectionString: LOCAL_URL });
  const neonPool = new Pool({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false }
  });

  const neonClient = await neonPool.connect();

  try {
    // 1. Limpiar tablas existentes en Neon de forma segura respetando FKs
    const tablesList = TABLES.map(t => `"${t}"`).join(', ');
    await neonClient.query(`TRUNCATE TABLE ${tablesList} CASCADE;`);
    console.log('✔ Tablas limpiadas en Neon con éxito.');

    // 3. Migrar cada tabla
    for (const table of TABLES) {
      // Obtener columnas
      const colRes = await localPool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position
      `, [table]);
      const columns = colRes.rows.map(r => r.column_name);

      if (columns.length === 0) continue;

      // Obtener todos los registros locales
      const localData = await localPool.query(`SELECT * FROM "${table}" ORDER BY id ASC`);
      const rows = localData.rows;

      console.log(`⏳ Migrando ${table} (${rows.length} registros)...`);

      if (rows.length > 0) {
        // Insertar en lotes de 100
        const batchSize = 100;
        for (let i = 0; i < rows.length; i += batchSize) {
          const chunk = rows.slice(i, i + batchSize);
          
          for (const row of chunk) {
            const keys = columns.filter(col => row[col] !== undefined);
            const values = keys.map(col => row[col]);
            const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(', ');
            const quotedKeys = keys.map(k => `"${k}"`).join(', ');

            const query = `
              INSERT INTO "${table}" (${quotedKeys})
              VALUES (${placeholders})
            `;
            await neonClient.query(query, values);
          }
        }
      }

      // Actualizar secuencia de autoincrementable si la tabla tiene columna 'id'
      if (columns.includes('id')) {
        try {
          await neonClient.query(`
            SELECT setval(
              pg_get_serial_sequence('"${table}"', 'id'),
              COALESCE((SELECT MAX(id) FROM "${table}"), 1),
              true
            );
          `);
        } catch (seqErr) {
          // Si no tiene secuencia serial, se ignora
        }
      }

      console.log(`✅ ${table} completada: ${rows.length} registros insertados.`);
    }

    // 4. Verificar recuentos finales en Neon
    console.log('\n📊 Verificación final de registros en Neon:');
    for (const table of TABLES) {
      const c = await neonClient.query(`SELECT count(*) FROM "${table}"`);
      console.log(`  - ${table}: ${c.rows[0].count} registros`);
    }

    console.log('\n🎉 ¡MIGRACIÓN EXITOSA A NEON COMPLETADA!');
  } catch (err) {
    console.error('❌ Error durante la migración:', err);
  } finally {
    neonClient.release();
    await localPool.end();
    await neonPool.end();
  }
}

migrate();
