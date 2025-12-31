const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

const pastes = new Map();

/* Health Check */
app.get("/api/healthz", (req, res) => {
  res.status(200).json({ ok: true });
});

/* Create Paste */
app.post("/api/pastes", (req, res) => {
  const { content, ttl_seconds, max_views } = req.body;

  if (!content || typeof content !== "string") {
    return res.status(400).json({ error: "Invalid content" });
  }

  if (ttl_seconds && ttl_seconds < 1) {
    return res.status(400).json({ error: "Invalid ttl_seconds" });
  }

  if (max_views && max_views < 1) {
    return res.status(400).json({ error: "Invalid max_views" });
  }

  const id = uuidv4();
  const now = Date.now();

  pastes.set(id, {
    content,
    createdAt: now,
    expiresAt: ttl_seconds ? now + ttl_seconds * 1000 : null,
    maxViews: max_views || null,
    views: 0,
  });

  res.status(201).json({
    id,
    url: `http://localhost:5173/p/${id}`,
  });
});

/* Fetch Paste (API) */
app.get("/api/pastes/:id", (req, res) => {
  const paste = pastes.get(req.params.id);
  if (!paste) return res.status(404).json({ error: "Not found" });

  const now = process.env.TEST_MODE === "1"
    ? Number(req.headers["x-test-now-ms"])
    : Date.now();

  if (paste.expiresAt && now > paste.expiresAt) {
    return res.status(404).json({ error: "Expired" });
  }

  if (paste.maxViews && paste.views >= paste.maxViews) {
    return res.status(404).json({ error: "View limit exceeded" });
  }

  paste.views++;

  res.json({
    content: paste.content,
    remaining_views: paste.maxViews
      ? paste.maxViews - paste.views
      : null,
    expires_at: paste.expiresAt
      ? new Date(paste.expiresAt).toISOString()
      : null,
  });
});

/* View Paste (HTML) */
app.get("/p/:id", (req, res) => {
  const paste = pastes.get(req.params.id);
  if (!paste) return res.status(404).send("Not Found");

  const now = Date.now();

  if (paste.expiresAt && now > paste.expiresAt) {
    return res.status(404).send("Expired");
  }

  if (paste.maxViews && paste.views >= paste.maxViews) {
    return res.status(404).send("View limit exceeded");
  }

  paste.views++;

  res.send(`
    <html>
      <body>
        <pre>${paste.content.replace(/</g, "&lt;")}</pre>
      </body>
    </html>
  `);
});


app.listen(4000, () =>
  console.log("Backend running on http://localhost:4000")
);
