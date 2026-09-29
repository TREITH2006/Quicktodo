from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.auth import get_current_user
from app.database.database import get_db
from app.models.task import Task
from app.models.user import User
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate
from app.services.openclaw_service import run_openclaw_agent, OpenClawError


router = APIRouter(prefix="/api/tasks", tags=["Tasks"])


def execute_task(task_id: int):
    """Execute a task through the local OpenClaw agent."""
    db_generator = get_db()
    db = next(db_generator)

    try:
        task = db.query(Task).filter(Task.id == task_id).first()

        if task is None:
            return

        task.status = "Running"
        task.progress = 10
        task.error_message = None
        db.commit()

        prompt = (
            "You are the task-execution agent for QuickTodo.\n\n"
            "Complete the user's task below. Use available tools when useful. "
            "Be clear about what you completed, distinguish verified facts from "
            "assumptions, and do not invent sources or claim actions you did not perform.\n\n"
            f"Task: {task.title}\n\n"
            f"Description: {task.description or 'No additional description'}"
        )

        agent_result = run_openclaw_agent(prompt)

        task.status = "Completed"
        task.progress = 100
        task.result = agent_result["response"]
        task.error_message = None
        task.is_completed = True

        # OpenClaw response metadata is not a research-source list.
        # Keep sources empty until source extraction is implemented.
        task.sources = []

        db.commit()

    except OpenClawError as exc:
        db.rollback()

        task = db.query(Task).filter(Task.id == task_id).first()

        if task is not None:
            task.status = "Failed"
            task.progress = 100
            task.result = None
            task.error_message = str(exc)
            task.is_completed = False
            db.commit()

    except Exception as exc:
        db.rollback()

        task = db.query(Task).filter(Task.id == task_id).first()

        if task is not None:
            task.status = "Failed"
            task.progress = 100
            task.result = None
            task.error_message = f"Unexpected task execution error: {exc}"
            task.is_completed = False
            db.commit()

    finally:
        db_generator.close()


@router.post("/", response_model=TaskResponse, status_code=201)
def create_task(
    task_data: TaskCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = Task(
        title=task_data.title,
        description=task_data.description,
        user_id=current_user.id,
        status="Running",
        progress=0,
        is_completed=False,
        sources=[],
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    background_tasks.add_task(execute_task, task.id)

    return task


@router.get("/", response_model=list[TaskResponse])
def get_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Task)
        .filter(Task.user_id == current_user.id)
        .order_by(Task.created_at.desc())
        .all()
    )


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = (
        db.query(Task)
        .filter(
            Task.id == task_id,
            Task.user_id == current_user.id,
        )
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    return task


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    task_data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = (
        db.query(Task)
        .filter(
            Task.id == task_id,
            Task.user_id == current_user.id,
        )
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    updates = task_data.model_dump(exclude_unset=True)

    for field, value in updates.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)

    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = (
        db.query(Task)
        .filter(
            Task.id == task_id,
            Task.user_id == current_user.id,
        )
        .first()
    )

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    db.delete(task)
    db.commit()

    return None