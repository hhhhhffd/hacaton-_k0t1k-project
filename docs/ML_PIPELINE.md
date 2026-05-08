# 🤖 ML Pipeline Documentation — _k0t1k Project

> Complete guide to the machine learning pipeline, from data preparation to model deployment

---

## 📋 Table of Contents

- [Overview](#overview)
- [Pipeline Architecture](#pipeline-architecture)
- [Data Preparation](#data-preparation)
- [Feature Engineering](#feature-engineering)
- [Model Training](#model-training)
- [Model Evaluation](#model-evaluation)
- [Model Serialization](#model-serialization)
- [Inference Pipeline](#inference-pipeline)
- [Model Versioning](#model-versioning)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

The _k0t1k ML pipeline is a production-ready system for scoring agricultural subsidy applications. It uses **LightGBM** as the core algorithm with comprehensive feature engineering and explainability.

### Key Design Principles

1. **No Target Leakage**: Separate `fit()` and `transform()` to prevent using future information
2. **Reproducibility**: Fixed random seeds and deterministic operations
3. **Explainability**: SHAP values for every prediction
4. **Production-Ready**: Batch scoring with error handling
5. **Versioned Models**: Track all model versions with metadata

### Pipeline Stages

```
Raw Excel Data
    ↓
[1. Data Loading & Cleaning]
    ↓
[2. Feature Engineering]
    ↓
[3. Target Variable Creation]
    ↓
[4. Model Training]
    ↓
[5. Model Evaluation]
    ↓
[6. Model Serialization]
    ↓
[7. Batch Scoring]
    ↓
Scored Applications in Database
```

---

## 🏗️ Pipeline Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                  ML PIPELINE                             │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │  Data Loader │ →  │   Feature    │ →  │  Target  │  │
│  │  (Excel)     │    │ Transformer  │    │ Variable │  │
│  └──────────────┘    └──────────────┘    └──────────┘  │
│                                              ↓          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────┐  │
│  │   Model      │ ←  │   Training   │ ←  │  Train/  │  │
│  │  Serializer  │    │   Pipeline   │    │  Test    │  │
│  └──────────────┘    └──────────────┘    └──────────┘  │
│         ↓                                                │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │   Inference  │ →  │   Scoring    │                   │
│  │   Pipeline   │    │   Service    │                   │
│  └──────────────┘    └──────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

### File Structure

```
backend/app/ml/
├── __init__.py
├── data_loader.py      # Excel loading and cleaning
├── features.py         # Feature engineering (20 features)
├── model.py            # LightGBM wrapper with training
├── explainer.py        # SHAP explanations
└── scoring_pipeline.py # Two-stage scoring pipeline
```

---

## 📥 Data Preparation

### Data Loading

**File**: `backend/app/ml/data_loader.py`

```python
def load_giss_excel(file_path: str) -> pd.DataFrame:
    """
    Load and clean GISS Excel export.
    
    Parameters:
        file_path: Path to .xlsx file
    
    Returns:
        Cleaned DataFrame with validated data
    """
    
    # Read Excel (skip first 4 rows - header metadata)
    df = pd.read_excel(
        file_path,
        skiprows=4,
        header=None,
        names=[f"col{i}" for i in range(13)],
        engine="openpyxl"
    )
    
    # Rename columns
    df = df.rename(columns={
        "col0": "sequential_number",
        "col1": "submission_date",
        "col4": "region",
        "col5": "akimat",
        "col6": "application_number",
        "col7": "direction",
        "col8": "subsidy_name",
        "col9": "status",
        "col10": "normativ",
        "col11": "amount",
        "col12": "farm_district"
    })
    
    # Remove unused columns
    df = df.drop(columns=["col2", "col3"], errors="ignore")
    
    return df
```

### Data Cleaning

```python
def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Clean and validate data.
    
    Steps:
    1. Convert numeric columns (handle comma decimals)
    2. Filter valid application numbers (regex: ^\d{5,}$)
    3. Remove rows with missing critical data
    4. Reset index
    """
    
    # Convert numeric columns
    df["normativ"] = pd.to_numeric(df["normativ"], errors="coerce").fillna(0.0)
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0.0)
    
    # Filter valid application numbers
    before_count = len(df)
    df = df[df["application_number"].astype(str).str.match(r"^\d{5,}$", na=False)]
    df = df.reset_index(drop=True)
    
    logger.info(f"Cleaned data: {before_count} → {len(df)} rows")
    
    return df
```

### Data Quality Checks

```python
def validate_data_quality(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Run data quality checks before processing.
    
    Returns:
        Dictionary with quality metrics
    """
    
    return {
        "total_rows": len(df),
        "missing_values": {
            "region": df["region"].isna().sum(),
            "amount": df["amount"].isna().sum(),
            "normativ": df["normativ"].isna().sum()
        },
        "duplicate_applications": df["application_number"].duplicated().sum(),
        "invalid_amounts": (df["amount"] <= 0).sum(),
        "date_range": {
            "min": df["submission_date"].min(),
            "max": df["submission_date"].max()
        }
    }
```

---

## 🔧 Feature Engineering

### FeatureTransformer Class

**File**: `backend/app/ml/features.py`

```python
class FeatureTransformer:
    """
    Feature engineering with target leakage prevention.
    
    CRITICAL: Statistics computed ONLY on training data,
    then applied to test/inference data.
    """
    
    def __init__(self):
        # Statistics computed during fit()
        self.approval_rates = None
        self.region_medians = None
        self.subsidy_medians = None
        self.direction_counts = None
    
    def fit(self, df: pd.DataFrame) -> 'FeatureTransformer':
        """
        Compute statistics on training data ONLY.
        
        These statistics are used for feature engineering
        and must not include test data to prevent leakage.
        """
        
        # Approval rates by subsidy type
        self.approval_rates = (
            df.groupby("subsidy_name")["is_merit_worthy"]
            .mean()
            .to_dict()
        )
        
        # Median amounts by region
        self.region_medians = (
            df.groupby("region")["amount"]
            .median()
            .to_dict()
        )
        
        # Median amounts by subsidy type
        self.subsidy_medians = (
            df.groupby("subsidy_name")["amount"]
            .median()
            .to_dict()
        )
        
        # Application counts by direction
        self.direction_counts = (
            df.groupby("direction").size()
            .to_dict()
        )
        
        return self
    
    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Transform data using pre-computed statistics.
        
        Creates 20 features from raw application data.
        """
        
        df = df.copy()
        
        # 1. Basic derived features
        df["head_count"] = np.where(
            df["normativ"] > 0,
            df["amount"] / df["normativ"],
            0.0
        ).clip(0, 50000)
        
        df["amount_per_head"] = np.where(
            df["head_count"] > 0,
            df["amount"] / df["head_count"],
            0.0
        ).clip(0, 10_000_000)
        
        # 2. Temporal features
        df["submission_date"] = pd.to_datetime(df["submission_date"], errors="coerce")
        df["month"] = df["submission_date"].dt.month
        df["hour"] = df["submission_date"].dt.hour
        df["day_of_week"] = df["submission_date"].dt.dayofweek
        
        # 3. Aggregated features (using pre-computed statistics)
        df["subsidy_type_approval_rate"] = df["subsidy_name"].map(
            self.approval_rates
        ).fillna(0.5)
        
        df["amount_vs_region_median"] = df["amount"] - df["region"].map(
            self.region_medians
        ).fillna(df["amount"].median())
        
        df["amount_vs_subsidy_median"] = df["amount"] - df["subsidy_name"].map(
            self.subsidy_medians
        ).fillna(df["amount"].median())
        
        df["direction_competition"] = df["direction"].map(
            self.direction_counts
        ).fillna(0)
        
        # 4. Derived features
        df["normativ_amount_ratio"] = np.where(
            df["amount"] > 0,
            df["normativ"] / df["amount"],
            0.0
        )
        
        df["amount_log"] = np.log1p(df["amount"])
        
        # 5. Farmer Portrait features (from synthetic data or defaults)
        if "pasture_area_ha" not in df.columns:
            df["pasture_area_ha"] = 0.0
        if "historical_mortality_rate" not in df.columns:
            df["historical_mortality_rate"] = 0.0
        if "current_head_count" not in df.columns:
            df["current_head_count"] = 0.0
        
        # 6. Binary features (keyword matching)
        df["is_cooperative"] = df["subsidy_name"].str.contains(
            "кооператив|кооперация", case=False, na=False
        ).astype(int)
        
        df["is_breeding"] = df["subsidy_name"].str.contains(
            "племенн|селекцион", case=False, na=False
        ).astype(int)
        
        df["is_import"] = df["subsidy_name"].str.contains(
            "импорт|зарубеж", case=False, na=False
        ).astype(int)
        
        # 7. Categorical features
        df["animal_type"] = df["subsidy_name"].apply(classify_animal_type)
        df["subsidy_category"] = df["subsidy_name"].apply(classify_subsidy_category)
        df["normativ_tier"] = pd.cut(
            df["normativ"],
            bins=[-1, 0, 1000, 10000, float('inf')],
            labels=["zero", "low", "mid", "high"]
        )
        
        return df
```

### Complete Feature List (20 Features)

| # | Feature | Type | Source | Description |
|---|---------|------|--------|-------------|
| 1 | `head_count` | Numeric | Computed | Number of livestock (amount/normativ) |
| 2 | `amount_per_head` | Numeric | Computed | Subsidy per head |
| 3 | `month` | Numeric | Temporal | Application month (1-12) |
| 4 | `hour` | Numeric | Temporal | Application hour (0-23) |
| 5 | `day_of_week` | Numeric | Temporal | Day of week (0-6) |
| 6 | `amount_vs_region_median` | Numeric | Aggregated | Deviation from region median |
| 7 | `amount_vs_subsidy_median` | Numeric | Aggregated | Deviation from subsidy median |
| 8 | `subsidy_type_approval_rate` | Numeric | Aggregated | Historical approval rate |
| 9 | `direction_competition` | Numeric | Aggregated | Applications per direction |
| 10 | `normativ_amount_ratio` | Numeric | Computed | Normativ to amount ratio |
| 11 | `amount_log` | Numeric | Transformed | Log-transformed amount |
| 12 | `pasture_area_ha` | Numeric | Synthetic | Pasture area (hectares) |
| 13 | `historical_mortality_rate` | Numeric | Synthetic | Mortality percentage |
| 14 | `current_head_count` | Numeric | Synthetic | Current livestock count |
| 15 | `is_cooperative` | Binary | Keyword | Is cooperative |
| 16 | `is_breeding` | Binary | Keyword | Is breeding farm |
| 17 | `is_import` | Binary | Keyword | Imported livestock |
| 18 | `animal_type` | Categorical | Keyword | Type of animal |
| 19 | `subsidy_category` | Categorical | Keyword | Subsidy category |
| 20 | `normativ_tier` | Categorical | Binned | Normativ level |

---

## 🎓 Model Training

### ScoringModel Class

**File**: `backend/app/ml/model.py`

```python
class ScoringModel:
    """
    LightGBM wrapper with training, evaluation, and serialization.
    """
    
    def __init__(self):
        self.model = None
        self.metadata = {}
    
    def train(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: pd.DataFrame,
        y_val: pd.Series,
        params: Optional[Dict] = None
    ) -> Dict:
        """
        Train LightGBM model with early stopping.
        
        Parameters:
            X_train: Training features
            y_train: Training target
            X_val: Validation features
            y_val: Validation target
            params: Optional hyperparameters
        
        Returns:
            Training metrics
        """
        
        # Default hyperparameters
        if params is None:
            params = {
                "n_estimators": 500,
                "max_depth": 7,
                "learning_rate": 0.05,
                "num_leaves": 63,
                "min_child_samples": 50,
                "subsample": 0.8,
                "colsample_bytree": 0.8,
                "scale_pos_weight": self._compute_class_weight(y_train),
                "random_state": 42,
                "verbose": -1
            }
        
        # Initialize model
        self.model = LGBMClassifier(**params)
        
        # Train with early stopping
        self.model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            callbacks=[
                early_stopping(stopping_rounds=50),
                log_evaluation(period=100)
            ]
        )
        
        # Compute training metrics
        train_metrics = self._compute_metrics(X_train, y_train)
        val_metrics = self._compute_metrics(X_val, y_val)
        
        self.metadata = {
            "train_metrics": train_metrics,
            "val_metrics": val_metrics,
            "hyperparameters": params,
            "training_date": datetime.now().isoformat(),
            "n_features": X_train.shape[1],
            "feature_names": list(X_train.columns)
        }
        
        return {
            "train": train_metrics,
            "validation": val_metrics
        }
    
    def cross_validate(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        n_folds: int = 5
    ) -> Dict:
        """
        Perform k-fold cross-validation.
        
        Returns:
            Cross-validation metrics
        """
        
        cv = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=42)
        
        cv_metrics = {
            "accuracy": [],
            "precision": [],
            "recall": [],
            "f1": [],
            "roc_auc": []
        }
        
        for fold, (train_idx, val_idx) in enumerate(cv.split(X, y)):
            X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
            y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]
            
            # Train temporary model
            temp_model = LGBMClassifier(
                n_estimators=500,
                max_depth=7,
                learning_rate=0.05,
                random_state=42,
                verbose=-1
            )
            
            temp_model.fit(
                X_train, y_train,
                eval_set=[(X_val, y_val)],
                callbacks=[early_stopping(50, verbose=False)]
            )
            
            # Compute metrics
            y_pred = temp_model.predict(X_val)
            y_proba = temp_model.predict_proba(X_val)[:, 1]
            
            cv_metrics["accuracy"].append(accuracy_score(y_val, y_pred))
            cv_metrics["precision"].append(precision_score(y_val, y_pred))
            cv_metrics["recall"].append(recall_score(y_val, y_pred))
            cv_metrics["f1"].append(f1_score(y_val, y_pred))
            cv_metrics["roc_auc"].append(roc_auc_score(y_val, y_proba))
        
        # Aggregate results
        return {
            metric: {
                "mean": np.mean(values),
                "std": np.std(values),
                "values": values
            }
            for metric, values in cv_metrics.items()
        }
    
    def _compute_class_weight(self, y: pd.Series) -> float:
        """Compute scale_pos_weight for imbalanced classes."""
        n_negative = (y == 0).sum()
        n_positive = (y == 1).sum()
        return n_negative / max(n_positive, 1)
    
    def _compute_metrics(self, X: pd.DataFrame, y: pd.Series) -> Dict:
        """Compute classification metrics."""
        y_pred = self.model.predict(X)
        y_proba = self.model.predict_proba(X)[:, 1]
        
        return {
            "accuracy": accuracy_score(y, y_pred),
            "precision": precision_score(y, y_pred),
            "recall": recall_score(y, y_pred),
            "f1": f1_score(y, y_pred),
            "roc_auc": roc_auc_score(y, y_proba)
        }
```

### Training Pipeline

```python
def train_model_pipeline(df: pd.DataFrame) -> ScoringModel:
    """
    Complete training pipeline.
    
    Steps:
    1. Split data (80/20 stratified)
    2. Fit FeatureTransformer on train data
    3. Transform both train and test data
    4. Train LightGBM model
    5. Cross-validate
    6. Return trained model
    """
    
    # Step 1: Create target variable
    df["is_merit_worthy"] = compute_target_variable(df)
    
    # Step 2: Split data
    train_df, test_df = train_test_split(
        df,
        test_size=0.2,
        stratify=df["is_merit_worthy"],
        random_state=42
    )
    
    # Step 3: Fit transformer on train data ONLY
    transformer = FeatureTransformer()
    transformer.fit(train_df)
    
    # Step 4: Transform both datasets
    X_train = transformer.transform(train_df)
    X_test = transformer.transform(test_df)
    y_train = train_df["is_merit_worthy"]
    y_test = test_df["is_merit_worthy"]
    
    # Select feature columns
    feature_cols = [col for col in X_train.columns if col not in [
        "application_number", "submission_date", "is_merit_worthy"
    ]]
    
    X_train = X_train[feature_cols]
    X_test = X_test[feature_cols]
    
    # Step 5: Train model
    model = ScoringModel()
    training_results = model.train(X_train, y_train, X_test, y_test)
    
    # Step 6: Cross-validation
    cv_results = model.cross_validate(
        pd.concat([X_train, X_test]),
        pd.concat([y_train, y_test])
    )
    
    # Step 7: Update metadata
    model.metadata["cv_results"] = cv_results
    model.metadata["test_metrics"] = model._compute_metrics(X_test, y_test)
    
    logger.info(f"Training completed: {training_results}")
    logger.info(f"Cross-validation: {cv_results}")
    
    return model
```

---

## 📊 Model Evaluation

### Evaluation Metrics

| Metric | Formula | Target Value | Description |
|--------|---------|--------------|-------------|
| **Accuracy** | (TP+TN)/(TP+TN+FP+FN) | > 0.75 | Overall correctness |
| **Precision** | TP/(TP+FP) | > 0.70 | True positives / predicted positives |
| **Recall** | TP/(TP+FN) | > 0.70 | True positives / actual positives |
| **F1-Score** | 2·(Precision·Recall)/(Precision+Recall) | > 0.70 | Harmonic mean |
| **ROC-AUC** | Area under ROC curve | > 0.80 | Discrimination ability |

### Cross-Validation Results (Expected)

```json
{
  "cv_results": {
    "accuracy": {"mean": 0.78, "std": 0.02},
    "precision": {"mean": 0.76, "std": 0.03},
    "recall": {"mean": 0.75, "std": 0.03},
    "f1": {"mean": 0.75, "std": 0.02},
    "roc_auc": {"mean": 0.82, "std": 0.02}
  }
}
```

### Feature Importance

```python
def get_feature_importance(model: ScoringModel) -> Dict[str, float]:
    """Get feature importance from trained model."""
    
    importance = model.model.feature_importances_
    feature_names = model.metadata["feature_names"]
    
    importance_dict = dict(zip(feature_names, importance))
    
    # Normalize to sum to 1.0
    total = sum(importance_dict.values())
    importance_dict = {k: v/total for k, v in importance_dict.items()}
    
    # Sort by importance
    return dict(
        sorted(importance_dict.items(), key=lambda x: x[1], reverse=True)
    )
```

---

## 💾 Model Serialization

### Saving Models

```python
def save_model(model: ScoringModel, version: str) -> str:
    """
    Save model with metadata.
    
    Files created:
    - models/{version}.joblib (model weights)
    - models/{version}.meta.json (metadata)
    
    Returns:
        Path to saved model
    """
    
    model_dir = Path("models")
    model_dir.mkdir(exist_ok=True)
    
    # Save model
    model_path = model_dir / f"{version}.joblib"
    joblib.dump(model.model, model_path)
    
    # Save metadata
    meta_path = model_dir / f"{version}.meta.json"
    with open(meta_path, 'w') as f:
        json.dump(model.metadata, f, indent=2)
    
    logger.info(f"Model saved: {model_path}")
    
    return str(model_path)
```

### Loading Models

```python
def load_model(version: str) -> ScoringModel:
    """
    Load model from disk.
    
    Parameters:
        version: Model version string
    
    Returns:
        Loaded ScoringModel
    """
    
    model_dir = Path("models")
    model_path = model_dir / f"{version}.joblib"
    meta_path = model_dir / f"{version}.meta.json"
    
    # Load model
    model = ScoringModel()
    model.model = joblib.load(model_path)
    
    # Load metadata
    with open(meta_path, 'r') as f:
        model.metadata = json.load(f)
    
    logger.info(f"Model loaded: {version}")
    
    return model
```

---

## 🔮 Inference Pipeline

### Two-Stage Scoring

**File**: `backend/app/ml/scoring_pipeline.py`

```python
class ScoringPipeline:
    """
    Two-stage scoring pipeline:
    Stage 1: Hard filters (instant rejection)
    Stage 2: ML scoring (nuanced evaluation)
    """
    
    def __init__(self, model: ScoringModel):
        self.model = model
        self.explainer = SHAPExplainer(model)
    
    def score_application(self, application: dict) -> dict:
        """
        Score single application.
        
        Returns:
            Score result with explanation
        """
        
        # Stage 1: Hard filters
        passed, violations = self._hard_filters(application)
        if not passed:
            return {
                "merit_score": 0.0,
                "is_approved": False,
                "risk_level": "red",
                "violations": violations
            }
        
        # Stage 2: ML scoring
        features = self._extract_features(application)
        score = self.model.predict_proba(features) * 100
        
        # Determine approval and risk level
        is_approved = score >= 50.0
        risk_level = self._classify_risk(score)
        
        return {
            "merit_score": round(score, 2),
            "is_approved": is_approved,
            "risk_level": risk_level,
            "violations": []
        }
    
    def _hard_filters(self, application: dict) -> Tuple[bool, List[str]]:
        """
        Stage 1: Hard rule filters.
        
        Instant rejection criteria:
        1. normativ > 0
        2. amount > 0
        3. head_count in [1, 50000]
        4. submission_date within 365 days
        5. pasture_load <= legal_capacity
        """
        
        violations = []
        
        if application.get("normativ", 0) <= 0:
            violations.append("Норматив должен быть больше 0")
        
        if application.get("amount", 0) <= 0:
            violations.append("Сумма должна быть больше 0")
        
        head_count = application.get("amount", 0) / max(application.get("normativ", 1), 1)
        if not (1 <= head_count <= 50000):
            violations.append("Недопустимое количество голов")
        
        # ... more filters
        
        return (len(violations) == 0, violations)
```

### Batch Scoring

```python
def batch_score_applications(
    model: ScoringModel,
    applications: pd.DataFrame
) -> pd.DataFrame:
    """
    Score all applications in batch.
    
    Parameters:
        model: Trained model
        applications: DataFrame with application data
    
    Returns:
        DataFrame with scores
    """
    
    # Transform features
    transformer = FeatureTransformer()
    transformer.fit(applications)  # Use all data for batch scoring
    features = transformer.transform(applications)
    
    # Score
    scores = model.model.predict_proba(features) * 100
    
    # Add to DataFrame
    applications = applications.copy()
    applications["merit_score"] = scores
    
    # Determine approval
    applications["is_approved"] = applications["merit_score"] >= 50.0
    
    # Risk levels
    applications["risk_level"] = applications["merit_score"].apply(
        lambda s: "green" if s >= 70 else ("yellow" if s >= 50 else "red")
    )
    
    return applications
```

---

## 📦 Model Versioning

### Version Format

```
v{major}.{minor}.{patch}

Examples:
v1.0.0 - Initial model
v1.1.0 - Retrained with new data
v1.1.1 - Bug fix
v2.0.0 - Major architecture change
```

### Model Registry

```python
class ModelRegistry:
    """Manage model versions and activations."""
    
    def __init__(self, redis_client):
        self.redis = redis_client
    
    def register_model(self, version: str, path: str):
        """Register new model version."""
        self.redis.set(f"model:{version}:path", path)
        self.redis.set(f"model:{version}:active", "false")
    
    def activate_model(self, version: str):
        """Activate specific model version."""
        self.redis.set("active_model_version", version)
        self.redis.set(f"model:{version}:active", "true")
    
    def get_active_model(self) -> str:
        """Get active model version."""
        return self.redis.get("active_model_version") or "v1.0.0"
    
    def list_models(self) -> List[Dict]:
        """List all registered models."""
        # Implementation
        pass
```

---

## ⚡ Performance Optimization

### Training Optimization

1. **Early Stopping**: Stop after 50 rounds without improvement
2. **Subsampling**: Use 80% of data per iteration
3. **Feature Binning**: LightGBM's native histogram-based approach
4. **Parallel Training**: Use all CPU cores

```python
params = {
    "n_jobs": -1,  # Use all cores
    "n_estimators": 500,  # Max trees
    "early_stopping_round": 50,  # Stop early
    "subsample": 0.8,  # Use 80% data
    "colsample_bytree": 0.8  # Use 80% features
}
```

### Inference Optimization

1. **Caching**: Redis cache for scores (1 hour TTL)
2. **Batch Processing**: Score multiple applications at once
3. **Feature Caching**: Cache transformer statistics

```python
# Redis caching
async def get_cached_score(redis, app_id: str) -> Optional[float]:
    """Get score from cache."""
    cached = await redis.get(f"score:{app_id}")
    if cached:
        return float(cached)
    return None

async def cache_score(redis, app_id: str, score: float):
    """Cache score for 1 hour."""
    await redis.setex(f"score:{app_id}", 3600, str(score))
```

---

## 🔧 Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| **Poor CV scores** | Target leakage | Check fit/transform separation |
| **Overfitting** | Too complex model | Reduce max_depth, increase min_child_samples |
| **Slow training** | Large dataset | Use subsample, reduce n_estimators |
| **Prediction errors** | Missing features | Check feature columns match training |
| **Model not loading** | Version mismatch | Check joblib version compatibility |

### Debug Mode

```python
# Enable verbose logging
params = {
    "verbose": 0,  # 0=silent, 1=errors, 2=warnings, 3=info
    "n_estimators": 100,  # Reduce for debugging
    "learning_rate": 0.1  # Higher for faster debugging
}

# Enable SHAP debugging
explainer = SHAPExplainer(model)
shap_values = explainer.explain_local(application, debug=True)
```

---

**Last Updated**: April 5, 2026  
**Maintained By**: DataNomads Team  
**Project**: _k0t1k Project
