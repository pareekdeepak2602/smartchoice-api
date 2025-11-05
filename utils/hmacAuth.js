import crypto from "crypto";

export function verifyHMAC(req, res, next) {
  const signature = req.headers["x-signature"];
  const timestamp = req.headers["x-timestamp"];
  const publicKey = req.headers["x-api-key"];
  const appToken = req.headers["x-app-token"];

  const { API_PUBLIC_KEY, API_SECRET, APP_VERIFICATION_TOKEN } = process.env;

  if (!signature || !timestamp || !publicKey)
    return res.status(403).json({ success: false, reason: "Missing signature headers" });

  if (publicKey !== API_PUBLIC_KEY)
    return res.status(403).json({ success: false, reason: "Invalid API key" });

  if (appToken !== APP_VERIFICATION_TOKEN)
    return res.status(403).json({ success: false, reason: "Invalid app verification token" });

  // prevent replay attacks (±2 min clock drift)
  if (Math.abs(Date.now() - Number(timestamp)) > 2 * 60 * 1000)
    return res.status(403).json({ success: false, reason: "Request expired" });

  // 🔹 Use rawBody, not JSON.stringify(req.body)
  const body = req.rawBody || "{}";
  const computed = crypto.createHmac("sha256", API_SECRET).update(timestamp + body).digest("hex");

  console.log("🧾 Raw Body:", body);
  console.log("🧮 Computed Signature:", computed);
  console.log("📦 Received Signature:", signature);

  if (computed !== signature)
    return res.status(403).json({ success: false, reason: "Invalid signature" });

  next();
}
