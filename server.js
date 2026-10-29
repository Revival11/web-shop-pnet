// Runner Lokal untuk Termux / Node.js (Menjalankan index.html + folder /api seperti di Vercel)
import http from "http";
import readline from "readline";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import createTransactionHandler from "./api/create-transaction.js";
import midtransWebhookHandler from "./api/midtrans-webhook.js";
import mcStatusHandler from "./api/mc-status.js";
import rconDeliverHandler from "./api/rcon-deliver.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Otomatis baca file .env jika ada
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

const PORT = process.env.PORT || 3000;

function enhanceRes(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    if (!res.getHeader("Content-Type")) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.end(JSON.stringify(data));
    return res;
  };
  return res;
}

const server = http.createServer(async (req, res) => {
  enhanceRes(res);
  const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = urlObj.pathname;

  // Parse JSON body untuk request POST
  if (req.method === "POST") {
    let rawBody = "";
    for await (const chunk of req) {
      rawBody += chunk;
    }
    try {
      req.body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      req.body = {};
    }
  }

  // Routing API persis seperti Vercel Serverless Functions
  if (pathname === "/api/create-transaction") {
    return createTransactionHandler(req, res);
  }
  if (pathname === "/api/midtrans-webhook") {
    return midtransWebhookHandler(req, res);
  }
  if (pathname === "/api/mc-status") {
    return mcStatusHandler(req, res);
  }
  if (pathname === "/api/rcon-deliver") {
    return rconDeliverHandler(req, res);
  }

  // Serve index.html
  const indexPath = path.join(__dirname, "index.html");
  if (fs.existsSync(indexPath)) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.statusCode = 200;
    return res.end(fs.readFileSync(indexPath));
  }

  res.status(404).json({ error: "File tidak ditemukan" });
});



// Console interaktif untuk debugging RCON langsung dari terminal Termux.
// Tidak memerlukan transaksi Midtrans untuk menguji command Minecraft.
function startDebugConsole() {
  if (!process.stdin.isTTY) return;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "pnet> " });
  let busy = false;

  const help = () => {
    console.log(`\nPlayNet Debug Console\n  help                         Tampilkan bantuan\n  rcon status                  Cek koneksi RCON + jalankan command list\n  rcon cmd <command>           Kirim command Minecraft bebas via RCON\n  give <player> <item> [jumlah] Shortcut /give\n  say <pesan>                  Kirim pesan ke chat server\n  exit                         Matikan server lokal\n\nContoh:\n  rcon cmd list\n  rcon cmd lp user Steve info\n  give Steve diamond 5\n  say Testing PlayNet Store\n`);
  };

  async function sendRcon(command) {
    const host = (process.env.RCON_HOST || "216.163.186.75").trim();
    const port = Number.parseInt(process.env.RCON_PORT || "12005", 10);
    const password = process.env.RCON_PASSWORD || "";
    if (process.env.RCON_ENABLED !== "true") throw new Error("RCON_ENABLED bukan true di .env");
    if (!password) throw new Error("RCON_PASSWORD belum diisi di .env");
    if (!command.trim()) throw new Error("Command kosong");
    const { Rcon } = await import("rcon-client");
    const rcon = await Rcon.connect({ host, port, password, timeout: 8000 });
    try {
      return await rcon.send(command);
    } finally {
      try { rcon.end(); } catch {}
    }
  }

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }
    const [first, second, ...rest] = input.split(/\s+/);
    const action = first.toLowerCase();
    const remainder = input.slice(first.length).trim();
    if (action === "exit" || action === "quit") {
      rl.close(); server.close(() => process.exit(0)); return;
    }
    if (action === "help") { help(); rl.prompt(); return; }
    if (busy) { console.log("Command sebelumnya masih berjalan, tunggu dulu."); rl.prompt(); return; }
    let command = "";
    if (action === "rcon" && second?.toLowerCase() === "status") command = "list";
    else if (action === "rcon" && second?.toLowerCase() === "cmd") command = rest.join(" ");
    else if (action === "say") command = `say ${remainder}`;
    else if (action === "give") {
      const parts = remainder.split(/\s+/);
      if (parts.length < 2 || parts.length > 3) {
        console.log("Format: give <player> <item> [jumlah]"); rl.prompt(); return;
      }
      const [player, item, amount = "1"] = parts;
      if (!/^[A-Za-z0-9_.-]{1,16}$/.test(player) || !/^[A-Za-z0-9_:.-]{1,100}$/.test(item) || !/^\d{1,4}$/.test(amount) || Number(amount) < 1) {
        console.log("Player/item/jumlah tidak valid."); rl.prompt(); return;
      }
      command = `give ${player} ${item} ${amount}`;
    } else {
      console.log('Command tidak dikenal. Ketik "help".'); rl.prompt(); return;
    }
    busy = true;
    try {
      console.log(`→ RCON: ${command}`);
      const result = await sendRcon(command);
      console.log(`← ${result || "Command terkirim (server tidak mengembalikan teks)."}`);
    } catch (err) {
      console.error(`RCON ERROR: ${err?.message || err}`);
    } finally {
      busy = false;
      rl.prompt();
    }
  });
  rl.on("close", () => console.log("Console debug ditutup."));
  console.log('\nConsole debug aktif. Ketik "help" untuk daftar command.');
  rl.prompt();
}

server.listen(PORT, "0.0.0.0", () => {
  console.log("==================================================");
  console.log("🚀 PlayNet SMP Store aktif di Termux!");
  console.log(`🌐 Buka di browser HP: http://localhost:${PORT}`);
  console.log("🔑 Status Midtrans Server Key:", process.env.MIDTRANS_SERVER_KEY ? "Terpasang ✅" : "Belum diisi di .env ⚠️ (Mode Simulasi Aktif)");
  console.log("🎮 Status RCON Minecraft:", process.env.RCON_ENABLED === "true" ? `Aktif (${process.env.RCON_HOST}:${process.env.RCON_PORT}) ✅` : "Belum aktif di .env ⚠️ (Set RCON_ENABLED=true untuk auto-give rank)");
  console.log("==================================================");
  startDebugConsole();
});
