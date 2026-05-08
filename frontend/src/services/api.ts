import axios from 'axios';
import type {
  ApplicationListResponse,
  Application,
  ScoreResponse,
  BudgetSimRequest,
  BudgetSimResponse,
  StatsResponse,
  GlobalShapResponse,
  HealthResponse,
  FilterState,
  SortingState,
  PaginationState,
  FifoVsMeritResponse,
  WeightSimRequest,
  WeightSimResponse,
  TokenResponse,
  UserInfo,
  AdminUserListResponse,
  ToggleAccessResponse,
  ProactiveOffer,
} from '../types';

/** Базовый URL API — из переменных окружения или /api (через nginx proxy) */
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

/** Axios-инстанс с базовыми настройками */
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Интерсептор запросов — добавляет JWT Bearer token из localStorage.
 */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Вспомогательная функция — получить токен для SSE (EventSource не поддерживает заголовки) */
export function getAccessToken(): string | null {
  return localStorage.getItem('access_token');
}

/**
 * Интерсептор ответов — конвертирует HTTP-ошибки в понятные сообщения.
 * 502/503/504 = сервер недоступен, остальные — по detail из бэкенда.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail;

      if (!error.response || status === 502 || status === 503 || status === 504) {
        error.message = 'SERVICE_UNAVAILABLE';
      } else if (status === 404) {
        error.message = 'NO_DATA';
      } else if (detail && typeof detail === 'string') {
        error.message = detail;
      }
    }
    return Promise.reject(error);
  },
);

/** Проверка здоровья сервиса */
export async function getHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/health');
  return data;
}

/** Список заявок с фильтрацией, сортировкой и пагинацией */
export async function getApplications(
  filters: FilterState,
  pagination: PaginationState,
  sorting: SortingState,
): Promise<ApplicationListResponse> {
  const params: Record<string, string | number> = {
    skip: pagination.skip,
    limit: pagination.limit,
    sort_by: sorting.field,
    sort_order: sorting.order,
  };

  if (filters.region) params.region = filters.region;
  if (filters.direction) params.direction = filters.direction;
  if (filters.status) params.status = filters.status;
  if (filters.minScore !== null) params.min_score = filters.minScore;
  if (filters.maxScore !== null) params.max_score = filters.maxScore;

  const { data } = await api.get<ApplicationListResponse>('/applications', { params });
  return data;
}

/** Получить одну заявку по ID */
export async function getApplication(id: number): Promise<Application> {
  const { data } = await api.get<Application>(`/applications/${id}`);
  return data;
}

/** SHAP-объяснение + LLM текст для заявки */
export async function getExplanation(id: number, lang: string = 'ru'): Promise<ScoreResponse> {
  const { data } = await api.get<ScoreResponse>(`/applications/${id}/explain`, {
    params: { lang },
  });
  return data;
}

/**
 * Стриминг SHAP + LLM объяснения через SSE.
 * Callback вызывается при каждом event от сервера.
 */
/**
 * Стриминг объяснения заявки через SSE с использованием безопасных stream tickets.
 * 
 * Архитектура безопасности (Task 8):
 * - JWT не передаётся через query params (попадает в логи серверов)
 * - Используем одноразовые stream tickets (60 сек TTL)
 * - Ticket получаем через POST /auth/stream-ticket с Bearer JWT
 * - Ticket удаляется после первого использования
 */
