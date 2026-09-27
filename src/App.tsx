import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
import LoginBackground from './components/loginBackground';
import {
  FloatingDashboard,
  TopicNode,
  SceneControls,
  RoadmapPath,
  SmoothScrollRoadmap,
  calculateTopicPositions
} from './components/ThreeDashboard';
import { ProfileAvatar } from './components/ProfileAvatar';
import {
  ChatConversation,
  fetchTopicConversations,
  persistConversation,
  removeConversation,
  removeRoadmapConversations
} from './lib/chatStorage';
import {
  generateRoadmap,
  solveDoubt,
  generateQuiz,
  generateRevisionNotes,
  findYouTubeVideo,
  generateTopicSummary,
  generateTopicStudyGuide
} from './lib/ai';
import {
  Loader2,
  Send,
  BookOpen,
  CheckCircle,
  Plus,
  FileText,
  HelpCircle,
  Download,
  LogIn,
  LogOut,
  ArrowLeft,
  Share2,
  Check,
  Trash2,
  X,
  History,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { jsPDF } from 'jspdf';

function Starfield() {
  const points = useMemo(() => {
    const p = new Float32Array(5000 * 3);
    for (let i = 0; i < 5000; i++) {
      const r = 100;
      const theta = 2 * Math.PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1);
      p[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      p[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      p[i * 3 + 2] = r * Math.cos(phi);
    }
    return p;
  }, []);

  const timeRef = useRef(0);
  const pointsRef = useRef<THREE.Points>(null);

  useFrame((_state, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;
    if (pointsRef.current) {
      pointsRef.current.rotation.y = t * 0.02;
      pointsRef.current.rotation.x = t * 0.01;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={5000}
          array={points}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.15} color="white" transparent opacity={0.8} sizeAttenuation={true} />
    </points>
  );
}

function ThemeStyles() {
  return (
    <style>{`
      .aesthetic-theme {
        background: #f5f5ef !important;
        color: #163824 !important;
        font-family: Inter, system-ui, sans-serif;
      }

      .aesthetic-theme [class*="bg-black"],
      .aesthetic-theme [class*="bg-slate-950"] {
        background-color: #f5f5ef !important;
      }

      .aesthetic-theme [class*="bg-white/5"] {
        background-color: #e8efe8 !important;
      }

      .aesthetic-theme [class*="bg-white/10"] {
        background-color: #dde7dd !important;
      }

      .aesthetic-theme [class*="border-white/10"],
      .aesthetic-theme [class*="border-white/20"] {
        border-color: #d2ded2 !important;
      }

      .aesthetic-theme [class*="text-white/"] {
        color: #55705d !important;
      }

      .aesthetic-theme [class~="text-white"] {
        color: #163824 !important;
      }

      .aesthetic-theme [class*="text-slate-"] {
        color: #5c7564 !important;
      }

      .aesthetic-theme [class*="bg-neon-green"] {
        background-color: #cbe3cf !important;
      }

      .aesthetic-theme [class*="text-neon-green"] {
        color: #275936 !important;
      }

      .aesthetic-theme [class*="border-neon-green"] {
        border-color: #a4cca9 !important;
      }

      .aesthetic-theme [class*="hover:bg-neon-green"]:hover {
        background-color: #b8d9bd !important;
      }

      .aesthetic-theme button {
        border-radius: 12px;
        transition: all 0.2s ease;
      }

      .aesthetic-theme input,
      .aesthetic-theme textarea {
        background-color: #fcfdfb !important;
        color: #163824 !important;
        border-color: #cfdccf !important;
        border-radius: 10px !important;
      }

      .aesthetic-theme input::placeholder,
      .aesthetic-theme textarea::placeholder {
        color: #8fa594 !important;
      }

      .aesthetic-theme h1,
      .aesthetic-theme h2,
      .aesthetic-theme h3,
      .aesthetic-theme h4 {
        color: #163824;
        letter-spacing: -0.04em;
      }

      .aesthetic-theme .prose {
        color: #385240;
      }

      ::-webkit-scrollbar {
        width: 6px;
      }
      ::-webkit-scrollbar-track {
        background: #f0f4ef;
      }
      ::-webkit-scrollbar-thumb {
        background: #b5ccb8;
        border-radius: 8px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #8fae93;
      }
    `}</style>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roadmaps, setRoadmaps] = useState<any[]>([]);
  const [selectedRoadmap, setSelectedRoadmap] = useState<any>(null);
  const [selectedTopic, setSelectedTopic] = useState<any>(null);
  const [syllabus, setSyllabus] = useState('');
  const [generating, setGenerating] = useState(false);

  // 3D Visualization Size Control (Scale: 0.6x to 1.6x, Default: 1.0x)
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [reset3DTrigger, setReset3DTrigger] = useState<number>(0);

  // Chat & History State
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'ai'; content: string; timestamp?: string }>>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isSolvingDoubt, setIsSolvingDoubt] = useState(false);
  const [isChatHistoryOpen, setIsChatHistoryOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<ChatConversation | null>(null);

  // Panel Visibility State (Close / Minimize buttons)
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isTopicDetailsOpen, setIsTopicDetailsOpen] = useState(true);

  // Roadmap Deletion Modal State
  const [roadmapToDelete, setRoadmapToDelete] = useState<any | null>(null);
  const [isDeletingRoadmap, setIsDeletingRoadmap] = useState(false);

  // Quiz, Notes, and Summary State
  const [quiz, setQuiz] = useState<any>(null);
  const [quizAnswers, setQuizAnswers] = useState<any>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [currentQuizDocId, setCurrentQuizDocId] = useState<string | null>(null);
  const [topicNotes, setTopicNotes] = useState<any[]>([]);
  const [topicQuizzes, setTopicQuizzes] = useState<any[]>([]);
  const [noteContent, setNoteContent] = useState('');
  const [revisionNotes, setRevisionNotes] = useState<string | null>(null);
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [youtubeVideo, setYoutubeVideo] = useState<string | null>(null);
  const [findingVideo, setFindingVideo] = useState(false);
  const [editingDetailedDescription, setEditingDetailedDescription] = useState(false);
  const [detailedDescriptionInput, setDetailedDescriptionInput] = useState('');
  const [generatingStudyGuide, setGeneratingStudyGuide] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharedRoadmapId, setSharedRoadmapId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState('beginner');
  const [topicSummary, setTopicSummary] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // 3D Roadmap Horizontal Scroll State
  const [scrollX, setScrollX] = useState<number>(0);
  const scrollTargetXRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const maxScrollXRef = useRef<number>(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const isShiftDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const scrollStartXRef = useRef(0);

  // Computed 3D topic node positions and horizontal scroll boundaries
  const topicPositions = useMemo(() => {
    return calculateTopicPositions(selectedRoadmap?.topics || []);
  }, [selectedRoadmap?.topics]);

  const topicCount = selectedRoadmap?.topics?.length || 0;
  const [maxScrollX, setMaxScrollX] = useState<number>(0);

  // Synchronize target ref whenever scrollX changes
  useEffect(() => {
    scrollTargetXRef.current = scrollX;
  }, [scrollX]);

  useEffect(() => {
    setScrollX(0);
    scrollTargetXRef.current = 0;
    setZoomScale(1.0);
    setReset3DTrigger(prev => prev + 1);
  }, [selectedRoadmap?.id]);

  // Stable callback for topic selection to keep TopicNode memoized
  const handleTopicSelect = useCallback((topic: any) => {
    setSelectedTopic(topic);
    setIsTopicDetailsOpen(true);
    setQuiz(null);
    setRevisionNotes(null);
    setTopicSummary(null);
    setYoutubeVideo(null);
    setEditingDetailedDescription(false);
  }, []);

  // Native non-passive wheel event listener on 3D roadmap viewport for ultra-smooth, responsive 60/120fps scrolling
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Prevent browser swipe back/forward navigation and vertical page bouncing
      e.preventDefault();
      e.stopPropagation();

      const currentMax = maxScrollXRef.current;
      if (currentMax <= 0) return;

      // Handle trackpad horizontal swipe (deltaX), trackpad vertical swipe (deltaY), or mouse wheel (deltaY)
      const rawDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;

      let step = 0;
      if (e.deltaMode === 1) {
        // Line mode (common with mouse wheel on Windows)
        step = rawDelta * 0.45;
      } else if (e.deltaMode === 2) {
        // Page mode
        step = rawDelta * 2.5;
      } else {
        // Pixel mode: trackpad swipe or mouse wheel ticks
        step = rawDelta * 0.012;
      }

      // Immediately accumulate target without waiting for React re-render cycle
      scrollTargetXRef.current = Math.max(0, Math.min(currentMax, scrollTargetXRef.current + step));

      // Batch React state updates directly to display refresh rate via requestAnimationFrame
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          setScrollX(scrollTargetXRef.current);
        });
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [selectedRoadmap?.id]);

  useEffect(() => {
    (window as any).__LEARNDEV_SET_ROADMAP = (rdm: any, openPanel: boolean = true) => {
      setSelectedRoadmap(rdm);
      if (openPanel && rdm?.topics?.length > 0) {
        setSelectedTopic(rdm.topics[0]);
        setIsTopicDetailsOpen(true);
      }
    };
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roadmapId = urlParams.get('roadmapId');
    if (roadmapId) {
      setSharedRoadmapId(roadmapId);
    }
  }, []);

  useEffect(() => {
    if (sharedRoadmapId) {
      const fetchSharedRoadmap = async () => {
        try {
          const { data } = await supabase.from('roadmaps').select('*').eq('id', sharedRoadmapId).single();
          if (data) setSelectedRoadmap(data);
        } catch (error) {
          console.error("Error fetching shared roadmap:", error);
        }
      };
      fetchSharedRoadmap();
    }
  }, [sharedRoadmapId]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    (window as any).__LEARNDEV_SET_ROADMAP = (roadmap: any, selectTopic = false) => {
      setSelectedRoadmap(roadmap);
      setScrollX(0);
      scrollTargetXRef.current = 0;
      setZoomScale(1.0);
      setReset3DTrigger(prev => prev + 1);
      if (selectTopic && roadmap?.topics?.length > 0) {
        setSelectedTopic(roadmap.topics[0]);
        setIsTopicDetailsOpen(true);
      } else {
        setSelectedTopic(null);
        setIsTopicDetailsOpen(false);
        setIsChatOpen(false);
      }
    };
  }, []);

  const loadRoadmaps = async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from('roadmaps').select('*').eq('userId', user.id);
      if (data) setRoadmaps(data);
    } catch (err) {
      console.error('Error loading roadmaps:', err);
    }
  };

  useEffect(() => {
    loadRoadmaps();
  }, [user]);

  // Load chat conversations whenever active roadmap/topic changes
  useEffect(() => {
    if (!user || !selectedRoadmap || !selectedTopic) {
      setConversations([]);
      setActiveConversationId(null);
      setChatMessages([]);
      return;
    }

    const loadConvs = async () => {
      const list = await fetchTopicConversations(user.id, selectedRoadmap.id, selectedTopic.id);
      setConversations(list);
      if (list.length > 0) {
        setActiveConversationId(list[0].id);
        setChatMessages(list[0].messages);
      } else {
        setActiveConversationId(null);
        setChatMessages([]);
      }
    };

    loadConvs();
  }, [user, selectedRoadmap?.id, selectedTopic?.id]);

  useEffect(() => {
    const loadTopicReferences = async () => {
      if (!selectedTopic || !user) {
        setTopicNotes([]);
        return;
      }

      try {
        const { data: notes } = await supabase.from('notes').select('*').eq('userId', user.id).eq('topicId', selectedTopic.id);
        const { data: quizzes } = await supabase.from('quizzes').select('*').eq('userId', user.id).eq('topicId', selectedTopic.id);
        setTopicNotes(notes || []);
        setTopicQuizzes(quizzes || []);
      } catch (error) {
        console.error('Error loading topic references:', error);
      }
    };

    loadTopicReferences();
  }, [selectedTopic, user]);

  const exportPDF = () => {
    if (!selectedRoadmap || !selectedTopic) {
      alert("Please select a topic first.");
      return;
    }
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
      doc.rect(0, 0, pageWidth, 30, 'F');
      y = 20;
      addText('LEARNDEV INTELLIGENCE REPORT', 22, true, '#163824');
      y = 40;

      addText(`Roadmap: ${selectedRoadmap.title}`, 16, true);
      addText(`Topic Element: ${selectedTopic.title}`, 14, true);
      addText(selectedTopic.description, 11, false, '#4d6655');
      y += 8;

      if (topicSummary) {
        addText('TOPIC SUMMARY', 12, true, '#163824');
        addText(topicSummary, 10);
        y += 6;
      }

      if (revisionNotes) {
        addText('REVISION NOTES', 12, true, '#163824');
        addText(revisionNotes, 10);
        y += 6;
      }

      if (topicNotes && topicNotes.length > 0) {
        addText('PERSONAL LOGS', 12, true, '#163824');
        topicNotes.forEach((note: any, i: number) => {
          addText(`Note ${i + 1}: ${note.content}`, 10);
        });
        y += 6;
      }

      if (chatMessages && chatMessages.length > 0) {
        addText('AI DIALOGUE TRANSCRIPT', 12, true, '#163824');
        chatMessages.forEach((msg) => {
          addText(`${msg.role.toUpperCase()}:`, 9, true, msg.role === 'user' ? '#163824' : '#2d6a4f');
          addText(msg.content, 10);
          y += 3;
        });
      }

      if (topicQuizzes && topicQuizzes.length > 0) {
        y += 8;
        addText('ASSESSMENTS & QUIZZES', 14, true, '#163824');
        y += 4;
        topicQuizzes.forEach((q: any, quizIdx: number) => {
          addText(`Quiz #${quizIdx + 1} (Score: ${q.score !== null ? q.score : 'N/A'}/${q.questions ? q.questions.length : '?'})`, 12, true);
          if (q.questions && Array.isArray(q.questions)) {
            q.questions.forEach((question: any, qIdx: number) => {
              addText(`Q${qIdx + 1}: ${question.question}`, 10, true);
              addText(`Answer: ${question.correctAnswer}`, 10, false, '#2d6a4f');
              y += 2;
            });
          }
          y += 5;
        });
      }

      doc.save(`LearnDev-AI-Export-${selectedTopic.title.replace(/\s+/g, '_')}.pdf`);
    } catch (e) {
      console.error("PDF generation failed", e);
      alert("Failed to export PDF format.");
    }
  };

  const handleShareRoadmap = async () => {
    if (!selectedRoadmap || !user) return;
    setSharing(true);
    try {
      await supabase.from('roadmaps').update({ isPublic: true }).eq('id', selectedRoadmap.id);
      const shareUrl = `${window.location.origin}${window.location.pathname}?roadmapId=${selectedRoadmap.id}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setSelectedRoadmap({ ...selectedRoadmap, isPublic: true });
    } catch (error) {
      console.error(error);
    } finally {
      setSharing(false);
    }
  };

  const handleCloneRoadmap = async () => {
    if (!selectedRoadmap || !user) return;
    setGenerating(true);
    try {
      const { id, ...roadmapData } = selectedRoadmap;
      await supabase.from('roadmaps').insert([{
        ...roadmapData,
        userId: user.id,
        createdAt: new Date().toISOString(),
        isPublic: false
      }]);
      loadRoadmaps();
      alert('Roadmap cloned to your protocols!');
    } catch (error) {
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (error) throw error;
        alert('Check your email to confirm registration or sign in directly.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCreateRoadmap = async () => {
    if (!syllabus || !user) return;
    setGenerating(true);
    try {
      const topics = await generateRoadmap(syllabus, difficulty);
      await supabase.from('roadmaps').insert([{
        userId: user.id,
        title: syllabus.slice(0, 30) + '...',
        syllabus,
        difficulty,
        topics: topics.map((t: any) => ({ ...t, completed: false })),
        createdAt: new Date().toISOString()
      }]);
      loadRoadmaps();
      setSyllabus('');
    } catch (error) {
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  // Permanently delete roadmap
  const handleDeleteRoadmap = async (id: string) => {
    if (!user) return;
    setIsDeletingRoadmap(true);
    try {
      const { error } = await supabase
        .from('roadmaps')
        .delete()
        .eq('id', id)
        .eq('userId', user.id);

      if (error) {
        console.warn('Supabase delete error (check RLS policy):', error);
      }

      // Immediately update local state without requiring page refresh
      setRoadmaps(prev => prev.filter(r => r.id !== id));

      // Return to dashboard if the deleted roadmap is currently active
      if (selectedRoadmap?.id === id) {
        setSelectedRoadmap(null);
        setSelectedTopic(null);
      }

      // Clean up chat conversations associated with this roadmap
      await removeRoadmapConversations(id, user.id);
      setRoadmapToDelete(null);
    } catch (err: any) {
      console.error('Error deleting roadmap:', err);
      alert('An error occurred while deleting the roadmap.');
    } finally {
      setIsDeletingRoadmap(false);
    }
  };

  const toggleTopicCompletion = async (roadmapId: string, topicId: string) => {
    const roadmap = roadmaps.find(r => r.id === roadmapId);
    if (!roadmap) return;
    const updatedTopics = roadmap.topics.map((t: any) =>
      t.id === topicId ? { ...t, completed: !t.completed } : t
    );
    await supabase.from('roadmaps').update({ topics: updatedTopics }).eq('id', roadmapId);
    loadRoadmaps();
    if (selectedTopic && selectedTopic.id === topicId) {
      setSelectedTopic({ ...selectedTopic, completed: !selectedTopic.completed });
    }
  };

  const handleUpdateDetailedDescription = async () => {
    if (!selectedRoadmap || !selectedTopic) return;
    const updatedTopics = selectedRoadmap.topics.map((t: any) =>
      t.id === selectedTopic.id ? { ...t, detailedDescription: detailedDescriptionInput } : t
    );
    await supabase.from('roadmaps').update({ topics: updatedTopics }).eq('id', selectedRoadmap.id);
    loadRoadmaps();
    setSelectedTopic({ ...selectedTopic, detailedDescription: detailedDescriptionInput });
    setEditingDetailedDescription(false);
  };

  // Solve Doubt with conversation history persistence
  const handleSolveDoubt = async () => {
    if (!chatInput.trim() || !selectedTopic || !user || isSolvingDoubt) return;
    const currentQuery = chatInput.trim();
    setChatInput('');
    setIsSolvingDoubt(true);

    const userMsg = { role: 'user' as const, content: currentQuery, timestamp: new Date().toISOString() };
    const tempMessages = [...chatMessages, userMsg];
    setChatMessages(tempMessages);

    try {
      const answer = await solveDoubt(selectedTopic.title, currentQuery);
      const aiMsg = { role: 'ai' as const, content: answer, timestamp: new Date().toISOString() };
      const finalMessages = [...tempMessages, aiMsg];
      setChatMessages(finalMessages);

      if (activeConversationId) {
        const existing = conversations.find(c => c.id === activeConversationId);
        if (existing) {
          const updatedConv: ChatConversation = {
            ...existing,
            messages: finalMessages,
            updatedAt: new Date().toISOString()
          };
          await persistConversation(updatedConv);
          setConversations(prev => [updatedConv, ...prev.filter(c => c.id !== updatedConv.id)]);
        }
      } else {
        const newId = crypto.randomUUID();
        const newConv: ChatConversation = {
          id: newId,
          userId: user.id,
          roadmapId: selectedRoadmap.id,
          topicId: selectedTopic.id,
          title: currentQuery.slice(0, 42) + (currentQuery.length > 42 ? '...' : ''),
          messages: finalMessages,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await persistConversation(newConv);
        setActiveConversationId(newId);
        setConversations(prev => [newConv, ...prev]);
      }
    } catch (error) {
      console.error('Error solving doubt:', error);
      setChatMessages(prev => [...prev, { role: 'ai' as const, content: 'Could not connect to neural assistant. Please check network and try again.' }]);
    } finally {
      setIsSolvingDoubt(false);
    }
  };

  const handleStartNewChat = () => {
    setActiveConversationId(null);
    setChatMessages([]);
    setIsChatHistoryOpen(false);
  };

  const handleSelectConversation = (conv: ChatConversation) => {
    setActiveConversationId(conv.id);
    setChatMessages(conv.messages);
    setIsChatHistoryOpen(false);
  };

  const handleConfirmDeleteConversation = async (conv: ChatConversation) => {
    if (!user) return;
    await removeConversation(conv.id, user.id);
    setConversations(prev => prev.filter(c => c.id !== conv.id));
    if (activeConversationId === conv.id) {
      setActiveConversationId(null);
      setChatMessages([]);
    }
    setConversationToDelete(null);
  };

  const handleAddNote = async () => {
    if (!selectedTopic || !user || !noteContent.trim()) return;
    try {
      await supabase.from('notes').insert([{
        userId: user.id,
        topicId: selectedTopic.id,
        roadmapId: selectedRoadmap?.id || null,
        content: noteContent.trim(),
        updatedAt: new Date().toISOString(),
      }]);
      setNoteContent('');
      const { data: notes } = await supabase.from('notes').select('*').eq('userId', user.id).eq('topicId', selectedTopic.id);
      setTopicNotes(notes || []);
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!selectedTopic || !user) return;
    setGenerating(true);
    try {
      const q = await generateQuiz(selectedTopic.title, selectedTopic.description);
      setQuiz(q);
      setQuizAnswers({});
      setQuizScore(null);

      const { data: quizData } = await supabase.from('quizzes').insert([{
        userId: user.id,
        topicId: selectedTopic.id,
        roadmapId: selectedRoadmap?.id || null,
        questions: q,
        score: 0,
        completed: false,
        createdAt: new Date().toISOString(),
      }]).select().single();
      if (quizData) setCurrentQuizDocId(quizData.id);
    } catch (error) {
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateRevisionNotes = async () => {
    if (!selectedTopic) return;
    setGeneratingNotes(true);
    try {
      const notes = await generateRevisionNotes(selectedTopic.title, selectedTopic.description);
      setRevisionNotes(notes);
    } catch (error) {
      console.error(error);
    } finally {
      setGeneratingNotes(false);
    }
  };

  const handleGenerateStudyGuide = async () => {
    if (!selectedRoadmap || !selectedTopic) return;
    setGeneratingStudyGuide(true);
    try {
      const guide = await generateTopicStudyGuide(selectedTopic.title, selectedTopic.description);
      const updatedTopics = selectedRoadmap.topics.map((t: any) =>
        t.id === selectedTopic.id ? { ...t, detailedDescription: guide } : t
      );
      await supabase.from('roadmaps').update({ topics: updatedTopics }).eq('id', selectedRoadmap.id);
      loadRoadmaps();
      setSelectedTopic({ ...selectedTopic, detailedDescription: guide });
    } catch (error) {
      console.error('Error generating study guide:', error);
    } finally {
      setGeneratingStudyGuide(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!selectedTopic) return;
    setGeneratingSummary(true);
    try {
      const summary = await generateTopicSummary(selectedTopic.title, selectedTopic.detailedDescription || selectedTopic.description);
      setTopicSummary(summary);
    } catch (error) {
      console.error(error);
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleFindVideo = async () => {
    if (!selectedTopic) return;
    setFindingVideo(true);
    try {
      const video = await findYouTubeVideo(selectedTopic.title, selectedTopic.description);
      setYoutubeVideo(video);
    } catch (error) {
      console.error(error);
    } finally {
      setFindingVideo(false);
    }
  };

  const submitQuiz = async () => {
    if (!quiz) return;
    let score = 0;
    quiz.forEach((q: any, i: number) => {
      if (quizAnswers[i] === q.correctAnswer) score++;
    });
    setQuizScore(score);

    if (currentQuizDocId) {
      try {
        await supabase.from('quizzes').update({
          score,
          completed: true,
          updatedAt: new Date().toISOString(),
        }).eq('id', currentQuizDocId);
      } catch (error) {
        console.error('Error updating quiz score:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#f5f5ef] text-[#163824]">
        <Loader2 className="animate-spin w-10 h-10 text-[#2d6a4f]" />
      </div>
    );
  }

  // Authentication View
  if (!user && !selectedRoadmap) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#f5f5ef] text-[#163824] p-4 overflow-hidden relative">
        <LoginBackground />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="z-10 text-center space-y-8 max-w-4xl"
        >
          <div className="inline-block px-4 py-1 border border-[#a9c9b1] rounded-full text-xs font-black uppercase tracking-[0.3em] text-[#275936] mb-4">
            Neural Learning Protocol v2.0
          </div>

          <h1 className="text-8xl md:text-9xl font-black tracking-tighter uppercase leading-[0.85] drop-shadow-[0_0_30px_rgba(0,255,102,0.3)]">
            <span className="text-[#163824]">LearnDev-AI</span>
          </h1>

          <p className="text-xl text-slate-400 max-w-xl mx-auto font-medium leading-relaxed">
            The next generation of AI-powered education. <br />
            Interactive 3D roadmaps, instant doubt solving, and personalized learning paths.
          </p>

          <div className="pt-8 max-w-sm mx-auto w-full">
            <form
              onSubmit={handleAuth}
              className="p-8 bg-white/80 backdrop-blur-xl border border-[#d2ded2] rounded-2xl shadow-xl space-y-4"
            >
              <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className={`flex-1 font-black uppercase text-xs tracking-widest ${!isSignUp ? 'text-[#163824]' : 'text-slate-500 hover:text-[#163824]'
                    }`}
                >
                  Log In
                </button>

                <button
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  className={`flex-1 font-black uppercase text-xs tracking-widest ${isSignUp ? 'text-[#163824]' : 'text-slate-500 hover:text-[#163824]'
                    }`}
                >
                  Sign Up
                </button>
              </div>

              {authError && (
                <div className="p-3 bg-red-500/20 text-red-500 text-xs font-mono mb-4">
                  {authError}
                </div>
              )}

              <input
                type="email"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                required
                placeholder="Enter your Email"
                className="w-full bg-white border border-[#a9c9b1] rounded-lg px-4 py-3 font-mono text-sm text-[#163824] placeholder:text-slate-500 outline-none focus:border-[#275936] focus:ring-2 focus:ring-[#a9c9b1]/40 transition-colors"
              />

              <input
                type="password"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                required
                placeholder="Enter your Password"
                className="w-full bg-white border border-[#a9c9b1] rounded-lg px-4 py-3 font-mono text-sm text-[#163824] placeholder:text-slate-500 outline-none focus:border-[#275936] focus:ring-2 focus:ring-[#a9c9b1]/40 transition-colors"
              />

              <button
                disabled={authLoading}
                type="submit"
                className="w-full mt-4 bg-[#cbe3cf] text-[#163824] font-black py-4 uppercase tracking-tighter hover:scale-[1.02] flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {authLoading ? (
                  <Loader2 className="animate-spin w-5 h-5" />
                ) : (
                  <LogIn className="w-5 h-5" />
                )}
                {isSignUp ? 'Initialize Profile' : 'Access System'}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }
  return (
    <div className="aesthetic-theme h-screen w-screen flex overflow-hidden font-display">
      <ThemeStyles />

      {/* Confirmation Modal for Roadmap Deletion */}
      <AnimatePresence>
        {roadmapToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#f5f5ef] border border-[#cfdccf] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-[#163824]">Delete Roadmap</h3>
                  <p className="text-xs text-[#5c7564]">This protocol will be permanently removed.</p>
                </div>
              </div>
              <p className="text-sm text-[#385240] leading-relaxed">
                Are you sure you want to permanently delete roadmap <strong className="text-[#163824]">"{roadmapToDelete.title}"</strong>?
                All associated modules, quiz scores, and discussions will be deleted.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setRoadmapToDelete(null)}
                  disabled={isDeletingRoadmap}
                  className="px-4 py-2.5 rounded-xl border border-[#cfdccf] hover:bg-[#e4ede3] text-[#163824] font-bold text-xs uppercase tracking-wider transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteRoadmap(roadmapToDelete.id)}
                  disabled={isDeletingRoadmap}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
                >
                  {isDeletingRoadmap ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {isDeletingRoadmap ? 'Deleting...' : 'Delete Roadmap'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal for Conversation Deletion */}
      <AnimatePresence>
        {conversationToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#f5f5ef] border border-[#cfdccf] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-[#163824]">Delete Conversation</h3>
                  <p className="text-xs text-[#5c7564]">This conversation history will be deleted.</p>
                </div>
              </div>
              <p className="text-sm text-[#385240] leading-relaxed">
                Delete chat session <strong className="text-[#163824]">"{conversationToDelete.title}"</strong>?
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setConversationToDelete(null)}
                  className="px-4 py-2 rounded-xl border border-[#cfdccf] hover:bg-[#e4ede3] text-[#163824] font-bold text-xs uppercase tracking-wider transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirmDeleteConversation(conversationToDelete)}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div className="w-80 border-r border-[#d5ded5] flex flex-col p-6 bg-[#f5f5ef] z-20 shrink-0">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-11 h-11 bg-[#cbe3cf] rounded-xl flex items-center justify-center border border-[#b8ccb8] shadow-sm">
            <BookOpen className="w-5 h-5 text-[#163824]" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-[#163824]">LearnDev-AI</h2>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto pr-1">
          {/* Active Protocols Section with Delete Buttons */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-[#5c7564] uppercase tracking-[0.25em] px-2">Active Protocols</h3>
            {user ? (
              roadmaps.length === 0 ? (
                <div className="p-4 border border-dashed border-[#cfdccf] rounded-xl text-[10px] font-bold uppercase tracking-widest text-[#7a9482] text-center">
                  No Protocols Initialized
                </div>
              ) : (
                <div className="space-y-1.5">
                  {roadmaps.map(r => (
                    <div
                      key={r.id}
                      className={`group/protocol relative flex items-center justify-between rounded-xl transition-all border ${selectedRoadmap?.id === r.id
                        ? 'bg-[#cbe3cf] border-[#a9c9b1] text-[#163824] shadow-sm'
                        : 'border-transparent hover:bg-[#e8efe8] text-[#3d5947]'
                        }`}
                    >
                      <button
                        onClick={() => {
                          setSelectedRoadmap(r);
                          setSelectedTopic(null);
                          setScrollX(0);
                          scrollTargetXRef.current = 0;
                          setZoomScale(1.0);
                          setReset3DTrigger(prev => prev + 1);
                        }}
                        className="flex-1 text-left p-3 flex items-center gap-3 min-w-0"
                        title={r.title}
                      >
                        <div className={`w-2 h-2 rotate-45 shrink-0 ${selectedRoadmap?.id === r.id ? 'bg-[#163824]' : 'bg-[#7a9981]'
                          }`} />
                        <span className="font-bold text-xs uppercase tracking-tight truncate">
                          {r.title}
                        </span>
                      </button>

                      {/* Small Trash Icon Button for Deleting Roadmap */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setRoadmapToDelete(r);
                        }}
                        title={`Delete roadmap: ${r.title}`}
                        className="p-2 mr-2 rounded-lg text-[#55785f] hover:text-red-600 hover:bg-red-500/10 transition-all opacity-80 md:opacity-0 md:group-hover/protocol:opacity-100 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="p-4 text-[10px] font-black uppercase tracking-widest text-[#7a9482]">Login to see your roadmaps</div>
            )}
          </div>

          {/* Syllabus Generator Form */}
          {user && (
            <div className="p-5 bg-[#eaf1ea] border border-[#d2ded2] rounded-2xl space-y-4 shadow-sm">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#3d5947]">Inject Syllabus</h4>
              <textarea
                placeholder="Paste raw data..."
                value={syllabus}
                onChange={(e) => setSyllabus(e.target.value)}
                className="w-full bg-[#fbfcf8] border border-[#cfdccf] rounded-xl p-3.5 text-xs focus:border-[#2d6a4f] outline-none h-28 resize-none transition-colors"
              />
              <div className="space-y-1.5">
                <h5 className="text-[9px] font-black uppercase tracking-[0.2em] text-[#5c7564]">Difficulty Level</h5>
                <div className="flex gap-1">
                  {['beginner', 'intermediate', 'advanced'].map((level) => (
                    <button
                      key={level}
                      onClick={() => setDifficulty(level)}
                      className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-tight rounded-lg border transition-all ${difficulty === level
                        ? 'bg-[#163824] border-[#163824] text-white shadow-sm'
                        : 'border-[#cfdccf] bg-white text-[#5c7564] hover:bg-[#f0f4ef]'
                        }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleCreateRoadmap}
                disabled={generating || !syllabus}
                className="w-full py-3 bg-[#cbe3cf] hover:bg-[#b8d7bd] text-[#163824] disabled:opacity-50 font-black text-xs uppercase tracking-tight rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {generating ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus className="w-4 h-4" />}
                Generate Roadmap
              </button>
            </div>
          )}
        </div>

        {/* Profile Footer with Beautiful Avatar */}
        <div className="pt-5 border-t border-[#d5ded5] flex items-center justify-between">
          {user ? (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <ProfileAvatar username={user.email?.split('@')[0]} />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black uppercase tracking-tight text-[#163824] truncate">
                    {user.email?.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-[#5c7564] font-mono tracking-wider">AUTHORIZED</span>
                </div>
              </div>
              <button
                onClick={() => supabase.auth.signOut()}
                title="Log Out"
                className="p-2.5 rounded-xl hover:bg-red-500/10 text-[#5c7564] hover:text-red-600 transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="w-full flex justify-center text-xs font-black uppercase tracking-widest text-[#7a9482]">
              Awaiting Auth...
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative flex flex-col overflow-hidden bg-[#f5f5ef]">
        {!selectedRoadmap ? (
          /* Dashboard Home View */
          <div className="flex-1 overflow-y-auto p-12">
            <div className="max-w-6xl mx-auto space-y-12">
              <header className="space-y-3">
                <div className="text-[#275936] font-mono text-xs tracking-[0.3em] uppercase">Status: Online</div>
                <h2 className="text-6xl font-black uppercase tracking-tight leading-[0.95] text-[#163824]">
                  Learning <br /> Dashboard
                </h2>
                <p className="text-[#4d6655] font-medium max-w-xl">
                  Welcome back, {user?.email?.split('@')[0]}. Your cognitive enhancement protocols are ready.
                </p>
              </header>

              {roadmaps.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-28 border border-dashed border-[#cfdccf] rounded-2xl bg-[#eaf1ea]/40">
                  <BookOpen className="w-14 h-14 text-[#7a9482] mb-4 opacity-50" />
                  <p className="text-[#5c7564] font-black uppercase tracking-widest text-xs">No Active Protocols Found</p>
                  <p className="text-[#7a9482] text-xs mt-1">Paste a syllabus in the sidebar to create your first 3D roadmap.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {roadmaps.map(r => {
                    const completed = r.topics.filter((t: any) => t.completed).length;
                    const total = r.topics.length;
                    const percent = Math.round((completed / total) * 100);

                    return (
                      <motion.div
                        key={r.id}
                        whileHover={{ y: -6, scale: 1.01 }}
                        className="p-6 bg-[#eaf1ea] border border-[#d2ded2] hover:border-[#163824] rounded-2xl transition-all text-left group relative overflow-hidden shadow-sm flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            {r.difficulty ? (
                              <span className="px-2.5 py-1 bg-[#cbe3cf] text-[9px] font-black uppercase tracking-widest text-[#163824] rounded-md">
                                {r.difficulty}
                              </span>
                            ) : <span />}
                            <div className="flex items-center gap-2">

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRoadmapToDelete(r);
                                }}
                                title="Delete Roadmap"
                                className="p-1.5 rounded-lg text-[#55785f] hover:text-red-600 hover:bg-red-500/10 transition-colors opacity-70 hover:opacity-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div
                            onClick={() => {
                              setSelectedRoadmap(r);
                              setSelectedTopic(null);
                              setScrollX(0);
                              scrollTargetXRef.current = 0;
                              setZoomScale(1.0);
                              setReset3DTrigger(prev => prev + 1);
                            }}
                            className="cursor-pointer"
                          >
                            <div className="w-12 h-12 bg-white rounded-xl border border-[#cfdccf] flex items-center justify-center mb-6 group-hover:bg-[#cbe3cf] transition-colors">
                              <BookOpen className="w-6 h-6 text-[#163824]" />
                            </div>
                            <h3 className="text-xl font-black uppercase tracking-tight mb-4 truncate text-[#163824]">
                              {r.title}
                            </h3>
                          </div>
                        </div>

                        <div
                          onClick={() => {
                            setSelectedRoadmap(r);
                            setSelectedTopic(null);
                            setScrollX(0);
                            scrollTargetXRef.current = 0;
                            setZoomScale(1.0);
                            setReset3DTrigger(prev => prev + 1);
                          }}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-[#5c7564] mb-3">
                            <span>Progress: {completed}/{total}</span>
                            <span className="text-[#275936] font-bold">{percent}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-[#dbe6db] rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percent}%` }}
                              className="h-full bg-[#163824] rounded-full"
                            />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Roadmap 3D Visualization & Detail Panels */
          <>

            {/* 3D Canvas Viewport */}
            <div
              ref={viewportRef}
              onPointerDown={(e) => {
                // If Shift key is held or middle button is clicked, enable drag scrolling
                if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
                  isShiftDraggingRef.current = true;
                  dragStartXRef.current = e.clientX;
                  scrollStartXRef.current = scrollX;
                  e.preventDefault();
                }
              }}
              onPointerMove={(e) => {
                if (!isShiftDraggingRef.current || maxScrollXRef.current <= 0) return;
                const deltaPx = e.clientX - dragStartXRef.current;
                const deltaUnits = (deltaPx / 75);
                setScrollX(Math.max(0, Math.min(maxScrollXRef.current, scrollStartXRef.current - deltaUnits)));
              }}
              onPointerUp={() => { isShiftDraggingRef.current = false; }}
              onPointerCancel={() => { isShiftDraggingRef.current = false; }}
              className={`w-full relative bg-[#f5f5ef] transition-all duration-300 select-none overflow-hidden ${isTopicDetailsOpen || isChatOpen ? 'h-[48%]' : 'h-full'
                }`}
            >
              {/* Return to Dashboard Button */}
              <motion.button
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                whileHover={{ x: -4 }}
                onClick={() => {
                  setSelectedRoadmap(null);
                  setSelectedTopic(null);
                  setScrollX(0);
                }}
                className="absolute top-6 left-6 z-30 flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-md border border-[#c8d9cb] hover:border-[#163824] text-[#163824] transition-all font-black uppercase tracking-wider text-[11px] rounded-xl shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Return to Dashboard
              </motion.button>

              {/* 3D Visualization Size Controls: Minus, Plus, Reset */}
              <div className="absolute top-6 right-6 z-30 flex items-center gap-1.5 p-1.5 bg-white/95 backdrop-blur-md border border-[#c8d9cb] rounded-2xl shadow-md">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#5c7564] px-1.5">Size</span>
                <button
                  onClick={() => setZoomScale(prev => Math.max(0.6, Math.round((prev - 0.1) * 10) / 10))}
                  title="Decrease 3D visualization size"
                  disabled={zoomScale <= 0.6}
                  className="w-7 h-7 rounded-lg bg-[#f0f4ef] hover:bg-[#cbe3cf] disabled:opacity-40 text-[#163824] font-black flex items-center justify-center transition-all text-sm"
                >
                  −
                </button>
                <span id="zoom-percentage-display" className="font-mono text-xs font-bold text-[#163824] px-1 min-w-9.5 text-center">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  onClick={() => setZoomScale(prev => Math.min(1.6, Math.round((prev + 0.1) * 10) / 10))}
                  title="Increase 3D visualization size"
                  disabled={zoomScale >= 1.6}
                  className="w-7 h-7 rounded-lg bg-[#f0f4ef] hover:bg-[#cbe3cf] disabled:opacity-40 text-[#163824] font-black flex items-center justify-center transition-all text-sm"
                >
                  +
                </button>
                <button
                  onClick={() => {
                    setZoomScale(1.0);
                    setScrollX(0);
                    scrollTargetXRef.current = 0;
                    setReset3DTrigger(prev => prev + 1);
                  }}
                  title="Reset to default size (100%) and start of roadmap"
                  className="px-2.5 py-1 rounded-lg bg-[#eaf1ea] hover:bg-[#cbe3cf] text-[#163824] text-[10px] font-black uppercase tracking-wider transition-all ml-1"
                >
                  Reset
                </button>
              </div>

              {/* 3D Scene */}
              <Canvas camera={{ position: [2.47, 0.05, 7.8], fov: 44 }}>
                <color attach="background" args={['#f5f5ef']} />
                <ambientLight intensity={1.3} />
                <directionalLight position={[10, 15, 10]} intensity={1.4} color="#ffffff" />
                <directionalLight position={[-10, 10, -5]} intensity={0.7} color="#cbe3cf" />
                <pointLight position={[5, 5, 8]} intensity={1.2} color="#52b788" />

                {/* Scalable Visualization Group with Smooth Damped Scrolling */}
                <SmoothScrollRoadmap scrollX={scrollX} zoomScale={zoomScale} resetTrigger={reset3DTrigger}>
                  {/* Flowing Sage & Forest Light Path */}
                  {selectedRoadmap && topicPositions.length > 1 && (
                    <RoadmapPath points={topicPositions} />
                  )}

                  {/* Neural Topic Nodes */}
                  {selectedRoadmap.topics.map((topic: any, idx: number) => (
                    <TopicNode
                      key={topic.id}
                      position={topicPositions[idx] || [idx * 2.15, (idx % 2 === 0 ? -0.18 : 0.22) + idx * 0.035, 0]}
                      title={topic.title}
                      completed={topic.completed}
                      isSelected={selectedTopic?.id === topic.id}
                      zoomScale={zoomScale}
                      onClick={() => handleTopicSelect(topic)}
                    />
                  ))}
                </SmoothScrollRoadmap>
                <SceneControls
                  resetTrigger={reset3DTrigger}
                  zoomScale={zoomScale}
                  topicCount={topicCount}
                  onMaxScrollChange={(max) => {
                    setMaxScrollX(max);
                    maxScrollXRef.current = max;
                    setScrollX(prev => Math.min(prev, max));
                  }}
                />
              </Canvas>

              {/* Subtle Edge Scroll Navigation Controls (Visible on hover near edges) */}
              {maxScrollX > 0 && (
                <>
                  <button
                    onClick={() => setScrollX(prev => Math.max(0, prev - 2.15))}
                    disabled={scrollX <= 0.05}
                    title="Scroll left to previous topics"
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full bg-white/90 border border-[#c8d9cb] hover:border-[#163824] hover:bg-[#cbe3cf] text-[#163824] opacity-0 hover:opacity-100 disabled:opacity-0 disabled:pointer-events-none transition-opacity duration-200 shadow-sm flex items-center justify-center font-black text-sm cursor-pointer"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => setScrollX(prev => Math.min(maxScrollX, prev + 2.15))}
                    disabled={scrollX >= maxScrollX - 0.05}
                    title="Scroll right to next topics"
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full bg-white/90 border border-[#c8d9cb] hover:border-[#163824] hover:bg-[#cbe3cf] text-[#163824] opacity-0 hover:opacity-100 disabled:opacity-0 disabled:pointer-events-none transition-opacity duration-200 shadow-sm flex items-center justify-center font-black text-sm cursor-pointer"
                  >
                    →
                  </button>
                </>
              )}

              {/* Horizontal Scroll Track & Thumb Indicator */}
              {maxScrollX > 0 && (
                <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1 bg-white/90 backdrop-blur-md border border-[#c8d9cb] rounded-full shadow-sm">
                  <div
                    className="w-48 h-1.5 bg-[#e0eae0] rounded-full relative cursor-pointer overflow-hidden"
                    title="Click or drag to scroll roadmap"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const track = e.currentTarget;
                      const updateScroll = (clientX: number) => {
                        const rect = track.getBoundingClientRect();
                        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                        setScrollX(ratio * maxScrollX);
                      };
                      updateScroll(e.clientX);
                      const handlePointerMove = (moveEv: PointerEvent) => {
                        updateScroll(moveEv.clientX);
                      };
                      const handlePointerUp = () => {
                        window.removeEventListener('pointermove', handlePointerMove);
                        window.removeEventListener('pointerup', handlePointerUp);
                      };
                      window.addEventListener('pointermove', handlePointerMove);
                      window.addEventListener('pointerup', handlePointerUp);
                    }}
                  >
                    <div
                      className="h-full bg-[#163824] rounded-full"
                      style={{
                        width: `${Math.max(20, (1 / (topicCount || 1)) * 100)}%`,
                        marginLeft: `${(scrollX / (maxScrollX || 1)) * (100 - Math.max(20, (1 / (topicCount || 1)) * 100))}%`,
                        willChange: 'margin-left'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Active Roadmap Information Card (Top-Left) */}
              <div className="absolute top-18 left-6 p-3.5 bg-white/95 backdrop-blur-md border border-[#c8d9cb] rounded-2xl shadow-sm max-w-62.5 z-20">
                <div className="text-[10px] font-black text-[#275936] uppercase tracking-[0.2em] mb-1.5 flex items-center justify-between">
                  <span>Active Roadmap</span>
                  {selectedRoadmap.difficulty && (
                    <span className="px-1.5 py-0.5 bg-[#eaf1ea] rounded text-[9px] font-bold text-[#163824]">
                      {selectedRoadmap.difficulty}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-black uppercase tracking-tight text-[#163824] truncate">
                    {selectedRoadmap.title}
                  </h2>
                  {user && user.id === selectedRoadmap.userId ? (
                    <button
                      onClick={handleShareRoadmap}
                      disabled={sharing}
                      className="p-1.5 bg-[#f0f4ef] rounded-lg border border-[#cfdccf] hover:border-[#163824] text-[#163824] transition-all shrink-0"
                      title="Share Roadmap"
                    >
                      {sharing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : copied ? <Check className="w-3.5 h-3.5 text-[#275936]" /> : <Share2 className="w-3.5 h-3.5" />}
                    </button>
                  ) : user ? (
                    <button
                      onClick={handleCloneRoadmap}
                      disabled={generating}
                      className="px-2.5 py-1 bg-[#cbe3cf] text-[#163824] font-black uppercase tracking-tight text-[10px] rounded-lg hover:scale-105 transition-all shrink-0"
                    >
                      {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Clone'}
                    </button>
                  ) : null}
                </div>
                <div className="flex items-center gap-2.5 mt-3">
                  <div className="flex-1 h-1.5 bg-[#e0eae0] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#163824] rounded-full transition-all duration-700"
                      style={{ width: `${(selectedRoadmap.topics.filter((t: any) => t.completed).length / Math.max(selectedRoadmap.topics.length, 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-[#275936] shrink-0">
                    {selectedRoadmap.topics.filter((t: any) => t.completed).length}/{selectedRoadmap.topics.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Floating Reopen Controls when both panels are closed */}
            {selectedTopic && !isTopicDetailsOpen && !isChatOpen && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 p-1.5 bg-white/95 backdrop-blur-md border border-[#c8d9cb] rounded-2xl shadow-lg">
                <button
                  onClick={() => setIsTopicDetailsOpen(true)}
                  style={{ color: '#ffffff' }}
                  className="px-4 py-2 bg-[#163824] hover:bg-[#235035] text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-sm"
                >
                  <BookOpen className="w-4 h-4" />
                  Show Topic Details
                </button>
                <button
                  onClick={() => setIsChatOpen(true)}
                  className="px-4 py-2 bg-[#cbe3cf] hover:bg-[#b8d7bd] text-[#163824] text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Open AI Tutor
                </button>
              </div>
            )}

            {/* Bottom Drawer (Topic Details + AI Chat) */}
            <AnimatePresence>
              {selectedTopic && (isTopicDetailsOpen || isChatOpen) && (
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="absolute bottom-0 left-0 right-0 h-[52%] bg-[#f5f5ef] border-t border-[#d2ded2] flex overflow-hidden z-20 shadow-2xl"
                >
                  {/* Topic Introduction / Details Section */}
                  {isTopicDetailsOpen && (
                    <div className={`${isChatOpen ? 'w-[42%]' : 'w-full'} border-r border-[#d2ded2] p-8 overflow-y-auto space-y-6 bg-[#f8faf7] transition-all`}>
                      {/* Topic Header with Completion Checkmark and Close Button */}
                      <div className="flex items-center justify-between pb-4 border-b border-[#d8e2d8]">
                        <div className="space-y-1 min-w-0 pr-4">
                          <div className="text-[10px] font-black text-[#275936] uppercase tracking-[0.2em]">Topic Module</div>
                          <h3 className="text-2xl font-black uppercase tracking-tight text-[#163824] truncate">{selectedTopic.title}</h3>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Reopen Chat shortcut if chat was minimized */}
                          {!isChatOpen && (
                            <button
                              onClick={() => setIsChatOpen(true)}
                              className="px-3 py-1.5 bg-[#cbe3cf] hover:bg-[#b8d7bd] text-[#163824] text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              Open AI Tutor
                            </button>
                          )}
                          <button
                            onClick={() => toggleTopicCompletion(selectedRoadmap.id, selectedTopic.id)}
                            title={selectedTopic.completed ? "Mark Topic Incomplete" : "Mark Topic Completed"}
                            className={`p-2.5 rounded-xl border transition-all ${selectedTopic.completed
                              ? 'bg-[#163824] border-[#163824] text-white shadow-sm'
                              : 'bg-white border-[#cfdccf] text-[#5c7564] hover:border-[#163824]'
                              }`}
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          {/* Close Button for Topic Introduction Section */}
                          <button
                            onClick={() => setIsTopicDetailsOpen(false)}
                            title="Close Topic Details"
                            className="p-2.5 rounded-xl border border-[#cfdccf] bg-white hover:bg-[#e4ede3] text-[#5c7564] hover:text-[#163824] transition-all"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-[#385240] leading-relaxed text-sm font-medium">{selectedTopic.description}</p>

                      {/* Detailed Intelligence Section */}
                      <div className="pt-4 border-t border-[#d8e2d8] space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h4 className="text-[10px] font-black text-[#275936] uppercase tracking-[0.2em]">Detailed Intelligence</h4>
                            <span className="text-[9px] px-2 py-0.5 bg-[#e2ede3] text-[#1b452d] font-bold rounded-full uppercase tracking-wider">
                              Study Guide
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleGenerateStudyGuide}
                              disabled={generatingStudyGuide}
                              title="Generate comprehensive masterclass study guide with AI"
                              className="px-2.5 py-1 bg-[#cbe3cf] hover:bg-[#b8d7bd] text-[#163824] font-black uppercase tracking-wider text-[10px] rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
                            >
                              {generatingStudyGuide ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Sparkles className="w-3 h-3 text-[#275936]" />
                              )}
                              {generatingStudyGuide ? 'Generating...' : selectedTopic.detailedDescription ? 'Regenerate' : 'Generate with AI'}
                            </button>
                            {!editingDetailedDescription && (
                              <button
                                onClick={() => {
                                  setEditingDetailedDescription(true);
                                  setDetailedDescriptionInput(selectedTopic.detailedDescription || '');
                                }}
                                className="text-[10px] font-black text-[#5c7564] hover:text-[#163824] uppercase tracking-widest transition-colors px-2 py-1 bg-white border border-[#cfdccf] rounded-lg"
                              >
                                {selectedTopic.detailedDescription ? 'Edit' : 'Write'}
                              </button>
                            )}
                          </div>
                        </div>

                        {editingDetailedDescription ? (
                          <div className="space-y-3">
                            <textarea
                              value={detailedDescriptionInput}
                              onChange={(e) => setDetailedDescriptionInput(e.target.value)}
                              placeholder="Input detailed topic intelligence (Markdown supported)..."
                              className="w-full h-32 bg-[#fbfcf8] border border-[#cfdccf] p-3 rounded-xl outline-none focus:border-[#2d6a4f] text-xs text-[#163824] transition-colors font-mono"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleUpdateDetailedDescription}
                                className="flex-1 py-2 bg-[#cbe3cf] hover:bg-[#b8d7bd] text-[#163824] font-black uppercase tracking-tight text-xs rounded-lg"
                              >
                                Save Guide
                              </button>
                              <button
                                onClick={() => setEditingDetailedDescription(false)}
                                className="flex-1 py-2 bg-white border border-[#cfdccf] text-[#163824] font-black uppercase tracking-tight text-xs rounded-lg"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="min-h-15">
                            {selectedTopic.detailedDescription ? (
                              <div className="prose prose-sm max-w-none text-[#385240] bg-white/70 p-4 rounded-xl border border-[#cfdccf] shadow-xs">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {selectedTopic.detailedDescription}
                                </ReactMarkdown>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center p-6 border border-dashed border-[#cfdccf] rounded-xl bg-white/50 space-y-3">
                                <p className="text-[10px] font-black text-[#7a9482] uppercase tracking-widest">
                                  No Detailed Study Material Yet
                                </p>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={handleGenerateStudyGuide}
                                    disabled={generatingStudyGuide}
                                    className="px-4 py-2 bg-[#cbe3cf] hover:bg-[#b8d7bd] text-[#163824] font-black uppercase tracking-tight text-xs rounded-lg transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                                  >
                                    {generatingStudyGuide ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Sparkles className="w-4 h-4 text-[#275936]" />
                                    )}
                                    {generatingStudyGuide ? 'Generating Master Study Guide...' : 'Generate Full AI Study Guide'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingDetailedDescription(true);
                                      setDetailedDescriptionInput('');
                                    }}
                                    className="px-3 py-2 bg-white border border-[#cfdccf] hover:border-[#163824] text-[#163824] font-black uppercase tracking-tight text-xs rounded-lg transition-all"
                                  >
                                    Write Manually
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Quick Review Summary */}
                      {topicSummary && (
                        <div className="p-4 bg-white border border-[#cfdccf] rounded-xl space-y-3 shadow-xs relative">
                          <div className="sticky top-0 bg-white/95 backdrop-blur-xs flex items-center justify-between pb-2 border-b border-[#e2ede3] z-10">
                            <div className="flex items-center gap-2">
                              <h4 className="text-[10px] font-black text-[#275936] uppercase tracking-[0.2em]">Topic Executive Summary</h4>
                              <span className="text-[9px] px-2 py-0.5 bg-[#e2ede3] text-[#1b452d] font-bold rounded-full uppercase tracking-wider">
                                AI Summary
                              </span>
                            </div>
                            <button
                              onClick={() => setTopicSummary(null)}
                              title="Close Summary"
                              className="p-1.5 rounded-lg border border-[#cfdccf] bg-white hover:bg-[#e4ede3] text-[#5c7564] hover:text-[#163824] transition-all flex items-center justify-center shrink-0 shadow-xs"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="prose prose-sm text-[#385240]">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{topicSummary}</ReactMarkdown>
                          </div>
                        </div>
                      )}

                      {/* Revision Notes */}
                      {revisionNotes && (
                        <div className="p-5 bg-white border border-[#cfdccf] rounded-xl space-y-3 shadow-xs relative">
                          <div className="sticky top-0 bg-white/95 backdrop-blur-xs flex items-center justify-between pb-2 border-b border-[#e2ede3] z-10">
                            <div className="flex items-center gap-2">
                              <h4 className="text-[10px] font-black text-[#275936] uppercase tracking-[0.2em]">Master Revision Notes</h4>
                              <span className="text-[9px] px-2 py-0.5 bg-[#e2ede3] text-[#1b452d] font-bold rounded-full uppercase tracking-wider">
                                Exam Ready
                              </span>
                            </div>
                            <button
                              onClick={() => setRevisionNotes(null)}
                              title="Close Revision Notes"
                              className="p-1.5 rounded-lg border border-[#cfdccf] bg-white hover:bg-[#e4ede3] text-[#5c7564] hover:text-[#163824] transition-all flex items-center justify-center shrink-0 shadow-xs"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="prose prose-sm text-[#385240]">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{revisionNotes}</ReactMarkdown>
                          </div>
                        </div>
                      )}

                      {/* Topic Notes */}
                      <div className="p-4 bg-[#eaf1ea] border border-[#cfdccf] rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-black text-[#275936] uppercase tracking-[0.2em]">Topic Notes</h4>
                          <span className="text-[9px] text-[#5c7564] uppercase tracking-wider">{topicNotes.length} entries</span>
                        </div>
                        <textarea
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          placeholder="Capture targeted notes for this topic..."
                          className="w-full h-20 bg-white border border-[#cfdccf] p-3 rounded-lg outline-none focus:border-[#2d6a4f] text-xs text-[#163824] transition-colors"
                        />
                        <button
                          onClick={handleAddNote}
                          disabled={!noteContent.trim()}
                          className="w-full py-2 bg-[#cbe3cf] hover:bg-[#b8d7bd] text-[#163824] font-black uppercase tracking-tight text-xs rounded-lg transition-all disabled:opacity-50"
                        >
                          Save Topic Note
                        </button>

                        <div className="space-y-1.5 max-h-36 overflow-y-auto pt-1">
                          {topicNotes.length === 0 ? (
                            <p className="text-[10px] text-[#7a9482] uppercase tracking-wider">No notes recorded yet.</p>
                          ) : (
                            topicNotes.map((note) => (
                              <div key={note.id} className="p-2.5 bg-white border border-[#cfdccf] rounded-lg text-xs text-[#385240]">
                                <div className="text-[9px] text-[#7a9482]">{new Date(note.updatedAt).toLocaleString()}</div>
                                <p className="mt-1">{note.content}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={handleGenerateSummary}
                          disabled={generatingSummary}
                          className="flex items-center justify-center gap-2 p-3 bg-white border border-[#cfdccf] hover:border-[#163824] rounded-xl font-bold uppercase tracking-tight text-xs text-[#163824] transition-all disabled:opacity-50"
                        >
                          {generatingSummary ? <Loader2 className="animate-spin w-4 h-4" /> : <FileText className="w-4 h-4 text-[#275936]" />}
                          {generatingSummary ? 'Summarizing...' : 'Topic Summary'}
                        </button>
                        <button
                          onClick={handleGenerateRevisionNotes}
                          disabled={generatingNotes}
                          className="flex items-center justify-center gap-2 p-3 bg-white border border-[#cfdccf] hover:border-[#163824] rounded-xl font-bold uppercase tracking-tight text-xs text-[#163824] transition-all disabled:opacity-50"
                        >
                          {generatingNotes ? <Loader2 className="animate-spin w-4 h-4" /> : <FileText className="w-4 h-4 text-[#275936]" />}
                          {generatingNotes ? 'Generating...' : 'Revision Notes'}
                        </button>
                        <button
                          onClick={handleGenerateQuiz}
                          className="flex items-center justify-center gap-2 p-3 bg-[#cbe3cf] hover:bg-[#b8d7bd] rounded-xl font-black uppercase tracking-tight text-xs text-[#163824] transition-all"
                        >
                          <HelpCircle className="w-4 h-4" /> Initialize Quiz
                        </button>
                        <button
                          onClick={exportPDF}
                          className="flex items-center justify-center gap-2 p-3 bg-white border border-[#cfdccf] hover:border-[#163824] rounded-xl font-bold uppercase tracking-tight text-xs text-[#163824] transition-all"
                        >
                          <Download className="w-4 h-4" /> Export PDF
                        </button>
                      </div>

                      {/* YouTube Integration */}
                      <div className="pt-4 border-t border-[#d8e2d8]">
                        <h4 className="text-[10px] font-black text-[#5c7564] uppercase tracking-[0.2em] mb-3">External Intelligence</h4>
                        {youtubeVideo ? (
                          <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-xl space-y-3">
                            <span className="text-xs font-black uppercase tracking-tight">AI Recommended Video</span>
                            <div className="prose prose-sm text-red-950">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{youtubeVideo}</ReactMarkdown>
                            </div>
                            <button
                              onClick={() => setYoutubeVideo(null)}
                              className="text-[10px] font-black uppercase tracking-wider text-red-700 hover:text-red-900"
                            >
                              [ Clear ]
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={handleFindVideo}
                            disabled={findingVideo}
                            className="w-full flex items-center justify-center gap-3 p-3 bg-white border border-red-200 hover:border-red-400 text-red-700 rounded-xl font-bold text-xs uppercase tracking-tight transition-all disabled:opacity-50"
                          >
                            {findingVideo ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {findingVideo ? 'Searching YouTube...' : 'Find Matching YouTube Video'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI Chat & Quiz Panel */}
                  {isChatOpen && (
                    <div className="flex-1 flex flex-col bg-[#f5f5ef] relative overflow-hidden">
                      {/* AI Chat Header with New Chat, History Toggle, and Close Button */}
                      <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#d2ded2] bg-[#eaf1ea] shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#cbe3cf] flex items-center justify-center text-[#163824]">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-tight text-[#163824]">AI Neural Tutor</h4>
                            <p className="text-[10px] font-mono text-[#5c7564] truncate max-w-50">
                              {activeConversationId
                                ? (conversations.find(c => c.id === activeConversationId)?.title || 'Current Thread')
                                : 'New Discussion'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {!isTopicDetailsOpen && (
                            <button
                              onClick={() => setIsTopicDetailsOpen(true)}
                              className="px-3 py-1.5 bg-white border border-[#cfdccf] hover:border-[#163824] text-[#163824] text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              Topic Details
                            </button>
                          )}
                          <button
                            onClick={handleStartNewChat}
                            title="Start New Conversation"
                            className="px-3 py-1.5 bg-white border border-[#cfdccf] hover:border-[#163824] text-[#163824] text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            New Chat
                          </button>
                          <button
                            onClick={() => setIsChatHistoryOpen(!isChatHistoryOpen)}
                            title="View Chat History"
                            className={`px-3 py-1.5 border text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 ${isChatHistoryOpen
                              ? 'bg-[#163824] border-[#163824] text-white'
                              : 'bg-white border-[#cfdccf] text-[#163824] hover:bg-[#e8efe8]'
                              }`}
                          >
                            <History className="w-3.5 h-3.5" />
                            History ({conversations.length})
                          </button>
                          {/* Close Button for AI Chat Section */}
                          <button
                            onClick={() => setIsChatOpen(false)}
                            title="Close AI Tutor Panel"
                            className="p-1.5 rounded-lg border border-[#cfdccf] bg-white hover:bg-[#e8efe8] text-[#5c7564] hover:text-[#163824] transition-all ml-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Main Chat / Quiz Stream or Chat History Drawer */}
                      {isChatHistoryOpen ? (
                        /* Dedicated Chat History Section */
                        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-[#f8faf7]">
                          <div className="flex items-center justify-between pb-3 border-b border-[#d8e2d8]">
                            <div>
                              <h4 className="text-sm font-black uppercase tracking-tight text-[#163824]">Chat History</h4>
                              <p className="text-[10px] text-[#5c7564]">Previous queries and discussions for {selectedTopic.title}</p>
                            </div>
                            <button
                              onClick={() => setIsChatHistoryOpen(false)}
                              className="text-[11px] font-bold text-[#163824] hover:underline"
                            >
                              Back to Chat
                            </button>
                          </div>

                          {conversations.length === 0 ? (
                            <div className="py-16 text-center space-y-2">
                              <MessageSquare className="w-10 h-10 text-[#7a9482] mx-auto opacity-40" />
                              <p className="text-xs font-bold text-[#5c7564]">No previous discussions recorded for this topic.</p>
                              <p className="text-[11px] text-[#7a9482]">Ask any question below to automatically record it.</p>
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              {conversations.map(conv => (
                                <div
                                  key={conv.id}
                                  className={`p-4 rounded-xl border transition-all flex items-center justify-between group ${activeConversationId === conv.id
                                    ? 'bg-[#cbe3cf] border-[#a9c9b1] text-[#163824] shadow-sm'
                                    : 'bg-white border-[#cfdccf] hover:border-[#163824] text-[#163824]'
                                    }`}
                                >
                                  <div
                                    onClick={() => handleSelectConversation(conv)}
                                    className="cursor-pointer flex-1 min-w-0 pr-3"
                                  >
                                    <div className="flex items-center gap-2">
                                      <p className="font-black text-xs uppercase tracking-tight truncate">{conv.title}</p>
                                      {activeConversationId === conv.id && (
                                        <span className="px-2 py-0.5 bg-[#163824] text-white text-[8px] font-bold uppercase rounded">Active</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] text-[#5c7564] mt-1">
                                      <span>{new Date(conv.updatedAt).toLocaleString()}</span>
                                      <span>•</span>
                                      <span>{conv.messages.length} messages</span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConversationToDelete(conv);
                                    }}
                                    title="Delete Conversation"
                                    className="p-2 rounded-lg text-[#55785f] hover:text-red-600 hover:bg-red-500/10 transition-all opacity-80 group-hover:opacity-100"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : quiz ? (
                        /* Assessment Quiz Mode */
                        <div className="flex-1 p-8 overflow-y-auto">
                          <div className="max-w-3xl mx-auto space-y-8">
                            <div className="flex items-center justify-between">
                              <h3 className="text-2xl font-black uppercase tracking-tight text-[#163824]">Assessment Protocol</h3>
                              <button onClick={() => setQuiz(null)} className="text-[#5c7564] hover:text-[#163824] font-black uppercase tracking-wider text-xs">
                                Terminate
                              </button>
                            </div>
                            {quiz.map((q: any, i: number) => (
                              <div key={i} className="space-y-4 p-6 bg-white border border-[#cfdccf] rounded-2xl shadow-sm">
                                <p className="text-lg font-black uppercase tracking-tight text-[#163824]">{q.question}</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {q.options.map((opt: string) => (
                                    <button
                                      key={opt}
                                      onClick={() => setQuizAnswers({ ...quizAnswers, [i]: opt })}
                                      className={`p-4 text-left rounded-xl transition-all border font-bold text-xs uppercase tracking-tight ${quizAnswers[i] === opt
                                        ? 'bg-[#163824] border-[#163824] text-white shadow-sm'
                                        : 'bg-[#fbfcf8] border-[#cfdccf] hover:border-[#163824] text-[#163824]'
                                        }`}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                            {quizScore === null ? (
                              <button
                                onClick={submitQuiz}
                                className="w-full py-4 bg-[#cbe3cf] hover:bg-[#b8d7bd] text-[#163824] font-black text-sm uppercase tracking-tight rounded-xl transition-all shadow-sm"
                              >
                                Submit Assessment
                              </button>
                            ) : (
                              <div className="text-center p-8 bg-[#eaf1ea] border border-[#cfdccf] rounded-2xl">
                                <div className="text-[10px] font-black text-[#275936] uppercase tracking-[0.3em] mb-2">Results Compiled</div>
                                <h4 className="text-5xl font-black uppercase tracking-tight text-[#163824] mb-2">{quizScore} / {quiz.length}</h4>
                                <p className="text-[#275936] font-black uppercase tracking-wider text-xs">Cognitive Assessment Completed</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* AI Chat Dialogue Stream */
                        <>
                          <div className="flex-1 p-6 overflow-y-auto space-y-4">
                            {chatMessages.length === 0 && (
                              <div className="h-full flex flex-col items-center justify-center text-[#7a9482] py-12">
                                <HelpCircle className="w-16 h-16 mb-4 opacity-30 text-[#275936]" />
                                <p className="font-black uppercase tracking-[0.25em] text-xs text-[#5c7564]">Awaiting Query...</p>
                                <p className="text-[11px] text-[#7a9482] mt-1">Ask questions about "{selectedTopic.title}" for instant AI tutoring.</p>
                              </div>
                            )}
                            {chatMessages.map((msg, i) => (
                              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[82%] p-4 rounded-2xl ${msg.role === 'user'
                                  ? 'bg-[#cbe3cf] text-[#163824] font-semibold shadow-sm'
                                  : 'bg-white border border-[#cfdccf] text-[#385240] shadow-sm'
                                  }`}>
                                  <div className="prose prose-sm">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {isSolvingDoubt && (
                              <div className="flex justify-start">
                                <div className="p-4 rounded-2xl bg-white border border-[#cfdccf] text-[#5c7564] flex items-center gap-2 shadow-sm text-xs">
                                  <Loader2 className="w-4 h-4 animate-spin text-[#2d6a4f]" />
                                  <span>Consulting Neural Model...</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Chat Input Bar */}
                          <div className="p-4 border-t border-[#d2ded2] bg-[#f5f5ef]">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSolveDoubt()}
                                placeholder="Input query for AI processing..."
                                className="flex-1 bg-[#fbfcf8] border border-[#cfdccf] px-5 py-3 outline-none focus:border-[#163824] text-xs rounded-xl transition-colors text-[#163824]"
                              />
                              <button
                                onClick={handleSolveDoubt}
                                disabled={isSolvingDoubt || !chatInput.trim()}
                                className="px-5 bg-[#cbe3cf] hover:bg-[#b8d7bd] text-[#163824] font-black uppercase tracking-tight rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center justify-center"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
