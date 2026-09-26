import "dotenv/config";
import express from "express";
import Groq from "groq-sdk";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const groqApiKey =
  process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;

const groq = groqApiKey
  ? new Groq({ apiKey: groqApiKey })
  : null;

// Common function for calling Groq
async function askGroq(messages, jsonMode = false) {
  if (!groq) {
    throw new Error("Groq API key is missing.");
  }

  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages,
    temperature: 0.7,
    ...(jsonMode
      ? { response_format: { type: "json_object" } }
      : {}),
  });

  const content = completion.choices[0]?.message?.content || "";

  if (jsonMode) {
    return JSON.parse(content);
  }

  return content;
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Runtime environment variables for Supabase
app.get("/env.js", (req, res) => {
  res.type("application/javascript");

  res.send(`
    window.ENV = {
      VITE_SUPABASE_URL: ${JSON.stringify(
    process.env.VITE_SUPABASE_URL || ""
  )},
      VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: ${JSON.stringify(
    process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || ""
  )}
    };
  `);
});

// 1. Generate roadmap
app.post("/api/ai/roadmap", async (req, res) => {
  try {
    const { syllabus, difficulty = "beginner" } = req.body;

    if (!syllabus || typeof syllabus !== "string") {
      return res.status(400).json({
        error: "A syllabus is required.",
      });
    }

    const result = await askGroq(
      [
        {
          role: "system",
          content: `You are an expert curriculum designer.
Convert the user's syllabus into a structured learning roadmap.
Tailor the roadmap to the ${difficulty} level.`,
        },
        {
          role: "user",
          content: `Create a progressive and clear learning roadmap based on this syllabus.

Return a JSON object with a single key "data" containing an array of objects.
Each object must have:
- "id" (string)
- "title" (string)
- "description" (string)
- "order" (number)

Syllabus: ${syllabus}`,
        },
      ],
      true
    );

    return res.json(result);
  } catch (error) {
    console.error("Roadmap generation error:", error);

    return res.status(500).json({
      error: "Failed to generate the roadmap.",
    });
  }
});

// 2. Solve doubt
app.post("/api/ai/doubt", async (req, res) => {
  try {
    const { topic, question } = req.body;

    if (!topic || !question) {
      return res.status(400).json({
        error: "Topic and question are required.",
      });
    }

    const answer = await askGroq([
      {
        role: "system",
        content:
          "You are a helpful AI tutor. Explain concepts clearly and simply.",
      },
      {
        role: "user",
        content: `Topic: ${topic}\nQuestion: ${question}`,
      },
    ]);

    return res.json({ answer });
  } catch (error) {
    console.error("Doubt-solving error:", error);

    return res.status(500).json({
      error: "Failed to solve the doubt.",
    });
  }
});

// 3. Generate quiz
app.post("/api/ai/quiz", async (req, res) => {
  try {
    const { topic, description } = req.body;

    if (!topic) {
      return res.status(400).json({
        error: "A topic is required.",
      });
    }

    const result = await askGroq(
      [
        {
          role: "system",
          content:
            "You are an expert quiz creator. Create accurate multiple-choice questions.",
        },
        {
          role: "user",
          content: `Create a quiz about ${topic}.
Description: ${description || "No description provided."}

Return a JSON object with a single key "data" containing an array of questions.
Each question must have:
- "question" (string)
- "options" (array of strings)
- "correctAnswer" (string)`,
        },
      ],
      true
    );

    return res.json(result);
  } catch (error) {
    console.error("Quiz generation error:", error);

    return res.status(500).json({
      error: "Failed to generate the quiz.",
    });
  }
});

// 4. Generate revision notes
app.post("/api/ai/revision", async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || typeof content !== "string") {
      return res.status(400).json({
        error: "Content is required.",
      });
    }

    const notes = await askGroq([
      {
        role: "system",
        content:
          "You are an expert study assistant. Create clear, concise revision notes.",
      },
      {
        role: "user",
        content: `Create revision notes from the following content:\n\n${content}`,
      },
    ]);

    return res.json({ notes });
  } catch (error) {
    console.error("Revision notes error:", error);

    return res.status(500).json({
      error: "Failed to generate revision notes.",
    });
  }
});

// 5. Find YouTube video
app.post("/api/ai/youtube", async (req, res) => {
  try {
    const { topic, description } = req.body;

    if (!topic) {
      return res.status(400).json({
        error: "A topic is required.",
      });
    }

    const result = await askGroq([
      {
        role: "system",
        content:
          "You are a study assistant. Suggest a relevant YouTube search URL for the given topic. Do not invent a specific video URL.",
      },
      {
        role: "user",
        content: `Topic: ${topic}\nDescription: ${description || ""}

Return only a YouTube search URL for this topic.`,
      },
    ]);

    return res.json({ result: result.trim() });
  } catch (error) {
    console.error("YouTube search error:", error);

    return res.status(500).json({
      error: "Failed to find a YouTube video.",
    });
  }
});

// 6. Generate topic summary
app.post("/api/ai/summary", async (req, res) => {
  try {
    const { topic, description } = req.body;

    if (!topic) {
      return res.status(400).json({
        error: "A topic is required.",
      });
    }

    const summary = await askGroq([
      {
        role: "system",
        content:
          "You are a helpful study assistant. Explain topics in a clear and student-friendly way.",
      },
      {
        role: "user",
        content: `Summarize the following topic:
Topic: ${topic}
Description: ${description || "No description provided."}`,
      },
    ]);

    return res.json({ summary });
  } catch (error) {
    console.error("Topic summary error:", error);

    return res.status(500).json({
      error: "Failed to generate the topic summary.",
    });
  }
});

// Start the server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");

    app.use(express.static(distPath));

    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Server startup error:", error);
  process.exit(1);
});

