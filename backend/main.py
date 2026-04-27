from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database.db import init_db
from .routers import schema, proxy, generator, runner, traces, analytics
from .config import settings

app = FastAPI(title="API Dev Dashboard", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


app.include_router(schema.router,    prefix="/schema",    tags=["Schema"])
app.include_router(proxy.router,     prefix="/proxy",     tags=["Proxy"])
app.include_router(generator.router, prefix="/tests",     tags=["Tests"])
app.include_router(runner.router,    prefix="/tests",     tags=["Tests"])
app.include_router(traces.router,    prefix="/traces",    tags=["Traces"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "API Dev Dashboard"}
