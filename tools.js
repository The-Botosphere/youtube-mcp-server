// tools.js
export const tools = [
  {
    name: "search_ou_videos",
    description:
      "Search the Oklahoma Sooners video database for game highlights, player performances, memorable plays, and historic moments.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search terms (e.g., 'Dillon Gabriel touchdown', 'Red River Rivalry')",
        },
        limit: {
          type: "number",
          description: "Maximum results (default: 10, max: 50)",
          default: 10,
        },
      },
      required: ["query"],
    },
  },

  {
    name: "get_videos_by_sport",
    description:
      "Get Oklahoma Sooners videos filtered by sport, optionally limited by days.",
    inputSchema: {
      type: "object",
      properties: {
        sport: {
          type: "string",
          description:
            "Sport name (Football, Softball, Basketball, Gymnastics, etc.)",
        },
        days: {
          type: "number",
          description: "Fetch videos from last N days (default: 30)",
          default: 30,
        },
        limit: {
          type: "number",
          description: "Maximum results (default: 10, max: 50)",
          default: 10,
        },
      },
      required: ["sport"],
    },
  },

  {
    name: "get_recent_videos",
    description:
      "Get the most recently published Oklahoma Sooners videos, optionally filtered by sport.",
    inputSchema: {
      type: "object",
      properties: {
        sport: {
          type: "string",
          description: "Optional sport filter (Football, Softball, etc.)",
        },
        limit: {
          type: "number",
          description: "Maximum results (default: 10, max: 50)",
          default: 10,
        },
      },
      required: [],
    },
  },
];
