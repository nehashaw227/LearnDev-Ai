import { supabase } from './supabase';

export interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  timestamp?: string;
}

export interface ChatConversation {
  id: string;
  userId: string;
  roadmapId: string;
  topicId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

const LOCAL_STORAGE_KEY_PREFIX = 'learndev_chat_history_';

function getLocalKey(userId: string): string {
  return `${LOCAL_STORAGE_KEY_PREFIX}${userId}`;
}

function getLocalConversations(userId: string): ChatConversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getLocalKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Failed reading chat history from localStorage:', err);
    return [];
  }
}

function setLocalConversations(userId: string, convs: ChatConversation[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getLocalKey(userId), JSON.stringify(convs));
  } catch (err) {
    console.warn('Failed saving chat history to localStorage:', err);
  }
}

export async function fetchTopicConversations(
  userId: string,
  roadmapId: string,
  topicId: string
): Promise<ChatConversation[]> {
  const localList = getLocalConversations(userId).filter(
    (c) => c.roadmapId === roadmapId && c.topicId === topicId
  );

  try {
    const { data, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', userId)
      .eq('roadmap_id', roadmapId)
      .eq('topic_id', topicId)
      .order('updated_at', { ascending: false });

    if (error) {
      return localList.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }

    if (data && Array.isArray(data)) {
      const serverConvs: ChatConversation[] = data.map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        roadmapId: d.roadmap_id,
        topicId: d.topic_id,
        title: d.title,
        messages: d.messages || [],
        createdAt: d.created_at || d.createdAt,
        updatedAt: d.updated_at || d.updatedAt,
      }));

      const mergedMap = new Map<string, ChatConversation>();
      localList.forEach((c) => mergedMap.set(c.id, c));
      serverConvs.forEach((c) => mergedMap.set(c.id, c));

      const merged = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      const allLocal = getLocalConversations(userId).filter(
        (c) => !(c.roadmapId === roadmapId && c.topicId === topicId)
      );
      setLocalConversations(userId, [...allLocal, ...merged]);

      return merged;
    }
  } catch (err) {
    console.warn('Error fetching chat history from Supabase:', err);
  }

  return localList.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function fetchRoadmapConversations(
  userId: string,
  roadmapId?: string
): Promise<ChatConversation[]> {
  const allLocal = getLocalConversations(userId);
  const localList = roadmapId ? allLocal.filter((c) => c.roadmapId === roadmapId) : allLocal;

  try {
    let query = supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (roadmapId) {
      query = query.eq('roadmap_id', roadmapId);
    }

    const { data, error } = await query;

    if (!error && data && Array.isArray(data)) {
      const serverConvs: ChatConversation[] = data.map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        roadmapId: d.roadmap_id,
        topicId: d.topic_id,
        title: d.title,
        messages: d.messages || [],
        createdAt: d.created_at || d.createdAt,
        updatedAt: d.updated_at || d.updatedAt,
      }));

      const mergedMap = new Map<string, ChatConversation>();
      localList.forEach((c) => mergedMap.set(c.id, c));
      serverConvs.forEach((c) => mergedMap.set(c.id, c));

      return Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }
  } catch (err) {
    console.warn('Error fetching roadmap conversations from Supabase:', err);
  }

  return localList.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function persistConversation(conv: ChatConversation): Promise<void> {
  const userId = conv.userId;
  const currentLocal = getLocalConversations(userId);
  const existingIdx = currentLocal.findIndex((c) => c.id === conv.id);

  if (existingIdx >= 0) {
    currentLocal[existingIdx] = conv;
  } else {
    currentLocal.unshift(conv);
  }
  setLocalConversations(userId, currentLocal);

  try {
    await supabase.from('chat_history').upsert({
      id: conv.id,
      user_id: conv.userId,
      roadmap_id: conv.roadmapId,
      topic_id: conv.topicId,
      title: conv.title,
      messages: conv.messages,
      created_at: conv.createdAt,
      updated_at: conv.updatedAt,
    });
  } catch (err) {
    console.warn('Could not sync conversation to Supabase:', err);
  }
}

export async function removeConversation(
  convId: string,
  userId: string
): Promise<void> {
  const currentLocal = getLocalConversations(userId).filter((c) => c.id !== convId);
  setLocalConversations(userId, currentLocal);

  try {
    await supabase
      .from('chat_history')
      .delete()
      .eq('id', convId)
      .eq('user_id', userId);
  } catch (err) {
    console.warn('Could not delete conversation from Supabase:', err);
  }
}

export async function removeRoadmapConversations(
  roadmapId: string,
  userId: string
): Promise<void> {
  const currentLocal = getLocalConversations(userId).filter(
    (c) => c.roadmapId !== roadmapId
  );
  setLocalConversations(userId, currentLocal);

  try {
    await supabase
      .from('chat_history')
      .delete()
      .eq('roadmap_id', roadmapId)
      .eq('user_id', userId);
  } catch (err) {
    console.warn('Could not delete roadmap conversations from Supabase:', err);
  }
}