export function streamExplanation(
  id: number,
  lang: string,
  onShap: (data: { 
    application_id: number; 
    merit_score: number; 
    risk_level: string; 
    shap_values: Record<string, number>;
    hard_rules_checklist?: Array<{rule: string; law: string; passed: boolean | null; value: string; required: string}>;
  }) => void,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): () => void {
  let eventSource: EventSource | null = null;
  let closed = false;
  let connectionTimeout: ReturnType<typeof setTimeout> | null = null;

  // Асинхронная инициализация SSE с получением ticket
  (async () => {
    try {
      // Получаем одноразовый ticket (требует Bearer JWT)
      const { ticket } = await getStreamTicket();
      if (closed) return; // Пользователь отменил до получения ticket

      const url = `${BASE_URL}/applications/${id}/explain-stream?lang=${lang}&ticket=${ticket}`;
      eventSource = new EventSource(url);
      let receivedAnyData = false;

      eventSource.onmessage = (event) => {
        receivedAnyData = true;
        const raw = event.data;
        if (raw === '[DONE]') {
          closed = true;
          eventSource?.close();
          if (connectionTimeout) clearTimeout(connectionTimeout);
          onDone();
          return;
        }
        try {
          const parsed = JSON.parse(raw);
          if (parsed.error) {
            closed = true;
            eventSource?.close();
            if (connectionTimeout) clearTimeout(connectionTimeout);
            onError(parsed.error);
            return;
          }
          // Кэшированный полный ответ (из Redis/DB)
          if (parsed.llm_explanation !== undefined) {
            onShap({
              application_id: parsed.application_id,
              merit_score: parsed.merit_score,
              risk_level: parsed.risk_level,
              shap_values: parsed.shap_values,
              hard_rules_checklist: parsed.hard_rules_checklist,
            });
            onToken(parsed.llm_explanation);
            return;
          }
          if (parsed.type === 'shap') {
            onShap({
              ...parsed,
              hard_rules_checklist: parsed.hard_rules_checklist,
            });
          } else if (parsed.type === 'token') {
            onToken(parsed.content);
          }
        } catch {
          // Нечитаемый чанк — игнорируем
        }
      };

      eventSource.onerror = () => {
        if (closed) return;
        if (receivedAnyData) {
          closed = true;
          eventSource?.close();
          if (connectionTimeout) clearTimeout(connectionTimeout);
          onDone();
        }
      };

      // Таймаут на случай если соединение зависло
      connectionTimeout = setTimeout(() => {
        if (!receivedAnyData && !closed) {
          closed = true;
          eventSource?.close();
          onError('Таймаут соединения');
        }
      }, 30000);
    } catch (err) {
      if (!closed) {
        onError(err instanceof Error ? err.message : 'Ошибка получения stream ticket');
      }
    }
  })();

  // Возвращаем функцию отмены
  return () => {
    closed = true;
    if (connectionTimeout) clearTimeout(connectionTimeout);
    eventSource?.close();
  };
}

/** Симуляция бюджета */
export async function simulateBudget(params: BudgetSimRequest): Promise<BudgetSimResponse> {
  const { data } = await api.post<BudgetSimResponse>('/budget-simulate', params, {
    timeout: 60000, // 60 секунд — запрос может быть тяжёлым при большом бюджете
  });
  return data;
}

/** Скачать PDF-протокол бюджетной симуляции */
export async function downloadBudgetPdf(params: BudgetSimRequest): Promise<void> {
  const token = localStorage.getItem('access_token');
  const baseURL = import.meta.env.VITE_API_URL || '/api';
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const resp = await fetch(`${baseURL}/budget-simulate/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(params),
  });
  if (!resp.ok) throw new Error('PDF generation failed');

  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `budget_protocol_${Math.round((params.budget ?? 0) / 1_000_000)}mln.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Агрегированная статистика */
export async function getStats(): Promise<StatsResponse> {
  const { data } = await api.get<StatsResponse>('/stats');
  return data;
}

/** Глобальные SHAP feature importances */
export async function getGlobalShap(): Promise<GlobalShapResponse> {
  const { data } = await api.get<GlobalShapResponse>('/global-shap');
  return data;
}

/** Загрузка Excel-файла с данными — возвращает task_id для отслеживания */
export async function uploadDataset(file: File): Promise<{ 
  status: string; 
  task_id: string; 
  progress: number;
  rows_to_process?: number;
  validation_warnings?: string[];
}> {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await api.post('/data/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000, // 60 секунд для валидации
  });
  return data;
}

/** Получить статус фоновой задачи обучения */
export async function getUploadStatus(taskId: string): Promise<{
  task_id: string;
  status: 'processing' | 'done' | 'failed';
  progress: number;
  error: string | null;
}> {
  const { data } = await api.get(`/upload/status/${taskId}`);
  return data;
}

/** Получить stream ticket для SSE (одноразовый, 60 сек) */
export async function getStreamTicket(): Promise<{ ticket: string; expires_in: number }> {
  const { data } = await api.post('/auth/stream-ticket');
  return data;
}

/** Сравнение FIFO vs Merit */
export async function getFifoVsMerit(budget: number): Promise<FifoVsMeritResponse> {
  const { data } = await api.get<FifoVsMeritResponse>('/analytics/fifo-vs-merit', {
    params: { budget },
    timeout: 60000,
  });
  return data;
}

/** Симуляция пользовательских весов */
export async function simulateWeights(params: WeightSimRequest): Promise<WeightSimResponse> {
  const { data } = await api.post<WeightSimResponse>('/analytics/simulate-weights', params, {
    timeout: 60000,
  });
  return data;
}

// ================================================================
// Авторизация
// ================================================================

/** Регистрация нового пользователя */
export async function register(email: string, password: string, fullName: string): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/auth/register', {
    email, password, full_name: fullName,
  });
  return data;
}

