from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://mem0dash:mem0dash@postgres:5432/mem0dashboard"
    QDRANT_HOST: str = "qdrant"
    QDRANT_PORT: int = 6333
    LITELLM_BASE_URL: str = "http://litellm:4000/v1"
    LITELLM_MASTER_KEY: str = "sk-sidstack-dev"
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    NEO4J_URI: str | None = None
    NEO4J_USERNAME: str = "neo4j"
    NEO4J_PASSWORD: str | None = None
    DEFAULT_LLM_MODEL: str = "gemini-flash"
    DEFAULT_EMBED_MODEL: str = "gemini-embedding"

    model_config = {"env_prefix": "", "case_sensitive": True}


settings = Settings()
