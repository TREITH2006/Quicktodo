from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.auth import router as auth_router
from app.api.v1.tasks import router as tasks_router
from app.database.database import Base, engine
from app.database.migrations import migrate_database
from app.models.task import Task
from app.models.user import User


# Create missing tables, then update existing SQLite tables.
Base.metadata.create_all(bind=engine)
migrate_database()


app = FastAPI(
    title="QuickTodo API",
    description="Backend API for QuickTodo",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://quicktodo.vercel.app",
        "https://quicktodo-teal.vercel.app",
        "https://quicktodo.env.pm",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(tasks_router)


@app.get("/health")
def health_check():
    return {"status": "healthy"}