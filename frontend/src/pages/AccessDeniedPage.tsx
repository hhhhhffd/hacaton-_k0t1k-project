import { LogOut, Wheat, Globe, Send, Bot, User, Loader2, Trash2, Plus, History, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useTranslation } from '../i18n/useTranslation';
import { useAppStore } from '../store/appStore';
import { streamChatMessage } from '../services/api';
import type { ChatMessage } from '../types';

// ================================================================
// Управление сессиями чата (localStorage + sessionStorage)
// ================================================================

const CURRENT_SESSION_KEY = 'k0t1k_session_id';
const SESSIONS_INDEX_KEY = 'k0t1k_sessions';
const chatStorageKey = (id: string) => `k0t1k_chat_${id}`;

interface SessionMeta {
  id: string;
  created_at: number;
  preview: string;
}

function getOrCreateSessionId(): string {
  let id = sessionStorage.getItem(CURRENT_SESSION_KEY);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(CURRENT_SESSION_KEY, id);
  }
  return id;
}

function createNewSessionId(): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  sessionStorage.setItem(CURRENT_SESSION_KEY, id);
  return id;
}

function loadChatMessages(sessionId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(chatStorageKey(sessionId));
    if (raw) return JSON.parse(raw) as ChatMessage[];
  } catch { /* игнорируем ошибки парсинга */ }
  return [];
}

function saveChatMessages(sessionId: string, msgs: ChatMessage[]): void {
  if (!sessionId) return;
  localStorage.setItem(chatStorageKey(sessionId), JSON.stringify(msgs));
  try {
    const raw = localStorage.getItem(SESSIONS_INDEX_KEY);
    const list: SessionMeta[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((s) => s.id === sessionId);
    const firstUserMsg = msgs.find((m) => m.role === 'user');
    const preview = firstUserMsg ? firstUserMsg.content.slice(0, 60) : '';
    if (idx >= 0) {
      list[idx] = { ...list[idx], preview };
    } else {
      list.unshift({ id: sessionId, created_at: Date.now(), preview });
    }
    localStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(list.slice(0, 10)));
  } catch { /* игнорируем */ }
}

function loadSessionsList(): SessionMeta[] {
  try {
    const raw = localStorage.getItem(SESSIONS_INDEX_KEY);
    return raw ? (JSON.parse(raw) as SessionMeta[]) : [];
  } catch {
    return [];
  }
}

function removeSession(sessionId: string): void {
  localStorage.removeItem(chatStorageKey(sessionId));
  try {
    const raw = localStorage.getItem(SESSIONS_INDEX_KEY);
    const list: SessionMeta[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(SESSIONS_INDEX_KEY, JSON.stringify(list.filter((s) => s.id !== sessionId)));
  } catch { /* игнорируем */ }
}

// ================================================================
// Вспомогательные константы
// ================================================================

const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  ru: [
    'Какие документы нужны для субсидии?',
    'Как подать заявку?',
    'Что такое Merit-скоринг?',
    'Как повысить шансы на одобрение?',
  ],
  kz: [
    'Субсидия үшін қандай құжаттар керек?',
    'Өтінімді қалай беруге болады?',
    'Merit-скоринг дегеніміз не?',
    'Мақұлдану мүмкіндігін қалай арттыруға болады?',
  ],
};

function welcomeMsg(lang: string): ChatMessage {
  return {
    role: 'assistant',
    content:
      lang === 'kz'
        ? 'Сәлем! Мен субсидиялар бойынша AI-көмекшісімін. Сізге қандай мәселеде көмектесе аламын?'
        : 'Здравствуйте! Я AI-ассистент по вопросам сельскохозяйственных субсидий Казахстана. Чем могу помочь?',
  };
}

// ================================================================
// Компонент
// ================================================================

