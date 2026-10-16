// Smoke test de punta a punta del Reminder de reservas (docs/persistence/10-DECISIONES.md
// #121, cerrado en #131). Corre contra el entorno local real: apps/api levantado + Postgres +
// Redis, con la company demo de `npm run db:seed` (lee tooling/scripts/db/.output/dev-seed.json).
//
// Repetible: cada corrida crea su PROPIA reserva Confirmed dentro de la ventana del Reminder
// (vehiculo 2 de la demo, +1h a +3h), verifica todo filtrando por su reservationId y al final
// la cancela para liberar el vehiculo. No depende de R1/R2 del seed ni del estado previo.
//
// No espera los 15 minutos del scheduler: encola un scan manual en la misma cola BullMQ que usa
// el scheduler (reservations.reminder-scan) - el Processor real de apps/api lo consume.
//
// Chequeos (PASS/FAIL, exit code 1 si alguno falla):
//   1. el scan termina COMPLETED (antes de #124 fallaba siempre al auditar el bypass);
//   2. la reserva tiene su fila en rental.reservation_reminder_dispatches;
//   3. el proveedor fake registro el envio 'reservation-reminder' para esa reserva (antes de
//      #131 la Notification quedaba Pending: fallaba la lectura de settings en el worker);
//   4. queda auditado el bypass de RLS (PlatformAdminBypassUsed.v1);
//   5. un segundo scan NO duplica ni el dispatch ni el envio (idempotencia);
//   6. R2 del seed (fuera de la ventana) no tiene dispatch.
//
// Nunca corre en CI ni en tests.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Queue, QueueEvents } from 'bullmq';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

loadEnv();

const SEED_FILE = join(__dirname, '..', 'db', '.output', 'dev-seed.json');
const SCAN_QUEUE = 'reservations.reminder-scan';
const SEND_QUEUE = 'reservations.send-reminder';
const HOUR_MS = 60 * 60 * 1000;

interface SeedOutput {
  apiBaseUrl: string;
  companyId: string;
  admin: { email: string; password: string; userId: string };
  vehicles: { id: string }[];
  customers: { id: string }[];
  reservations: { id: string }[];
}

interface Counts {
  dispatches: number;
  sends: number;
  dispatchR2: number;
  bypassAudits: number;
}

const results: { name: string; ok: boolean; detail: string }[] = [];

