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

// 4. Generate revision notes
export async function generateRevisionNotes(
  content: string
) {
  const result = await callAI<{ notes: string }>(
    "/api/ai/revision",
    {
      content,
    }
  );

  return result.notes;
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

