"""Initial schema — таблицы applications и scoring_results.

Revision ID: 001
Revises: None
Create Date: 2026-03-29
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "applications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sequential_number", sa.Integer(), nullable=False, server_default="0", comment="№ п/п из выгрузки"),
        sa.Column("submission_date", sa.DateTime(), nullable=True, comment="Дата поступления заявки"),
        sa.Column("region", sa.String(255), nullable=False, server_default="", comment="Область"),
        sa.Column("akimat", sa.String(512), nullable=False, server_default="", comment="Акимат"),
        sa.Column("application_number", sa.String(20), nullable=False, comment="Номер заявки (14-значный)"),
        sa.Column("direction", sa.String(255), nullable=False, server_default="", comment="Направление животноводства"),
        sa.Column("subsidy_name", sa.Text(), nullable=False, server_default="", comment="Наименование субсидирования"),
        sa.Column("status", sa.String(100), nullable=False, server_default="", comment="Статус заявки"),
        sa.Column("normativ", sa.Float(), nullable=False, server_default="0.0", comment="Норматив субсидии (тенге)"),
        sa.Column("amount", sa.Float(), nullable=False, server_default="0.0", comment="Причитающая сумма (тенге)"),
        sa.Column("farm_district", sa.String(255), nullable=False, server_default="", comment="Район хозяйства"),
        sa.Column("merit_score", sa.Float(), nullable=True, comment="Итоговый балл 0-100"),
        sa.Column("is_approved", sa.Boolean(), nullable=True, comment="Предсказание: одобрена или нет"),
        sa.Column("risk_level", sa.String(10), nullable=True, comment="Уровень риска: green/yellow/red"),
        sa.Column("shap_values", postgresql.JSON(astext_type=sa.Text()), nullable=True, comment="SHAP-значения по фичам"),
        sa.Column("llm_explanation", sa.Text(), nullable=True, comment="Текстовое объяснение от Qwen"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("application_number"),
    )
    op.create_index("ix_applications_region", "applications", ["region"])
    op.create_index("ix_applications_direction", "applications", ["direction"])
    op.create_index("ix_applications_status", "applications", ["status"])
    op.create_index("ix_applications_application_number", "applications", ["application_number"])
    op.create_index("ix_applications_farm_district", "applications", ["farm_district"])

    op.create_table(
        "scoring_results",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("application_id", sa.Integer(), nullable=False, comment="FK на заявку"),
        sa.Column("score", sa.Float(), nullable=False, comment="Балл скоринга 0-100"),
        sa.Column("shap_values", postgresql.JSON(astext_type=sa.Text()), nullable=True, comment="SHAP-значения"),
        sa.Column("llm_explanation", sa.Text(), nullable=True, comment="Объяснение от LLM"),
        sa.Column("scored_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_scoring_results_application_id", "scoring_results", ["application_id"])


def downgrade() -> None:
    op.drop_table("scoring_results")
    op.drop_table("applications")
