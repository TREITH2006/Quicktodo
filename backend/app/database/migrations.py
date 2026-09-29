from sqlalchemy import inspect, text

from app.database.database import engine


def migrate_database():
    """Add columns introduced after the initial SQLite schema."""
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    if "tasks" not in table_names:
        return

    existing_columns = {
        column["name"]
        for column in inspector.get_columns("tasks")
    }

    migrations = {
        "user_id": "INTEGER",
        "status": "VARCHAR(20) NOT NULL DEFAULT 'Running'",
        "progress": "INTEGER NOT NULL DEFAULT 0",
        "result": "TEXT",
        "error_message": "TEXT",
        "sources": "JSON",
    }

    with engine.begin() as connection:
        for column_name, definition in migrations.items():
            if column_name not in existing_columns:
                connection.execute(
                    text(
                        f"ALTER TABLE tasks "
                        f"ADD COLUMN {column_name} {definition}"
                    )
                )

        connection.execute(
            text(
                """
                UPDATE tasks
                SET status = CASE
                    WHEN is_completed = 1 THEN 'Completed'
                    ELSE 'Running'
                END,
                progress = CASE
                    WHEN is_completed = 1 THEN 100
                    ELSE 0
                END
                """
            )
        )