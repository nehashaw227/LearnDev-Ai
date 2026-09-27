import { supabase } from './supabase';
import { DetectedTopic, FlashcardItem, PdfQuizQuestion } from './ai';

export interface SavedPdfWorkspace {
  id: string;
  userId: string;
  fileName: string;
  fileSizeBytes: number;
  pageCount: number;
  subject: string;
  overview: string;
  topics: DetectedTopic[];
  keyConcepts: string[];
  formulasPresent: boolean;
  extractedText: string;
  generatedMaterials: {
    importantTopics?: string;
    examNotes?: string;
    summary?: string;
    questions?: string;
    revision?: string;
    flashcards?: Array<FlashcardItem & { learned?: boolean }>;
    explanation?: string;
    quiz?: PdfQuizQuestion[];
  };
  chatMessages: Array<{ role: 'user' | 'ai'; content: string; timestamp?: string }>;
  createdAt: string;
  updatedAt: string;
}

const LOCAL_STORAGE_KEY_PREFIX = 'learndev_pdf_workspaces_';

function getLocalKey(userId: string): string {
  return `${LOCAL_STORAGE_KEY_PREFIX}${userId}`;
}

function getLocalWorkspaces(userId: string): SavedPdfWorkspace[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getLocalKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Failed reading PDF workspaces from localStorage:', err);
    return [];
  }
}

function setLocalWorkspaces(userId: string, workspaces: SavedPdfWorkspace[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getLocalKey(userId), JSON.stringify(workspaces));
  } catch (err) {
    console.warn('Failed saving PDF workspaces to localStorage:', err);
  }
}

export async function fetchUserPdfWorkspaces(userId: string): Promise<SavedPdfWorkspace[]> {
  const localList = getLocalWorkspaces(userId);

  try {
    const { data, error } = await supabase
      .from('pdf_study_workspaces')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      return localList.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }

    if (data && Array.isArray(data)) {
      const serverList: SavedPdfWorkspace[] = data.map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        fileName: d.file_name,
        fileSizeBytes: d.file_size_bytes || 0,
        pageCount: d.page_count || 1,
        subject: d.subject || '',
        overview: d.overview || '',
        topics: d.topics || [],
        keyConcepts: d.key_concepts || [],
        formulasPresent: !!d.formulas_present,
        extractedText: d.extracted_text || '',
        generatedMaterials: d.generated_materials || {},
        chatMessages: d.chat_messages || [],
        createdAt: d.created_at || d.createdAt,
        updatedAt: d.updated_at || d.updatedAt,
      }));

      // Merge server and local caches
      const map = new Map<string, SavedPdfWorkspace>();
      localList.forEach((w) => map.set(w.id, w));
      serverList.forEach((w) => map.set(w.id, w));

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setLocalWorkspaces(userId, merged);
      return merged;
    }
  } catch (err) {
    console.warn('Error querying Supabase for PDF workspaces:', err);
  }

  return localList.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function savePdfWorkspace(workspace: SavedPdfWorkspace): Promise<void> {
  const userId = workspace.userId;
  const current = getLocalWorkspaces(userId);
  const idx = current.findIndex((w) => w.id === workspace.id);

  if (idx >= 0) {
    current[idx] = workspace;
  } else {
    current.unshift(workspace);
  }
  setLocalWorkspaces(userId, current);

  try {
    await supabase.from('pdf_study_workspaces').upsert({
      id: workspace.id,
      user_id: workspace.userId,
      file_name: workspace.fileName,
      file_size_bytes: workspace.fileSizeBytes,
      page_count: workspace.pageCount,
      subject: workspace.subject,
      overview: workspace.overview,
      topics: workspace.topics,
      key_concepts: workspace.keyConcepts,
      formulas_present: workspace.formulasPresent,
      extracted_text: workspace.extractedText,
      generated_materials: workspace.generatedMaterials,
      chat_messages: workspace.chatMessages,
      created_at: workspace.createdAt,
      updated_at: workspace.updatedAt,
    });
  } catch (err) {
    console.warn('Could not sync PDF workspace to Supabase:', err);
  }
}

export async function deletePdfWorkspace(id: string, userId: string): Promise<void> {
  const current = getLocalWorkspaces(userId).filter((w) => w.id !== id);
  setLocalWorkspaces(userId, current);

  try {
    await supabase
      .from('pdf_study_workspaces')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
  } catch (err) {
    console.warn('Could not delete PDF workspace from Supabase:', err);
  }
}
