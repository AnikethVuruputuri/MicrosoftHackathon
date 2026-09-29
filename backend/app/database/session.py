import os
from sqlalchemy import inspect, text, event
from sqlmodel import SQLModel, create_engine, Session
from app.config import settings

# Database engine configuration (PostgreSQL or SQLite)
connect_args = {}
if "sqlite" in settings.DATABASE_URL:
    connect_args = {"check_same_thread": False, "timeout": 30}

engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args=connect_args,
    pool_pre_ping=True
)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if "sqlite" in settings.DATABASE_URL:
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA busy_timeout=30000")
        finally:
            cursor.close()

def init_db():
    SQLModel.metadata.create_all(engine)
    inspector = inspect(engine)
    if "automation_runs" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("automation_runs")}
        with engine.begin() as connection:
            if "execution_attempted" not in columns:
                connection.execute(text(
                    "ALTER TABLE automation_runs "
                    "ADD COLUMN execution_attempted BOOLEAN NOT NULL DEFAULT FALSE"
                ))
            if "dry_run" not in columns:
                connection.execute(text(
                    "ALTER TABLE automation_runs ADD COLUMN dry_run BOOLEAN NOT NULL DEFAULT FALSE"
                ))
            if "target_namespace" not in columns:
                connection.execute(text("ALTER TABLE automation_runs ADD COLUMN target_namespace VARCHAR"))
            if "target_deployment" not in columns:
                connection.execute(text("ALTER TABLE automation_runs ADD COLUMN target_deployment VARCHAR"))
            if "plan_json" not in columns:
                connection.execute(text("ALTER TABLE automation_runs ADD COLUMN plan_json TEXT"))
    if "automation_guards" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("automation_guards")}
        with engine.begin() as connection:
            if "kubernetes_enabled" not in columns:
                connection.execute(text(
                    "ALTER TABLE automation_guards ADD COLUMN kubernetes_enabled BOOLEAN NOT NULL DEFAULT FALSE"
                ))
            if "kubernetes_dry_run" not in columns:
                connection.execute(text(
                    "ALTER TABLE automation_guards ADD COLUMN kubernetes_dry_run BOOLEAN NOT NULL DEFAULT TRUE"
                ))
    if "automation_service_policies" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("automation_service_policies")}
        with engine.begin() as connection:
            if "health_check_count" not in columns:
                connection.execute(text(
                    "ALTER TABLE automation_service_policies "
                    "ADD COLUMN health_check_count INTEGER NOT NULL DEFAULT 3"
                ))
            if "health_check_interval_seconds" not in columns:
                connection.execute(text(
                    "ALTER TABLE automation_service_policies "
                    "ADD COLUMN health_check_interval_seconds INTEGER NOT NULL DEFAULT 5"
                ))
            if "allow_retry" not in columns:
                connection.execute(text(
                    "ALTER TABLE automation_service_policies "
                    "ADD COLUMN allow_retry BOOLEAN NOT NULL DEFAULT TRUE"
                ))
            if "allow_restart" not in columns:
                connection.execute(text(
                    "ALTER TABLE automation_service_policies "
                    "ADD COLUMN allow_restart BOOLEAN NOT NULL DEFAULT FALSE"
                ))
            if "allow_rollback" not in columns:
                connection.execute(text(
                    "ALTER TABLE automation_service_policies "
                    "ADD COLUMN allow_rollback BOOLEAN NOT NULL DEFAULT FALSE"
                ))
    if "automation_targets" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("automation_targets")}
        with engine.begin() as connection:
            for column in ("kube_namespace", "kube_deployment", "kube_context"):
                if column not in columns:
                    connection.execute(text(f"ALTER TABLE automation_targets ADD COLUMN {column} VARCHAR"))

def get_session():
    with Session(engine) as session:
        yield session
