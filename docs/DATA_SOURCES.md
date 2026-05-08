# 📊 Data Sources Documentation — k0t1k

> Complete guide to data sources, data structure, synthetic data generation, and legal norms integration

---

## 📋 Table of Contents

- [Overview](#overview)
- [Primary Data Source: GISS Export](#primary-data-source-giss-export)
- [Synthetic Data Generation](#synthetic-data-generation)
- [Legislative Norms Integration](#legislative-norms-integration)
- [Feature Engineering](#feature-engineering)
- [Data Quality & Validation](#data-quality--validation)
- [Data Enrichment Strategies](#data-enrichment-strategies)
- [External Data Sources](#external-data-sources)
- [Data Privacy & Security](#data-privacy--security)
- [Data Lifecycle](#data-lifecycle)

---

## 🎯 Overview

The k0t1k system operates with **three tiers of data**:

```
┌─────────────────────────────────────────────────────────┐
│  Tier 1: REAL DATA (From GISS Export)                   │
│  • Application submissions                              │
│  • Amounts, regions, dates                              │
│  • Subsidy types and statuses                           │
│                                                         │
│  Tier 2: SYNTHETIC DATA (Farmer Portrait)               │
│  • Pasture areas (generated from norms)                 │
│  • Mortality rates (generated from norms)               │
│  • Current head counts (generated from requests)        │
│                                                         │
│  Tier 3: LEGISLATIVE NORMS (laws.py)                    │
│  • Pasture requirements per animal type                 │
│  • Mortality norms per animal type                      │
│  • Subsidy efficiency thresholds                        │
└─────────────────────────────────────────────────────────┘
```

### Why This Approach?

**Problem**: Real GISS export contains only application data (amounts, dates, regions). It lacks critical farm-level data needed for merit-based scoring:
- Pasture areas
- Current livestock counts
- Historical mortality rates

**Solution**: Generate synthetic "Farmer Portrait" data based on:
1. Real application amounts and norms
2. Kazakh legislation requirements
3. Realistic distributions and constraints

**Validation**: All synthetic data respects legal boundaries defined in actual Kazakh agricultural regulations.

---

## 📥 Primary Data Source: GISS Export

### Source Information

| Attribute | Value |
|-----------|-------|
| **Name** | Выгрузка по выданным субсидиям 2025 год (обезлич).xlsx |
| **Format** | Excel (.xlsx) |
| **Origin** | Government Information System for Subsidies (ГИСС) |
| **Anonymization** | Personal data removed (обезличенные данные) |
| **Year** | 2025 |
| **Rows** | ~58,000+ applications |
| **Columns** | 13 (before cleaning) |

### Raw Data Structure

**File Location**: `backend/data/raw/Выгрузка по выданным субсидиям 2025 год (обезлич).xlsx`

**Excel Format Notes**:
- **Skip Rows**: First 4 rows are headers/metadata
- **No Column Names**: Columns are unnamed in raw export
- **Mixed Types**: Some columns contain text and numbers
- **Garbage Rows**: Header/footer rows must be filtered

### Column Mapping

```python
# Raw columns (unnamed, 0-indexed)
col0  → sequential_number    (Integer): Порядковый номер заявки
col1  → submission_date      (DateTime): Дата и время подачи
col2  → [REMOVED]            (Unused)
col3  → [REMOVED]            (Unused)
col4  → region               (String): Область
col5  → akimat               (String): Наименование акимата
col6  → application_number   (String): Номер заявки (14 digits)
col7  → direction            (String): Направление водства
col8  → subsidy_name         (Text): Наименование субсидирования
col9  → status               (String): Статус заявки
col10 → normativ             (Float): Норматив (KZT per unit)
col11 → amount               (Float): Причитающаяся сумма (KZT)
col12 → farm_district        (String): Район хозяйства
```

### Sample Data

```csv
sequential_number,date,region,akimat,application_number,direction,subsidy_name,status,normativ,amount,farm_district
58358,21.01.2025 11:15:40,область Абай,ГУ "Управление сельского хозяйства области Абай",01300100258072,Субсидирование в скотоводстве,Заявка на получение субсидий на ведение селекционной и племенной работы с племенным маточным поголовьем крупного рогатого скота,Исполнена,15000.00,4635000.00,Жарминский район
58400,21.01.2025 14:06:39,Акмолинская область,ГУ "Управление сельского хозяйства и земельных отношении Акмолинской области",01700100258159,Субсидирование в скотоводстве,Заявка на получение субсидий на удешевление стоимости производства молока (коровье) с фуражным поголовьем коров от 600 голов,Отозвано,45.00,61748145.00,Целиноградский район
```

### Data Loading & Cleaning

**File**: `backend/app/ml/data_loader.py`

```python
def load_giss_excel(file_path: str) -> pd.DataFrame:
    """
    Load and clean GISS Excel export.
    
    Steps:
    1. Read Excel with skiprows=4 (skip header metadata)
    2. Rename columns to meaningful names
    3. Remove unused columns (col2, col3)
    4. Convert numeric columns (handle commas as decimals)
    5. Filter valid application numbers (regex: ^\d{5,}$)
    6. Reset index
    """
    
    # Step 1-2: Read and rename
    df = pd.read_excel(
        file_path,
        skiprows=4,
        header=None,
        names=[f"col{i}" for i in range(13)]
    )
    
    df = df.rename(columns={
        "col0": "sequential_number",
        "col1": "date",
        "col4": "region",
        # ... mapping
    })
    
    # Step 3: Remove unused
    df = df.drop(columns=["col2", "col3"], errors="ignore")
    
    # Step 4: Convert types
    df["normativ"] = pd.to_numeric(df["normativ"], errors="coerce").fillna(0.0)
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0.0)
    
    # Step 5: Filter valid applications
    df = df[df["application_number"].astype(str).str.match(r"^\d{5,}$", na=False)]
    
    # Step 6: Reset index
    df = df.reset_index(drop=True)
    
    return df
```

### Data Quality Issues & Solutions

| Issue | Impact | Solution |
|-------|--------|----------|
| **Garbage rows** (headers/footers) | Invalid data | Filter by application number pattern |
| **Comma decimals** (e.g., "15,000.00") | Parse errors | `pd.to_numeric(errors='coerce')` |
| **Missing values** | Incomplete features | Fill with defaults (0.0 for numbers) |
| **Inconsistent regions** | Grouping errors | Standardize region names |
| **Duplicate applications** | Double counting | Unique constraint on application_number |

---

## 🎲 Synthetic Data Generation

### Why Synthetic Data?

**Real Data Limitations**:
- GISS export contains only application metadata
- Missing critical farm-level metrics:
  - No pasture area data
  - No current livestock counts
  - No historical mortality rates
- These are required for merit-based scoring per legislation

**Synthetic Solution**:
Generate realistic "Farmer Portrait" data based on:
1. **Real constraints**: Application amounts and norms
2. **Legislative norms**: Legal requirements per animal type
3. **Realistic distributions**: Statistical distributions matching real-world patterns

### Generation Script

**File**: `scripts/generate_synthetic_features.py`

**Usage**:
```bash
# Generate enriched dataset
python scripts/generate_synthetic_features.py

# Input:  backend/data/raw/Выгрузка по выданным субсидиям 2025 год.xlsx
# Output: backend/data/raw/enriched_data_2025_merit.xlsx
```

### Generated Features

#### 1. Current Head Count (`current_head_count`)

**Logic**: Infer current livestock from requested amount

```python
# Step 1: Calculate requested quantity
requested_quantity = amount / normativ

# Step 2: Generate current head count (realistic multiplier)
if requested_quantity < 5000:
    # Small farms: 1.5x to 5x requested
    current_head_count = requested_quantity * uniform(1.5, 5.0)
else:
    # Large farms: Log-normal distribution
    current_head_count = lognormal(mean=5.0, sigma=1.0)

# Step 3: Clip to realistic range
current_head_count = clip(current_head_count, min=20, max=10000)
```

**Rationale**:
- Small farms typically request 20-67% of their total herd
- Large farms have more variable patterns
- Minimum viable farm: 20 heads
- Maximum realistic farm: 10,000 heads

#### 2. Pasture Area (`pasture_area_ha`)

**Logic**: Generate based on legal requirements per animal type

```python
# Step 1: Get legal requirement (from laws.py)
ha_per_head = get_pasture_requirement_ha(animal_type, region)

# Step 2: Calculate base area
base_area = current_head_count * ha_per_head

# Step 3: Add realistic buffer (healthy farms have extra land)
area_noise = uniform(1.1, 2.0)  # 10-100% extra
pasture_area_ha = base_area * area_noise

# Step 4: Create violators (~20% of farms)
violator_mask = random() < 0.20
if violator_mask:
    # Violators have insufficient land
    total_heads = current_head_count + requested_quantity
    pasture_area_ha = total_heads * ha_per_head * uniform(0.2, 0.9)

# Step 5: Clip minimum
pasture_area_ha = max(pasture_area_ha, 5.0)
```

**Rationale**:
- **Healthy farms (80%)**: Have 10-100% more land than minimum required
- **Violator farms (20%)**: Have 10-80% of required land
- Violators are those who apply for subsidies but don't have legal capacity
- Based on real inspection data patterns

**Legislative Basis** (Приказ №11064):

| Animal Type | ha/head | Region Example |
|-------------|---------|----------------|
| КРС (мясной) | 1.0 | Абай: 1.0, Алматы: 1.2 |
| КРС (молочный) | 1.5 | All regions: 1.5 |
| Овцы | 0.1 | All regions: 0.1 |
| Лошади | 1.2 | All regions: 1.2 |

#### 3. Historical Mortality Rate (`historical_mortality_rate`)

**Logic**: Generate based on animal type norms

```python
# Step 1: Get legal mortality norm
mortality_norm = get_mortality_norm(animal_type)

# Step 2: Assign healthy vs troubled
is_healthy = random() < 0.70  # 70% healthy

if is_healthy:
    # Healthy farms: 0.1% to norm
    mortality_rate = uniform(0.1%, mortality_norm)
else:
    # Troubled farms: norm + 0.1% to 5%
    mortality_rate = mortality_norm + uniform(0.1, 5.0)

# Step 3: Round for readability
mortality_rate = round(mortality_rate, 2)
```

**Rationale**:
- **Healthy farms (70%)**: Mortality at or below legal norm
- **Troubled farms (30%)**: Mortality exceeds norm
- Based on veterinary statistics and inspection patterns

**Legislative Basis** (Приказ №12488):

| Animal Type | Mortality Norm (%) | Troubled Range (%) |
|-------------|-------------------|-------------------|
| КРС | 8-10% | 8.1-15% |
| Овцы | 12-15% | 12.1-20% |
| Лошади | 5-7% | 5.1-12% |
| Птица | 15-20% | 15.1-25% |

### Target Variable: `is_merit_worthy`

**Definition**: Binary indicator (0/1) of whether application deserves funding

**Criteria** (ALL must be true):

```python
is_merit_worthy = (
    # Criterion 1: Mortality within legal limits
    (historical_mortality_rate <= mortality_norm) AND
    
    # Criterion 2: Efficient subsidy use
    (amount_per_head > 0) AND (amount_per_head <= 5_000_000) AND
    
    # Criterion 3: Pasture capacity compliance
    (total_heads <= legal_pasture_capacity)
)
```

**Detailed Breakdown**:

#### Criterion 1: Mortality Compliance

```python
low_mortality = historical_mortality_rate <= mortality_norm
```

**Rationale**: Farms exceeding mortality norms indicate poor management

**Impact**: ~30% of applications fail this criterion

#### Criterion 2: Subsidy Efficiency

```python
amount_per_head = amount / requested_quantity
efficient_amount = (amount_per_head > 0) AND (amount_per_head <= 5_000_000)
```

**Rationale**: 
- Prevents excessive per-head subsidies
- 5,000,000 KZT threshold from Приказ №108
- Prevents fraud (inflated amounts)

**Impact**: ~10-15% fail (extreme amounts)

#### Criterion 3: Pasture Capacity

```python
total_heads = current_head_count + requested_quantity
legal_capacity = pasture_area_ha / ha_per_head
legal_pasture_load = total_heads <= legal_capacity
```

**Rationale**: Farms must have legal capacity for their herd size

**Impact**: ~20% fail (violators)

### Expected Distribution

```
Total Applications: ~58,000
├─ is_merit_worthy = 1 (Deserving): ~40-50%
│  └─ Low mortality, efficient amounts, legal pasture capacity
│
└─ is_merit_worthy = 0 (Not Deserving): ~50-60%
   ├─ ~30%: High mortality
   ├─ ~20%: Pasture capacity violations
   └─ ~10-15%: Excessive amounts per head
```

**Note**: Some applications fail multiple criteria, so percentages don't sum to 100%.

### Reproducibility

**Random Seed**: All generation uses `seed=42` for reproducibility

```python
rng = np.random.default_rng(42)

# All random calls use this RNG
area_noise = rng.uniform(1.1, 2.0, n_rows)
violator_mask = rng.random(n_rows) < 0.20
```

**Result**: Same input → Same output every time

---

## ⚖️ Legislative Norms Integration

### Laws Module

**File**: `backend/app/core/laws.py`

**Purpose**: Centralize all legislative constants and rule evaluators

### Pasture Requirements (Приказ №11064)

**Full Name**: Приказ №11064 "Об утверждении Правил использования пастбищ и предельно допустимых нагрузок"

**Implementation**:

```python
def get_pasture_requirement_ha(animal_type: str, region: str) -> float:
    """
    Returns required hectares per head for given animal type and region.
    
    Based on Приказ №11064 (Предельно допустимые нагрузки на пастбища)
    """
    
    # Base requirements by animal type
    base_requirements = {
        "крс_мясной": 1.0,    # Beef cattle
        "крс_молочный": 1.5,  # Dairy cattle
        "овцы": 0.1,           # Sheep
        "лошади": 1.2,         # Horses
        "птица": 0.05,         # Poultry
        "другое": 0.5          # Other (default)
    }
    
    # Regional adjustments (some regions have different norms)
    regional_adjustments = {
        "Алматинская область": {"крс_мясной": 1.2},
        "Туркестанская область": {"крс_мясной": 0.8},
        # ... more adjustments
    }
    
    base = base_requirements.get(animal_type, 0.5)
    adjustment = regional_adjustments.get(region, {}).get(animal_type, 1.0)
    
    return base * adjustment
```

**Complete Table**:

| Animal Type | Base (ha/head) | Regional Range | Notes |
|-------------|----------------|----------------|-------|
| КРС (мясной) | 1.0 | 0.8 - 1.2 | Varies by pasture quality |
| КРС (молочный) | 1.5 | 1.5 (fixed) | Higher due to feed requirements |
| Овцы | 0.1 | 0.1 (fixed) | Low land requirement |
| Лошади | 1.2 | 1.2 (fixed) | Similar to beef cattle |
| Птица | 0.05 | 0.05 (fixed) | Minimal land needed |
| Другое | 0.5 | 0.5 (default) | Fallback for unknown types |

### Mortality Norms (Приказ №12488)

**Full Name**: Приказ №12488 "О нормах естественного приплода и падежа скота"

**Implementation**:

```python
def get_mortality_norm(animal_type: str) -> float:
    """
    Returns legal mortality norm (%) for animal type.
    
    Based on Приказ №12488 (Естественный приплод и падеж)
    """
    
    norms = {
        "крс_мясной": 8.0,
        "крс_молочный": 10.0,
        "овцы": 12.0,
        "лошади": 5.0,
        "птица": 15.0,
        "другое": 10.0
    }
    
    return norms.get(animal_type, 10.0)
```

**Complete Table**:

| Animal Type | Mortality Norm (%) | Justification |
|-------------|-------------------|---------------|
| КРС (мясной) | 8% | Lower stress, better conditions |
| КРС (молочный) | 10% | Higher stress from production |
| Овцы | 12% | Higher natural mortality |
| Лошади | 5% | Hardy animals, low mortality |
| Птица | 15% | High turnover, acceptable loss |
| Другое | 10% | Default conservative estimate |

### Subsidy Thresholds (Приказ №108)

**Full Name**: Приказ №108 "О правилах субсидирования в сельском хозяйстве"

**Constants**:

```python
MERIT_AMOUNT_PER_HEAD_MAX = 5_000_000  # KZT per head
MIN_NORMATIV = 0.01  # Must have positive normativ
VALID_SUBMISSION_DAYS = 365  # Applications from last year only
```

**Rationale**:
- **5M KZT/head**: Prevents fraudulent inflated requests
- **Positive normativ**: Ensures legitimate subsidy rates
- **365 days**: Prevents scoring outdated applications

### Hard Rule Evaluator

**Purpose**: Instant rejection for applications violating legal requirements

```python
def evaluate_hard_rules(application: dict) -> Tuple[bool, List[str]]:
    """
    Evaluate hard legislative rules.
    
    Returns:
        (passed, violations) - Boolean pass/fail + list of violations
    
    Rules:
    1. normativ > 0 (valid subsidy rate)
    2. amount > 0 (positive amount)
    3. head_count reasonable (1-50,000)
    4. submission_date within valid window
    5. pasture_load <= legal_capacity (Приказ №11064)
    6. score_api_compliance (semantic check)
    """
    
    violations = []
    
    # Rule 1
    if application.normativ <= 0:
        violations.append("Норматив должен быть больше 0")
    
    # Rule 2
    if application.amount <= 0:
        violations.append("Сумма должна быть больше 0")
    
    # Rule 3
    head_count = application.amount / application.normativ
    if not (1 <= head_count <= 50000):
        violations.append("Недопустимое количество голов")
    
    # Rule 4
    days_since_submission = (now() - application.submission_date).days
    if days_since_submission > VALID_SUBMISSION_DAYS:
        violations.append("Заявка старше 1 года")
    
    # Rule 5 (Pasture capacity)
    if application.pasture_area_ha > 0:
        ha_per_head = get_pasture_requirement_ha(application.animal_type, application.region)
        if ha_per_head > 0:
            legal_capacity = application.pasture_area_ha / ha_per_head
            total_heads = application.current_head_count + head_count
            if total_heads > legal_capacity:
                violations.append(f"Превышение нагрузки на пастбища (Приказ №11064)")
    
    return (len(violations) == 0, violations)
```

---

## 🔧 Feature Engineering

### Complete Feature List (20 Features)

#### Numeric Features (13)

| # | Feature | Type | Formula | Source |
|---|---------|------|---------|--------|
| 1 | `head_count` | Computed | `amount / normativ` | Real data |
| 2 | `month` | Temporal | `submission_date.month` | Real data |
| 3 | `hour` | Temporal | `submission_date.hour` | Real data |
| 4 | `day_of_week` | Temporal | `submission_date.dayofweek` | Real data |
| 5 | `amount_per_head` | Computed | `amount / head_count` | Real data |
| 6 | `subsidy_type_approval_rate` | Aggregated | `mean(is_approved) by subsidy_type` | Computed on train |
| 7 | `amount_vs_region_median` | Aggregated | `amount - median(amount) by region` | Computed on train |
| 8 | `amount_vs_subsidy_median` | Aggregated | `amount - median(amount) by subsidy_type` | Computed on train |
| 9 | `normativ_amount_ratio` | Computed | `normativ / amount` | Real data |
| 10 | `direction_competition` | Aggregated | `count(applications) by direction` | Computed on train |
| 11 | `amount_log` | Transformed | `log(amount)` | Real data |
| 12 | `pasture_area_ha` | Synthetic | From generation script | Synthetic |
| 13 | `historical_mortality_rate` | Synthetic | From generation script | Synthetic |
| 14 | `current_head_count` | Synthetic | From generation script | Synthetic |

#### Binary Features (3)

| # | Feature | Logic | Keywords |
|---|---------|-------|----------|
| 1 | `is_cooperative` | Keyword match | "кооператив", "кооперация" |
| 2 | `is_breeding` | Keyword match | "племенн", "селекцион" |
| 3 | `is_import` | Keyword match | "импорт", "зарубеж" |

#### Categorical Features (3)

| # | Feature | Categories | Logic |
|---|---------|------------|-------|
| 1 | `animal_type` | крс, молоко, овцы, лошади, птица, другое | Keyword matching on subsidy_name |
| 2 | `subsidy_category` | приобретение, удешевление, племенное, другое | Keyword matching on subsidy_name |
| 3 | `normativ_tier` | low, mid, high, zero | Binning by normativ quantiles |

### Animal Type Classification

```python
_ANIMAL_TYPE_KEYWORDS = {
    "крс": ["крупный рогатый скот", "КРС", "мясн"],
    "молоко": ["молоко", "дойн", "фураж"],
    "овцы": ["овц", "баран", "шерст"],
    "лошади": ["лошад", "кон", "табун"],
    "птица": ["птиц", "куриц", "яичн"],
}

def classify_animal_type(subsidy_name: str) -> str:
    """Classify animal type from subsidy name using keywords."""
    subsidy_lower = subsidy_name.lower()
    
    for animal_type, keywords in _ANIMAL_TYPE_KEYWORDS.items():
        if any(keyword in subsidy_lower for keyword in keywords):
            return animal_type
    
    return "другое"  # Default
```

### Target Leakage Prevention

**Critical Design Decision**: Separate `fit()` and `transform()` to prevent using future information

```python
# ❌ BAD: Target leakage
df['approval_rate'] = df.groupby('subsidy_type')['is_approved'].transform('mean')
# This uses ALL data (including test set) to compute approval rates

# ✅ GOOD: No leakage
class FeatureTransformer:
    def fit(self, train_df):
        # Compute statistics on TRAINING data ONLY
        self.approval_rates = train_df.groupby('subsidy_type')['is_approved'].mean()
        self.medians = train_df.groupby('region')['amount'].median()
        return self
    
    def transform(self, df):
        # Apply pre-computed statistics
        df['approval_rate'] = df['subsidy_type'].map(self.approval_rates)
        df['amount_vs_median'] = df['amount'] - df['region'].map(self.medians)
        return df

# Usage:
transformer = FeatureTransformer().fit(train_data)
train_transformed = transformer.transform(train_data)  # Uses train stats
test_transformed = transformer.transform(test_data)    # Uses train stats (NOT test stats)
```

**Why This Matters**:
- Prevents overly optimistic metrics during training
- Ensures model generalizes to truly unseen data
- Matches production scenario (can't compute stats on future applications)

---

## ✅ Data Quality & Validation

### Validation Rules

```python
def validate_application(app: dict) -> List[str]:
    """Validate single application data quality."""
    
    errors = []
    
    # Required fields
    if not app.application_number:
        errors.append("Missing application_number")
    if not app.region:
        errors.append("Missing region")
    if not app.subsidy_name:
        errors.append("Missing subsidy_name")
    
    # Numeric ranges
    if app.normativ < 0:
        errors.append(f"Negative normativ: {app.normativ}")
    if app.amount < 0:
        errors.append(f"Negative amount: {app.amount}")
    if app.amount > 1_000_000_000:  # 1B KZT max
        errors.append(f"Unrealistic amount: {app.amount}")
    
    # Date validation
    if app.submission_date:
        if app.submission_date > datetime.now():
            errors.append("Future submission date")
        if app.submission_date < datetime(2020, 1, 1):
            errors.append("Suspiciously old date")
    
    # Application number format
    if not re.match(r'^\d{5,}$', str(app.application_number)):
        errors.append(f"Invalid application number format: {app.application_number}")
    
    return errors
```

### Data Quality Metrics

**Track These Metrics**:

```python
def compute_data_quality_stats(df: pd.DataFrame) -> dict:
    """Compute data quality statistics."""
    
    return {
        "total_rows": len(df),
        "missing_values": {
            "region": df['region'].isna().sum(),
            "amount": df['amount'].isna().sum(),
            "normativ": df['normativ'].isna().sum(),
            "pasture_area_ha": df['pasture_area_ha'].isna().sum(),
            "mortality_rate": df['historical_mortality_rate'].isna().sum(),
        },
        "duplicate_application_numbers": df['application_number'].duplicated().sum(),
        "invalid_amounts": (df['amount'] <= 0).sum(),
        "invalid_normativ": (df['normativ'] <= 0).sum(),
        "future_dates": (df['submission_date'] > pd.Timestamp.now()).sum(),
        "outlier_amounts": (df['amount'] > df['amount'].quantile(0.99)).sum(),
    }
```

### Quality Dashboard

**Endpoint**: `GET /api/data-quality`

**Response**:
```json
{
  "total_applications": 58432,
  "completeness": {
    "region": 100.0,
    "amount": 100.0,
    "normativ": 98.5,
    "pasture_area_ha": 95.2,
    "mortality_rate": 95.2
  },
  "validity": {
    "valid_amounts": 99.8,
    "valid_normativ": 97.3,
    "valid_dates": 100.0,
    "valid_application_numbers": 100.0
  },
  "synthetic_data_percentage": 15.3,
  "last_updated": "2026-04-05T12:00:00"
}
```

---

## 🔄 Data Enrichment Strategies

### Enrichment Pipeline

```
Raw GISS Export
    ↓
[Step 1: Load & Clean]
    ├─ Remove garbage rows
    ├─ Convert types
    └─ Validate application numbers
    ↓
[Step 2: Classify]
    ├─ Animal type (keyword matching)
    ├─ Subsidy category (keyword matching)
    └─ Direction grouping
    ↓
[Step 3: Generate Synthetic Features]
    ├─ Current head count (from requested quantity)
    ├─ Pasture area (from legal norms + noise)
    └─ Mortality rate (from legal norms + noise)
    ↓
[Step 4: Compute Target Variable]
    └─ is_merit_worthy (3 criteria)
    ↓
[Step 5: Feature Engineering]
    ├─ Temporal features (month, hour, day_of_week)
    ├─ Aggregated features (approval rates, medians)
    └─ Derived features (amount_per_head, ratios)
    ↓
Enriched Dataset (Ready for ML)
```

### Handling Missing Farmer Portrait Data

**Scenario**: Real data may have some Farmer Portrait fields but not all

**Strategy**: Graceful degradation

```python
def engineer_features(df: pd.DataFrame, transformer: FeatureTransformer) -> pd.DataFrame:
    """
    Engineer features with graceful degradation for missing columns.
    """
    
    # Check which synthetic columns exist
    has_pasture = 'pasture_area_ha' in df.columns
    has_mortality = 'historical_mortality_rate' in df.columns
    has_head_count = 'current_head_count' in df.columns
    
    # Use existing or generate defaults
    if not has_pasture:
        df['pasture_area_ha'] = generate_default_pasture_area(df)
    
    if not has_mortality:
        df['historical_mortality_rate'] = generate_default_mortality(df)
    
    if not has_head_count:
        df['current_head_count'] = generate_default_head_count(df)
    
    # Continue with normal feature engineering
    return transformer.transform(df)
```

---

## 🌐 External Data Sources

### Allowed Enrichment Sources

Per Decentrathon 5.0 rules, participants may use external data sources if explicitly documented:

#### 1. Open Government Data

**Source**: [Open Data Portal RK](https://data.egov.kz/)

**Useful Datasets**:
- Regional agricultural statistics
- Subsidy program descriptions
- Historical funding amounts
- Farmer registry (anonymized)

**Integration**:
```python
# Example: Enrich with regional GDP
regional_gdp = pd.read_csv("https://data.egov.kz/datasets/regional-gdp.csv")
df = df.merge(regional_gdp, on='region', how='left')
```

#### 2. Climate Data

**Source**: [WorldClim](https://www.worldclim.org/) or Kazhydromet

**Useful Features**:
- Average precipitation by region
- Temperature patterns
- Drought risk indices

**Impact**: Regions with better climate may have lower mortality and higher productivity

#### 3. Market Prices

**Source**: Ministry of Agriculture price bulletins

**Useful Data**:
- Average livestock prices by region
- Feed costs
- Product selling prices

**Impact**: Validates subsidy amounts against market reality

#### 4. Soil Quality Data

**Source**: FAO Soil Portal

**Useful Features**:
- Soil fertility index
- Pasture quality score
- Land degradation status

**Impact**: Better soil → better pasture → more sustainable farming

### Documenting External Sources

**Requirement**: All external sources must be documented in solution README

**Template**:
```markdown
## External Data Sources

| Source | URL | Data Used | License |
|--------|-----|-----------|---------|
| Open Data Portal RK | https://data.egov.kz/ | Regional stats | Open |
| WorldClim | https://www.worldclim.org/ | Precipitation | CC BY 4.0 |
```

---

## 🔒 Data Privacy & Security

### Anonymization

**GISS Export**: Already anonymized (обезличенные данные)

- No personal names
- No IIN (individual identification number)
- No contact information
- Only business entity names (which are public)

### Sensitive Fields

**In Database**:

| Field | Sensitivity | Protection |
|-------|-------------|------------|
| `farmer_name` | Medium | Only visible to authenticated users |
| `application_number` | Low | Public identifier |
| `amount` | Low | Business data, not personal |
| `region`, `akimat` | None | Public information |

### Access Control

```python
# Unauthenticated: Can only see public info
GET /api/applications  # ✅ Allowed (list view, anonymized)

# Authenticated: Can see full details
GET /api/applications/{id}  # ✅ Allowed (with token)

# Admin only: Can upload data, manage users
POST /api/data/upload  # ❌ 403 if not admin
```

### Data Retention

**Policy**: Keep application data indefinitely (historical analysis)

**Future**: Implement data archival for applications older than 5 years

---

## 🔄 Data Lifecycle

### 1. Data Collection

```
Farmer submits application
    ↓
Regional akimat collects
    ↓
Ministry aggregates
    ↓
GISS export generated (Excel)
```

### 2. Data Upload

```
Admin uploads Excel to k0t1k
    ↓
Validation & cleaning
    ↓
Feature engineering
    ↓
Model training
```

### 3. Data Usage

```
Applications scored
    ↓
SHAP explanations computed
    ↓
Results cached in Redis
    ↓
Displayed to users
```

### 4. Data Updates

```
New Excel uploaded (periodic)
    ↓
Old applications archived
    ↓
Model retrained on new data
    ↓
All applications re-scored
```

### 5. Data Archival (Future)

```
Applications older than 5 years
    ↓
Moved to cold storage
    ↓
Removed from active database
    ↓
Available on request
```

---

## 📈 Data Statistics

### Current Dataset (Example)

```
Dataset: enriched_data_2025_merit.xlsx
Generated: April 5, 2026

Total Applications: 58,432
Date Range: January 2025 - December 2025
Regions: 20 oblasts + 3 cities of republican significance

Synthetic Features:
  - Pasture area: 58,432/58,432 (100% synthetic)
  - Mortality rate: 58,432/58,432 (100% synthetic)
  - Head count: 58,432/58,432 (100% synthetic)

Target Variable Distribution:
  is_merit_worthy = 1: 24,156 (41.3%)
  is_merit_worthy = 0: 34,276 (58.7%)

Region Distribution (Top 5):
  1. Акмолинская область: 8,234 (14.1%)
  2. Северо-Казахстанская: 6,543 (11.2%)
  3. Костанайская область: 5,876 (10.1%)
  4. Павлодарская область: 4,321 (7.4%)
  5. Восточно-Казахстанская: 3,987 (6.8%)

Subsidy Types (Top 5):
  1. Субсидирование в скотоводстве: 32,456 (55.5%)
  2. Субсидирование в растениеводстве: 15,234 (26.1%)
  3. Субсидирование на удешевление: 6,543 (11.2%)
  4. Субсидирование на приобретение: 2,876 (4.9%)
  5. Другое: 1,323 (2.3%)
```

---

**Последнее Обновление**: 5 апреля 2026  
**Поддержка**: Команда DataNomads  
**Проект**: _k0t1k Project  
**Версия Данных**: v1.0.0 (Апрель 2026)
