import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { allowedOrigins } from "./config/cors";
import { testDbConnection } from "./config/db";
import { authRouter } from "./modules/auth/auth.routes";
import { modelsRouter } from "./modules/models/models.routes";
import { paymentsRouter } from "./modules/payments/payments.routes";
import { interactionsRouter } from "./modules/interactions/interactions.routes";
import { sellerRouter } from "./modules/seller/seller.routes";
import { adminRouter } from "./modules/admin/admin.routes";
import { complaintsRouter } from "./modules/complaints/complaints.routes";
import { notificationsRouter } from "./modules/notifications/notifications.routes";
import { startSuspensionSweeper } from "./modules/admin/suspensionSweeper";
import { errorHandler } from "./middlewares/error.middleware";


export const app = express();

app.use(cors({ origin: allowedOrigins(), credentials: true }));
// Stripe webhook requires the raw request body for signature verification
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));
app.use(express.json());

app.get("/health", async (_req, res) => {
  const dbStatus = await testDbConnection();
  res.json({
    service: "broken-design-core-api",
    status: "ok",
    database: dbStatus,
  });
});

app.use("/api/auth", authRouter);
app.use("/api/models", modelsRouter);
app.use("/api", paymentsRouter);
app.use("/api/seller", sellerRouter);
app.use("/api/admin", adminRouter);
app.use("/api/complaints", complaintsRouter);
app.use("/api/me/notifications", notificationsRouter);
app.use("/api", interactionsRouter);

app.use(errorHandler);

const isTest =
  process.env.NODE_ENV === "test" ||
  process.argv.some((arg) => arg.includes("test"));

if (!isTest) {
  app.listen(env.port, () => {
    console.log(`[Lixyte Core-API] running on http://localhost:${env.port}`);
  });
  startSuspensionSweeper(); // lifts suspensions whose end time has passed (every 60 s)
}
