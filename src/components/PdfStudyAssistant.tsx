import { useState, useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { extractTextFromPdf, ExtractedPdfContent } from '../lib/pdfExtractor';
import {
  analyzePdfDocument,
  generatePdfStudyMaterial,
  askPdfTutor,
  PdfAnalysisResult,
  DetectedTopic,
  FlashcardItem,
  PdfQuizQuestion,
} from '../lib/ai';
import {
  SavedPdfWorkspace,
  fetchUserPdfWorkspaces,
  savePdfWorkspace,
  deletePdfWorkspace,
} from '../lib/pdfStorage';
import {
  UploadCloud,
  FileText,
  BookOpen,
  HelpCircle,
  Sparkles,
  CheckCircle,
  Download,
  Trash2,
  Send,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Bookmark,
  Layers,
  Check,
  AlertCircle,
  ArrowRight,
  Save,
  MessageSquare
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';

interface PdfStudyAssistantProps {
  user: User | null;
  onBackToRoadmaps?: () => void;
}

export function PdfStudyAssistant({ user, onBackToRoadmaps }: PdfStudyAssistantProps) {
  // Upload and Extraction State
  const [extractedPdf, setExtractedPdf] = useState<ExtractedPdfContent | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PdfAnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Topics Selection & Progress State
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [topicsWithProgress, setTopicsWithProgress] = useState<DetectedTopic[]>([]);

  // Generator Options State
  const [selectedTool, setSelectedTool] = useState<
    'important-topics' | 'exam-notes' | 'summary' | 'questions' | 'revision' | 'flashcards' | 'explanation' | 'quiz'
  >('exam-notes');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [detailLevel, setDetailLevel] = useState<'short' | 'detailed'>('detailed');
  const [targetTopicForExplanation, setTargetTopicForExplanation] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Generated Materials State
  const [generatedMaterials, setGeneratedMaterials] = useState<{
    importantTopics?: string;
    examNotes?: string;
    summary?: string;
    questions?: string;
    revision?: string;
    flashcards?: Array<FlashcardItem & { learned?: boolean }>;
    explanation?: string;
    quiz?: PdfQuizQuestion[];
  }>({});

  // Active View Tab in Results
  const [activeResultTab, setActiveResultTab] = useState<string>('exam-notes');

  // Interactive Flashcards State
  const [currentFlashcardIdx, setCurrentFlashcardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Interactive Quiz State
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // PDF Chat State
  const [pdfChatInput, setPdfChatInput] = useState('');
  const [pdfChatMessages, setPdfChatMessages] = useState<Array<{ role: 'user' | 'ai'; content: string; timestamp?: string }>>([]);
  const [isPdfChatting, setIsPdfChatting] = useState(false);

  // Saved Workspaces State
  const [savedWorkspaces, setSavedWorkspaces] = useState<SavedPdfWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<SavedPdfWorkspace | null>(null);

  // Load Saved Workspaces on Mount
  useEffect(() => {
    if (!user) return;
    const loadWorkspaces = async () => {
      const list = await fetchUserPdfWorkspaces(user.id);
      setSavedWorkspaces(list);
    };
    loadWorkspaces();
  }, [user]);

  // Handle PDF File Selection / Drop
  const handleFileProcess = async (file: File) => {
    setExtractError(null);
    setIsExtracting(true);
    setAnalysis(null);
    setGeneratedMaterials({});
    setPdfChatMessages([]);
    setActiveWorkspaceId(null);

    try {
      const extracted = await extractTextFromPdf(file);
      setExtractedPdf(extracted);
      setIsExtracting(false);

      if (extracted.isScannedOrEmpty) {
        setExtractError(
          'This PDF appears to be scanned or contains image-only pages with little selectable text. OCR is not currently supported; please upload a PDF with selectable digital text for best results.'
        );
        return;
      }

      // Analyze document structure and topics
      setIsAnalyzing(true);
      const analysisResult = await analyzePdfDocument(extracted.fullText, extracted.fileName, extracted.pageCount);
      setAnalysis(analysisResult);

      const topicsInit = analysisResult.topics.map((t) => ({
        ...t,
        status: 'not-started' as const,
      }));
      setTopicsWithProgress(topicsInit);
      setSelectedTopicIds(topicsInit.map((t) => t.id));
      if (topicsInit.length > 0) {
        setTargetTopicForExplanation(topicsInit[0].title);
      }
    } catch (err: any) {
      console.error('PDF extraction/analysis error:', err);
      setExtractError(err.message || 'Failed to process PDF.');
      setIsExtracting(false);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  // Toggle Topic Checkbox
  const toggleTopicSelect = (topicId: string) => {
    setSelectedTopicIds((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId]
    );
  };

  // Toggle Topic Mastery Status (Not Started -> In Progress -> Completed)
  const cycleTopicStatus = (topicId: string) => {
    setTopicsWithProgress((prev) =>
      prev.map((t) => {
        if (t.id !== topicId) return t;
        const nextStatus =
          t.status === 'not-started' ? 'in-progress' : t.status === 'in-progress' ? 'completed' : 'not-started';
        return { ...t, status: nextStatus };
      })
    );
  };

  // Generate Selected Material
  const handleGenerate = async () => {
    if (!extractedPdf) return;
    setIsGenerating(true);

    try {
      const selectedTitles = topicsWithProgress
        .filter((t) => selectedTopicIds.includes(t.id))
        .map((t) => t.title);

      const res = await generatePdfStudyMaterial({
        materialType: selectedTool,
        pdfContext: extractedPdf.fullText,
        selectedTopics: selectedTitles,
        difficulty,
        detailLevel,
        targetTopic: selectedTool === 'explanation' ? targetTopicForExplanation : undefined,
      });

      if (selectedTool === 'flashcards' && res.data) {
        setGeneratedMaterials((prev) => ({
          ...prev,
          flashcards: res.data?.map((f: any) => ({ ...f, learned: false })),
        }));
        setCurrentFlashcardIdx(0);
        setIsFlipped(false);
      } else if (selectedTool === 'quiz' && res.data) {
        setGeneratedMaterials((prev) => ({
          ...prev,
          quiz: res.data,
        }));
        setQuizAnswers({});
        setQuizSubmitted(false);
      } else if (res.content) {
        setGeneratedMaterials((prev) => {
          const map: Record<string, string> = {
            'important-topics': 'importantTopics',
            'exam-notes': 'examNotes',
            summary: 'summary',
            questions: 'questions',
            revision: 'revision',
            explanation: 'explanation',
          };
          const key = map[selectedTool];
          return key ? { ...prev, [key]: res.content } : prev;
        });
      }

      setActiveResultTab(selectedTool);
    } catch (err: any) {
      console.error('Study material generation error:', err);
      alert('Failed to generate study material: ' + (err.message || 'Unknown error'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Send message in PDF Chat
  const handleSendPdfChat = async () => {
    if (!pdfChatInput.trim() || !extractedPdf || isPdfChatting) return;
    const q = pdfChatInput.trim();
    setPdfChatInput('');
    setIsPdfChatting(true);

    const userMsg = { role: 'user' as const, content: q, timestamp: new Date().toISOString() };
    const tempMsgs = [...pdfChatMessages, userMsg];
    setPdfChatMessages(tempMsgs);

    try {
      const answer = await askPdfTutor(q, extractedPdf.fullText, pdfChatMessages);
      const aiMsg = { role: 'ai' as const, content: answer, timestamp: new Date().toISOString() };
      setPdfChatMessages([...tempMsgs, aiMsg]);
    } catch (err: any) {
      console.error('PDF Chat Error:', err);
      setPdfChatMessages([
        ...tempMsgs,
        { role: 'ai' as const, content: 'Could not connect to AI assistant. Please try again.' },
      ]);
    } finally {
      setIsPdfChatting(false);
    }
  };

  // Save current workspace
  const handleSaveWorkspace = async () => {
    if (!user || !extractedPdf) return;
    setIsSaving(true);

    const workspace: SavedPdfWorkspace = {
      id: activeWorkspaceId || crypto.randomUUID(),
      userId: user.id,
      fileName: extractedPdf.fileName,
      fileSizeBytes: extractedPdf.fileSizeBytes,
      pageCount: extractedPdf.pageCount,
      subject: analysis?.subject || 'Study Workspace',
      overview: analysis?.overview || '',
      topics: topicsWithProgress,
      keyConcepts: analysis?.keyConcepts || [],
      formulasPresent: analysis?.formulasPresent || false,
      extractedText: extractedPdf.fullText,
      generatedMaterials,
      chatMessages: pdfChatMessages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await savePdfWorkspace(workspace);
    setActiveWorkspaceId(workspace.id);
    const updated = await fetchUserPdfWorkspaces(user.id);
    setSavedWorkspaces(updated);
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Load a saved workspace
  const handleOpenWorkspace = (ws: SavedPdfWorkspace) => {
    setActiveWorkspaceId(ws.id);
    setExtractedPdf({
      fileName: ws.fileName,
      fileSizeBytes: ws.fileSizeBytes,
      pageCount: ws.pageCount,
      fullText: ws.extractedText,
      pages: [],
      isScannedOrEmpty: false,
    });
    setAnalysis({
      subject: ws.subject,
      overview: ws.overview,
      topics: ws.topics,
      keyConcepts: ws.keyConcepts,
      formulasPresent: ws.formulasPresent,
    });
    setTopicsWithProgress(ws.topics);
    setSelectedTopicIds(ws.topics.map((t) => t.id));
    setGeneratedMaterials(ws.generatedMaterials || {});
    setPdfChatMessages(ws.chatMessages || []);
    setIsHistoryDrawerOpen(false);
    if (ws.topics.length > 0) {
      setTargetTopicForExplanation(ws.topics[0].title);
    }
  };

  // Delete saved workspace
  const handleDeleteWorkspace = async (ws: SavedPdfWorkspace) => {
    if (!user) return;
    await deletePdfWorkspace(ws.id, user.id);
    setSavedWorkspaces((prev) => prev.filter((w) => w.id !== ws.id));
    if (activeWorkspaceId === ws.id) {
      setActiveWorkspaceId(null);
    }
    setWorkspaceToDelete(null);
  };

  // Download Generated Notes / Summary as formatted PDF
  const handleDownloadPdf = () => {
    if (!extractedPdf) return;

    try {
      const doc = new jsPDF();
      let y = 20;
      const margin = 15;
      const pageWidth = doc.internal.pageSize.getWidth();
      const wrapWidth = pageWidth - margin * 2;

      const addText = (text: string, fontSize: number, isBold: boolean = false, textColor: string = '#163824') => {
        if (!text) return;
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.setTextColor(textColor);
        const lines = doc.splitTextToSize(text, wrapWidth);
        for (const line of lines) {
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, margin, y);
          y += fontSize * 0.4 + 2;
        }
        y += 4;
      };

      doc.setFillColor(235, 242, 235);
      doc.rect(0, 0, pageWidth, 26, 'F');
      addText('LEARNDEV AI — PDF STUDY INTELLIGENCE', 16, true, '#163824');
      y = 35;
      addText(`Source Document: ${extractedPdf.fileName}`, 12, true, '#163824');
      if (analysis?.subject) addText(`Subject: ${analysis.subject}`, 11, false, '#4d6655');
      y += 4;

      const content =
        activeResultTab === 'important-topics'
          ? generatedMaterials.importantTopics
          : activeResultTab === 'exam-notes'
          ? generatedMaterials.examNotes
          : activeResultTab === 'summary'
          ? generatedMaterials.summary
          : activeResultTab === 'questions'
          ? generatedMaterials.questions
          : activeResultTab === 'revision'
          ? generatedMaterials.revision
          : activeResultTab === 'explanation'
          ? generatedMaterials.explanation
          : '';

      if (content) {
        // Strip markdown hashes for clean print
        const plain = content.replace(/#{1,6}\s?/g, '').trim();
        addText(plain, 10, false, '#2b4433');
      }

      doc.save(`LearnDev-Study-${activeResultTab}-${extractedPdf.fileName.replace(/\.[^/.]+$/, '')}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Failed to export PDF.');
    }
  };

  // Download Generated Material as Plain Text
  const handleDownloadTxt = () => {
    if (!extractedPdf) return;
    const content =
      activeResultTab === 'important-topics'
        ? generatedMaterials.importantTopics
        : activeResultTab === 'exam-notes'
        ? generatedMaterials.examNotes
        : activeResultTab === 'summary'
        ? generatedMaterials.summary
        : activeResultTab === 'questions'
        ? generatedMaterials.questions
        : activeResultTab === 'revision'
        ? generatedMaterials.revision
        : activeResultTab === 'explanation'
        ? generatedMaterials.explanation
        : '';

    if (!content) return;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LearnDev-Study-${activeResultTab}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Completed Topics Count for Progress Bar
  const completedTopicsCount = topicsWithProgress.filter((t) => t.status === 'completed').length;
  const progressPercent =
    topicsWithProgress.length > 0 ? Math.round((completedTopicsCount / topicsWithProgress.length) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f5f5ef] overflow-hidden">
      {/* Delete Workspace Confirmation Modal */}
      <AnimatePresence>
        {workspaceToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <div className="bg-[#f5f5ef] border border-[#cfdccf] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-[#163824]">Delete Workspace</h3>
                  <p className="text-xs text-[#5c7564]">Study notes and questions will be removed.</p>
                </div>
              </div>
              <p className="text-sm text-[#385240] leading-relaxed">
                Are you sure you want to delete <strong className="text-[#163824]">"{workspaceToDelete.fileName}"</strong>?
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setWorkspaceToDelete(null)}
                  className="px-4 py-2 rounded-xl border border-[#cfdccf] hover:bg-[#e4ede3] text-[#163824] font-bold text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteWorkspace(workspaceToDelete)}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Bar */}
      <header className="px-8 py-4 bg-[#f8faf7] border-b border-[#d5ded5] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          {onBackToRoadmaps && (
            <button
              onClick={onBackToRoadmaps}
              className="px-3 py-1.5 bg-white border border-[#cfdccf] hover:border-[#163824] text-[#163824] font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" /> 3D Roadmaps
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black uppercase tracking-tight text-[#163824]">
                AI PDF Study Assistant
              </h2>
              <span className="px-2 py-0.5 bg-[#cbe3cf] text-[#163824] text-[9px] font-black uppercase tracking-wider rounded-md">
                Neural Notes
              </span>
            </div>
            <p className="text-xs text-[#5c7564]">
              Upload textbook chapters or lecture slides to generate exam notes, flashcards, and quizzes.
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-3">
          {extractedPdf && (
            <>
              <button
                onClick={handleSaveWorkspace}
                disabled={isSaving}
                className="px-4 py-2 bg-[#cbe3cf] hover:bg-[#b8d7bd] text-[#163824] font-black text-xs uppercase tracking-tight rounded-xl flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveSuccess ? <Check className="w-4 h-4 text-[#163824]" /> : <Save className="w-4 h-4" />}
                {saveSuccess ? 'Saved!' : 'Save Material'}
              </button>

              <button
                onClick={() => {
                  setExtractedPdf(null);
                  setAnalysis(null);
                  setGeneratedMaterials({});
                  setPdfChatMessages([]);
                  setActiveWorkspaceId(null);
                }}
                className="px-3 py-2 bg-white border border-[#cfdccf] hover:border-[#163824] text-[#163824] font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
              >
                Upload New PDF
              </button>
            </>
          )}

          <button
            onClick={() => setIsHistoryDrawerOpen(!isHistoryDrawerOpen)}
            className={`px-4 py-2 border rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
              isHistoryDrawerOpen
                ? 'bg-[#163824] border-[#163824] text-white shadow-sm'
                : 'bg-white border-[#cfdccf] text-[#163824] hover:bg-[#eaf1ea]'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            Saved Materials ({savedWorkspaces.length})
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left / Main Content */}
        <div className="flex-1 flex flex-col overflow-y-auto p-8 space-y-8">
          {!extractedPdf ? (
            /* Upload & Drag-and-Drop Area */
            <div className="max-w-3xl mx-auto w-full pt-10 space-y-6">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#cfdccf] hover:border-[#163824] bg-[#eaf1ea]/40 hover:bg-[#eaf1ea]/80 rounded-3xl p-16 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-4 group shadow-sm"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileProcess(e.target.files[0])}
                />
                <div className="w-16 h-16 rounded-2xl bg-white border border-[#cfdccf] flex items-center justify-center text-[#163824] group-hover:scale-110 transition-transform shadow-sm">
                  {isExtracting ? (
                    <Loader2 className="w-8 h-8 animate-spin text-[#275936]" />
                  ) : (
                    <UploadCloud className="w-8 h-8 text-[#275936]" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-[#163824]">
                    {isExtracting ? 'Analyzing PDF Content...' : 'Upload Study Material (PDF)'}
                  </h3>
                  <p className="text-xs text-[#5c7564] mt-1 max-w-sm mx-auto">
                    Drag and drop your lecture notes, textbook chapters, or syllabus PDF here, or click to browse files.
                  </p>
                </div>
                <div className="pt-2 flex items-center gap-4 text-[10px] font-mono text-[#7a9482]">
                  <span>• Supports Multi-page PDFs</span>
                  <span>• Max 30 MB</span>
                  <span>• Instant Topic Extraction</span>
                </div>
              </div>

              {extractError && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-2xl flex items-start gap-3 text-xs leading-relaxed">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">Notice: </strong>
                    {extractError}
                  </div>
                </div>
              )}

              {/* Quick Feature Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
                <div className="p-5 bg-white border border-[#d2ded2] rounded-2xl space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-[#cbe3cf] flex items-center justify-center text-[#163824]">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-tight text-[#163824]">Exam-Oriented Notes</h4>
                  <p className="text-[11px] text-[#5c7564] leading-relaxed">
                    Auto-structures chapters into high-yield exam summaries, formulas, and definitions.
                  </p>
                </div>

                <div className="p-5 bg-white border border-[#d2ded2] rounded-2xl space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-[#cbe3cf] flex items-center justify-center text-[#163824]">
                    <Layers className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-tight text-[#163824]">Interactive Flashcards</h4>
                  <p className="text-[11px] text-[#5c7564] leading-relaxed">
                    Flip, shuffle, and practice key terms with built-in memory mastery tracking.
                  </p>
                </div>

                <div className="p-5 bg-white border border-[#d2ded2] rounded-2xl space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-[#cbe3cf] flex items-center justify-center text-[#163824]">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-tight text-[#163824]">Practice Quizzes & Q&A</h4>
                  <p className="text-[11px] text-[#5c7564] leading-relaxed">
                    Test yourself with multiple-choice questions and instant scoring directly from the text.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Active Document Analysis & Generator Workspace */
            <div className="max-w-6xl mx-auto w-full space-y-8">
              {/* File Info & Analysis Summary Header */}
              <div className="p-6 bg-white border border-[#d2ded2] rounded-2xl shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#e4ede3]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#cbe3cf] flex items-center justify-center text-[#163824] shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black uppercase tracking-tight text-[#163824]">
                        {extractedPdf.fileName}
                      </h3>
                      <p className="text-[11px] text-[#5c7564] font-mono">
                        {extractedPdf.pageCount} Pages • {(extractedPdf.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>

                  {analysis?.subject && (
                    <div className="px-3.5 py-1.5 bg-[#eaf1ea] border border-[#cfdccf] rounded-xl text-xs font-black uppercase tracking-tight text-[#163824]">
                      Course: {analysis.subject}
                    </div>
                  )}
                </div>

                {isAnalyzing ? (
                  <div className="py-6 flex items-center justify-center gap-3 text-xs text-[#5c7564]">
                    <Loader2 className="w-5 h-5 animate-spin text-[#275936]" />
                    <span>Analyzing document structure and detecting topics...</span>
                  </div>
                ) : (
                  analysis && (
                    <div className="space-y-4">
                      <p className="text-xs text-[#385240] leading-relaxed font-medium">
                        {analysis.overview}
                      </p>

                      {/* Topic Mastery Tracker & Progress Bar */}
                      <div className="pt-2">
                        <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-[#5c7564] mb-2">
                          <span>Document Study Progress</span>
                          <span className="text-[#163824]">{completedTopicsCount} / {topicsWithProgress.length} Topics Completed ({progressPercent}%)</span>
                        </div>
                        <div className="w-full h-2 bg-[#e4ede3] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#163824] rounded-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Detected Topics Checklist */}
                      <div className="pt-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5c7564]">
                            Detected Topics (Click status icon to toggle progress):
                          </h4>
                          <button
                            onClick={() => {
                              if (selectedTopicIds.length === topicsWithProgress.length) {
                                setSelectedTopicIds([]);
                              } else {
                                setSelectedTopicIds(topicsWithProgress.map((t) => t.id));
                              }
                            }}
                            className="text-[10px] font-black uppercase tracking-wider text-[#275936] hover:underline"
                          >
                            {selectedTopicIds.length === topicsWithProgress.length ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-44 overflow-y-auto pr-1">
                          {topicsWithProgress.map((topic) => (
                            <div
                              key={topic.id}
                              className={`p-3 rounded-xl border transition-all flex items-center justify-between text-xs ${
                                selectedTopicIds.includes(topic.id)
                                  ? 'bg-[#eaf1ea] border-[#a9c9b1] text-[#163824]'
                                  : 'bg-[#fbfcf8] border-[#cfdccf] text-[#5c7564]'
                              }`}
                            >
                              <div
                                onClick={() => toggleTopicSelect(topic.id)}
                                className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0 pr-2"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedTopicIds.includes(topic.id)}
                                  onChange={() => {}}
                                  className="accent-[#163824] rounded cursor-pointer"
                                />
                                <span className="font-bold truncate">{topic.title}</span>
                              </div>

                              {/* Progress Status Badge / Toggle */}
                              <button
                                onClick={() => cycleTopicStatus(topic.id)}
                                title="Click to cycle status"
                                className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-colors shrink-0 ${
                                  topic.status === 'completed'
                                    ? 'bg-[#163824] text-white'
                                    : topic.status === 'in-progress'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-white border border-[#cfdccf] text-[#7a9482]'
                                }`}
                              >
                                {topic.status === 'completed'
                                  ? 'Done ✓'
                                  : topic.status === 'in-progress'
                                  ? 'In Progress'
                                  : 'Not Started'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* Study Material Generator Selection Section */}
              <div className="p-6 bg-white border border-[#d2ded2] rounded-2xl shadow-sm space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-[#e4ede3]">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight text-[#163824]">
                      Choose Study Material to Generate
                    </h3>
                    <p className="text-[11px] text-[#5c7564]">Select the desired format, options, and click Generate.</p>
                  </div>
                </div>

                {/* Generator Type Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'exam-notes', title: 'Exam Notes', desc: 'Structured notes with definitions & formulas', icon: BookOpen },
                    { id: 'important-topics', title: 'Important Topics', desc: 'High-yield priorities & review rationale', icon: FileText },
                    { id: 'summary', title: 'PDF Summary', desc: 'Core takeaways & executive overview', icon: Sparkles },
                    { id: 'questions', title: 'Practice Q&A', desc: 'Short, long & conceptual questions', icon: HelpCircle },
                    { id: 'revision', title: 'Quick Revision', desc: 'Bullet points & formula cheatsheet', icon: CheckCircle },
                    { id: 'flashcards', title: 'Flashcards', desc: 'Interactive flip cards with mastery tracking', icon: Layers },
                    { id: 'quiz', title: 'Practice Quiz', desc: 'Multiple-choice test with explanations', icon: HelpCircle },
                    { id: 'explanation', title: 'Topic Deep Dive', desc: 'Step-by-step breakdown of chosen topic', icon: BookOpen },
                  ].map((tool) => {
                    const Icon = tool.icon;
                    const isSelected = selectedTool === tool.id;
                    return (
                      <button
                        key={tool.id}
                        onClick={() => setSelectedTool(tool.id as any)}
                        className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#cbe3cf] border-[#163824] text-[#163824] shadow-sm'
                            : 'bg-[#fbfcf8] border-[#cfdccf] hover:border-[#163824] text-[#385240]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Icon className="w-5 h-5 text-[#163824]" />
                          {isSelected && <Check className="w-4 h-4 text-[#163824]" />}
                        </div>
                        <div>
                          <div className="font-black text-xs uppercase tracking-tight">{tool.title}</div>
                          <div className="text-[10px] text-[#5c7564] mt-1 leading-snug">{tool.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Additional Generator Options */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#f8faf7] border border-[#cfdccf] rounded-xl text-xs">
                  {/* Difficulty selector (for questions & quiz) */}
                  {(selectedTool === 'questions' || selectedTool === 'quiz') && (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#5c7564] uppercase text-[10px]">Difficulty:</span>
                      {(['beginner', 'intermediate', 'advanced'] as const).map((lvl) => (
                        <button
                          key={lvl}
                          onClick={() => setDifficulty(lvl)}
                          className={`px-2.5 py-1 rounded-lg uppercase text-[10px] font-black transition-all ${
                            difficulty === lvl
                              ? 'bg-[#163824] text-white shadow-sm'
                              : 'bg-white border border-[#cfdccf] text-[#5c7564]'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Detail Level selector (for notes & summary) */}
                  {(selectedTool === 'exam-notes' || selectedTool === 'summary') && (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#5c7564] uppercase text-[10px]">Detail Level:</span>
                      {(['short', 'detailed'] as const).map((lvl) => (
                        <button
                          key={lvl}
                          onClick={() => setDetailLevel(lvl)}
                          className={`px-2.5 py-1 rounded-lg uppercase text-[10px] font-black transition-all ${
                            detailLevel === lvl
                              ? 'bg-[#163824] text-white shadow-sm'
                              : 'bg-white border border-[#cfdccf] text-[#5c7564]'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Topic Selector for Topic-wise Deep Dive */}
                  {selectedTool === 'explanation' && topicsWithProgress.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#5c7564] uppercase text-[10px]">Target Topic:</span>
                      <select
                        value={targetTopicForExplanation}
                        onChange={(e) => setTargetTopicForExplanation(e.target.value)}
                        className="bg-white border border-[#cfdccf] rounded-lg px-3 py-1 text-xs text-[#163824] outline-none"
                      >
                        {topicsWithProgress.map((t) => (
                          <option key={t.id} value={t.title}>
                            {t.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Primary Generate Button */}
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || selectedTopicIds.length === 0}
                    className="ml-auto px-6 py-2.5 bg-[#cbe3cf] hover:bg-[#b8d7bd] text-[#163824] font-black uppercase tracking-tight text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {isGenerating ? 'Synthesizing Material...' : 'Generate Material'}
                  </button>
                </div>
              </div>

              {/* Generated Results Viewer */}
              {Object.keys(generatedMaterials).length > 0 && (
                <div className="p-6 bg-white border border-[#d2ded2] rounded-2xl shadow-sm space-y-6">
                  {/* Results Sub-Navigation Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e4ede3]">
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'exam-notes', label: 'Exam Notes', exists: !!generatedMaterials.examNotes },
                        { id: 'important-topics', label: 'Important Topics', exists: !!generatedMaterials.importantTopics },
                        { id: 'summary', label: 'Summary', exists: !!generatedMaterials.summary },
                        { id: 'questions', label: 'Q&A Practice', exists: !!generatedMaterials.questions },
                        { id: 'revision', label: 'Quick Revision', exists: !!generatedMaterials.revision },
                        { id: 'flashcards', label: `Flashcards (${generatedMaterials.flashcards?.length || 0})`, exists: !!generatedMaterials.flashcards },
                        { id: 'quiz', label: `Quiz (${generatedMaterials.quiz?.length || 0})`, exists: !!generatedMaterials.quiz },
                        { id: 'explanation', label: 'Deep Dive', exists: !!generatedMaterials.explanation },
                      ]
                        .filter((item) => item.exists)
                        .map((item) => (
                          <button
                            key={item.id}
                            onClick={() => setActiveResultTab(item.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-tight transition-all ${
                              activeResultTab === item.id
                                ? 'bg-[#163824] text-white shadow-sm'
                                : 'bg-[#eaf1ea] text-[#385240] hover:bg-[#dde7dd]'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                    </div>

                    {/* Download Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDownloadPdf}
                        title="Download as PDF"
                        className="px-3 py-1.5 bg-[#fbfcf8] border border-[#cfdccf] hover:border-[#163824] text-[#163824] text-xs font-bold uppercase rounded-lg transition-all flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>
                      <button
                        onClick={handleDownloadTxt}
                        title="Download as Text"
                        className="px-3 py-1.5 bg-[#fbfcf8] border border-[#cfdccf] hover:border-[#163824] text-[#163824] text-xs font-bold uppercase rounded-lg transition-all"
                      >
                        TXT
                      </button>
                    </div>
                  </div>

                  {/* Result Content Body */}
                  <div className="pt-2">
                    {/* Interactive Flashcards Mode */}
                    {activeResultTab === 'flashcards' && generatedMaterials.flashcards && (
                      <div className="max-w-xl mx-auto space-y-6 py-4">
                        <div className="flex items-center justify-between text-xs text-[#5c7564]">
                          <span className="font-bold">
                            Card {currentFlashcardIdx + 1} of {generatedMaterials.flashcards.length}
                          </span>
                          <button
                            onClick={() => {
                              const shuffled = [...generatedMaterials.flashcards!].sort(() => Math.random() - 0.5);
                              setGeneratedMaterials((prev) => ({ ...prev, flashcards: shuffled }));
                              setCurrentFlashcardIdx(0);
                              setIsFlipped(false);
                            }}
                            className="flex items-center gap-1.5 hover:text-[#163824] font-bold"
                          >
                            <Shuffle className="w-3.5 h-3.5" /> Shuffle
                          </button>
                        </div>

                        {/* 3D Flip Card */}
                        <div
                          onClick={() => setIsFlipped(!isFlipped)}
                          className="h-64 w-full bg-[#fbfcf8] border border-[#cfdccf] hover:border-[#163824] rounded-3xl p-8 flex flex-col justify-between cursor-pointer transition-all shadow-md"
                        >
                          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-[#7a9482]">
                            <span>
                              {generatedMaterials.flashcards[currentFlashcardIdx]?.topic || 'Topic Concept'}
                            </span>
                            <span className="px-2 py-0.5 bg-[#eaf1ea] rounded text-[#163824]">
                              {isFlipped ? 'Answer (Click to flip)' : 'Question (Click to flip)'}
                            </span>
                          </div>

                          <div className="flex-1 flex items-center justify-center text-center p-4">
                            <p className="text-lg font-black text-[#163824] leading-relaxed">
                              {isFlipped
                                ? generatedMaterials.flashcards[currentFlashcardIdx]?.back
                                : generatedMaterials.flashcards[currentFlashcardIdx]?.front}
                            </p>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-[#7a9482]">
                            <span>{generatedMaterials.flashcards[currentFlashcardIdx]?.pageRef || ''}</span>
                            <span className="italic">Click card to reveal answer</span>
                          </div>
                        </div>

                        {/* Navigation & Mastery Controls */}
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => {
                              setCurrentFlashcardIdx((prev) => Math.max(0, prev - 1));
                              setIsFlipped(false);
                            }}
                            disabled={currentFlashcardIdx === 0}
                            className="px-4 py-2 bg-white border border-[#cfdccf] rounded-xl text-xs font-bold uppercase disabled:opacity-40 flex items-center gap-1"
                          >
                            <ChevronLeft className="w-4 h-4" /> Previous
                          </button>

                          <button
                            onClick={() => {
                              const updated = [...generatedMaterials.flashcards!];
                              updated[currentFlashcardIdx].learned = !updated[currentFlashcardIdx].learned;
                              setGeneratedMaterials((prev) => ({ ...prev, flashcards: updated }));
                            }}
                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${
                              generatedMaterials.flashcards[currentFlashcardIdx]?.learned
                                ? 'bg-[#163824] text-white'
                                : 'bg-[#eaf1ea] text-[#163824] border border-[#cfdccf]'
                            }`}
                          >
                            <CheckCircle className="w-4 h-4" />
                            {generatedMaterials.flashcards[currentFlashcardIdx]?.learned ? 'Mastered ✓' : 'Mark Learned'}
                          </button>

                          <button
                            onClick={() => {
                              setCurrentFlashcardIdx((prev) =>
                                Math.min(generatedMaterials.flashcards!.length - 1, prev + 1)
                              );
                              setIsFlipped(false);
                            }}
                            disabled={currentFlashcardIdx === generatedMaterials.flashcards.length - 1}
                            className="px-4 py-2 bg-white border border-[#cfdccf] rounded-xl text-xs font-bold uppercase disabled:opacity-40 flex items-center gap-1"
                          >
                            Next <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Interactive Quiz Mode */}
                    {activeResultTab === 'quiz' && generatedMaterials.quiz && (
                      <div className="space-y-6">
                        <div className="space-y-4">
                          {generatedMaterials.quiz.map((q, idx) => (
                            <div key={idx} className="p-5 bg-[#fbfcf8] border border-[#cfdccf] rounded-2xl space-y-3">
                              <p className="font-black text-sm text-[#163824]">
                                {idx + 1}. {q.question}
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {q.options.map((opt) => {
                                  const isSelected = quizAnswers[idx] === opt;
                                  const isCorrect = opt === q.correctAnswer;
                                  let btnStyle = 'bg-white border-[#cfdccf] text-[#385240] hover:border-[#163824]';

                                  if (quizSubmitted) {
                                    if (isCorrect) {
                                      btnStyle = 'bg-emerald-100 border-emerald-400 text-emerald-950 font-bold';
                                    } else if (isSelected && !isCorrect) {
                                      btnStyle = 'bg-rose-100 border-rose-400 text-rose-950';
                                    }
                                  } else if (isSelected) {
                                    btnStyle = 'bg-[#163824] text-white font-bold';
                                  }

                                  return (
                                    <button
                                      key={opt}
                                      onClick={() => !quizSubmitted && setQuizAnswers((prev) => ({ ...prev, [idx]: opt }))}
                                      className={`p-3 rounded-xl border text-left text-xs transition-all ${btnStyle}`}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>

                              {quizSubmitted && (
                                <div className="p-3 bg-[#eaf1ea] border border-[#cfdccf] rounded-xl text-xs text-[#275936] space-y-1">
                                  <strong className="font-bold">Explanation: </strong>
                                  <span>{q.explanation}</span>
                                  {q.pageRef && <span className="block text-[10px] text-[#7a9482] mt-1">{q.pageRef}</span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {!quizSubmitted ? (
                          <button
                            onClick={() => setQuizSubmitted(true)}
                            disabled={Object.keys(quizAnswers).length === 0}
                            className="w-full py-3 bg-[#cbe3cf] hover:bg-[#b8d7bd] text-[#163824] font-black uppercase text-xs rounded-xl shadow-sm transition-all"
                          >
                            Submit Assessment
                          </button>
                        ) : (
                          <div className="p-6 bg-[#eaf1ea] border border-[#cfdccf] rounded-2xl text-center space-y-3">
                            <h4 className="text-2xl font-black text-[#163824]">
                              Score:{' '}
                              {
                                generatedMaterials.quiz.filter((q, i) => quizAnswers[i] === q.correctAnswer).length
                              }{' '}
                              / {generatedMaterials.quiz.length}
                            </h4>
                            <button
                              onClick={() => {
                                setQuizAnswers({});
                                setQuizSubmitted(false);
                              }}
                              className="px-4 py-2 bg-white border border-[#cfdccf] text-[#163824] text-xs font-bold uppercase rounded-xl"
                            >
                              Retry Quiz
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Markdown Text Results (Notes, Summary, Q&A, Revision, Explanation) */}
                    {activeResultTab !== 'flashcards' && activeResultTab !== 'quiz' && (
                      <div className="prose prose-sm max-w-none text-[#2b4433] leading-relaxed">
                        <ReactMarkdown>
                          {activeResultTab === 'important-topics'
                            ? generatedMaterials.importantTopics || ''
                            : activeResultTab === 'exam-notes'
                            ? generatedMaterials.examNotes || ''
                            : activeResultTab === 'summary'
                            ? generatedMaterials.summary || ''
                            : activeResultTab === 'questions'
                            ? generatedMaterials.questions || ''
                            : activeResultTab === 'revision'
                            ? generatedMaterials.revision || ''
                            : activeResultTab === 'explanation'
                            ? generatedMaterials.explanation || ''
                            : ''}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Integrated AI PDF Chat Section */}
              <div className="p-6 bg-white border border-[#d2ded2] rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-[#e4ede3]">
                  <div className="w-8 h-8 rounded-lg bg-[#cbe3cf] flex items-center justify-center text-[#163824]">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-tight text-[#163824]">
                      Ask Questions About this PDF
                    </h4>
                    <p className="text-[10px] text-[#5c7564]">
                      Ask for formulas, clarify difficult definitions, or request specific examples from the document.
                    </p>
                  </div>
                </div>

                {/* Chat dialogue */}
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {pdfChatMessages.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#7a9482]">
                      No questions asked yet. Type any doubt or query about {extractedPdf.fileName} below.
                    </div>
                  ) : (
                    pdfChatMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[82%] p-3.5 rounded-2xl text-xs ${
                            msg.role === 'user'
                              ? 'bg-[#cbe3cf] text-[#163824] font-semibold'
                              : 'bg-[#f8faf7] border border-[#cfdccf] text-[#2b4433]'
                          }`}
                        >
                          <div className="prose prose-sm">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {isPdfChatting && (
                    <div className="flex justify-start">
                      <div className="p-3 bg-[#f8faf7] border border-[#cfdccf] rounded-2xl text-xs text-[#5c7564] flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#275936]" />
                        <span>Searching PDF for answer...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Bar */}
                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    value={pdfChatInput}
                    onChange={(e) => setPdfChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendPdfChat()}
                    placeholder="Ask a question about this document (e.g. explain the formula on page 2)..."
                    className="flex-1 bg-[#fbfcf8] border border-[#cfdccf] px-4 py-2.5 outline-none focus:border-[#163824] text-xs rounded-xl text-[#163824]"
                  />
                  <button
                    onClick={handleSendPdfChat}
                    disabled={isPdfChatting || !pdfChatInput.trim()}
                    className="px-5 bg-[#cbe3cf] hover:bg-[#b8d7bd] text-[#163824] rounded-xl flex items-center justify-center transition-all disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Drawer: Saved PDF Workspaces */}
        <AnimatePresence>
          {isHistoryDrawerOpen && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-80 border-l border-[#d5ded5] bg-[#f8faf7] flex flex-col z-30 shadow-xl shrink-0"
            >
              <div className="p-5 border-b border-[#d5ded5] flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-tight text-[#163824]">
                    Saved Study Materials
                  </h3>
                  <p className="text-[10px] text-[#5c7564]">Revisit previously processed PDFs</p>
                </div>
                <button
                  onClick={() => setIsHistoryDrawerOpen(false)}
                  className="p-1 rounded-lg hover:bg-[#eaf1ea] text-[#5c7564]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {savedWorkspaces.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[#7a9482]">
                    No saved workspaces yet. Upload a PDF and click "Save Material" to store your notes and tests.
                  </div>
                ) : (
                  savedWorkspaces.map((ws) => (
                    <div
                      key={ws.id}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between group ${
                        activeWorkspaceId === ws.id
                          ? 'bg-[#cbe3cf] border-[#163824] text-[#163824]'
                          : 'bg-white border-[#cfdccf] hover:border-[#163824] text-[#163824]'
                      }`}
                    >
                      <div
                        onClick={() => handleOpenWorkspace(ws)}
                        className="flex-1 min-w-0 pr-2 cursor-pointer"
                      >
                        <h4 className="font-bold text-xs truncate">{ws.fileName}</h4>
                        <div className="text-[10px] text-[#5c7564] mt-0.5">
                          {ws.subject || `${ws.pageCount} Pages`} • {new Date(ws.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setWorkspaceToDelete(ws);
                        }}
                        title="Delete Workspace"
                        className="p-1.5 rounded-lg text-[#55785f] hover:text-red-600 hover:bg-red-50 transition-all opacity-80 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
