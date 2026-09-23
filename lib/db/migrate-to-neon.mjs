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

// Orden estricto respetando dependencias de Foreign Keys (FK)
const TABLES = [
  'business_settings',
  'users',
  'payment_methods',
  'categories',
  'brands',
  'suppliers',
  'customers',
  'customer_points',
  'coupons',
  'products',
  'sales',
  'sale_details',
  'quotes',
  'quote_details',
  'points_transactions',
  'audit_logs'
];

async function syncSchema(localPool, neonClient) {
  console.log('📐 [1/5] Sincronizando esquema de columnas entre Local y Neon...');

  for (const table of TABLES) {
    const lColsRes = await localPool.query(`
      SELECT column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = 'public'
    `, [table]);

    const nColsRes = await neonClient.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = 'public'
    `, [table]);

    const nColNames = new Set(nColsRes.rows.map(r => r.column_name));

    for (const col of lColsRes.rows) {
      if (!nColNames.has(col.column_name)) {
        let typeDef = col.data_type;
        if (col.data_type === 'USER-DEFINED') {
          typeDef = col.udt_name;
        } else if (col.data_type === 'character varying') {
          typeDef = 'varchar';
        } else if (col.data_type === 'numeric') {
          typeDef = 'numeric(12, 2)';
        }

        let defClause = '';
        if (col.column_default) {
          defClause = ` DEFAULT ${col.column_default}`;
        }

        console.log(`  ➕ Agregando columna "${col.column_name}" (${typeDef}) a tabla "${table}" en Neon...`);
        await neonClient.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col.column_name}" ${typeDef}${defClause};`);
      }
    }
  }

  // Asegurar que restricciones conflictivas se retiren
  await neonClient.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_unique CASCADE;`);
  await neonClient.query(`ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_key CASCADE;`);
  await neonClient.query(`DROP INDEX IF EXISTS products_barcode_unique;`);
  await neonClient.query(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);`);

  console.log('✔ Esquema de columnas sincronizado con éxito.\n');
}

async function migrate() {
  console.log('================================================================');
  console.log('🚀 INICIANDO MIGRACIÓN COMPLETA DE BASE DE DATOS LOCAL A NEON');
  console.log('================================================================\n');

  const localPool = new Pool({ connectionString: LOCAL_URL });
  const neonPool = new Pool({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false }
  });

  const neonClient = await neonPool.connect();

  try {
    // 1. Sincronizar esquema
    await syncSchema(localPool, neonClient);

    // 2. Limpiar tablas existentes en Neon de forma segura respetando FKs
    console.log('🧹 [2/5] Limpiando datos antiguos en Neon...');
    const tablesList = TABLES.map(t => `"${t}"`).join(', ');
    await neonClient.query(`TRUNCATE TABLE ${tablesList} CASCADE;`);
    console.log('✔ Tablas limpiadas en Neon con éxito.\n');

    // 3. Migrar cada tabla con lotes rápidos
    console.log('📦 [3/5] Migrando registros desde Local hacia Neon...');
    for (const table of TABLES) {
      // Columnas comunes entre local y neon
      const lCols = (await localPool.query(`
        SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position
      `, [table])).rows.map(r => r.column_name);

      const nCols = (await neonClient.query(`
        SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position
      `, [table])).rows.map(r => r.column_name);

      const columns = lCols.filter(c => nCols.includes(c));
      if (columns.length === 0) continue;

      const localData = await localPool.query(`SELECT * FROM "${table}" ORDER BY id ASC`);
      const rows = localData.rows;

      process.stdout.write(`  ⏳ ${table.padEnd(22)} (${rows.length.toString().padStart(4)} registros)... `);

      if (rows.length > 0) {
        const batchSize = 100;
        const quotedCols = columns.map(c => `"${c}"`).join(', ');

        for (let i = 0; i < rows.length; i += batchSize) {
          const chunk = rows.slice(i, i + batchSize);
          const valueClauses = [];
          const values = [];
          let pIdx = 1;

          for (const row of chunk) {
            const rowPlaceholders = [];
            for (const col of columns) {
              rowPlaceholders.push(`$${pIdx++}`);
              values.push(row[col] === undefined ? null : row[col]);
            }
            valueClauses.push(`(${rowPlaceholders.join(', ')})`);
          }

          const insertSql = `
            INSERT INTO "${table}" (${quotedCols})
            VALUES ${valueClauses.join(', ')}
          `;
          await neonClient.query(insertSql, values);
        }
      }

      console.log('✅ OK');
    }

    // 4. Actualizar secuencias autoincrementales
    console.log('\n🔢 [4/5] Actualizando secuencias de IDs (setval) en Neon...');
    for (const table of TABLES) {
      try {
        const seqRes = await neonClient.query(`
          SELECT pg_get_serial_sequence('"${table}"', 'id') as seq;
        `);
        const seq = seqRes.rows[0]?.seq;
        if (seq) {
          await neonClient.query(`
            SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM "${table}"), 1), true);
          `);
        }
      } catch (err) {
        // Ignorar tablas sin columna id autoincremental
      }
    }
    console.log('✔ Secuencias sincronizadas con éxito.\n');

    // 5. Verificación final y reporte
    console.log('📊 [5/5] VERIFICACIÓN FINAL: LOCAL vs NEON');
    console.log('----------------------------------------------------');
    let allMatches = true;

    for (const table of TABLES) {
      const lCount = (await localPool.query(`SELECT count(*) FROM "${table}"`)).rows[0].count;
      const nCount = (await neonClient.query(`SELECT count(*) FROM "${table}"`)).rows[0].count;
      const status = (lCount === nCount) ? '✅ COINCIDE' : '⚠️ DIFERENCIA';
      if (lCount !== nCount) allMatches = false;
      console.log(`${table.padEnd(25)} | Local: ${lCount.toString().padStart(4)} | Neon: ${nCount.toString().padStart(4)} | ${status}`);
    }

    console.log('\n================================================================');
    if (allMatches) {
      console.log('🎉 ¡MIGRACIÓN EXITOSA! TODOS LOS DATOS LOCALES ESTÁN EN NEON');
    } else {
      console.log('⚠️ Migración finalizada con diferencias en algunos conteos.');
    }
    console.log('================================================================\n');

  } catch (err) {
    console.error('❌ Error durante la migración:', err);
  } finally {
    neonClient.release();
    await localPool.end();
    await neonPool.end();
  }
}

migrate();
