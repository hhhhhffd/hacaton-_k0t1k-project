/** Полная информация о заявке — данные + результаты AI-скоринга */
export interface Application {
  id: number;
  sequential_number: number;
  submission_date: string | null;
  region: string;
  akimat: string;
  application_number: string;
  direction: string;
  subsidy_name: string;
  status: string;
  normativ: number;
  amount: number;
  farm_district: string;
  merit_score: number | null;
  risk_level: string | null;
  risk_reason: string | null;  // Anti-Fraud: причина риска
  pasture_area_ha: number | null;
  historical_mortality_rate: number | null;
  current_head_count: number | null;
  shap_values: Record<string, number> | null;
  llm_explanation: string | null;
  is_approved: boolean | null;
}

/** Список заявок с пагинацией */
export interface ApplicationListResponse {
  items: Application[];
  total: number;
  skip: number;
  limit: number;
}

/** Результат скоринга одной заявки (SHAP + LLM объяснение) */
export interface ScoreResponse {
  application_id: number;
  merit_score: number;
  risk_level: string;
  shap_values: Record<string, number>;
  llm_explanation: string;
}

/** Запрос на симуляцию бюджета */
export interface BudgetSimRequest {
  budget: number;
  region?: string;
  direction?: string;
  export_all?: boolean;
}

/** Результат симуляции бюджета */
export interface BudgetSimResponse {
  total_applications: number;
  funded_count: number;
  total_amount: number;
  remaining_budget: number;
  avg_funded_score: number;
  funded_applications: Application[];
}

/** Агрегированная статистика по всем заявкам */
export interface StatsResponse {
  total_applications: number;
  scored_applications: number;
  avg_score: number | null;
  score_distribution: Record<string, number>;
  top_regions: Array<{ region: string; avg_score: number; count: number }>;
  anomaly_counts: Record<string, number>;
  status_counts: Record<string, number>;
}

/** Глобальные SHAP-значения */
export interface GlobalShapResponse {
  feature_importances: Record<string, number>;
  total_samples: number;
}

/** Проверка здоровья сервиса */
export interface HealthResponse {
  status: string;
  version: string;
  model_loaded: boolean;
  redis_connected: boolean;
  llm_configured: boolean;
}

/** Состояние фильтров */
export interface FilterState {
  region: string | null;
  direction: string | null;
  status: string | null;
  minScore: number | null;
  maxScore: number | null;
}

/** Состояние сортировки */
export interface SortingState {
  field: string;
  order: 'asc' | 'desc';
}

/** Состояние пагинации */
export interface PaginationState {
  skip: number;
  limit: number;
}

/** Статистика одного столбца FIFO или Merit */
export interface FifoVsMeritColumn {
  funded_count: number;
  total_amount: number;
  avg_score: number;
  median_score: number;
  anomaly_count: number;
  coop_pct: number;
  avg_head_count: number;
  top_regions: Array<{ region: string; count: number }>;
  direction_distribution: Record<string, number>;
  score_histogram: Array<{ range: string; count: number }>;
}

/** Результат сравнения FIFO vs Merit */
export interface FifoVsMeritResponse {
  budget: number;
  total_applications: number;
  fifo: FifoVsMeritColumn;
  merit: FifoVsMeritColumn;
  score_improvement: number;
  anomaly_reduction: number;
  coop_improvement: number;
}

/** Запрос на симуляцию весов */
export interface WeightSimRequest {
  weights: Record<string, number>;
  top_n?: number;
}

/** Одна заявка в результатах симуляции весов */
export interface WeightSimApplication {
  id: number;
  application_number: string;
  region: string;
  direction: string;
  amount: number;
  original_score: number;
  new_score: number;
  rank_change: number;
}

/** Результат симуляции весов */
export interface WeightSimResponse {
  top_applications: WeightSimApplication[];
  avg_score_change: number;
  total_reshuffle: number;
  weights_used: Record<string, number>;
}

/** Поддерживаемые языки */
export type Language = 'ru' | 'kz';


// ================================================================
// Авторизация
// ================================================================

/** Ответ с JWT токеном */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  email: string;
  full_name: string;
}

/** Информация о текущем пользователе */
export interface UserInfo {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  is_admin: boolean;
  auth_provider: string;
}

/** Пользователь в админской таблице */
export interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  is_admin: boolean;
  auth_provider: string;
  created_at: string;
}

/** Список пользователей для админки */
export interface AdminUserListResponse {
  items: AdminUser[];
  total: number;
}

/** Результат переключения доступа */
export interface ToggleAccessResponse {
  user_id: number;
  email: string;
  is_active: boolean;
  message: string;
}

// ================================================================
// AI-ассистент для граждан
// ================================================================

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  lang: string;
}

export interface ChatResponse {
  response: string;
  lang: string;
}

// ================================================================
// Проактивные предложения (Auto-Offer)
// ================================================================

/** Проактивное предложение субсидии для перспективного фермера */
export interface ProactiveOffer {
  farmer_name: string;
  region: string;
  direction: string;
  pasture_area_ha: number;
  current_head_count: number;
  historical_mortality_rate: number;
  predicted_merit_score: number;
  recommendation_text: string;
}
