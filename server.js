import express from "express";
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(express.json());

/* ============================================================
   🔍 FULL REQUEST LOGGER
   ============================================================ */
app.use((req, res, next) => {
  console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
  console.log("🟦 NEW REQUEST");
  console.log("Method:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("Path:", req.path);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  console.log("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
  next();
});

/* ============================================================
   🔍 RESPONSE LOGGER
   ============================================================ */
app.use((req, res, next) => {
  const oldJson = res.json;
  res.json = function (data) {
    console.log("🟩 OUTGOING RESPONSE:", JSON.stringify(data, null, 2));
    return oldJson.apply(res, arguments);
  };
  next();
});

/* ============================================================
   🔑 ENV VARS & SUPABASE CLIENT
   ============================================================ */
const AUTH_SECRET = process.env.MCP_AUTH_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("🔧 Supabase configured:", SUPABASE_URL ? "✅" : "❌ MISSING!");

/* ============================================================
   📦 MCP TOOLS - Boomer Bot Video Search
   ============================================================ */
const tools = [
  {
    name: "search_ou_videos",
    description: "Search the Oklahoma Sooners video database for game highlights, player performances, memorable plays, and historic moments. Searches through 4,627+ curated OU videos.",
    inputSchema: {
      type: "object",
      properties: {
        query: { 
          type: "string",
          description: "Search terms for OU videos (e.g., 'Dillon Gabriel touchdown', 'Red River Rivalry', 'Baker Mayfield highlights')"
        },
        limit: { 
          type: "number",
          description: "Maximum number of results to return (default: 5)",
          default: 5
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get_videos_by_sport",
    description: "Get Oklahoma Sooners videos filtered by sport (Football, Softball, Basketball, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        sport: {
          type: "string",
          description: "Sport name (Football, Softball, Men's Basketball, Women's Basketball, Baseball, Gymnastics, Wrestling, Golf)"
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 10)",
          default: 10
        }
      },
      required: ["sport"]
    }
  },
  {
    name: "get_recent_videos",
    description: "Get the most recently published Oklahoma Sooners videos, optionally filtered by sport",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Get videos from last N days (default: 30)",
          default: 30
        },
        sport: {
          type: "string",
          description: "Optional: filter by sport (Football, Softball, etc.)"
        },
        limit: {
          type: "number",
          description: "Maximum results (default: 10)",
          default: 10
        }
      }
    }
  }
];

/* ============================================================
   🔓 AUTH MIDDLEWARE
   ============================================================ */
const openPaths = ["/mcp", "/mcp/", "/manifest.json", "/manifest", "/health"];

app.use((req, res, next) => {
  if (openPaths.includes(req.path)) return next();

  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${AUTH_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
});

/* ============================================================
   ⭐ JSON-RPC HANDLER (REQUIRED BY MCP)
   ============================================================ */
app.post("/mcp", async (req, res) => {
  const { id, jsonrpc, method, params } = req.body;

  /* Ignore notifications */
  if (method && method.startsWith("notifications/")) {
    console.log("🔕 Ignoring notification:", method);
    return res.status(200).end();
  }

  /* Validate structure */
  if (jsonrpc !== "2.0" || typeof id === "undefined") {
    return res.json({
      jsonrpc: "2.0",
      id: id || null,
      error: { code: -32600, message: "Invalid Request" }
    });
  }

  /* MCP HANDSHAKE */
  if (method === "initialize") {
    return res.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-06-18",
        serverInfo: { 
          name: "boomer-bot-video-search", 
          version: "2.0.0",
          description: "Oklahoma Sooners video database search with 4,627+ curated videos"
        },
        capabilities: { tools: {} }
      }
    });
  }

  /* tools/list */
  if (method === "tools/list") {
    return res.json({
      jsonrpc: "2.0",
      id,
      result: { tools }
    });
  }

  /* tools/call */
  if (method === "tools/call") {
    const { name, arguments: args } = params;

    try {
      if (name === "search_ou_videos") {
        const videos = await searchOUVideos(args.query, args.limit || 5);
        return res.json({
          jsonrpc: "2.0",
          id,
          result: { 
            content: [{
              type: "text",
              text: formatVideoResults(videos, args.query)
            }]
          }
        });
      }

      if (name === "get_videos_by_sport") {
        const videos = await getVideosBySport(args.sport, args.limit || 10);
        return res.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{
              type: "text",
              text: formatVideoResults(videos, `${args.sport} videos`)
            }]
          }
        });
      }

      if (name === "get_recent_videos") {
        const videos = await getRecentVideos(args.days || 30, args.sport, args.limit || 10);
        return res.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{
              type: "text",
              text: formatVideoResults(videos, `Recent ${args.sport || 'OU'} videos`)
            }]
          }
        });
      }

      return res.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: "Unknown tool" }
      });

    } catch (error) {
      console.error("Error executing tool:", error);
      return res.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32000, message: `Tool execution failed: ${error.message}` }
      });
    }
  }

  /* Unknown method */
  return res.json({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Unknown method ${method}` }
  });
});

/* ============================================================
   🔧 SUPABASE VIDEO SEARCH FUNCTIONS
   ============================================================ */

async function searchOUVideos(query, limit = 5) {
  console.log("🔍 Searching Supabase for:", query);
  
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .or(`title.ilike.%${query}%,description.ilike.%${query}%,channel.ilike.%${query}%`)
    .order('view_count', { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Supabase error:", error);
    throw new Error(`Database query failed: ${error.message}`);
  }

  console.log(`✅ Found ${data.length} videos`);
  
  return data.map(v => ({
    title: v.title,
    url: v.url,
    channel_title: v.channel,
    published_date: v.published_date,
    sport: v.sport,
    views: v.view_count,
    duration: v.duration
  }));
}

async function getVideosBySport(sport, limit = 10) {
  console.log("🏈 Getting videos for sport:", sport);
  
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .ilike('sport', sport)
    .order('published_date', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Database query failed: ${error.message}`);

  return data.map(v => ({
    title: v.title,
    url: v.url,
    channel_title: v.channel,
    published_date: v.published_date,
    sport: v.sport,
    views: v.view_count,
    duration: v.duration
  }));
}

