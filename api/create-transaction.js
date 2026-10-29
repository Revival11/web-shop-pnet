// Vercel Serverless Function: /api/create-transaction
// Membuat Snap Token Midtrans secara aman dari sisi Server

const CATALOG = {
  "rank:Warrior": { name: "Rank Warrior", price: 5000, category: "Rank" },
  "rank:Slayer": { name: "Rank Slayer", price: 10000, category: "Rank" },
  "rank:Elite": { name: "Rank Elite", price: 20000, category: "Rank" },
  "rank:Emperor": { name: "Rank Emperor", price: 35000, category: "Rank" },
  "rank:Lord": { name: "Rank Lord", price: 50000, category: "Rank" },
  "rank:Overlord": { name: "Rank Overlord", price: 75000, category: "Rank" },
  "rank:Mythic": { name: "Rank Mythic", price: 120000, category: "Rank" },
  "rank:Celestial": { name: "Rank Celestial", price: 250000, category: "Rank" },
  "kit:Emperor Kit": { name: "Emperor Kit", price: 5000, category: "Kit" },
  "kit:Lord Kit": { name: "Lord Kit", price: 8500, category: "Kit" },
  "kit:Overlord Kit": { name: "Overlord Kit", price: 10000, category: "Kit" },
  "kit:Mythic Kit": { name: "Mythic Kit", price: 11500, category: "Kit" },
  "kit:Celestial Kit": { name: "Celestial Kit", price: 16000, category: "Kit" }
};

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed. Gunakan POST." });
  }

  try {
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    const clientKey = process.env.MIDTRANS_CLIENT_KEY || "";
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";

    if (!serverKey) {
      return res.status(500).json({
        error: "MIDTRANS_SERVER_KEY belum dipasang di Environment Variables Vercel."
      });
    }

    const { itemType, itemName, moneySteps, gamertag, platform, email, phone } = req.body || {};

    if (!gamertag || !platform) {
      return res.status(400).json({ error: "Gamertag dan Platform Minecraft wajib diisi." });
    }

    // Validasi harga dari sisi server agar tidak bisa dimanipulasi dari inspect element
    let grossAmount = 0;
    let finalItemName = "";
    let itemId = "";

    if (itemType === "Money In Game") {
      const steps = Math.max(1, Math.min(1000, parseInt(moneySteps, 10) || 1));
      grossAmount = steps * 1000;
      const totalMoney = (steps * 50000).toLocaleString("id-ID");
      finalItemName = `${totalMoney} Money In Game`;
      itemId = `money_${steps}`;
    } else {
      const key = `${itemType.toLowerCase()}:${itemName}`;
      const matched = CATALOG[key];
      if (!matched) {
        return res.status(400).json({ error: "Item tidak ditemukan di katalog resmi PlayNet SMP." });
      }
      grossAmount = matched.price;
      finalItemName = matched.name;
      itemId = key.replace(/[^a-zA-Z0-9_-]/g, "_");
    }

    const timestamp = Date.now().toString().slice(-8);
    const cleanTag = gamertag.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 16);
    const orderId = `PN-${timestamp}-${cleanTag}`;

    const snapUrl = isProduction
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    const authString = Buffer.from(`${serverKey}:`).toString("base64");

    const payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount
      },
      item_details: [
        {
          id: itemId,
          price: grossAmount,
          quantity: 1,
          name: `${finalItemName} (${platform})`.slice(0, 50),
          category: itemType
        }
      ],
      customer_details: {
        first_name: gamertag,
        last_name: `[${platform}]`,
        email: email || `${cleanTag.toLowerCase()}@playnet.my.id`,
        phone: phone || "081234567890"
      },
      custom_field1: gamertag,
      custom_field2: platform,
      custom_field3: `${itemType}|${itemName}|${moneySteps || 1}`
    };

    const response = await fetch(snapUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Basic ${authString}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error_messages ? data.error_messages.join(", ") : "Gagal membuat transaksi Midtrans."
      });
    }

    return res.status(200).json({
      token: data.token,
      redirect_url: data.redirect_url,
      order_id: orderId,
      gross_amount: grossAmount,
      client_key: clientKey,
      is_production: isProduction
    });
  } catch (err) {
    console.error("Midtrans Transaction Error:", err);
    return res.status(500).json({ error: "Terjadi kesalahan server saat menghubungi Midtrans." });
  }
}
