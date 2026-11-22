import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const DB_BUSY_RE =
  /EMAXCONN|max clients reached|remaining connection slots|too many clients|timeout exceeded when trying to connect|Connection terminated due to connection timeout/i;

export function isDbBusyError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const msg = (err as { message?: unknown }).message;
  return typeof msg === "string" && DB_BUSY_RE.test(msg);
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }

  const rawUrl = req.originalUrl || req.url || "";
  const where = `${req.method} ${rawUrl.split("?")[0]}`;

  if (isDbBusyError(err)) {
    console.error(`[Lixyte Core-API Error] ${where}: database busy:`, (err as Error).message);
    res.setHeader("Retry-After", "5");
    res.status(503).json({
      error: {
        code: "DATABASE_BUSY",
        message: "The database is busy right now. Please try again in a moment.",
      },
    });
    return;
  }

  console.error(`[Lixyte Core-API Error] ${where}:`, err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
  });
}
