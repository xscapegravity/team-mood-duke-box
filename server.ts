import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  app.use(express.json());

  const PORT = 3000;

  // Shared state
  let moods: { id: string; user: string; mood: string }[] = [];
  let isDone = false;
  let suggestedSong: any = null;

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    socket.emit("state-update", { moods, isDone, suggestedSong });

    socket.on("add-mood", (data) => {
      if (isDone) return;
      moods.push({ id: Math.random().toString(36).substr(2, 9), ...data });
      io.emit("state-update", { moods, isDone, suggestedSong });
    });

    socket.on("set-done", (songData) => {
      isDone = true;
      suggestedSong = songData;
      io.emit("state-update", { moods, isDone, suggestedSong });
    });

    socket.on("reset", () => {
      moods = [];
      isDone = false;
      suggestedSong = null;
      io.emit("state-update", { moods, isDone, suggestedSong });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });

  // API Route for Gemini (Server-side)
  app.post("/api/generate-song", async (req, res) => {
    const { moods: moodsList } = req.body;
    const moodsText = moodsList.map((m: any) => `${m.user}: ${m.mood}`).join('\n');
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: `The following is a list of moods from a team:\n${moodsText}\n\nBased on these collective moods, find one specific REAL song that perfectly represents the team's current vibe. 
        Return the response in JSON format with keys: "title", "artist", "reason", "youtubeId".`,
        config: {
          responseMimeType: "application/json",
        }
      });

      let jsonText = response.text || '{}';
      const songData = JSON.parse(jsonText);
      res.json(songData);
    } catch (error) {
      console.error("Error generating song:", error);
      res.status(500).json({ error: "Failed to generate song" });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV });
  });

  const distPath = path.resolve(__dirname, "dist");
  const hasDist = fs.existsSync(path.join(distPath, "index.html"));

  if (hasDist && process.env.NODE_ENV === "production") {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
