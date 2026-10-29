// Vercel Serverless Function: /api/midtrans-webhook
// Menerima Payment Notification (Webhook) dari Midtrans & otomatis mengirim item ke Server Minecraft via RCON

import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const serverKey = process.env.MIDTRANS_SERVER_KEY || "";
    const notification = req.body || {};

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      custom_field1: gamertag,
      custom_field2: platform,
      custom_field3: itemMeta
    } = notification;

    // 1. Verifikasi SHA512 Signature Key dari Midtrans
    const rawSignature = `${order_id}${status_code}${gross_amount}${serverKey}`;
    const expectedSignature = crypto.createHash("sha512").update(rawSignature).digest("hex");

    if (signature_key !== expectedSignature) {
      console.warn("Invalid Midtrans Signature untuk order:", order_id);
      return res.status(403).json({ message: "Invalid Signature Key" });
    }

    // 2. Cek apakah pembayaran sudah lunas (settlement / capture)
    const isPaid =
      transaction_status === "settlement" ||
      (transaction_status === "capture" && fraud_status === "accept");

    if (isPaid && gamertag && itemMeta) {
      const [itemType, itemName, moneyStepsStr] = itemMeta.split("|");
      // Untuk pemain Bedrock dengan Floodgate, biasanya memakai titik di depan nama jika belum ada
      const targetPlayer =
        platform === "Bedrock" && !gamertag.startsWith(".") ? `.${gamertag}` : gamertag;

      let mcCommand = "";
      if (itemType === "Rank") {
        mcCommand = `lp user ${targetPlayer} parent add ${itemName.toLowerCase()}`;
      } else if (itemType === "Kit") {
        const kitSlug = itemName.replace(/\s+Kit$/i, "").toLowerCase();
        mcCommand = `kit ${kitSlug} ${targetPlayer}`;
      } else if (itemType === "Money In Game") {
        const steps = parseInt(moneyStepsStr, 10) || 1;
        const amount = steps * 50000;
        mcCommand = `eco give ${targetPlayer} ${amount}`;
      }

      // 3. Jika RCON diaktifkan di Environment Variables Vercel, kirim command ke server Minecraft
      if (process.env.RCON_ENABLED === "true" && mcCommand) {
        try {
          const { Rcon } = await import("rcon-client");
          const rcon = await Rcon.connect({
            host: process.env.RCON_HOST || "216.163.186.75",
            port: parseInt(process.env.RCON_PORT || "12005", 10),
            password: process.env.RCON_PASSWORD || ""
          });
          await rcon.send(mcCommand);
          await rcon.send(`say [PlayNet Store] Terima kasih ${gamertag} telah membeli ${itemName}!`);
          rcon.end();
        } catch (rconErr) {
          console.error("Gagal menjalankan RCON:", rconErr);
        }
      }
    }

    return res.status(200).json({ status: "OK", order_id, transaction_status });
  } catch (err) {
    console.error("Webhook Error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}
