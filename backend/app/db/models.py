"""SQLAlchemy модели — таблицы заявок и результатов скоринга."""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Базовый класс для всех моделей."""


class User(Base):
    """Пользователь платформы — аутентификация через email/пароль или Google OAuth."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False, comment="Email пользователя")
    hashed_password: Mapped[str | None] = mapped_column(String(128), nullable=True, comment="Хеш bcrypt (null для OAuth)")
    full_name: Mapped[str] = mapped_column(String(255), default="", comment="Полное имя")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, comment="Активен ли аккаунт")
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, comment="Права администратора")
    auth_provider: Mapped[str] = mapped_column(String(20), default="local", comment="local / google")
    google_sub: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True, comment="Google subject ID")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.utcnow(), comment="Дата регистрации")

    def __repr__(self) -> str:
        return f"<User {self.email} provider={self.auth_provider}>"


class Application(Base):
    """Заявка на субсидию — данные из выгрузки GISS + результаты скоринга."""

    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # --- Исходные данные из Excel ---
    sequential_number: Mapped[int] = mapped_column(Integer, default=0, comment="№ п/п из выгрузки")
    submission_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, comment="Дата поступления заявки")
    region: Mapped[str] = mapped_column(String(255), index=True, default="", comment="Область")
    akimat: Mapped[str] = mapped_column(String(512), default="", comment="Акимат (управление сельского хозяйства)")
    application_number: Mapped[str] = mapped_column(String(20), unique=True, index=True, comment="Номер заявки (14-значный)")
    direction: Mapped[str] = mapped_column(String(255), index=True, default="", comment="Направление животноводства")
    subsidy_name: Mapped[str] = mapped_column(Text, default="", comment="Наименование субсидирования")
    status: Mapped[str] = mapped_column(String(100), index=True, default="", comment="Статус заявки (Исполнена, Одобрена, Отклонена, ...)")
    normativ: Mapped[float] = mapped_column(Float, default=0.0, comment="Норматив субсидии (тенге за единицу)")
    amount: Mapped[float] = mapped_column(Float, default=0.0, comment="Причитающая сумма (тенге)")
    farm_district: Mapped[str] = mapped_column(String(255), index=True, default="", comment="Район хозяйства")

    # --- Поля для портала фермера (публичные) ---
    farmer_name: Mapped[str | None] = mapped_column(String(255), nullable=True, comment="ФИО или название хозяйства")
    land_area: Mapped[float | None] = mapped_column(Float, nullable=True, comment="Площадь земель (га)")
    
    # --- Портрет фермера (для вывода в UI) ---
    pasture_area_ha: Mapped[float | None] = mapped_column(Float, nullable=True, comment="Пастбища (ГА)")
    historical_mortality_rate: Mapped[float | None] = mapped_column(Float, nullable=True, comment="Падёж (%)")
    current_head_count: Mapped[float | None] = mapped_column(Float, nullable=True, comment="Поголовье")

    # --- Результаты AI-скоринга ---
    merit_score: Mapped[float | None] = mapped_column(Float, nullable=True, comment="Итоговый балл 0-100")
    is_approved: Mapped[bool | None] = mapped_column(Boolean, nullable=True, comment="Предсказание: одобрена или нет")
    risk_level: Mapped[str | None] = mapped_column(String(10), nullable=True, comment="Уровень риска: green/yellow/red")
    shap_values: Mapped[dict | None] = mapped_column(JSON, nullable=True, comment="SHAP-значения по фичам")
    llm_explanation: Mapped[str | None] = mapped_column(Text, nullable=True, comment="Текстовое объяснение от Qwen")

    # --- Метаданные ---
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.utcnow(), comment="Дата создания записи")

    # --- Связь с результатами скоринга ---
    scoring_results: Mapped[list["ScoringResult"]] = relationship(back_populates="application")

    def __repr__(self) -> str:
        return f"<Application {self.application_number} score={self.merit_score}>"


class ScoringResult(Base):
    """Результат одного прогона скоринга — хранит историю оценок."""

    __tablename__ = "scoring_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    application_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("applications.id", ondelete="CASCADE"),
        index=True,
        comment="FK на заявку",
    )
    score: Mapped[float] = mapped_column(Float, comment="Балл скоринга 0-100")
    shap_values: Mapped[dict | None] = mapped_column(JSON, nullable=True, comment="SHAP-значения")
    llm_explanation: Mapped[str | None] = mapped_column(Text, nullable=True, comment="Объяснение от LLM")
    scored_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.utcnow(), comment="Дата скоринга")

    # --- Связь ---
    application: Mapped["Application"] = relationship(back_populates="scoring_results")

    def __repr__(self) -> str:
        return f"<ScoringResult app={self.application_id} score={self.score}>"