async function getRecentVideos(days = 30, sport = null, limit = 10) {
  console.log(`📅 Getting videos from last ${days} days${sport ? ` (${sport})` : ''}`);
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffString = cutoffDate.toISOString().split('T')[0];

  let query = supabase
    .from('videos')
    .select('*')
    .gte('published_date', cutoffString)
    .order('published_date', { ascending: false })
    .limit(limit);

  if (sport) {
    query = query.ilike('sport', sport);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Database query failed: ${error.message}`);

  return data.map(v => ({
    title: v.title,
    url: v.url,
    channel_title: v.channel,
    published_date: v.published_date,
    sport: v.sport,
    views: v.view_count,
    duration: v.duration
  }));
}

/* ============================================================
   📝 FORMAT RESULTS FOR DISPLAY
   ============================================================ */
function formatVideoResults(videos, query) {
  if (!videos || videos.length === 0) {
    return `No Oklahoma Sooners videos found for "${query}". Try different search terms like player names, game opponents, or types of plays.`;
  }

  let result = `Found ${videos.length} Oklahoma Sooners video${videos.length > 1 ? 's' : ''} for "${query}":\n\n`;
  
  videos.forEach((video, index) => {
    result += `${index + 1}. **${video.title}**\n`;
    result += `   📺 ${video.url}\n`;
    if (video.channel_title) {
      result += `   📹 ${video.channel_title}\n`;
    }
    if (video.sport) {
      result += `   🏆 ${video.sport}\n`;
    }
    if (video.published_date) {
      result += `   📅 ${video.published_date}\n`;
    }
    if (video.views) {
      result += `   👁️ ${video.views.toLocaleString()} views\n`;
    }
    result += `\n`;
  });
  
  return result;
}

/* ============================================================
   🌐 HEALTH CHECK & MANIFEST
   ============================================================ */
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    service: "boomer-bot-video-search-mcp",
    videos: "4627",
    supabase: SUPABASE_URL ? "connected" : "not configured",
    timestamp: new Date().toISOString()
  });
});

app.get("/manifest.json", (req, res) => res.json({ 
  name: "Boomer Bot Video Search",
  tools 
}));

app.get("/mcp", (req, res) =>
  res.json({ 
    note: "Use POST /mcp with JSON-RPC 2.0",
    service: "Oklahoma Sooners Video Search MCP Server"
  })
);

/* ============================================================
   🚀 START SERVER
   ============================================================ */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Boomer Bot MCP Server running on port ${PORT}`);
  console.log(`🗄️ Supabase: ${SUPABASE_URL ? 'Connected ✅' : 'NOT CONFIGURED ❌'}`);
  console.log(`🔐 Auth: ${AUTH_SECRET ? 'Configured' : 'NOT SET - WARNING!'}`);
});




