import express from "express";
import QRCode from "qrcode";
import pkg from "pg";
import pino from "pino";
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";

const { Pool } = pkg;

const AUTH_DIR = process.env.AUTH_DIR || "./auth";
const PORT = process.env.PORT || 8080;
const POLL_INTERVAL_MS = 5000;
const REMINDER_CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly; the endpoint
// itself is idempotent per day, so more frequent checks just mean a debt
// due today gets reminded within an hour of the check window, not instantly

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const logger = pino({ level: "warn" });

let latestQrDataUrl = null;
let connectionStatus = "starting";
let sock = null;

function digitsOnly(phone) {
  return phone.replace(/[^0-9]/g, "");
}

async function sendPendingMessages() {
  if (connectionStatus !== "connected" || !sock) return;

  const { rows: jobs } = await pool.query(
    `select nj.id, nj.message, c.phone
     from notification_jobs nj
     join clients c on c.id = nj.target_client_id
     where nj.channel = 'whatsapp' and nj.status = 'pending'
     order by nj.created_at asc
     limit 20`,
  );

  for (const job of jobs) {
    await pool
      .query(`update notification_jobs set status = 'sending' where id = $1`, [job.id])
      .catch(() => {});
    try {
      const jid = `${digitsOnly(job.phone)}@s.whatsapp.net`;
      await sock.sendMessage(jid, { text: job.message });
      await pool.query(
        `update notification_jobs set status = 'sent', sent_at = now() where id = $1`,
        [job.id],
      );
      console.log(`sent whatsapp message to ${job.phone} (job ${job.id})`);
    } catch (err) {
      console.error(`failed to send whatsapp message (job ${job.id}):`, err.message);
      await pool.query(
        `update notification_jobs set status = 'failed', last_error = $2, attempts = attempts + 1 where id = $1`,
        [job.id, String(err.message).slice(0, 500)],
      );
    }
  }
}

async function connectWhatsapp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQrDataUrl = await QRCode.toDataURL(qr);
      connectionStatus = "waiting_for_scan";
      console.log("New QR code generated — open /qr to scan it");
    }

    if (connection === "open") {
      connectionStatus = "connected";
      latestQrDataUrl = null;
      console.log("WhatsApp connected");
    }

    if (connection === "close") {
      connectionStatus = "disconnected";
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log("Connection closed. Reconnecting:", shouldReconnect);
      if (shouldReconnect) {
        setTimeout(connectWhatsapp, 3000);
      } else {
        connectionStatus = "logged_out";
      }
    }
  });
}

const app = express();

app.get("/health", (_req, res) => res.json({ status: connectionStatus }));

app.get("/qr", (_req, res) => {
  if (connectionStatus === "connected") {
    return res.send("<h1>WhatsApp уже подключён ✅</h1>");
  }
  if (!latestQrDataUrl) {
    return res.send("<h1>QR код ещё не готов, обновите через несколько секунд...</h1>");
  }
  res.send(`
    <html>
      <body style="display:flex;flex-direction:column;align-items:center;font-family:sans-serif;margin-top:40px">
        <h2>Отсканируйте этот QR код из WhatsApp (магазинного номера)</h2>
        <p>WhatsApp → Настройки → Связанные устройства → Привязать устройство</p>
        <img src="${latestQrDataUrl}" width="300" height="300" />
        <p>Статус: ${connectionStatus}</p>
      </body>
    </html>
  `);
});

app.get("/", (_req, res) => res.json({ status: connectionStatus }));

app.listen(PORT, () => {
  console.log(`WhatsApp bot HTTP server listening on port ${PORT}`);
});

async function triggerReminderScan() {
  const mainAppUrl = process.env.MAIN_APP_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!mainAppUrl) return;

  try {
    const res = await fetch(
      `${mainAppUrl}/api/cron/reminders?secret=${encodeURIComponent(cronSecret || "")}`,
    );
    const body = await res.json();
    console.log("reminder scan:", body);
  } catch (err) {
    console.error("reminder scan failed:", err.message);
  }
}

setInterval(() => {
  sendPendingMessages().catch((err) => console.error("poll error:", err));
}, POLL_INTERVAL_MS);

setInterval(() => {
  triggerReminderScan();
}, REMINDER_CHECK_INTERVAL_MS);
// also run once shortly after startup so a redeploy doesn't wait a full
// hour before the first reminder scan of the day
setTimeout(triggerReminderScan, 30000);

connectWhatsapp().catch((err) => {
  console.error("Failed to start WhatsApp connection:", err);
  process.exit(1);
});
