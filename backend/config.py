from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    dashboard_port: int = 9000
    database_url: str = "sqlite:///./traces.db"
    cors_origins: str = "http://localhost:5173"
    generated_tests_dir: str = "./generated_tests"
    pytest_timeout: int = 60

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