function check(name: string, ok: boolean, detail: string): void {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} - ${detail}`);
}

function redisConnection(): { host: string; port: number; password?: string } {
  const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return {
    host: url.hostname === 'localhost' ? '127.0.0.1' : url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
  };
}

async function api<T>(
  seed: SeedOutput,
  method: string,
  path: string,
  body?: unknown,
  accessToken?: string,
): Promise<T> {
  const response = await fetch(`${seed.apiBaseUrl}/api/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} -> HTTP ${response.status}: ${text}`);
  }
  return (text ? (JSON.parse(text) as { data: T }).data : undefined) as T;
}

async function countEvidence(
  db: Client,
  reservationId: string,
  r2Id: string,
  since: Date,
): Promise<Counts> {
  const count = async (sql: string, params: unknown[]): Promise<number> =>
    Number((await db.query<{ n: string }>(sql, params)).rows[0].n);
  const dispatchSql =
    'SELECT count(*) AS n FROM rental.reservation_reminder_dispatches WHERE reservation_id = $1';
  return {
    dispatches: await count(dispatchSql, [reservationId]),
    dispatchR2: await count(dispatchSql, [r2Id]),
    // templateParams lleva el reservationId (SendReservationReminderProcessor).
    sends: await count(
      `SELECT count(*) AS n FROM support.fake_notification_sends
       WHERE template_id = 'reservation-reminder' AND template_params->>'reservationId' = $1`,
      [reservationId],
    ),
    bypassAudits: await count(
      `SELECT count(*) AS n FROM support.audit_log
       WHERE action = 'PlatformAdminBypassUsed.v1' AND occurred_at >= $1`,
      [since],
    ),
  };
}

async function runScan(queue: Queue, events: QueueEvents): Promise<boolean> {
  const job = await queue.add('smoke-manual-scan', {});
  try {
    await job.waitUntilFinished(events, 60_000);
    return true;
  } catch (error) {
    console.error(`  scan ${job.id} fallo: ${(error as Error).message}`);
    return false;
  }
}

// El scan encola un job por reserva en reservations.send-reminder: se espera a que esa cola
// quede vacia (sin jobs en espera, activos ni demorados) antes de contar evidencia.
async function waitForSendQueueDrained(sendQueue: Queue, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const counts = await sendQueue.getJobCounts('waiting', 'active', 'delayed');
    if (counts.waiting + counts.active + counts.delayed === 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`La cola ${SEND_QUEUE} no se vacio en ${timeoutMs}ms.`);
}

async function main(): Promise<void> {
  const seed = JSON.parse(readFileSync(SEED_FILE, 'utf8')) as SeedOutput;
  const r2Id = seed.reservations[1].id;

  const { accessToken } = await api<{ accessToken: string }>(seed, 'POST', '/auth/login', {
    companyId: seed.companyId,
    email: seed.admin.email,
    password: seed.admin.password,
  });
  const start = new Date(Date.now() + HOUR_MS);
  const reservation = await api<{ id: string }>(
    seed,
    'POST',
    '/reservations',
    {
      customerId: seed.customers[0].id,
      vehicleId: seed.vehicles[1].id,
      startDate: start.toISOString(),
      endDate: new Date(start.getTime() + 2 * HOUR_MS).toISOString(),
    },
    accessToken,
  );
  await api(seed, 'POST', `/reservations/${reservation.id}/confirm`, undefined, accessToken);
  console.log(`Reserva de smoke ${reservation.id} confirmada (inicio ${start.toISOString()}).`);

  const connection = redisConnection();
  const scanQueue = new Queue(SCAN_QUEUE, { connection });
  const sendQueue = new Queue(SEND_QUEUE, { connection });
  const events = new QueueEvents(SCAN_QUEUE, { connection });
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const startedAt = new Date();

  try {
    await events.waitUntilReady();

    const firstScanOk = await runScan(scanQueue, events);
    check('scan 1 termina COMPLETED', firstScanOk, firstScanOk ? 'ok' : 'el job fallo');
    await waitForSendQueueDrained(sendQueue);
    const first = await countEvidence(db, reservation.id, r2Id, startedAt);
    check('dispatch registrado', first.dispatches === 1, `dispatches=${first.dispatches}`);
    check('envio reservation-reminder realizado', first.sends === 1, `envios=${first.sends}`);
    check('bypass de RLS auditado', first.bypassAudits >= 1, `auditorias=${first.bypassAudits}`);

    const secondScanOk = await runScan(scanQueue, events);
    await waitForSendQueueDrained(sendQueue);
    const second = await countEvidence(db, reservation.id, r2Id, startedAt);
    check(
      'scan 2 no duplica (idempotencia)',
      secondScanOk && second.dispatches === 1 && second.sends === 1,
      `dispatches=${second.dispatches} envios=${second.sends}`,
    );
    check(
      'R2 del seed (fuera de ventana) sin dispatch',
      second.dispatchR2 === 0,
      `dispatches=${second.dispatchR2}`,
    );
  } finally {
    await db.end();
    await events.close();
    await scanQueue.close();
    await sendQueue.close();
    // Libera el vehiculo para la proxima corrida (Confirmed -> Cancelled libera el slot).
    await api(seed, 'POST', `/reservations/${reservation.id}/cancel`, undefined, accessToken).catch(
      (error: unknown) => console.error('No se pudo cancelar la reserva de smoke:', error),
    );
  }

  const failed = results.filter((result) => !result.ok).length;
  console.log(
    failed === 0 ? '\nSMOKE REMINDER: PASS' : `\nSMOKE REMINDER: FAIL (${failed} chequeo/s)`,
  );
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error('Smoke reminder fallo:', error);
  process.exitCode = 1;
});
