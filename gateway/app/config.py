from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    backend_url: str = "http://localhost:3000"
    monitoring_url: str = "http://localhost:3001"
    gateway_api_key: str = ""
    ssh_host: str = "0.0.0.0"
    ssh_port: int = 2222
    metrics_host: str = "0.0.0.0"
    metrics_port: int = 8000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