/** Страница «Доступ не одобрен» с AI-ассистентом и персистентными сессиями чата */
export default function AccessDeniedPage() {
  const { t, language } = useTranslation();
  const setLanguage = useAppStore((s) => s.setLanguage);
  const { user, logout } = useAuthStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef(false);

  // Инициализация: загружаем сессию из sessionStorage/localStorage
  useEffect(() => {
    hasMountedRef.current = true;
    const id = getOrCreateSessionId();
    setSessionId(id);
    const stored = loadChatMessages(id);
    setMessages(stored.length > 0 ? stored : [welcomeMsg(language)]);
    setSessions(loadSessionsList());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Смена языка: обновляем приветствие только если пользователь ещё не писал
  useEffect(() => {
    if (!hasMountedRef.current) return;
    setMessages((prev) => {
      const hasUserMessages = prev.some((m) => m.role === 'user');
      return hasUserMessages ? prev : [welcomeMsg(language)];
    });
  }, [language]);

  // Сохраняем сообщения в localStorage при каждом изменении
  useEffect(() => {
    if (!sessionId || messages.length === 0) return;
    saveChatMessages(sessionId, messages);
    setSessions(loadSessionsList());
  }, [messages, sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const messageText = (text ?? input).trim();
    if (!messageText || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: messageText };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Добавляем пустое сообщение от ассистента для стриминга
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      await streamChatMessage(
        messageText,
        messages, // история без текущего сообщения
        language,
        (chunk) => {
          setLoading(false); // как только пошел первый чанк, снимаем лоадер (спиннер)
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastIdx = newMessages.length - 1;
            if (newMessages[lastIdx].role === 'assistant') {
              newMessages[lastIdx] = {
                ...newMessages[lastIdx],
                content: newMessages[lastIdx].content + chunk,
              };
            }
            return newMessages;
          });
        },
        () => {
          setLoading(false);
          // done
        },
        () => {
          const errMsg =
            language === 'kz'
              ? 'Кешіріңіз, қазір техникалық үзіліс. Кейінірек қайталаңыз.'
              : 'Извините, временная техническая проблема. Попробуйте позже.';
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastIdx = newMessages.length - 1;
            if (newMessages[lastIdx].role === 'assistant') {
              newMessages[lastIdx] = {
                ...newMessages[lastIdx],
                content: newMessages[lastIdx].content || errMsg,
              };
            }
            return newMessages;
          });
          setLoading(false);
        }
      );
    } catch {
      const errMsg =
        language === 'kz'
          ? 'Кешіріңіз, қазір техникалық үзіліс. Кейінірек қайталаңыз.'
          : 'Извините, временная техническая проблема. Попробуйте позже.';
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastIdx = newMessages.length - 1;
        if (newMessages[lastIdx].role === 'assistant') {
          newMessages[lastIdx] = {
             ...newMessages[lastIdx],
             content: errMsg,
          };
        }
        return newMessages;
      });
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    removeSession(sessionId);
    setMessages([welcomeMsg(language)]);
    setSessions(loadSessionsList());
  };

  const handleNewSession = () => {
    const newId = createNewSessionId();
    setSessionId(newId);
    setMessages([welcomeMsg(language)]);
    setSessions(loadSessionsList());
    setShowSessions(false);
  };

  const handleSwitchSession = (id: string) => {
    sessionStorage.setItem(CURRENT_SESSION_KEY, id);
    setSessionId(id);
    const stored = loadChatMessages(id);
    setMessages(stored.length > 0 ? stored : [welcomeMsg(language)]);
    setShowSessions(false);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeSession(id);
    const updated = loadSessionsList();
    setSessions(updated);
    if (id === sessionId) {
      // Удалили текущую — переключаемся на последнюю или создаём новую
      const next = updated[0];
      if (next) {
        handleSwitchSession(next.id);
      } else {
        handleNewSession();
      }
    }
  };

  const formatSessionDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString(language === 'kz' ? 'kk-KZ' : 'ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return d.toLocaleDateString(language === 'kz' ? 'kk-KZ' : 'ru-RU', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col px-4 py-6 relative overflow-hidden">
      {/* Переключатель языка */}
      <button
        onClick={() => setLanguage(language === 'ru' ? 'kz' : 'ru')}
        className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <Globe className="w-4 h-4" />
        {language === 'ru' ? 'Қазақша' : 'Русский'}
      </button>

      <div className="w-full max-w-2xl mx-auto flex flex-col flex-1 min-h-0">
        {/* Заголовок проекта */}
        <div className="text-center mb-4 shrink-0">
          <div className="flex items-center justify-center gap-2">
            <div className="w-8 h-8 bg-[#C0F11C] rounded-lg flex items-center justify-center">
              <Wheat className="w-4 h-4 text-[#333333]" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">_k0t1k Project</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">{t('auth.subtitle')}</p>
        </div>

        {/* Карточка пользователя */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#C0F11C] rounded-full flex items-center justify-center">
              <Wheat className="w-5 h-5 text-[#333333]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 font-medium text-sm truncate">{user?.full_name || t('access.user')}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
            >
              <LogOut className="w-3 h-3" />
              {t('logout')}
            </button>
          </div>
        </div>

        {/* AI-ассистент */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col flex-1 min-h-0">
          {/* Шапка чата */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
            <div className="w-8 h-8 bg-[#C0F11C] rounded-lg flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-[#333333]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {language === 'kz' ? 'AI-Көмекші' : 'AI-Ассистент'}
              </p>
              <p className="text-xs text-gray-500">
                {language === 'kz' ? 'Субсидиялар бойынша сұрақтар' : 'Вопросы по субсидиям'}
              </p>
            </div>

            {/* Кнопки управления сессиями */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 bg-[#C0F11C] rounded-full animate-pulse mr-1" />
              {/* История сессий */}
              <button
                onClick={() => setShowSessions((v) => !v)}
                title={t('chat.sessions')}
                className={`p-1.5 rounded-lg text-gray-400 hover:text-gray-900 transition-colors ${
                  showSessions ? 'bg-gray-200 text-gray-900' : 'hover:bg-gray-100'
                }`}
              >
                <History className="w-4 h-4" />
              </button>
              {/* Новый чат */}
              <button
                onClick={handleNewSession}
                title={t('chat.newSession')}
                className="p-1.5 rounded-lg text-gray-400 hover:text-[#333333] hover:bg-[#C0F11C]/20 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
              {/* Очистить текущий чат */}
              <button
                onClick={handleClearChat}
                title={t('chat.clearSession')}
                className="p-1.5 rounded-lg text-gray-400 hover:text-[#333333] hover:bg-white transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Панель истории сессий */}
          {showSessions && (
            <div className="border-b border-gray-200 bg-gray-50 max-h-48 overflow-y-auto">
              {sessions.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">{t('chat.noSessions')}</p>
              ) : (
                <div className="py-1">
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSwitchSession(s.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-100 transition-colors group ${
                        s.id === sessionId ? 'bg-[#C0F11C]/10' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 truncate">
                          {s.preview || t('chat.sessionPreviewEmpty')}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{formatSessionDate(s.created_at)}</p>
                      </div>
                      {s.id === sessionId && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#C0F11C] shrink-0" />
                      )}
                      <button
                        onClick={(e) => handleDeleteSession(s.id, e)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:text-[#333333] text-gray-400 transition-all shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Сообщения */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col bg-gray-50 min-h-0">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === 'user' ? 'bg-[#C0F11C]' : 'bg-gray-200'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <User className="w-3.5 h-3.5 text-[#333333]" />
                  ) : (
                    <Bot className="w-3.5 h-3.5 text-gray-600" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#C0F11C] text-[#333333] rounded-tr-sm'
                      : 'bg-white border border-gray-200 text-gray-700 rounded-tl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-gray-600" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Быстрые вопросы */}
          {messages.length <= 1 && (
            <div className="px-4 pb-3 flex flex-wrap gap-2 bg-gray-50 shrink-0">
              {SUGGESTED_QUESTIONS[language].map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="text-xs bg-white hover:bg-[#C0F11C]/20 text-gray-600 hover:text-[#333333] border border-gray-200 hover:border-[#C0F11C] rounded-full px-3 py-1.5 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Поле ввода */}
          <div className="px-4 pb-4 bg-white border-t border-gray-200 shrink-0">
            <div className="flex gap-2 pt-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder={language === 'kz' ? 'Сұрақ жазыңыз...' : 'Введите вопрос...'}
                className="flex-1 bg-white border border-gray-200 text-gray-900 text-sm rounded-xl px-4 py-2.5 placeholder-gray-400 focus:outline-none focus:border-[#C0F11C] focus:ring-1 focus:ring-[#C0F11C] transition-colors"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="w-10 h-10 bg-[#C0F11C] hover:brightness-95 disabled:bg-gray-200 disabled:cursor-not-allowed text-[#333333] rounded-xl flex items-center justify-center transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
