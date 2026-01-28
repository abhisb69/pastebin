import express from "express";
import { nanoid } from "nanoid";
import redis from "../services/redis.js";
import { getNow } from "../utils/time.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { content, ttl_seconds, max_views } = req.body;

  // Validation
  if (!content || typeof content !== "string" || content.trim() === "") {
    return res.status(400).json({ error: "content is required" });
  }

  if (
    ttl_seconds !== undefined &&
    (!Number.isInteger(ttl_seconds) || ttl_seconds < 1)
  ) {
    return res.status(400).json({ error: "ttl_seconds must be >= 1" });
  }

  if (
    max_views !== undefined &&
    (!Number.isInteger(max_views) || max_views < 1)
  ) {
    return res.status(400).json({ error: "max_views must be >= 1" });
  }

  const id = nanoid(8);
  const now = Date.now();

  const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

  const ttl = Number.isInteger(ttl_seconds)
    ? ttl_seconds
    : DEFAULT_TTL_SECONDS;

  const paste = {
    id,
    content,
    created_at: now,
    expires_at: now + ttl * 1000,
    max_views: Number.isInteger(max_views) ? max_views : null,
    views: 0
  };

  await redis.set(`paste:${id}`, JSON.stringify(paste));

  res.status(201).json({
    id,
    url: `${req.protocol}://${req.get("host")}/p/${id}`
  });
});


router.get("/:id", async (req, res) => {
  const key = `paste:${req.params.id}`;

  while (true) {
    await redis.watch(key);
    const raw = await redis.get(key);

    if (!raw) {
      await redis.unwatch();
      return res.status(404).json({ error: "Paste not found" });
    }

    const paste = JSON.parse(raw);
    const now = getNow(req);

    if (paste.expires_at && now >= paste.expires_at) {
      await redis.unwatch();
      return res.status(404).json({ error: "Paste expired" });
    }

    if (paste.max_views !== null && paste.views >= paste.max_views) {
      await redis.unwatch();
      return res.status(404).json({ error: "View limit exceeded" });
    }

    paste.views += 1;

    const tx = redis.multi();
    tx.set(key, JSON.stringify(paste));
    const result = await tx.exec();

    if (result === null) {
      continue;
    }

    return res.json({
      content: paste.content,
      remaining_views:
        paste.max_views !== null ? paste.max_views - paste.views : null,
      expires_at: paste.expires_at
        ? new Date(paste.expires_at).toISOString()
        : null
    });
  }
});

export default router;
