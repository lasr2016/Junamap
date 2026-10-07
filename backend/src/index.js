import express from "express";
import localesRouter from "./routes/locales.js";
import searchRouter from "./routes/search.js";

const app = express();
const port = Number(process.env.PORT) || 3001;
const allowedOrigins = new Set([
  process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "junamap-api" });
});

app.use("/api/locales", localesRouter);
app.use("/api/search", searchRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(port, () => {
  console.log(`JunaMap API escuchando en http://localhost:${port}`);
  console.log(`CORS habilitado para ${[...allowedOrigins].join(", ")}`);
});
