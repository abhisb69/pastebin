import express from "express";
import cors from "cors";
import redis from "./services/redis.js";
import pastesRouter from "./routes/pastes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/healthz", async (req, res) => {
  try {
    await redis.ping();
    res.status(200).json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.use("/api/pastes", pastesRouter);

app.get("/p/:id", async (req, res) => {
  const key = `paste:${req.params.id}`;
  const raw = await redis.get(key);

  if (!raw) {
    return res.status(404).send("Not Found");
  }

  const paste = JSON.parse(raw);
  const now = Date.now();

  if (paste.expires_at && now >= paste.expires_at) {
    return res.status(404).send("Not Found");
  }

  if (paste.max_views !== null && paste.views >= paste.max_views) {
    return res.status(404).send("Not Found");
  }

  const escaped = paste.content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Paste</title>
      </head>
      <body>
        <pre>${escaped}</pre>
      </body>
    </html>
  `);
});
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
