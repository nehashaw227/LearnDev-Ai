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

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
          content: `You are an expert curriculum designer and university professor.
Convert the user's syllabus into a well-structured, comprehensive learning roadmap tailored to ${difficulty} level.
Each topic must have a thorough, educational description (3-4 sentences outlining core concept, significance, and learning goals) rather than a brief phrase.`,
        },
        {
          role: "user",
          content: `Create a progressive and clear learning roadmap based on this syllabus.

Return a JSON object with a single key "data" containing an array of objects.
Each object must have:
- "id" (string)
- "title" (string)
- "description" (string - 3-4 informative sentences explaining what this topic covers, key concepts, and practical learning objective)
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

// 2. Solve doubt (AI Neural Tutor)
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
        content: `You are LearnDev AI Neural Tutor, an expert educator and mentor.
Your mission is to provide thorough, well-organized, and engaging explanations.
Follow these rules strictly:
1. Explain core concepts clearly in accessible language.
2. Highlight important terms and key definitions in **bold**.
3. Use bullet points or numbered lists for sequential steps or multi-faceted concepts.
4. Include practical examples, code snippets, or real-world analogies where helpful.
5. Avoid short, dismissive one-line answers. Ensure depth, accuracy, and clear structure.`,
      },
      {
        role: "user",
        content: `Topic: ${topic}\nStudent Question: ${question}`,
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
            "You are an expert quiz creator. Create accurate, challenging multiple-choice questions suitable for exam preparation.",
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

// 4. Generate revision notes (Organized, detailed, exam-oriented)
app.post("/api/ai/revision", async (req, res) => {
  try {
    const { content, topic, description } = req.body;
    const combinedContext = [
      topic ? `Topic: ${topic}` : null,
      description ? `Overview: ${description}` : null,
      content && content !== topic ? `Reference Content:\n${content}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    if (!combinedContext.trim()) {
      return res.status(400).json({
        error: "Content or topic is required.",
      });
    }

    const notes = await askGroq([
      {
        role: "system",
        content: `You are a distinguished university professor and master educator.
Your task is to generate comprehensive, masterclass-level study and revision notes.
You MUST strictly follow this structured format:

# [Topic Title] - Comprehensive Study & Revision Notes

## 1. Executive Concept Overview
Provide a clear, engaging explanation of the core concept in accessible language. Explain why this concept is essential.

## 2. Key Terminology & Core Definitions
List essential terms with their definitions in **bold**.

## 3. Deep-Dive Concepts & Mechanics
Break down the underlying principles, architecture, or workflow using numbered steps or bullet points. Avoid giant unstructured blocks of text.

## 4. Structured Comparison / Key Parameters Table
Include a detailed Markdown comparison or parameter table:
| Aspect / Property | Description / Behavior | Significance |
| :--- | :--- | :--- |
| ... | ... | ... |

## 5. Practical Implementation & Concrete Examples
Provide practical code examples or concrete real-world use cases demonstrating the concept in action with step-by-step commentary.

## 6. High-Yield Exam Essentials & Common Pitfalls
- **Crucial Rule:** Key rule to remember for exams and interviews.
- **Common Pitfall:** What mistakes students/developers often make and how to avoid them.
- **Exam Tip:** High-yield fact or pattern frequently tested.

## 7. Quick Review Summary
A 2-3 sentence concluding synthesis capturing the most vital takeaway.`,
      },
      {
        role: "user",
        content: `Generate thorough, beautifully organized exam-ready revision notes for:\n\n${combinedContext}`,
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

// 4b. Generate In-Depth Topic Study Guide
app.post("/api/ai/topic-guide", async (req, res) => {
  try {
    const { topic, description } = req.body;

    if (!topic) {
      return res.status(400).json({
        error: "A topic is required.",
      });
    }

    const guide = await askGroq([
      {
        role: "system",
        content: `You are an elite educator creating deep, self-contained study material for a learning topic.
Provide an in-depth, structured masterclass guide formatted with clear Markdown:
- Clear headings (##, ###)
- Detailed conceptual explanation in simple language
- Bold definitions
- Subtopics and architecture breakdowns
- Markdown comparison or specification table
- Concrete practical examples with explanations
- Exam tips & high-yield takeaways
- Brief conclusion`,
      },
      {
        role: "user",
        content: `Generate an in-depth, comprehensive study guide for:
Topic: ${topic}
Context/Description: ${description || "General concept"}`,
      },
    ]);

    return res.json({ guide });
  } catch (error) {
    console.error("Topic study guide error:", error);

    return res.status(500).json({
      error: "Failed to generate topic study guide.",
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
        content: `You are an expert academic tutor. Provide an insightful, beautifully organized Topic Summary.
Format your response with:
- A clear 2-3 sentence overview introducing the concept.
- 4-5 bullet points highlighting the core mechanics, key principles, and significance (bold key terms).
- A concluding statement on its real-world application.`,
      },
      {
        role: "user",
        content: `Summarize the following topic thoroughly:
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

// 7. PDF Study Assistant: Analyze document & extract topics
app.post("/api/ai/pdf/analyze", async (req, res) => {
  try {
    const { pdfText, fileName, pageCount } = req.body;

    if (!pdfText || typeof pdfText !== "string") {
      return res.status(400).json({ error: "PDF text content is required." });
    }

    const contextSample = pdfText.slice(0, 16000);

    const result = await askGroq(
      [
        {
          role: "system",
          content: `You are an expert academic curriculum analyst.
Analyze the provided text from an uploaded study document.
Identify the overall subject/course, an overview, and all real topics covered in the document.
DO NOT hallucinate or invent topics that are not present.
Return a valid JSON object matching this schema:
{
  "subject": "Name of the subject or course",
  "overview": "Clear 2-3 sentence overview of what the document covers",
  "topics": [
    {
      "id": "slug-id",
      "title": "Topic or Chapter Title",
      "subtopics": ["Subtopic 1", "Subtopic 2"],
      "pageRange": "e.g. Pages 1-4"
    }
  ],
  "keyConcepts": ["Concept 1", "Concept 2", "Concept 3"],
  "formulasPresent": true
}`,
        },
        {
          role: "user",
          content: `Document Name: ${fileName || "Study Material.pdf"} (${pageCount || 1} pages)
Content:
${contextSample}`,
        },
      ],
      true
    );

    return res.json(result);
  } catch (error) {
    console.error("PDF analysis error:", error);
    return res.status(500).json({ error: "Failed to analyze PDF content." });
  }
});

// 8. PDF Study Assistant: Generate selected study material
app.post("/api/ai/pdf/generate", async (req, res) => {
  try {
    const {
      materialType,
      pdfContext,
      selectedTopics = [],
      difficulty = "intermediate",
      detailLevel = "detailed",
      targetTopic = null,
    } = req.body;

    if (!pdfContext) {
      return res.status(400).json({ error: "PDF context is required." });
    }

    const trimmedContext = pdfContext.slice(0, 24000);
    const topicsScope = selectedTopics.length > 0 ? selectedTopics.join(", ") : "All topics in document";

    if (materialType === "flashcards") {
      const result = await askGroq(
        [
          {
            role: "system",
            content: `You are an expert study flashcard creator.
Create interactive study flashcards based directly on the provided text.
Each card must have:
- "front": clear question, term, or prompt
- "back": concise, accurate explanation or answer
- "topic": related topic name
- "pageRef": page reference if found (e.g. "[Page 2]")
Return a JSON object with key "data" containing an array of 8 to 15 flashcards.`,
          },
          {
            role: "user",
            content: `Topic Focus: ${targetTopic || topicsScope}
Context:
${trimmedContext}`,
          },
        ],
        true
      );
      return res.json(result);
    }

    if (materialType === "quiz") {
      const result = await askGroq(
        [
          {
            role: "system",
            content: `You are an expert academic examiner.
Create multiple-choice practice questions based on the provided PDF text.
Difficulty: ${difficulty}.
Return a JSON object with key "data" containing an array of 5 to 10 questions.
Each question must have:
- "question": string
- "options": array of 4 distinct string choices
- "correctAnswer": exact matching string from options
- "explanation": why this answer is correct with source reference`,
          },
          {
            role: "user",
            content: `Topic Focus: ${targetTopic || topicsScope}
Context:
${trimmedContext}`,
          },
        ],
        true
      );
      return res.json(result);
    }

    let promptInstruction = "";
    switch (materialType) {
      case "important-topics":
        promptInstruction = `Generate a high-yield "Exam-Oriented Important Topics" study guide based on the PDF.
Include:
1. Priority Breakdown (High Priority / Core Topics vs Secondary Topics).
2. Key concepts to focus on for each topic with review rationale.
3. Important Definitions and Formulas with source page citations (e.g. [Page X]).
4. Suggested exam study priority checklist.
Note clearly that these are suggested study priorities based on the document.`;
        break;

      case "exam-notes":
        promptInstruction = `Generate structured, high-quality "Exam-Oriented Notes" (${detailLevel} level).
Include:
1. Clear headings (#, ##, ###) and subheadings.
2. Definitions, core principles, and practical examples from the text.
3. Highlighted key terms (**bold**) and mathematical formulas where applicable.
4. Structured markdown tables or diagrams where helpful.
5. Explicit source page citations (e.g. [Page X]) throughout the notes.`;
        break;

      case "summary":
        promptInstruction = `Generate a comprehensive "PDF Summary" (${detailLevel} mode).
Include:
1. Short overview of the document scope.
2. Main topics and subtopics breakdown.
3. Core concepts and key takeaways.
4. Formulas, definitions, and essential conclusions.`;
        break;

      case "questions":
        promptInstruction = `Generate comprehensive practice questions with answers and explanations (${difficulty} level).
Include:
1. Short-Answer Questions (with answers).
2. Long-Answer / Essay Questions (with structured point-wise answers).
3. Definition-Based Questions.
4. Conceptual & Application-Based Questions.
Include page references [Page X] for answers.`;
        break;

      case "revision":
        promptInstruction = `Generate ultra-concise "Quick Revision Notes" for fast review before an exam.
Include:
1. Key Definitions Cheatsheet.
2. Important Formulas & Rules.
3. Bullet-point summaries of main concepts.
4. Important Differences & Comparisons (table format).
5. Quick-Revision 5-Minute Checklist.`;
        break;

      case "explanation":
        promptInstruction = `Provide a thorough, student-friendly explanation of the topic "${targetTopic || topicsScope}".
Include:
1. Simple beginner explanation with analogies.
2. In-depth technical breakdown based on the document.
3. Real-world examples or applications.
4. Key exam tips and common pitfalls to avoid.
5. Source page references [Page X].`;
        break;

      default:
        promptInstruction = `Generate comprehensive study notes based on the provided document.`;
    }

    const content = await askGroq([
      {
        role: "system",
        content: `You are an elite academic tutor and study assistant.
Base your responses strictly on the provided PDF text. Distinguish verified facts from general guidance. Cite source pages where available (e.g. [Page X]).`,
      },
      {
        role: "user",
        content: `${promptInstruction}

Topics Scope: ${topicsScope}
Document Content:
${trimmedContext}`,
      },
    ]);

    return res.json({ content });
  } catch (error) {
    console.error("PDF generation error:", error);
    return res.status(500).json({ error: "Failed to generate study materials." });
  }
});

// 9. PDF Study Assistant: Ask questions / Chat with PDF
app.post("/api/ai/pdf/chat", async (req, res) => {
  try {
    const { question, pdfContext, chatHistory = [] } = req.body;

    if (!question || !pdfContext) {
      return res.status(400).json({ error: "Question and PDF context are required." });
    }

    const trimmedContext = pdfContext.slice(0, 22000);

    const messages = [
      {
        role: "system",
        content: `You are an AI study tutor assisting a student with their uploaded PDF document.
Answer the user's question accurately using the provided PDF context as ground truth.
If information is from the PDF, cite the page number (e.g., [Page 3]).
If the student asks for something outside the PDF, answer helpfully while clarifying that it extends beyond the provided notes.`,
      },
      ...chatHistory.slice(-6).map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
      {
        role: "user",
        content: `PDF Content:
${trimmedContext}

Question: ${question}`,
      },
    ];

    const answer = await askGroq(messages);
    return res.json({ answer });
  } catch (error) {
    console.error("PDF chat error:", error);
    return res.status(500).json({ error: "Failed to answer question from PDF." });
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

