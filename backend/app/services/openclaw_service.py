import json
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any


class OpenClawError(RuntimeError):
    """Raised when OpenClaw cannot complete a task."""


def run_openclaw_agent(
    message: str,
    timeout_seconds: int = 600,
) -> dict[str, Any]:
    """
    Send a task to the configured local OpenClaw agent through its Gateway.

    Returns a dictionary containing the agent's text response and run metadata.
    """

    if not message or not message.strip():
        raise OpenClawError("The task message cannot be empty.")

    powershell = os.environ.get("POWERSHELL_EXE", "powershell.exe")

    # Pass the task through a temporary UTF-8 file. This avoids embedding
    # user-provided task text in a PowerShell command string.
    message_path: Path | None = None

    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            suffix=".txt",
            prefix="quicktodo-agent-",
            delete=False,
        ) as message_file:
            message_file.write(message)
            message_path = Path(message_file.name)

        env = os.environ.copy()
        env["QUICKTODO_AGENT_MESSAGE_FILE"] = str(message_path)

        powershell_script = (
            "$ErrorActionPreference = 'Stop'; "
            "openclaw agent "
            "--message-file $env:QUICKTODO_AGENT_MESSAGE_FILE "
            "--json "
            f"--timeout {int(timeout_seconds)}"
        )

        completed = subprocess.run(
            [
                powershell,
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                powershell_script,
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout_seconds + 30,
            env=env,
            check=False,
        )

        if completed.returncode != 0:
            detail = (completed.stderr or completed.stdout).strip()
            raise OpenClawError(
                f"OpenClaw exited with code {completed.returncode}: "
                f"{detail[-2000:]}"
            )

        output = completed.stdout.strip()

        # Ignore any non-JSON CLI decoration surrounding the JSON response.
        json_start = output.find("{")
        json_end = output.rfind("}")

        if json_start < 0 or json_end < json_start:
            raise OpenClawError(
                f"OpenClaw did not return valid JSON. Output: {output[-2000:]}"
            )

        try:
            response = json.loads(output[json_start : json_end + 1])
        except json.JSONDecodeError as exc:
            raise OpenClawError(
                f"Could not parse OpenClaw JSON response: {exc}"
            ) from exc

        if response.get("status") != "ok":
            raise OpenClawError(
                f"OpenClaw task did not complete successfully: "
                f"{response.get('summary', 'Unknown error')}"
            )

        payloads = response.get("result", {}).get("payloads", [])
        text_parts = [
            item.get("text", "").strip()
            for item in payloads
            if isinstance(item, dict) and item.get("text")
        ]

        agent_text = "\n\n".join(text_parts).strip()

        if not agent_text:
            raise OpenClawError("OpenClaw completed without returning text.")

        return {
            "response": agent_text,
            "run_id": response.get("runId"),
            "provider": (
                response.get("result", {})
                .get("meta", {})
                .get("agentMeta", {})
                .get("provider")
            ),
            "model": (
                response.get("result", {})
                .get("meta", {})
                .get("agentMeta", {})
                .get("model")
            ),
        }

    except subprocess.TimeoutExpired as exc:
        raise OpenClawError(
            f"OpenClaw did not finish within {timeout_seconds} seconds."
        ) from exc

    except FileNotFoundError as exc:
        raise OpenClawError(
            "PowerShell or the OpenClaw command could not be found. "
            "Start the backend from the same Windows account where OpenClaw "
            "is installed."
        ) from exc

    finally:
        if message_path and message_path.exists():
            message_path.unlink(missing_ok=True)