/** Вход по email/пароль */
export async function login(email: string, password: string): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/auth/login', { email, password });
  return data;
}

/** Вход через Google OAuth (id_token) */
export async function googleAuth(idToken: string): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/auth/google', { id_token: idToken });
  return data;
}

/** Получить текущего пользователя (работает даже для неодобренных) */
export async function getMe(): Promise<UserInfo> {
  const { data } = await api.get<UserInfo>('/auth/me');
  return data;
}


// ================================================================
// Админка — управление пользователями
// ================================================================

/** Список пользователей с поиском и пагинацией (только для админов) */
export async function getAdminUsers(
  search = '',
  limit = 50,
  offset = 0,
): Promise<AdminUserListResponse> {
  const { data } = await api.get<AdminUserListResponse>('/admin/users', {
    params: { search, limit, offset },
  });
  return data;
}

/** Переключить доступ пользователя */
export async function toggleUserAccess(userId: number): Promise<ToggleAccessResponse> {
  const { data } = await api.post<ToggleAccessResponse>(`/admin/users/${userId}/toggle-active`);
  return data;
}

/** Переключить права администратора */
export async function toggleUserAdmin(userId: number): Promise<ToggleAccessResponse> {
  const { data } = await api.post<ToggleAccessResponse>(`/admin/users/${userId}/toggle-admin`);
  return data;
}

// ================================================================
// AI-ассистент для граждан (доступен для неодобренных пользователей)
// ================================================================

/** Отправить сообщение AI-ассистенту */
export async function sendChatMessage(
  message: string,
  history: import('../types').ChatMessage[],
  lang: string,
): Promise<string> {
  const { data } = await api.post<import('../types').ChatResponse>('/assistant/chat', {
    message,
    history,
    lang,
  });
  return data.response;
}

/** Стриминг сообщения AI-ассистенту через fetch + SSE */
export async function streamChatMessage(
  message: string,
  history: import('../types').ChatMessage[],
  lang: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): Promise<() => void> {
  const abortController = new AbortController();

  try {
    const response = await fetch(`${BASE_URL}/assistant/chat-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, history, lang }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Пустой ответ от сервера');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // оставляем последний неполный чанк в буфере

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            onDone();
            return () => abortController.abort();
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              onChunk(parsed.content);
            }
          } catch {
            // игнорируем ошибки парсинга неполных JSON
          }
        }
      }
    }
  } catch (err: unknown) {
    const error = err as Error;
    if (error.name === 'AbortError') {
      console.log('Stream aborted');
    } else {
      onError(error.message || 'Ошибка сети');
    }
  }

  return () => abortController.abort();
}

// ================================================================
// Проактивные предложения (Auto-Offer)
// ================================================================

/** Получить список проактивных предложений для перспективных фермеров */
export async function getProactiveOffers(
  minScore: number = 75,
  limit: number = 10,
  lang: string = 'ru',
): Promise<ProactiveOffer[]> {
  const { data } = await api.get<ProactiveOffer[]>('/proactive-offers', {
    params: { min_score: minScore, limit, lang },
  });
  return data;
}

// ================================================================
// PDF генерация
// ================================================================

/** Скачать PDF-протокол решения комиссии для заявки */
export async function downloadApplicationPdf(applicationId: number): Promise<Blob> {
  const response = await api.get(`/applications/${applicationId}/pdf`, {
    responseType: 'blob',
  });
  return response.data;
}

/** Скачать PDF-уведомление об отказе для заявки (Task 2: Auto-Refusal) */
export async function downloadRefusalPdf(applicationId: number): Promise<Blob> {
  const response = await api.get(`/applications/${applicationId}/refusal-pdf`, {
    responseType: 'blob',
  });
  return response.data;
}

/** Публичный отчёт для СМИ (Task 5) */
export async function getTransparencyReport(lang: string = 'ru'): Promise<{ report: string; lang: string }> {
  const { data } = await api.get<{ report: string; lang: string }>('/analytics/transparency-report', {
    params: { lang },
    timeout: 30000,
  });
  return data;
}

export default api;
