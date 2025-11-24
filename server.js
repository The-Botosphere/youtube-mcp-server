// server.js
import express from "express";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { tools } from "./tools.js";

const app = express();
app.use(express.json());

// --- CORS (REQUIRED for MCP over HTTP) ---
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// --- Healthcheck ---
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// --- Root ---
app.get("/", (req, res) => {
  res.send("YouTube / OU Videos MCP server is running");
});

// --- Supabase Client ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase ENV vars");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- Query Functions ---
async function searchOuVideos({ query, limit = 10 }) {
  const max = Math.min(limit, 50);

  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .ilike("title", `%${query}%`)
    .order("published_at", { ascending: false })
    .limit(max);

  if (error) throw error;
  return data || [];
}

async function getVideosBySport({ sport, days = 30, limit = 10 }) {
  const max = Math.min(limit, 50);

  let q = supabase
    .from("videos")
    .select("*")
    .eq("sport", sport)
    .order("published_at", { ascending: false })
    .limit(max);

  if (days > 0) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    q = q.gte("published_at", since.toISOString());
  }

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function getRecentVideos({ sport, limit = 10 }) {
  const max = Math.min(limit, 50);

  let q = supabase
    .from("videos")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(max);

  if (sport) q = q.eq("sport", sport);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// --- MCP ENDPOINT ---
app.post("/mcp", async (req, res) => {
  const { id, method, params } = req.body;

  console.log("\n🟦 NEW MCP REQUEST");
  console.log(JSON.stringify(req.body, null, 2));

  // Notifications have no "id"
  if (!id) {
    return res.json({ jsonrpc: "2.0", result: null });
  }

  try {
    // 1. tools/list
    if (method === "tools/list") {
      return res.json({
        jsonrpc: "2.0",
        id,
        result: { tools },
      });
    }

    // 2. tools/call
    if (method === "tools/call") {
      const { name, arguments: args = {} } = params;

      let out;

      if (name === "search_ou_videos") out = await searchOuVideos(args);
      else if (name === "get_videos_by_sport") out = await getVideosBySport(args);
      else if (name === "get_recent_videos") out = await getRecentVideos(args);
      else {
        return res.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Unknown tool: ${name}` },
        });
      }

      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "output_text",
              text: JSON.stringify(out, null, 2),
            },
          ],
        },
      });
    }

    // Unknown method
    return res.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Unknown method: ${method}` },
    });
  } catch (err) {
    console.error("❌ ERROR:", err);
    return res.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: err.message || "Internal error" },
    });
  }
});

// --- Start Server ---
const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log("YouTube MCP listening on port " + port);
});


           // --- Keep-alive internal ping (Railway safe) ---
setInterval(() => {
  try {
    fetch(`http://localhost:${port}/health`)
      .then(() => console.log("⏳ Keep-alive ping"))
      .catch(err => console.log("⚠ Keep-alive failed:", err.message));
  } catch (err) {
    console.log("⚠ Keep-alive exception:", err.message);
  }
}, 1000 * 60 * 4); // every 4 minutes

);




