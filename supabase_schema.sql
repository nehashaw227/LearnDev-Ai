-- ==============================================================================
-- LearnDev-AI Supabase Schema & Row Level Security (RLS) Configuration
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ==============================================================================

-- 1. Ensure roadmaps DELETE policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'roadmaps' AND policyname = 'Users can delete own roadmaps'
  ) THEN
    CREATE POLICY "Users can delete own roadmaps"
    ON public.roadmaps FOR DELETE
    TO authenticated
    USING (auth.uid()::text = "userId"::text);
  END IF;
END $$;

-- 2. Chat History Table (for persistent AI query discussions)
CREATE TABLE IF NOT EXISTS public.chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  roadmap_id TEXT,
  topic_id TEXT,
  title TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for chat_history
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- Chat History Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_history' AND policyname = 'Users can view own chat history') THEN
    CREATE POLICY "Users can view own chat history"
    ON public.chat_history FOR SELECT
    TO authenticated
    USING (auth.uid()::text = user_id::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_history' AND policyname = 'Users can insert own chat history') THEN
    CREATE POLICY "Users can insert own chat history"
    ON public.chat_history FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid()::text = user_id::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_history' AND policyname = 'Users can update own chat history') THEN
    CREATE POLICY "Users can update own chat history"
    ON public.chat_history FOR UPDATE
    TO authenticated
    USING (auth.uid()::text = user_id::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_history' AND policyname = 'Users can delete own chat history') THEN
    CREATE POLICY "Users can delete own chat history"
    ON public.chat_history FOR DELETE
    TO authenticated
    USING (auth.uid()::text = user_id::text);
  END IF;
END $$;

-- 3. Topic Notes Table (if not already created)
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "roadmapId" TEXT,
  content TEXT NOT NULL,
  "updatedAt" TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'Users can manage own notes') THEN
    CREATE POLICY "Users can manage own notes"
    ON public.notes FOR ALL
    TO authenticated
    USING (auth.uid()::text = "userId"::text)
    WITH CHECK (auth.uid()::text = "userId"::text);
  END IF;
END $$;

-- 4. Topic Quizzes Table (if not already created)
CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "roadmapId" TEXT,
  questions JSONB NOT NULL,
  score INT DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  "updatedAt" TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quizzes' AND policyname = 'Users can manage own quizzes') THEN
    CREATE POLICY "Users can manage own quizzes"
    ON public.quizzes FOR ALL
    TO authenticated
    USING (auth.uid()::text = "userId"::text)
    WITH CHECK (auth.uid()::text = "userId"::text);
  END IF;
END $$;

-- 5. AI PDF Study Assistant: Workspaces & Generated Materials Table
CREATE TABLE IF NOT EXISTS public.pdf_study_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT DEFAULT 0,
  page_count INT DEFAULT 1,
  subject TEXT,
  overview TEXT,
  topics JSONB DEFAULT '[]'::jsonb,
  key_concepts JSONB DEFAULT '[]'::jsonb,
  formulas_present BOOLEAN DEFAULT false,
  extracted_text TEXT,
  generated_materials JSONB DEFAULT '{}'::jsonb,
  chat_messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pdf_study_workspaces ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pdf_study_workspaces' AND policyname = 'Users can view own pdf workspaces') THEN
    CREATE POLICY "Users can view own pdf workspaces"
    ON public.pdf_study_workspaces FOR SELECT
    TO authenticated
    USING (auth.uid()::text = user_id::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pdf_study_workspaces' AND policyname = 'Users can insert own pdf workspaces') THEN
    CREATE POLICY "Users can insert own pdf workspaces"
    ON public.pdf_study_workspaces FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid()::text = user_id::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pdf_study_workspaces' AND policyname = 'Users can update own pdf workspaces') THEN
    CREATE POLICY "Users can update own pdf workspaces"
    ON public.pdf_study_workspaces FOR UPDATE
    TO authenticated
    USING (auth.uid()::text = user_id::text);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pdf_study_workspaces' AND policyname = 'Users can delete own pdf workspaces') THEN
    CREATE POLICY "Users can delete own pdf workspaces"
    ON public.pdf_study_workspaces FOR DELETE
    TO authenticated
    USING (auth.uid()::text = user_id::text);
  END IF;
END $$;

