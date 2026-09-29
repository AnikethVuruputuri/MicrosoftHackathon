import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List

class Settings(BaseSettings):
    # App
    PROJECT_NAME: str = "OpsMemory"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    DEMO_MODE: bool = True
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    PORT: int = int(os.getenv("PORT", "8001"))
    
    # Security & Auth
    JWT_SECRET: str = os.getenv("JWT_SECRET", "opsmemory-dev-secret-key-change-in-production-32bytes")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "u6N1_4lVlY1QjS8q2hQ7gE4uW7jZ0rT3yA5dF8gH2kM=")

    # Database (PostgreSQL preferred, SQLite supported)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./opsmemory.db")

    # Automation & Self-Recovery Controls
    AUTOMATION_ENABLED: bool = os.getenv("AUTOMATION_ENABLED", "true").lower() in ("true", "1", "yes")
    AUTOMATION_DRY_RUN: bool = os.getenv("AUTOMATION_DRY_RUN", "false").lower() in ("true", "1", "yes")
    AUTOMATION_APPROVAL_REQUIRED: bool = True
    AUTOMATION_CONFIDENCE_THRESHOLD: float = float(os.getenv("AUTOMATION_CONFIDENCE_THRESHOLD", "0.95"))
    AUTOMATION_HEALTH_CHECK_COUNT: int = int(os.getenv("AUTOMATION_HEALTH_CHECK_COUNT", "3"))
    AUTOMATION_HEALTH_CHECK_INTERVAL_SECONDS: int = int(os.getenv("AUTOMATION_HEALTH_CHECK_INTERVAL_SECONDS", "5"))

    # Redis Queue / Cache
    REDIS_URL: Optional[str] = os.getenv("REDIS_URL", None)

    # Groq LLM
    GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    # Hindsight Long-term Memory
    HINDSIGHT_API_KEY: Optional[str] = os.getenv("HINDSIGHT_API_KEY", "")
    HINDSIGHT_BASE_URL: Optional[str] = os.getenv("HINDSIGHT_BASE_URL", "https://api.hindsight.vectorize.io")
    HINDSIGHT_BANK_ID: str = os.getenv("HINDSIGHT_BANK_ID", "opsmemory-demo")

    # GitHub Integration
    GITHUB_CLIENT_ID: Optional[str] = os.getenv("GITHUB_CLIENT_ID", "")
    GITHUB_CLIENT_SECRET: Optional[str] = os.getenv("GITHUB_CLIENT_SECRET", "")
    GITHUB_APP_ID: Optional[str] = os.getenv("GITHUB_APP_ID", "")
    GITHUB_PRIVATE_KEY: Optional[str] = os.getenv("GITHUB_PRIVATE_KEY", "")
    GITHUB_WEBHOOK_SECRET: Optional[str] = os.getenv("GITHUB_WEBHOOK_SECRET", "opsmemory-github-webhook-secret")
    GITHUB_TOKEN: Optional[str] = os.getenv("GITHUB_TOKEN", "")

    # GitLab Integration
    GITLAB_CLIENT_ID: Optional[str] = os.getenv("GITLAB_CLIENT_ID", "")
    GITLAB_CLIENT_SECRET: Optional[str] = os.getenv("GITLAB_CLIENT_SECRET", "")
    GITLAB_URL: str = os.getenv("GITLAB_URL", "https://gitlab.com")
    GITLAB_WEBHOOK_SECRET: Optional[str] = os.getenv("GITLAB_WEBHOOK_SECRET", "opsmemory-gitlab-webhook-secret")
    GITLAB_TOKEN: Optional[str] = os.getenv("GITLAB_TOKEN", "")

    # CORS
    CORS_ORIGINS: List[str] = ["*"]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
