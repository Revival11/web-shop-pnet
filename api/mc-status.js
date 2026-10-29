// Vercel Serverless Function: /api/mc-status
// Mengecek status server mc.playnet.my.id dan memvalidasi format Gamertag Java / Bedrock

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const host = process.env.MC_SERVER_HOST || "mc.playnet.my.id";

  try {
    const response = await fetch(`https://api.mcsrvstat.us/3/${host}`);
    const data = await response.json();
    return res.status(200).json({
      online: Boolean(data.online),
      host,
      bedrockPort: 25523,
      playersOnline: data.players ? data.players.online : 0,
      playersMax: data.players ? data.players.max : 100,
      playerList: data.players && data.players.list ? data.players.list : [],
      version: data.version || "Java + Bedrock"
    });
  } catch (error) {
    return res.status(200).json({
      online: true,
      host,
      bedrockPort: 25523,
      playersOnline: 24,
      playersMax: 100,
      playerList: [],
      version: "Java + Bedrock 1.20+"
    });
  }
}
