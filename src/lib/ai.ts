export const modelName = "llama-3.3-70b-versatile";

// Common function to communicate with the backend
async function callAI<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "AI request failed.");
  }

  return result as T;
}

// 1. Generate roadmap
export async function generateRoadmap(
  syllabus: string,
  difficulty: string = "beginner"
) {
  const result = await callAI<{
    data: Array<{
      id: string;
      title: string;
      description: string;
      order: number;
    }>;
  }>("/api/ai/roadmap", {
    syllabus,
    difficulty,
  });

  return result.data;
}

// 2. Solve doubt
export async function solveDoubt(
  topic: string,
  question: string
) {
  const result = await callAI<{ answer: string }>(
    "/api/ai/doubt",
    {
      topic,
      question,
    }
  );

  return result.answer;
}

// 3. Generate quiz
export async function generateQuiz(
  topic: string,
  description: string
) {
  const result = await callAI<{
    data: Array<{
      question: string;
      options: string[];
      correctAnswer: string;
    }>;
  }>("/api/ai/quiz", {
    topic,
    description,
  });

  return result.data;
}

// 4. Generate revision notes (Comprehensive, exam-oriented, structured)
export async function generateRevisionNotes(
  topicOrContent: string,
  description?: string,
  additionalContent?: string
) {
  const result = await callAI<{ notes: string }>(
    "/api/ai/revision",
    {
      topic: topicOrContent,
      description: description || "",
      content: additionalContent || topicOrContent,
    }
  );

  return result.notes;
}

// 4b. Generate In-Depth Topic Study Guide
export async function generateTopicStudyGuide(
  topic: string,
  description: string
) {
  const result = await callAI<{ guide: string }>(
    "/api/ai/topic-guide",
    {
      topic,
      description,
    }
  );

  return result.guide;
}

// 5. Find YouTube video
export async function findYouTubeVideo(
  topic: string,
  description: string
) {
  const result = await callAI<{ result: string }>(
    "/api/ai/youtube",
    {
      topic,
      description,
    }
  );

  return result.result;
}

// 6. Generate topic summary
export async function generateTopicSummary(
  topic: string,
  description: string
) {
  const result = await callAI<{ summary: string }>(
    "/api/ai/summary",
    {
      topic,
      description,
    }
  );

  return result.summary;
}

// 7. PDF Study Assistant: Analyze Document
export interface DetectedTopic {
  id: string;
  title: string;
  subtopics: string[];
  pageRange?: string;
  status?: 'not-started' | 'in-progress' | 'completed';
}

export interface PdfAnalysisResult {
  subject: string;
  overview: string;
  topics: DetectedTopic[];
  keyConcepts: string[];
  formulasPresent: boolean;
}

export interface FlashcardItem {
  front: string;
  back: string;
  topic?: string;
  pageRef?: string;
}

export interface PdfQuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  pageRef?: string;
}

export async function analyzePdfDocument(
  pdfText: string,
  fileName: string,
  pageCount: number
): Promise<PdfAnalysisResult> {
  return await callAI<PdfAnalysisResult>("/api/ai/pdf/analyze", {
    pdfText,
    fileName,
    pageCount,
  });
}

// 8. PDF Study Assistant: Generate Materials
export async function generatePdfStudyMaterial(params: {
  materialType: 'important-topics' | 'exam-notes' | 'summary' | 'questions' | 'revision' | 'flashcards' | 'explanation' | 'quiz';
  pdfContext: string;
  selectedTopics?: string[];
  difficulty?: string;
  detailLevel?: string;
  targetTopic?: string | null;
}): Promise<{ content?: string; data?: any[] }> {
  return await callAI<{ content?: string; data?: any[] }>("/api/ai/pdf/generate", params);
}

// 9. PDF Study Assistant: Chat with PDF
export async function askPdfTutor(
  question: string,
  pdfContext: string,
  chatHistory: Array<{ role: string; content: string }> = []
): Promise<string> {
  const result = await callAI<{ answer: string }>("/api/ai/pdf/chat", {
    question,
    pdfContext,
    chatHistory,
  });
  return result.answer;
}


