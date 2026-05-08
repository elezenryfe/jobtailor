import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./jobsort.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY")
    DEEPSEEK_BASE_URL: str = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID")

settings = Settings()