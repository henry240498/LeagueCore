// Siembra el usuario admin por defecto (admin/123456, password_temp_reset=true).
// Idempotente: no hace nada si el usuario "admin" ya existe.
// Uso: node scripts/seed-admin.js  (desde src/backend, con .env cargado)

require('dotenv/config');
const bcrypt = require('bcryptjs');
const sql = require('mssql');

async function main() {
  const pool = await sql.connect({
    server: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 1433),
    database: process.env.DB_NAME ?? 'LeagueCore',
    user: process.env.DB_USER ?? 'sa',
    password: process.env.DB_PASSWORD ?? '',
    options: { encrypt: false, trustServerCertificate: true },
  });

  const existing = await pool
    .request()
    .input('username', sql.NVarChar, 'admin')
    .query('SELECT id FROM dbo.users WHERE username = @username');

  if (existing.recordset.length > 0) {
    console.log('El usuario "admin" ya existe, no se hizo nada.');
    await pool.close();
    return;
  }

  const hash = await bcrypt.hash('123456', 10);
  await pool
    .request()
    .input('username', sql.NVarChar, 'admin')
    .input('password_hash', sql.NVarChar, hash)
    .input('display_name', sql.NVarChar, 'Administrador')
    .input('role', sql.NVarChar, 'admin')
    .query(
      `INSERT INTO dbo.users (username, password_hash, display_name, role, password_temp_reset)
       VALUES (@username, @password_hash, @display_name, @role, 1)`,
    );

  console.log('Usuario "admin" creado con contraseña temporal "123456".');
  await pool.close();
}

main().catch((err) => {
  console.error('Error al sembrar el usuario admin:', err);
  process.exit(1);
});
