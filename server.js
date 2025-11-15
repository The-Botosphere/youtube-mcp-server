import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// Your environment variable secrets
const API_KEY = process.env.YOUTUBE_API_KEY;
const AUTH_SECRET = process.env.MCP_AUTH_TOKEN;

// -------------------------------------------------------
// AUTH MIDDLEWARE — SKIP MANIFEST ROUTES
// -------------------------------------------------------
app.use((req, res, next) => {
  const openPaths = ["/manifest.json", "/mcp/manifest.json"];

  if (openPaths.includes(req.path)) {
    return next();
  }

  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${AUTH_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
});

// -------------------------------------------------------
// MASTER MANIFEST OBJECT (used by both routes)
// -------------------------------------------------------
const manifest = {
  version: "1.0.0",
  tools: [
    {
      name: "youtube_search",
      description: "Search YouTube for videos.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string" },
          maxResults: { type: "number" }
        },
        required: ["query"]
      }
    },
    {
      name: "youtube_get_video",
      description: "Retrieve details for a specific YouTube video ID.",
      input_schema: {
        type: "object",
        properties: {
          videoId: { type: "string" }
        },
        required: ["videoId"]
      }
    }
  ]
};

// -------------------------------------------------------
// PUBLIC MANIFEST ROUTES (PMG compatible)
// -------------------------------------------------------
app.get("/manifest.json", (req, res) => {
  res.json(manifest);
});

app.get("/mcp/manifest.json", (req, res) => {
  res.json(manifest);
});

// -------------------------------------------------------
// YOUTUBE SEARCH TOOL
// -------------------------------------------------------
app.post("/youtube/search", async (req, res) => {
  const { query, maxResults = 10 } = req.body;

  const url =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video` +
    `&maxResults=${maxResults}&q=${encodeURIComponent(query)}` +
    `&key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data.items || []);
  } catch (err) {
    res.status(500).json({ error: "YouTube search failed", details: err.message });
  }
});

// -------------------------------------------------------
// YOUTUBE GET VIDEO INFO TOOL
// -------------------------------------------------------
app.post("/youtube/get", async (req, res) => {
  const { videoId } = req.body;

  const url =
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,player` +
    `&id=${videoId}&key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data.items?.[0] || {});
  } catch (err) {
    res.status(500).json({ error: "YouTube video lookup failed", details: err.message });
  }
});

// -------------------------------------------------------
// START SERVER
// -------------------------------------------------------
app.listen(3000, () => {
  console.log("MCP YouTube server running on port 3000");
});
