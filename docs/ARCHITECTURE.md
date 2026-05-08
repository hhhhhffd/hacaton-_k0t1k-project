# 🏗️ Architecture Documentation — k0t1k

> Comprehensive guide to the system architecture, design patterns, and technical decisions

---

## 📋 Table of Contents

- [System Overview](#system-overview)
- [Architecture Principles](#architecture-principles)
- [Component Architecture](#component-architecture)
- [Data Flow Architecture](#data-flow-architecture)
- [Database Architecture](#database-architecture)
- [ML Pipeline Architecture](#ml-pipeline-architecture)
- [API Architecture](#api-architecture)
- [Security Architecture](#security-architecture)
- [Deployment Architecture](#deployment-architecture)
- [Design Patterns](#design-patterns)
- [Performance Considerations](#performance-considerations)
- [Scalability Architecture](#scalability-architecture)
- [Error Handling](#error-handling)
- [Monitoring & Observability](#monitoring--observability)

---

## 🌐 System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  Admin   │  │ Analyst  │  │  Farmer  │  │  Public  │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
└───────┼─────────────┼─────────────┼─────────────┼──────────────────┘
        │             │             │             │
        └─────────────┴──────┬──────┴─────────────┘
                             │
                   ┌─────────▼─────────┐
                   │   Cloudflare      │  (Optional CDN/Security)
                   │   Tunnel          │
                   └─────────┬─────────┘
                             │
                   ┌─────────▼─────────┐
                   │      Nginx        │  Port 80
                   │  • Static Files   │  • SPA routing
                   │  • API Proxy      │  • SSL termination
                   │  • SSE Support    │  • Rate limiting
                   └─────────┬─────────┘
                             │
            ┌────────────────┴────────────────┐
            │                                 │
   ┌────────▼────────┐              ┌────────▼────────┐
   │   Frontend      │              │    Backend      │
   │   React + TS    │              │   FastAPI       │  Port 8000
   │   Vite          │              │   Uvicorn       │  • REST API
   │   TailwindCSS   │              │   SQLAlchemy    │  • ML Processing
   │   Zustand       │              │   LightGBM      │  • Async Tasks
   └─────────────────┘              └────────┬────────┘
                                             │
                              ┌──────────────┼──────────────┐
                              │              │              │
                     ┌────────▼────┐  ┌──────▼──────┐ ┌────▼────┐
                     │ PostgreSQL  │  │   Redis     │ │  LLM    │
                     │   Port 5432 │  │   Port 6379 │ │ alem.plus│
                     │ • Users     │  │ • Cache     │ │ Qwen 3.5│
                     │ • Apps      │  │ • Sessions  │ │ Score API│
                     │ • Scores    │  │ • Rate Limit│ │ Embedder│
                     └─────────────┘  └─────────────┘ └─────────┘
```

### Technology Stack Rationale

| Component | Choice | Why This Choice | Alternatives Considered |
|-----------|--------|-----------------|------------------------|
| **Backend Framework** | FastAPI | Async-native, auto OpenAPI docs, type-safe, fastest Python framework | Django (too heavy), Flask (sync-only), Sanic (less mature) |
| **Frontend Framework** | React 19 + TypeScript | Largest ecosystem, strong typing, component reusability | Vue (smaller ecosystem), Svelte (less mature), Angular (too complex) |
| **Database** | PostgreSQL 16 | ACID compliance, JSON support, mature, excellent SQLAlchemy integration | MySQL (weaker JSON), MongoDB (no ACID), SQLite (not production-ready) |
| **ORM** | SQLAlchemy 2.0 (async) | Type-safe Mapped columns, async support, mature migration tools | Prisma (Python immature), Tortoise (less features) |
| **ML Framework** | LightGBM 4.5.0 | Fast training, handles categorical features natively, excellent for tabular data | XGBoost (slower), CatBoost (larger models), Random Forest (less accurate) |
| **Explainability** | SHAP 0.46.0 | Theoretically sound, consistent, widely adopted | LIME (less stable), ELI5 (less accurate) |
| **LLM Integration** | Qwen 3.5 (alem.plus) | Strong multilingual (RU/KZ), cost-effective, good explainability | GPT-4 (expensive), Llama 3 (requires hosting), Claude (API limits) |
| **Caching** | Redis 7 | Sub-millisecond latency, pub/sub, rate limiting, session store | Memcached (no persistence), in-memory (not distributed) |
| **Container Orchestration** | Docker Compose | Simple, reproducible, hackathon-appropriate | Kubernetes (overkill), ECS (vendor lock-in) |

---

## 🏛️ Architecture Principles

### 1. Separation of Concerns

```
Layered Architecture:

Presentation Layer (Frontend)
    ↓
API Layer (FastAPI routers)
    ↓
Service Layer (Business logic)
    ↓
ML Layer (Models, features, explainers)
    ↓
Data Access Layer (SQLAlchemy ORM)
    ↓
Database Layer (PostgreSQL)
```

**Implementation**:

```python
# ✅ GOOD: Clear layer separation
# api/endpoints.py (API Layer)
@router.get("/applications/{app_id}/explain")
async def get_explanation(
    app_id: int,
    current_user: User = Depends(get_current_user),
    scoring_service: ScoringService = Depends(get_scoring_service)
):
    # Delegates to service layer
    explanation = await scoring_service.explain_application(app_id)
    return explanation

# services/scoring_service.py (Service Layer)
class ScoringService:
    async def explain_application(self, app_id: int) -> Explanation:
        # Orchestrates ML layer
        shap_values = self.explainer.compute_shap(app)
        llm_text = await self.llm_client.generate_explanation(shap_values)
        return Explanation(shap=shap_values, text=llm_text)

# ml/explainer.py (ML Layer)
class SHAPExplainer:
    def compute_shap(self, application: Application) -> Dict:
        # Uses model directly
        return self.explainer.shap_values(application.features)
```

### 2. Dependency Injection

**Problem**: Global state makes testing hard and creates hidden dependencies

**Solution**: FastAPI `Depends()` for explicit dependency injection

```python
# ❌ BAD: Global state
model = load_model()  # Global variable
redis_client = Redis()

@app.get("/score")
async def score(app_id: int):
    return model.predict(app_id)  # Hidden dependency

# ✅ GOOD: Dependency injection
def get_scoring_service() -> ScoringService:
    return ScoringService()

@app.get("/score")
async def score(
    app_id: int,
    service: ScoringService = Depends(get_scoring_service)  # Explicit dependency
):
    return service.predict(app_id)
```

### 3. Async-First Design

**Why**: ML training, LLM calls, and database queries are I/O-bound operations

**Implementation**:

```python
# Async database queries
async with AsyncSessionLocal() as session:
    apps = await session.execute(select(Application))
    
# Async LLM calls
response = await alem_client.chat.completions.create(...)

# Async Redis
await redis_client.setex(key, ttl, value)

# Background tasks for ML training
@app.post("/upload")
async def upload_data(
    file: UploadFile,
    background_tasks: BackgroundTasks
):
    # Returns immediately
    background_tasks.add_task(train_model_task, file)
    return {"task_id": "abc123"}
```

### 4. Stateless Services

**Principle**: Backend services should be stateless for horizontal scaling

**Implementation**:

```python
# ❌ BAD: Stateful service
class ScoringService:
    def __init__(self):
        self.model_cache = {}  # Local state (not shared across instances)

# ✅ GOOD: Stateless with external cache
class ScoringService:
    def __init__(self, redis: Redis):
        self.redis = redis  # Shared state
    
    async def get_score(self, app_id: int):
        # Check Redis cache first
        cached = await self.redis.get(f"score:{app_id}")
        if cached:
            return json.loads(cached)
        
        # Compute and cache
        score = self.compute_score(app_id)
        await self.redis.setex(f"score:{app_id}", 3600, json.dumps(score))
        return score
```

---

## 🧩 Component Architecture

### Backend Components

#### 1. API Layer (`app/api/`)

**Responsibilities**:
- HTTP request/response handling
- Input validation (Pydantic schemas)
- Authentication & authorization
- Rate limiting
- Response serialization

**Structure**:
```
api/
├── endpoints.py          # Main business endpoints (2627 lines)
│   ├── Data upload & training
│   ├── Application CRUD
│   ├── Scoring & explanations
│   ├── Budget simulation
│   ├── Analytics & reports
│   └── AI assistant chat
├── auth_router.py        # Authentication endpoints
│   ├── Register
│   ├── Login
│   ├── Google OAuth
│   └── Password change
└── admin_router.py       # Admin-only endpoints
    ├── User management
    └── Model versioning
```

**Design Pattern**: Router-based organization with dependency injection

```python
# Each router is independent and testable
router = APIRouter(prefix="/api/applications", tags=["Applications"])

@router.get("/{app_id}", response_model=ApplicationResponse)
async def get_application(
    app_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Implementation
    pass
```

#### 2. Service Layer (`app/services/`)

**Responsibilities**:
- Business logic orchestration
- Multi-step workflows
- Error handling & recovery
- External API integration

**Components**:

```python
# scoring_service.py - Thread-safe ML model wrapper
class ScoringService:
    """
    Manages ML model lifecycle with thread safety.
    Uses app.state to avoid global state issues.
    """
    def __init__(self):
        self._model: Optional[ScoringModel] = None
        self._lock = asyncio.Lock()
        self._feature_cache = {}
    
    async def predict(self, application: Application) -> ScoreResponse:
        async with self._lock:
            if not self._model:
                raise RuntimeError("Model not loaded")
            return self._model.predict(application.features)

# scoring_pipeline.py - Two-stage scoring
class ScoringPipeline:
    """
    Stage 1: Hard filters (instant rejection)
    Stage 2: ML scoring (nuanced evaluation)
    """
    async def score_application(self, app: Application) -> ScoreResult:
        # Stage 1: Hard filters
        if not self.passes_hard_filters(app):
            return ScoreResult(score=0, rejected=True, reason="...")
        
        # Stage 2: ML scoring
        score = await self.ml_model.predict(app.features)
        shap = self.explainer.compute_shap(app)
        explanation = await self.llm.generate(shap)
        
        return ScoreResult(
            score=score,
            shap_values=shap,
            explanation=explanation
        )

# anti_fraud_service.py - Fraud detection
class AntiFraudChecker:
    """Detects suspicious patterns:
    - Collusion (identical amounts/areas in districts)
    - Night submissions (anomalous timing)
    - New farms (suspiciously new operations)
    - Extreme amounts (outlier detection)
    """
    def detect_collusion(self, applications: List[Application]) -> List[FraudAlert]:
        # Implementation
        pass
```

#### 3. ML Layer (`app/ml/`)

**Responsibilities**:
- Feature engineering
- Model training & prediction
- SHAP explanations
- Data loading & cleaning

**Components**:

```python
# features.py - Feature engineering with leakage prevention
class FeatureTransformer:
    """
    CRITICAL DESIGN: Separate fit() and transform() to prevent target leakage.
    Statistics computed ONLY on training data, applied to test/inference data.
    """
    def fit(self, df: pd.DataFrame) -> 'FeatureTransformer':
        # Compute statistics on training data only
        self.approval_rates = df.groupby('subsidy_type')['is_approved'].mean()
        self.medians = df.groupby('region')['amount'].median()
        self.counts = df.groupby('direction').size()
        return self
    
    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        # Apply pre-computed statistics
        df['subsidy_type_approval_rate'] = df['subsidy_type'].map(self.approval_rates)
        df['amount_vs_region_median'] = df['amount'] - df['region'].map(self.medians)
        # ... 20 features total
        return df

# model.py - LightGBM wrapper with versioning
class ScoringModel:
    """
    Manages ML model lifecycle:
    - Training with early stopping
    - 5-fold cross-validation
    - Save/load with versioning
    - Prediction with probability calibration
    """
    def train(self, X_train, y_train, X_val, y_val):
        self.model = LGBMClassifier(
            n_estimators=500,
            max_depth=7,
            learning_rate=0.05,
            # ... hyperparameters
            scale_pos_weight=self._compute_class_weight(y_train)
        )
        
        self.model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            callbacks=[early_stopping(50)]
        )
        
        # Cross-validation to prove no overfitting
        cv_scores = cross_validate(self.model, X_train, y_train, cv=5)
        
        return cv_scores
    
    def predict_proba(self, features: pd.DataFrame) -> float:
        # Returns score 0-100
        proba = self.model.predict_proba(features)[0][1]
        return proba * 100

# explainer.py - SHAP explanations
class SHAPExplainer:
    """
    Provides both local and global explanations:
    - Local: SHAP values per application
    - Global: Mean |SHAP| across all applications
    """
    def __init__(self, model: ScoringModel):
        self.explainer = shap.TreeExplainer(model.model)
    
    def explain_local(self, application: Application) -> Dict:
        # SHAP values for single prediction
        shap_values = self.explainer.shap_values(application.features)
        return {
            'feature_name': shap_value,
            'top_positive': [...],
            'top_negative': [...]
        }
    
    def explain_global(self, applications: List[Application]) -> Dict:
        # Mean |SHAP| for feature importance
        # Sample to 5000 max for performance
        sampled = applications[:5000]
        all_shap = [self.explain_local(app) for app in sampled]
        return mean_absolute_shap(all_shap)
```

#### 4. Data Access Layer (`app/db/`)

**Responsibilities**:
- Database connection management
- ORM model definitions
- Session lifecycle
- Migration management

**Implementation**:

```python
# session.py - Async engine with connection pooling
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=20,           # Max persistent connections
    max_overflow=10,        # Max additional connections
    pool_timeout=30,        # Timeout waiting for connection
    pool_recycle=3600,      # Recycle connections after 1 hour
    echo=False              # Set True for SQL logging
)

AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# models.py - Declarative models with type hints
class Application(Base):
    __tablename__ = "applications"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    merit_score: Mapped[Optional[float]] = mapped_column(Float)
    shap_values: Mapped[Optional[dict]] = mapped_column(JSON)
    
    # Relationships
    scoring_results = relationship("ScoringResult", back_populates="application", cascade="all, delete-orphan")
```

---

## 🔄 Data Flow Architecture

### 1. Data Upload & Training Flow

```
User uploads Excel file
    ↓
[API Layer] POST /api/data/upload
    ├─ Validates file format (.xlsx)
    ├─ Checks authentication (admin only)
    └─ Returns HTTP 202 with task_id
    ↓
[Background Task] train_model_task(file)
    ├─ Step 1: Load Excel (data_loader.py)
    │   ├─ Auto-detect format (GISS vs Enriched)
    │   ├─ Clean data (remove garbage rows)
    │   ├─ Validate application numbers (14 digits)
    │   └─ Convert types (dates, floats)
    │
    ├─ Step 2: Feature Engineering (features.py)
    │   ├─ FeatureTransformer.fit(train_data)
    │   │   ├─ Compute approval rates (by subsidy type)
    │   │   ├─ Compute medians (by region, by subsidy)
    │   │   └─ Compute counts (by direction)
    │   │
    │   ├─ FeatureTransformer.transform(all_data)
    │   │   ├─ Extract 20 features
    │   │   ├─ Apply pre-computed statistics
    │   │   └─ Prevent target leakage
    │   │
    │   └─ Create target variable: is_merit_worthy
    │       ├─ Check mortality rate <= legal norm
    │       ├─ Check amount per head <= threshold
    │       └─ Check pasture capacity compliance
    │
    ├─ Step 3: Train Model (model.py)
    │   ├─ 80/20 stratified split
    │   ├─ LGBMClassifier with early stopping
    │   ├─ 5-fold cross-validation
    │   ├─ Compute metrics (Accuracy, F1, ROC-AUC)
    │   └─ Save model with versioning (joblib)
    │
    ├─ Step 4: Batch Scoring
    │   ├─ Load all applications
    │   ├─ Two-stage scoring:
    │   │   ├─ Hard filters (reject invalid)
    │   │   └─ ML prediction (score 0-100)
    │   ├─ Compute SHAP values (sampled)
    │   └─ Save to PostgreSQL
    │
    ├─ Step 5: Cache Invalidation
    │   ├─ Invalidate all Redis score caches
    │   └─ Update model version in Redis
    │
    └─ Step 6: Notify Completion
        └─ Update task status to "completed"
```

### 2. Scoring Request Flow

```
User requests application explanation
    ↓
[API Layer] GET /api/applications/{id}/explain
    ├─ Check authentication
    ├─ Check authorization (active user)
    └─ Extract application ID
    ↓
[Service Layer] scoring_service.explain_application(id)
    ├─ Step 1: Check Redis Cache
    │   ├─ Key: "explain:{app_id}:{language}"
    │   ├─ TTL: 3600 seconds (1 hour)
    │   └─ If cache hit → return cached result
    │
    ├─ Step 2: Load Application
    │   └─ Query PostgreSQL: SELECT * FROM applications WHERE id = ?
    │
    ├─ Step 3: Compute SHAP Values
    │   ├─ Extract features from application
    │   ├─ SHAP TreeExplainer.shap_values(features)
    │   └─ Format as JSON
    │
    ├─ Step 4: Generate LLM Explanation
    │   ├─ Build prompt with:
    │   │   ├─ Application context (region, amount, etc.)
    │   │   ├─ SHAP values (top positive/negative)
    │   │   └─ Legal norms (mortality, pasture limits)
    │   │
    │   ├─ Call Qwen 3.5 API (alem.plus)
    │   │   ├─ Temperature: 0.3 (deterministic)
    │   │   ├─ Max tokens: 1000
    │   │   └─ Language: RU or KZ
    │   │
    │   └─ Sanitize LLM response (remove hallucinations)
    │
    ├─ Step 5: Cache Result
    │   └─ Redis SETEX "explain:{app_id}:{language}" 3600 json_result
    │
    └─ Step 6: Return Response
        └─ JSON with score, SHAP, and LLM explanation
```

### 3. Budget Simulation Flow

```
User submits budget simulation request
    ↓
[API Layer] POST /api/budget-simulate
    ├─ Request body: { "total_budget": 1000000000 }
    └─ Validate budget > 0
    ↓
[Service Layer] budget_simulator.simulate(total_budget)
    ├─ Step 1: Load All Approved Applications
    │   └─ Query: SELECT * FROM applications WHERE is_approved = true
    │
    ├─ Step 2: Sort by Merit Score (Descending)
    │   └─ applications.sort(key=lambda x: x.merit_score, reverse=True)
    │
    ├─ Step 3: Greedy Allocation
    │   ├─ remaining_budget = total_budget
    │   ├─ funded_apps = []
    │   │
    │   └─ For each application:
    │       ├─ If app.amount <= remaining_budget:
    │       │   ├─ Fund application
    │       │   ├─ remaining_budget -= app.amount
    │       │   └─ funded_apps.append(app)
    │       └─ Else:
    │           └─ Skip (insufficient budget)
    │
    ├─ Step 4: Compute Metrics
    │   ├─ Total funded: len(funded_apps)
    │   ├─ Total spent: total_budget - remaining_budget
    │   ├─ Average merit score of funded
    │   └─ Budget utilization: (spent / total_budget) * 100
    │
    ├─ Step 5: Compare with FIFO Approach
    │   ├─ Repeat Steps 1-4 with FIFO sorting (by submission_date)
    │   └─ Compute differences:
    │       ├─ More farmers funded? (+X farmers)
    │       ├─ Higher average merit? (+X points)
    │       └─ Better budget utilization? (+X%)
    │
    └─ Step 6: Return Comparison Report
        └─ JSON with merit-based vs FIFO metrics
```

---

## 🗄️ Database Architecture

### Schema Design

```sql
-- Users table (authentication & authorization)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(320) UNIQUE NOT NULL,
    hashed_password VARCHAR(128),  -- NULL for OAuth users
    full_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,  -- Admin approval gate
    is_admin BOOLEAN DEFAULT FALSE,
    auth_provider VARCHAR(20) DEFAULT 'local',  -- 'local' or 'google'
    google_sub VARCHAR(255) UNIQUE,  -- Google OAuth ID
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT chk_auth_provider CHECK (auth_provider IN ('local', 'google'))
);

-- Applications table (core business data)
CREATE TABLE applications (
    id SERIAL PRIMARY KEY,
    sequential_number INTEGER,
    submission_date TIMESTAMP,
    region VARCHAR(255) NOT NULL,
    akimat VARCHAR(512),
    application_number VARCHAR(20) UNIQUE NOT NULL,
    direction VARCHAR(255),
    subsidy_name TEXT,
    status VARCHAR(100),
    normativ FLOAT DEFAULT 0.0,
    amount FLOAT DEFAULT 0.0,
    farm_district VARCHAR(255),
    
    -- Farmer Portrait features
    farmer_name VARCHAR(255),
    land_area FLOAT,
    pasture_area_ha FLOAT,
    historical_mortality_rate FLOAT,
    current_head_count FLOAT,
    
    -- Scoring results
    merit_score FLOAT,  -- 0-100
    is_approved BOOLEAN,
    risk_level VARCHAR(10),  -- 'green', 'yellow', 'red'
    shap_values JSON,  -- Per-feature SHAP values
    llm_explanation TEXT,  -- Qwen-generated explanation
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes for common queries
    CONSTRAINT chk_risk_level CHECK (risk_level IN ('green', 'yellow', 'red')),
    CONSTRAINT chk_merit_score CHECK (merit_score BETWEEN 0 AND 100)
);

-- Indexes
CREATE INDEX idx_apps_region ON applications(region);
CREATE INDEX idx_apps_direction ON applications(direction);
CREATE INDEX idx_apps_status ON applications(status);
CREATE INDEX idx_apps_merit_score ON applications(merit_score DESC);
CREATE INDEX idx_apps_application_number ON applications(application_number);

-- Scoring results table (audit trail)
CREATE TABLE scoring_results (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    score FLOAT NOT NULL,
    shap_values JSON,
    llm_explanation TEXT,
    scored_at TIMESTAMP DEFAULT NOW()
);

-- Index for scoring history
CREATE INDEX idx_scoring_app_id ON scoring_results(application_id);
```

### Migration Strategy

**Tool**: Alembic 1.13.0

**Migration Files**:
```
alembic/versions/
├── 001_initial_schema.py          # applications + scoring_results
├── 002_add_users_table.py         # users table
├── 003_add_merit_score_indexes.py # Performance indexes
├── 004_add_farmer_portal_columns.py # farmer_name, land_area
└── 005_add_missing_columns.py     # Additional features
```

**Auto-Migration on Startup**:
```python
# app/main.py
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run migrations before starting server
    logger.info("Running database migrations...")
    alembic_upgrade()
    logger.info("Migrations completed")
    
    # Initialize services
    app.state.scoring_service = ScoringService()
    app.state.redis = Redis()
    
    yield
    
    # Cleanup on shutdown
    await app.state.redis.close()
```

### Query Optimization

**Common Query Patterns**:

```python
# Pagination with filters (Dashboard)
async def get_applications(
    page: int = 1,
    page_size: int = 50,
    region: Optional[str] = None,
    status: Optional[str] = None,
    min_score: Optional[float] = None
):
    query = select(Application)
    
    # Apply filters (uses indexes)
    if region:
        query = query.where(Application.region == region)
    if status:
        query = query.where(Application.status == status)
    if min_score is not None:
        query = query.where(Application.merit_score >= min_score)
    
    # Pagination
    query = query.order_by(Application.merit_score.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    
    result = await session.execute(query)
    return result.scalars().all()

# Budget simulation (greedy allocation)
async def simulate_budget(total_budget: float):
    # Load approved apps sorted by merit (uses index)
    query = select(Application).where(
        Application.is_approved == True
    ).order_by(
        Application.merit_score.desc()
    )
    
    result = await session.execute(query)
    applications = result.scalars().all()
    
    # Greedy allocation in Python
    remaining = total_budget
    funded = []
    for app in applications:
        if app.amount <= remaining:
            funded.append(app)
            remaining -= app.amount
    
    return funded, remaining
```

---

## 🤖 ML Pipeline Architecture

### Feature Engineering Pipeline

```
Raw Excel Data
    ↓
[Data Loader]
    ├─ Auto-detect format (GISS vs Enriched)
    │   ├─ GISS: 13 columns, skiprows=4
    │   └─ Enriched: 16+ columns with Farmer Portrait
    │
    ├─ Clean data
    │   ├─ Remove header/footer rows
    │   ├─ Filter valid application numbers (regex: ^\d{5,}$)
    │   └─ Drop rows with NaN in critical columns
    │
    └─ Convert types
        ├─ Dates: pd.to_datetime()
        ├─ Numbers: pd.to_numeric(errors='coerce')
        └─ Strings: .str.strip()
    ↓
[Feature Transformer]
    │
    ├─ fit(train_data)  # ONLY on training data
    │   ├─ Compute approval rates by subsidy_type
    │   ├─ Compute median amounts by region
    │   ├─ Compute median amounts by subsidy_type
    │   └─ Compute application counts by direction
    │
    └─ transform(all_data)  # Apply to all data
        ├─ Numeric Features (13):
        │   ├─ head_count = amount / normativ
        │   ├─ month, hour, day_of_week (temporal)
        │   ├─ amount_per_head = amount / head_count
        │   ├─ subsidy_type_approval_rate (from fit)
        │   ├─ amount_vs_region_median (from fit)
        │   ├─ amount_vs_subsidy_median (from fit)
        │   ├─ normativ_amount_ratio
        │   ├─ direction_competition (from fit)
        │   ├─ amount_log = log(amount)
        │   ├─ pasture_area_ha (from data or default)
        │   ├─ historical_mortality_rate (from data or default)
        │   └─ current_head_count (from data or default)
        │
        ├─ Binary Features (3):
        │   ├─ is_cooperative (keyword matching)
        │   ├─ is_breeding (keyword matching)
        │   └─ is_import (keyword matching)
        │
        └─ Categorical Features (3):
            ├─ animal_type (keyword matching)
            ├─ subsidy_category (keyword matching)
            └─ normativ_tier (binning: low/mid/high/zero)
    ↓
[Target Variable Creation]
    └─ is_merit_worthy = (
        mortality_rate <= legal_norm AND
        amount_per_head <= 5_000_000 AND
        total_heads <= pasture_capacity
    )
    ↓
[Train/Test Split]
    └─ 80/20 stratified split (preserve class balance)
```

### Training Pipeline

```
[Training Data] (80%)
    ↓
[Model Initialization]
    └─ LGBMClassifier(
        n_estimators=500,
        max_depth=7,
        learning_rate=0.05,
        num_leaves=63,
        min_child_samples=50,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=negative/positive,
        random_state=42
    )
    ↓
[Training with Early Stopping]
    ├─ Fit on training data
    ├─ Evaluate on validation set every 10 rounds
    ├─ Early stopping if no improvement for 50 rounds
    └─ Best iteration selected automatically
    ↓
[Cross-Validation] (5-fold StratifiedKFold)
    ├─ Split training data into 5 folds
    ├─ Train 5 models (each on 4 folds, validate on 1)
    ├─ Compute metrics for each fold
    └─ Report mean ± std for:
        ├─ Accuracy
        ├─ Precision
        ├─ Recall
        ├─ F1-Score
        └─ ROC-AUC
    ↓
[Model Evaluation] (on 20% test set)
    ├─ Predict probabilities
    ├─ Compute final metrics
    ├─ Generate confusion matrix
    ├─ Generate ROC curve
    └─ Compare with CV metrics (check overfitting)
    ↓
[Model Serialization]
    ├─ Save model: joblib.dump(model, "models/v1.0.0.joblib")
    ├─ Save metadata:
    │   ├─ Training date
    │   ├─ Metrics (CV + test)
    │   ├─ Feature importances
    │   └─ Hyperparameters
    └─ Update model registry in Redis
```

### Inference Pipeline

```
[Application Data]
    ↓
[Feature Transformation]
    └─ transformer.transform(application)  # Uses pre-computed stats
    ↓
[Hard Filters] (Stage 1)
    ├─ normativ > 0
    ├─ amount > 0
    ├─ head_count in reasonable range
    ├─ submission_date within valid window
    ├─ pasture_load <= legal_capacity
    └─ score_api_compliance_check
    ↓
    ├─ If ANY filter fails → score = 0, rejected = true
    └─ If all pass → proceed to Stage 2
    ↓
[ML Scoring] (Stage 2)
    ├─ Load active model from disk (or cache)
    ├─ predict_proba(features) → probability
    └─ score = probability * 100  # Scale to 0-100
    ↓
[SHAP Explanation]
    ├─ TreeExplainer.shap_values(features)
    ├─ Compute top positive features
    ├─ Compute top negative features
    └─ Format as JSON
    ↓
[LLM Explanation] (Optional, cached)
    ├─ Check Redis cache
    │   └─ Key: "explain:{app_id}:{lang}"
    │
    ├─ If cache miss:
    │   ├─ Build prompt with context
    │   ├─ Call Qwen 3.5 API
    │   ├─ Sanitize response
    │   └─ Cache result (1 hour TTL)
    │
    └─ Return cached/generated explanation
    ↓
[Response Assembly]
    └─ {
        "merit_score": 78.5,
        "is_approved": true,
        "risk_level": "green",
        "shap_values": {...},
        "llm_explanation": "..."
    }
```

---

## 🔌 API Architecture

### RESTful Design Principles

1. **Resource-Based URLs**:
   ```
   GET    /api/applications           # List
   GET    /api/applications/{id}      # Read
   POST   /api/applications           # Create (not used - via upload)
   PUT    /api/applications/{id}      # Update (not used - immutable)
   DELETE /api/applications/{id}      # Delete (not used - soft delete only)
   ```

2. **HTTP Status Codes**:
   ```
   200 OK              # Successful GET
   201 Created         # Successful POST
   202 Accepted        # Background task started
   400 Bad Request     # Validation error
   401 Unauthorized    # Missing/invalid token
   403 Forbidden       # Insufficient permissions
   404 Not Found       # Resource doesn't exist
   500 Internal Error  # Server error
   ```

3. **Consistent Response Format**:
   ```json
   // Success
   {
     "data": {...},
     "message": "Success"
   }
   
   // Error
   {
     "detail": "Error message",
     "status_code": 400
   }
   
   // Paginated list
   {
     "data": [...],
     "total": 1234,
     "page": 1,
     "page_size": 50,
     "total_pages": 25
   }
   ```

### Endpoint Organization

```
API v1 (/api/)
├── Health & Status
│   └── GET /health
│
├── Authentication (/auth/)
│   ├── POST /auth/register
│   ├── POST /auth/login
│   ├── POST /auth/google
│   ├── GET  /auth/me
│   ├── POST /auth/change-password
│   └── POST /auth/stream-ticket
│
├── Data Management (/data/)
│   ├── POST /data/upload
│   └── GET  /upload/status/{task_id}
│
├── Applications
│   ├── GET    /applications
│   ├── GET    /applications/{id}
│   ├── GET    /applications/{id}/explain
│   ├── GET    /applications/{id}/explain-stream
│   ├── GET    /applications/{id}/pdf
│   └── GET    /applications/{id}/refusal-pdf
│
├── Analytics (/analytics/)
│   ├── GET  /stats
│   ├── GET  /global-shap
│   ├── GET  /analytics/fifo-vs-merit
│   ├── POST /analytics/simulate-weights
│   ├── GET  /analytics/transparency-report
│   ├── GET  /data-quality
│   ├── GET  /fairness
│   └── GET  /model-info
│
├── Budget Simulation
│   ├── POST /budget-simulate
│   └── POST /budget-simulate/pdf
│
├── AI Assistant (/assistant/)
│   ├── POST /assistant/chat
│   └── POST /assistant/chat-stream
│
├── Proactive Offers
│   └── GET  /proactive-offers
│
└── Administration (/admin/)
    ├── GET  /admin/users
    ├── POST /admin/users/{id}/toggle-active
    ├── POST /admin/users/{id}/toggle-admin
    ├── GET  /admin/models
    └── POST /admin/models/{filename}/activate
```

---

## 🔐 Security Architecture

### Authentication Flow

```
[Email/Password Login]
    ↓
POST /api/auth/login
    ├─ Validate email format
    ├─ Query user from DB
    ├─ Verify password with bcrypt
    └─ If valid:
        ├─ Generate JWT token (24h TTL)
        ├─ Set HTTP-only cookie (optional)
        └─ Return token + user info

[JWT Token Structure]
    {
        "sub": "user_id",
        "email": "user@example.com",
        "is_admin": false,
        "exp": 1234567890,  # Expiration timestamp
        "iat": 1234567890   # Issued at
    }
    ↓
[Token Verification]
    ↓
Depends(get_current_user)
    ├─ Extract token from Authorization header
    ├─ Decode JWT (verify signature & expiration)
    ├─ Query user from DB
    ├─ Check is_active == true
    └─ Return User object or raise 401

[Admin Authorization]
    ↓
Depends(get_current_admin)
    ├─ Call get_current_user
    ├─ Check is_admin == true
    └─ Return User object or raise 403
```

### Rate Limiting

```python
# Using slowapi (Redis-backed)
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="redis://redis:6379/0"
)

# Apply to endpoints
@router.post("/auth/login")
@limiter.limit("5/minute")  # 5 login attempts per minute
async def login(request: Request, ...):
    pass

@router.get("/applications/{id}/explain")
@limiter.limit("20/minute")  # 20 explanations per minute
async def explain(request: Request, ...):
    pass

@router.get("/applications")
@limiter.limit("100/minute")  # 100 API calls per minute
async def list_apps(request: Request, ...):
    pass
```

### Input Sanitization

```python
# SQL Injection Prevention: SQLAlchemy parameterized queries
# ❌ BAD: String formatting
query = f"SELECT * FROM users WHERE email = '{email}'"

# ✅ GOOD: Parameterized
query = select(User).where(User.email == email)

# XSS Prevention: Frontend escaping (React auto-escapes)
# LLM Hallucination Prevention: Sanitization
def sanitize_llm_response(text: str) -> str:
    # Remove potential hallucinations
    # Check against known facts
    # Validate ranges
    return cleaned_text
```

---

## 🚀 Deployment Architecture

### Docker Compose Architecture

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: pg_isready
    restart: unless-stopped
  
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: [redisdata:/data]
    healthcheck: redis-cli ping
  
  backend:
    build: ./backend
    ports: ["8000:8000"]
    depends_on: [postgres, redis]
    healthcheck: curl http://localhost:8000/api/health
    volumes:
      - ./backend/data:/app/data  # Datasets
      - ./backend/models:/app/models  # ML models
    environment:
      DATABASE_URL: postgresql+asyncpg://...
      REDIS_URL: redis://redis:6379/0
  
  nginx:
    build: ./frontend
    ports: ["80:80"]
    depends_on: [backend]
    healthcheck: curl http://localhost:80/
  
  cloudflared:  # Optional
    image: cloudflare/cloudflared
    depends_on: [nginx]
```

### Nginx Configuration

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    
    # SPA Routing
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-store";
    }
    
    # API Proxy
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_read_timeout 300s;  # 5 minutes for ML training
        proxy_connect_timeout 10s;
        client_max_body_size 100M;  # Large Excel files
        
        # SSE Support
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
    }
    
    # Static Assets (1 year cache)
    location ~* \.(js|css)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Images/Fonts (30 days cache)
    location ~* \.(png|jpg|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public";
    }
}
```

---

## 🎨 Design Patterns

### 1. Factory Pattern (Model Loading)

```python
class ModelFactory:
    @staticmethod
    def load_model(version: str = "latest") -> ScoringModel:
        if version == "latest":
            # Load from Redis registry
            version = redis.get("active_model_version")
        
        model_path = f"models/{version}.joblib"
        model = joblib.load(model_path)
        
        metadata = json.load(open(f"models/{version}.meta.json"))
        
        return ScoringModel(model, metadata)
```

### 2. Strategy Pattern (Explainability)

```python
class ExplanationStrategy(ABC):
    @abstractmethod
    def explain(self, application: Application) -> Explanation:
        pass

class SHAPExplanation(ExplanationStrategy):
    def explain(self, app: Application) -> Explanation:
        # SHAP-based explanation
        pass

class FeatureImportanceExplanation(ExplanationStrategy):
    def explain(self, app: Application) -> Explanation:
        # Global feature importance
        pass

class LLMExplanation(ExplanationStrategy):
    def explain(self, app: Application) -> Explanation:
        # LLM-generated text
        pass

# Usage
strategies = [SHAPExplanation(), LLMExplanation()]
explanations = [strategy.explain(app) for strategy in strategies]
```

### 3. Observer Pattern (Task Status Updates)

```python
class TaskObserver(ABC):
    @abstractmethod
    def update(self, task_id: str, progress: float):
        pass

class RedisTaskObserver(TaskObserver):
    def update(self, task_id: str, progress: float):
        redis.set(f"task:{task_id}:progress", progress)

class TaskManager:
    def __init__(self):
        self.observers = []
    
    def add_observer(self, observer: TaskObserver):
        self.observers.append(observer)
    
    def update_progress(self, task_id: str, progress: float):
        for observer in self.observers:
            observer.update(task_id, progress)
```

---

## ⚡ Performance Considerations

### Database Performance

1. **Connection Pooling**: 20 connections + 10 overflow
2. **Indexes**: On frequently queried columns
3. **Query Optimization**: Use `EXPLAIN ANALYZE` for slow queries
4. **Batch Operations**: Bulk inserts for scoring results

### ML Performance

1. **Caching**:
   ```python
   # Redis cache for scores (1 hour TTL)
   cache_key = f"score:{app_id}"
   cached = await redis.get(cache_key)
   if cached:
       return json.loads(cached)
   ```

2. **Sampling for SHAP**:
   ```python
   # Limit to 5000 applications for global SHAP
   sampled_apps = applications[:5000]
   ```

3. **Background Training**:
   ```python
   # Don't block HTTP request
   background_tasks.add_task(train_model, file)
   return {"task_id": task_id}
   ```

### Frontend Performance

1. **Pagination**: 50 items per page
2. **Lazy Loading**: Load charts on demand
3. **Code Splitting**: React.lazy() for routes
4. **Caching**: TanStack Query for API responses

---

## 📈 Scalability Architecture

### Horizontal Scaling

```
Current: Single Backend Instance
    ↓
Future: Multiple Backend Instances
    
┌─────────┐
│  Nginx  │  (Load Balancer)
└────┬────┘
     │
     ├──→ [Backend 1]
     ├──→ [Backend 2]
     └──→ [Backend 3]
          ↑
          All share:
          - PostgreSQL (shared DB)
          - Redis (shared cache)
          - NFS/S3 (shared models)
```

### Database Scaling

1. **Read Replicas**: For analytics queries
2. **Partitioning**: By region or date
3. **Archival**: Old applications to cold storage

### ML Scaling

1. **Model Parallelism**: Multiple models for different regions
2. **Batch Prediction**: Nightly scoring for all applications
3. **Distributed Training**: Spark ML for large datasets

---

## 🚨 Error Handling

### Global Exception Handler

```python
@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)}
    )

@app.exception_handler(Exception)
async def general_exception(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )
```

### Graceful Degradation

```python
async def get_explanation(app_id: int):
    try:
        # Try LLM explanation
        llm_text = await llm_client.generate(...)
    except LLMError:
        # Fallback to SHAP-only
        llm_text = "LLM unavailable. SHAP values provided."
    finally:
        # Always return SHAP values
        return {
            "shap_values": shap,
            "llm_explanation": llm_text  # May be fallback
        }
```

---

## 📊 Monitoring & Observability

### Health Checks

```python
@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "model_loaded": scoring_service.model is not None,
        "redis_connected": await redis.ping(),
        "llm_available": await llm_client.check_api_key()
    }
```

### Logging

```python
# Structured logging
logger.info(
    "Application scored",
    extra={
        "app_id": app_id,
        "score": score,
        "user_id": user.id,
        "duration_ms": duration
    }
)
```

### Metrics (Future)

- Prometheus metrics for API latency
- Grafana dashboards for model performance
- Alertmanager for critical errors

---

**Last Updated**: April 5, 2026  
**Maintained By**: DataNomads Team  
**Project**: _k0t1k Project
