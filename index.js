import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import dotenv from "dotenv";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

// ---------------------------------------------------------
// 1️⃣ Load Secrets
// ---------------------------------------------------------
const SECRET_MODE = process.env.SECRET_MODE || "dotenv";

if (SECRET_MODE === "dotenv") {
  dotenv.config();
  console.log("🔐 Loaded secrets from .env file");
  startServer();
} else if (SECRET_MODE === "doppler" || SECRET_MODE === "infisical") {
  console.log(`🔐 Using ${SECRET_MODE.toUpperCase()} injected secrets`);
  startServer();
} else if (SECRET_MODE === "aws") {
  const client = new SecretsManagerClient({ region: process.env.AWS_REGION || "us-east-1" });

  try {
    const secretId = process.env.AWS_SECRET_ID;
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
    const secrets = JSON.parse(response.SecretString);
    for (const key of Object.keys(secrets)) process.env[key] = secrets[key];
    console.log("🔐 AWS Secrets loaded into environment");
    startServer();
  } catch (err) {
    console.error("❌ Failed to load AWS secrets:", err.message);
    process.exit(1);
  }
} else {
  console.error("❌ Invalid SECRET_MODE value");
  process.exit(1);
}

// ---------------------------------------------------------
// 2️⃣ Main Server Function
// ---------------------------------------------------------
async function startServer() {
  const { default: confirmPayment } = await import("./routes/confirmPayment.js");
  const { default: withdraw } = await import("./routes/withdraw.js");

  const app = express();

  // 🔹 Capture RAW BODY for HMAC Verification
  app.use(
    express.json({
      limit: "10kb",
      verify: (req, res, buf) => {
        req.rawBody = buf.toString(); // store raw body for HMAC check
      },
    })
  );

  app.use(helmet());
  app.use(cors());
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

  // Routes
  app.use("/api/confirm-payment", confirmPayment);
  app.use("/api/withdraw", withdraw);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () =>
    console.log(`🚀 Server running on port ${PORT} [${process.env.NETWORK || "unknown"}]`)
  );
}
