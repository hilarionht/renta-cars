// Ayuda de DESARROLLO para la validacion manual del login de clientes en apps/mobile
// (docs/persistence/10-DECISIONES.md #131). Con NOTIFICATION_SENDER_PROVIDER=fake (default
// local) el codigo OTP no viaja por WhatsApp: el adaptador fake lo registra en
// support.fake_notification_sends (templateParams.code). Este script muestra el ultimo.
//
// Uso: npm run dev:last-otp -- +525500009001

import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

loadEnv();

async function main(): Promise<void> {
  const phone = process.argv[2];
  if (!phone) {
    throw new Error('Uso: npm run dev:last-otp -- <telefono>  (ej. +525500009001)');
  }
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const result = await db.query<{ code: string; created_at: Date }>(
      `SELECT template_params->>'code' AS code, created_at
       FROM support.fake_notification_sends
       WHERE template_id = 'customer-otp-login' AND recipient_phone = $1
       ORDER BY created_at DESC LIMIT 1`,
      [phone],
    );
    const row = result.rows[0];
    if (!row) {
      console.log(`No hay OTP para ${phone}. Pedilo primero desde la app (login de cliente).`);
      process.exitCode = 1;
      return;
    }
    console.log(`OTP para ${phone}: ${row.code}  (pedido ${row.created_at.toISOString()})`);
  } finally {
    await db.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
