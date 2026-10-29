// Vercel Serverless Function & Termux endpoint: /api/rcon-deliver
// Test koneksi RCON dan pengiriman item. Jangan pernah mengirim password RCON dari browser.

import { Rcon } from "rcon-client";

function cleanPlayerName(value) {
  return String(value || "Steve").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 16) || "Steve";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Gunakan POST." });
  }

  const body = req.body || {};
  // Konfigurasi koneksi hanya dari server environment, bukan dari request/browser.
  const host = (process.env.RCON_HOST || "216.163.186.75").trim();
  const port = Number.parseInt(process.env.RCON_PORT || "12005", 10);
  const password = process.env.RCON_PASSWORD || "";
  if (process.env.RCON_ENABLED !== "true") {
    return res.status(503).json({ delivered: false, error: "RCON_DISABLED", reason: "Set RCON_ENABLED=true di Environment Variables lalu redeploy." });
  }
  if (!password) {
    return res.status(503).json({ delivered: false, error: "RCON_PASSWORD_MISSING", reason: "RCON_PASSWORD belum diisi di Environment Variables." });
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return res.status(500).json({ delivered: false, error: "RCON_PORT_INVALID", reason: "RCON_PORT harus berupa angka 1-65535." });
  }

  const player = cleanPlayerName(body.gamertag);
  const targetPlayer = body.platform === "Bedrock" && !player.startsWith(".") ? `.${player}` : player;
  let command = "";
  const type = String(body.itemType || "");
  const item = String(body.itemName || "").replace(/[^A-Za-z0-9 _.-]/g, "").trim();

  if (body.testConnection === true) {
    command = `say [PlayNet Store] RCON connection test berhasil (${new Date().toISOString()})`;
  } else if (type === "Rank" && item) {
    const rank = item.toLowerCase().replace(/\s+/g, "");
    if (!/^[a-z0-9_-]{1,32}$/.test(rank)) return res.status(400).json({ error: "Nama rank tidak valid." });
    command = `lp user ${targetPlayer} parent add ${rank}`;
  } else if (type === "Kit" && item) {
    const kit = item.replace(/\s+Kit$/i, "").toLowerCase().replace(/\s+/g, "");
    if (!/^[a-z0-9_-]{1,32}$/.test(kit)) return res.status(400).json({ error: "Nama kit tidak valid." });
    command = `kit ${kit} ${targetPlayer}`;
  } else if (type === "Money In Game") {
    const steps = Number.parseInt(body.moneySteps, 10);
    if (!Number.isInteger(steps) || steps < 1 || steps > 1000) return res.status(400).json({ error: "moneySteps harus 1-1000." });
    command = `eco give ${targetPlayer} ${steps * 50000}`;
  } else {
    return res.status(400).json({ error: "Permintaan item tidak valid. Untuk tes, kirim {\"testConnection\":true}." });
  }

  let rcon;
  try {
    rcon = await Rcon.connect({ host, port, password, timeout: 8000 });
    const serverResponse = await rcon.send(command);
    return res.status(200).json({ delivered: true, host, port, command, serverResponse: serverResponse || "Command dikirim ke server RCON." });
  } catch (err) {
    const message = String(err?.message || err);
    console.error("RCON connection/delivery failed:", { host, port, error: message });
    return res.status(502).json({ delivered: false, host, port, error: "RCON_CONNECTION_FAILED", reason: message });
  } finally {
    if (rcon) { try { rcon.end(); } catch {} }
  }
}
