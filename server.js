import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const API_KEY = process.env.YOUTUBE_API_KEY;
const AUTH_SECRET = process.env.MCP_AUTH_TOKEN;

// -------------------------------------------------------
// AUTH MIDDLEWARE
// -------------------------------------------------------
app.use((req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${AUTH_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// -------------------------------------------------------
// MCP MANIFEST
// -------------------------------------------------------
app.get("/manifest.json", (req, res) => {
  res.json({
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
        description: "Retrieve details for a video ID.",
        input_schema: {
          type: "object",
          properties: {
            videoId: { type: "string" }
          },
          required: ["videoId"]
        }
      }
    ]
  });
});

// -------------------------------------------------------
// SEARCH VIDEOS
// -------------------------------------------------------
app.post("/youtube/search", async (req, res) => {
  const { query, maxResults = 10 } = req.body;

  const url =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}` +
    `&q=${encodeURIComponent(query)}&key=${API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  res.json(data.items || []);
});

// -------------------------------------------------------
// GET VIDEO DETAILS
// -------------------------------------------------------
app.post("/youtube/get", async (req, res) => {
  const { videoId } = req.body;

  const url =
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,player&id=${videoId}` +
    `&key=${API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  res.json(data.items?.[0] || {});
});

// -------------------------------------------------------
app.listen(3000, () => {
  console.log("MCP YouTube server running on port 3000");
});
