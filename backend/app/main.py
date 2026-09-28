from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database.session import init_db
from app.database.seed import seed_database
from app.services.queue import task_queue

# Import API Routers
from app.api.dashboard import router as dashboard_router
from app.api.deployments import router as deployments_router
from app.api.incidents import router as incidents_router
from app.api.memory import router as memory_router
from app.api.patterns import router as patterns_router
from app.api.system import router as system_router
from app.api.auth import router as auth_router
from app.api.integrations import router as integrations_router
from app.api.repositories import router as repositories_router
from app.api.pipelines import router as pipelines_router
from app.api.webhooks import router as webhooks_router
from app.api.audit import router as audit_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB & Seed demo data on startup
    init_db()
    seed_database()
    # Start background task queue
    await task_queue.start()
    yield
    # Cleanup task queue
    await task_queue.stop()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Your DevOps agent that remembers what your team learned.",
    lifespan=lifespan
)

# CORS Middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(dashboard_router, prefix=settings.API_V1_STR)
app.include_router(deployments_router, prefix=settings.API_V1_STR)
app.include_router(incidents_router, prefix=settings.API_V1_STR)
app.include_router(memory_router, prefix=settings.API_V1_STR)
app.include_router(patterns_router, prefix=settings.API_V1_STR)
app.include_router(system_router, prefix=settings.API_V1_STR)
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(integrations_router, prefix=settings.API_V1_STR)
app.include_router(repositories_router, prefix=settings.API_V1_STR)
app.include_router(pipelines_router, prefix=settings.API_V1_STR)
app.include_router(webhooks_router, prefix=settings.API_V1_STR)
app.include_router(audit_router, prefix=settings.API_V1_STR)

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "database": "connected",
        "providers": ["github", "gitlab"],
        "memory_layer": "Hindsight"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
