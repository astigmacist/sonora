"""SQLite persistence for SONORA.

The module deliberately uses only Python's standard-library ``sqlite3`` module.
Every public CRUD helper opens a short-lived connection when passed a path and
returns plain dictionaries, which keeps the storage layer easy to consume from
FastAPI without leaking sqlite objects into the API layer.

Lyrics are intentionally absent from the analysis history schema.  Only the
small, derived analysis summary can be persisted.
"""

from __future__ import annotations

import json
import os
import sqlite3
import unicodedata
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator, Mapping, Sequence


DEFAULT_DB_PATH = Path(__file__).with_name("sonora.db")
SCHEMA_VERSION = 2

Database = str | os.PathLike[str] | sqlite3.Connection


class IncompleteSessionError(ValueError):
    """Raised when completion is requested before all required activities exist."""

    def __init__(self, missing_activity_ids: Sequence[str]) -> None:
        self.missing_activity_ids = list(missing_activity_ids)
        super().__init__("Required activities are incomplete")


_SCHEMA = """
CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
    interface_language TEXT NOT NULL DEFAULT 'en'
        CHECK (interface_language IN ('en', 'ru', 'kk')),
    current_level TEXT NOT NULL DEFAULT 'A1'
        CHECK (length(trim(current_level)) > 0),
    weekly_goal INTEGER NOT NULL DEFAULT 5 CHECK (weekly_goal BETWEEN 1 AND 100),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS saved_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    word TEXT NOT NULL CHECK (length(trim(word)) > 0),
    normalized_word TEXT NOT NULL CHECK (length(normalized_word) > 0),
    translation TEXT,
    definition TEXT,
    ipa TEXT,
    cefr TEXT,
    word_type TEXT,
    example TEXT,
    song_id TEXT,
    meaning_json TEXT NOT NULL DEFAULT '{}',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    mastery_level INTEGER NOT NULL DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 5),
    review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
    next_review_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (profile_id, normalized_word)
);

CREATE INDEX IF NOT EXISTS idx_saved_words_profile_created
    ON saved_words(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_words_song
    ON saved_words(song_id);

CREATE TABLE IF NOT EXISTS lesson_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    song_id TEXT NOT NULL CHECK (length(trim(song_id)) > 0),
    status TEXT NOT NULL DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'in_progress', 'completed')),
    progress_percent INTEGER NOT NULL DEFAULT 0
        CHECK (progress_percent BETWEEN 0 AND 100),
    current_step TEXT,
    quiz_score INTEGER CHECK (quiz_score BETWEEN 0 AND 100),
    time_spent_seconds INTEGER NOT NULL DEFAULT 0 CHECK (time_spent_seconds >= 0),
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (profile_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_profile_updated
    ON lesson_progress(profile_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS analysis_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
    song_id TEXT,
    artist TEXT NOT NULL CHECK (length(trim(artist)) > 0),
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    interface_language TEXT NOT NULL DEFAULT 'en'
        CHECK (interface_language IN ('en', 'ru', 'kk')),
    level TEXT NOT NULL CHECK (length(trim(level)) > 0),
    learning_score INTEGER NOT NULL CHECK (learning_score BETWEEN 0 AND 100),
    total_words INTEGER NOT NULL CHECK (total_words >= 0),
    unique_words INTEGER NOT NULL CHECK (unique_words >= 0),
    useful_words_json TEXT NOT NULL DEFAULT '[]',
    slang_json TEXT NOT NULL DEFAULT '[]',
    explicit_count INTEGER NOT NULL DEFAULT 0 CHECK (explicit_count >= 0),
    classroom_fit TEXT NOT NULL CHECK (classroom_fit IN ('safe', 'guided')),
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_analysis_history_profile_created
    ON analysis_history(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_history_song
    ON analysis_history(song_id);

CREATE TABLE IF NOT EXISTS lesson_sessions (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    song_id TEXT NOT NULL CHECK (length(trim(song_id)) > 0),
    lesson_version TEXT NOT NULL DEFAULT 'curated-v1'
        CHECK (length(trim(lesson_version)) > 0),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'abandoned')),
    required_activity_ids_json TEXT NOT NULL DEFAULT '[]',
    current_activity_id TEXT,
    total_time_seconds INTEGER NOT NULL DEFAULT 0 CHECK (total_time_seconds >= 0),
    started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_active_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_lesson_sessions_profile_status
    ON lesson_sessions(profile_id, status, last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_sessions_song
    ON lesson_sessions(song_id);

CREATE TABLE IF NOT EXISTS activity_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES lesson_sessions(id) ON DELETE CASCADE,
    activity_id TEXT NOT NULL CHECK (length(trim(activity_id)) > 0),
    activity_kind TEXT NOT NULL CHECK (length(trim(activity_kind)) > 0),
    skill TEXT NOT NULL CHECK (
        skill IN ('orientation', 'meaning', 'vocabulary', 'listening', 'grammar', 'speaking', 'practice')
    ),
    attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
    correct INTEGER CHECK (correct IN (0, 1)),
    score REAL NOT NULL CHECK (score BETWEEN 0.0 AND 1.0),
    duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds BETWEEN 0 AND 3600),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (session_id, activity_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_activity_attempts_session_activity
    ON activity_attempts(session_id, activity_id, attempt_number);
CREATE INDEX IF NOT EXISTS idx_activity_attempts_skill
    ON activity_attempts(skill, created_at DESC);

CREATE TABLE IF NOT EXISTS review_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    saved_word_id INTEGER NOT NULL REFERENCES saved_words(id) ON DELETE CASCADE,
    rating TEXT NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy')),
    correct INTEGER CHECK (correct IN (0, 1)),
    mastery_before INTEGER NOT NULL CHECK (mastery_before BETWEEN 0 AND 5),
    mastery_after INTEGER NOT NULL CHECK (mastery_after BETWEEN 0 AND 5),
    next_review_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_review_attempts_profile_created
    ON review_attempts(profile_id, created_at DESC);
"""


def _prepare_path(database: Database) -> None:
    if isinstance(database, sqlite3.Connection):
        return
    path = os.fspath(database)
    if path != ":memory:" and not path.startswith("file:"):
        Path(path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)


def open_connection(database: str | os.PathLike[str] = DEFAULT_DB_PATH) -> sqlite3.Connection:
    """Open a configured SQLite connection.

    Callers that keep a connection themselves are responsible for closing it.
    The CRUD functions below can accept that connection directly.
    """

    _prepare_path(database)
    path = os.fspath(database)
    connection = sqlite3.connect(
        path,
        timeout=5.0,
        uri=path.startswith("file:"),
    )
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 5000")
    return connection


@contextmanager
def _connection(database: Database, *, write: bool = False) -> Iterator[sqlite3.Connection]:
    owns_connection = not isinstance(database, sqlite3.Connection)
    connection = open_connection(database) if owns_connection else database
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        if write:
            connection.commit()
    except Exception:
        if write:
            connection.rollback()
        raise
    finally:
        if owns_connection:
            connection.close()


def init_db(database: Database = DEFAULT_DB_PATH) -> None:
    """Create all tables and indexes. Safe to call on every application start."""

    _prepare_path(database)
    with _connection(database, write=True) as connection:
        connection.executescript(_SCHEMA)
        connection.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")


def _json_dump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _json_load(value: str | None, fallback: Any) -> Any:
    if value is None:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return fallback


def _row_to_dict(row: sqlite3.Row | None, *, kind: str | None = None) -> dict[str, Any] | None:
    if row is None:
        return None
    result = dict(row)
    if kind == "saved_word":
        result["meaning"] = _json_load(result.pop("meaning_json"), {})
        result["metadata"] = _json_load(result.pop("metadata_json"), {})
    elif kind == "analysis":
        result["useful_words"] = _json_load(result.pop("useful_words_json"), [])
        result["slang"] = _json_load(result.pop("slang_json"), [])
        result["metadata"] = _json_load(result.pop("metadata_json"), {})
    elif kind == "session":
        result["required_activity_ids"] = _json_load(
            result.pop("required_activity_ids_json"), []
        )
    elif kind in {"activity_attempt", "review_attempt"} and result.get("correct") is not None:
        result["correct"] = bool(result["correct"])
    return result


def _rows_to_dicts(rows: Sequence[sqlite3.Row], *, kind: str | None = None) -> list[dict[str, Any]]:
    return [_row_to_dict(row, kind=kind) for row in rows]  # type: ignore[misc]


def _require_nonempty(value: str, field: str) -> str:
    clean = value.strip()
    if not clean:
        raise ValueError(f"{field} must not be empty")
    return clean


def _validate_language(language: str) -> str:
    if language not in {"en", "ru", "kk"}:
        raise ValueError("interface_language must be one of: en, ru, kk")
    return language


def _validate_range(value: int, field: str, minimum: int, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise ValueError(f"{field} must be an integer between {minimum} and {maximum}")
    return value


def _pagination(limit: int, offset: int) -> tuple[int, int]:
    _validate_range(limit, "limit", 1, 500)
    if isinstance(offset, bool) or not isinstance(offset, int) or offset < 0:
        raise ValueError("offset must be a non-negative integer")
    return limit, offset


def normalize_word(word: str) -> str:
    """Return a stable key used to de-duplicate a profile's word bank."""

    word = unicodedata.normalize("NFKC", _require_nonempty(word, "word"))
    word = word.replace("’", "'")
    return " ".join(word.casefold().split())


# Profiles -----------------------------------------------------------------


def create_profile(
    database: Database = DEFAULT_DB_PATH,
    *,
    display_name: str,
    interface_language: str = "en",
    current_level: str = "A1",
    weekly_goal: int = 5,
    profile_id: str | None = None,
) -> dict[str, Any]:
    profile_id = profile_id or str(uuid.uuid4())
    display_name = _require_nonempty(display_name, "display_name")
    interface_language = _validate_language(interface_language)
    current_level = _require_nonempty(current_level, "current_level")
    _validate_range(weekly_goal, "weekly_goal", 1, 100)
    with _connection(database, write=True) as connection:
        connection.execute(
            """
            INSERT INTO profiles (id, display_name, interface_language, current_level, weekly_goal)
            VALUES (?, ?, ?, ?, ?)
            """,
            (profile_id, display_name, interface_language, current_level, weekly_goal),
        )
    return get_profile(database, profile_id)  # type: ignore[return-value]


def get_profile(database: Database, profile_id: str) -> dict[str, Any] | None:
    with _connection(database) as connection:
        row = connection.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,)).fetchone()
    return _row_to_dict(row)


def list_profiles(
    database: Database = DEFAULT_DB_PATH,
    *,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    limit, offset = _pagination(limit, offset)
    with _connection(database) as connection:
        rows = connection.execute(
            "SELECT * FROM profiles ORDER BY created_at DESC, id ASC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
    return _rows_to_dicts(rows)


def update_profile(database: Database, profile_id: str, **changes: Any) -> dict[str, Any] | None:
    allowed = {"display_name", "interface_language", "current_level", "weekly_goal"}
    unknown = set(changes) - allowed
    if unknown:
        raise ValueError(f"Unsupported profile fields: {', '.join(sorted(unknown))}")
    if not changes:
        return get_profile(database, profile_id)
    if "display_name" in changes:
        changes["display_name"] = _require_nonempty(changes["display_name"], "display_name")
    if "interface_language" in changes:
        changes["interface_language"] = _validate_language(changes["interface_language"])
    if "current_level" in changes:
        changes["current_level"] = _require_nonempty(changes["current_level"], "current_level")
    if "weekly_goal" in changes:
        _validate_range(changes["weekly_goal"], "weekly_goal", 1, 100)
    assignments = ", ".join(f"{column} = ?" for column in changes)
    values = list(changes.values()) + [profile_id]
    with _connection(database, write=True) as connection:
        cursor = connection.execute(
            f"""
            UPDATE profiles
            SET {assignments}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?
            """,
            values,
        )
        changed = cursor.rowcount > 0
    return get_profile(database, profile_id) if changed else None


def delete_profile(database: Database, profile_id: str) -> bool:
    with _connection(database, write=True) as connection:
        cursor = connection.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
        return cursor.rowcount > 0


# Saved words ---------------------------------------------------------------


def create_saved_word(
    database: Database,
    *,
    profile_id: str,
    word: str,
    translation: str | None = None,
    definition: str | None = None,
    ipa: str | None = None,
    cefr: str | None = None,
    word_type: str | None = None,
    example: str | None = None,
    song_id: str | None = None,
    meaning: Mapping[str, Any] | None = None,
    metadata: Mapping[str, Any] | None = None,
    mastery_level: int = 0,
) -> dict[str, Any]:
    word = _require_nonempty(word, "word")
    normalized_word = normalize_word(word)
    _validate_range(mastery_level, "mastery_level", 0, 5)
    with _connection(database, write=True) as connection:
        cursor = connection.execute(
            """
            INSERT INTO saved_words (
                profile_id, word, normalized_word, translation, definition, ipa, cefr,
                word_type, example, song_id, meaning_json, metadata_json, mastery_level
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                profile_id, word, normalized_word, translation, definition, ipa, cefr,
                word_type, example, song_id, _json_dump(dict(meaning or {})),
                _json_dump(dict(metadata or {})), mastery_level,
            ),
        )
        saved_word_id = cursor.lastrowid
    return get_saved_word(database, saved_word_id)  # type: ignore[return-value]


def upsert_saved_word(
    database: Database,
    *,
    profile_id: str,
    word: str,
    translation: str | None = None,
    definition: str | None = None,
    ipa: str | None = None,
    cefr: str | None = None,
    word_type: str | None = None,
    example: str | None = None,
    song_id: str | None = None,
    meaning: Mapping[str, Any] | None = None,
    metadata: Mapping[str, Any] | None = None,
    mastery_level: int = 0,
) -> dict[str, Any]:
    """Insert a word, or enrich the existing normalized word for that profile."""

    word = _require_nonempty(word, "word")
    normalized_word = normalize_word(word)
    _validate_range(mastery_level, "mastery_level", 0, 5)
    with _connection(database, write=True) as connection:
        connection.execute(
            """
            INSERT INTO saved_words (
                profile_id, word, normalized_word, translation, definition, ipa, cefr,
                word_type, example, song_id, meaning_json, metadata_json, mastery_level
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(profile_id, normalized_word) DO UPDATE SET
                word = excluded.word,
                translation = COALESCE(excluded.translation, saved_words.translation),
                definition = COALESCE(excluded.definition, saved_words.definition),
                ipa = COALESCE(excluded.ipa, saved_words.ipa),
                cefr = COALESCE(excluded.cefr, saved_words.cefr),
                word_type = COALESCE(excluded.word_type, saved_words.word_type),
                example = COALESCE(excluded.example, saved_words.example),
                song_id = COALESCE(excluded.song_id, saved_words.song_id),
                meaning_json = CASE WHEN excluded.meaning_json = '{}' THEN saved_words.meaning_json
                                    ELSE excluded.meaning_json END,
                metadata_json = CASE WHEN excluded.metadata_json = '{}' THEN saved_words.metadata_json
                                     ELSE excluded.metadata_json END,
                mastery_level = MAX(saved_words.mastery_level, excluded.mastery_level),
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            """,
            (
                profile_id, word, normalized_word, translation, definition, ipa, cefr,
                word_type, example, song_id, _json_dump(dict(meaning or {})),
                _json_dump(dict(metadata or {})), mastery_level,
            ),
        )
    return find_saved_word(database, profile_id=profile_id, word=word)  # type: ignore[return-value]


def get_saved_word(database: Database, saved_word_id: int) -> dict[str, Any] | None:
    with _connection(database) as connection:
        row = connection.execute("SELECT * FROM saved_words WHERE id = ?", (saved_word_id,)).fetchone()
    return _row_to_dict(row, kind="saved_word")


def find_saved_word(database: Database, *, profile_id: str, word: str) -> dict[str, Any] | None:
    normalized_word = normalize_word(word)
    with _connection(database) as connection:
        row = connection.execute(
            "SELECT * FROM saved_words WHERE profile_id = ? AND normalized_word = ?",
            (profile_id, normalized_word),
        ).fetchone()
    return _row_to_dict(row, kind="saved_word")


def list_saved_words(
    database: Database,
    *,
    profile_id: str,
    song_id: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    limit, offset = _pagination(limit, offset)
    query = "SELECT * FROM saved_words WHERE profile_id = ?"
    parameters: list[Any] = [profile_id]
    if song_id is not None:
        query += " AND song_id = ?"
        parameters.append(song_id)
    query += " ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?"
    parameters.extend((limit, offset))
    with _connection(database) as connection:
        rows = connection.execute(query, parameters).fetchall()
    return _rows_to_dicts(rows, kind="saved_word")


def update_saved_word(database: Database, saved_word_id: int, **changes: Any) -> dict[str, Any] | None:
    allowed = {
        "word", "translation", "definition", "ipa", "cefr", "word_type", "example",
        "song_id", "meaning", "metadata", "mastery_level", "review_count", "next_review_at",
    }
    unknown = set(changes) - allowed
    if unknown:
        raise ValueError(f"Unsupported saved word fields: {', '.join(sorted(unknown))}")
    if not changes:
        return get_saved_word(database, saved_word_id)
    if "word" in changes:
        changes["word"] = _require_nonempty(changes["word"], "word")
        changes["normalized_word"] = normalize_word(changes["word"])
    if "mastery_level" in changes:
        _validate_range(changes["mastery_level"], "mastery_level", 0, 5)
    if "review_count" in changes:
        if isinstance(changes["review_count"], bool) or not isinstance(changes["review_count"], int) or changes["review_count"] < 0:
            raise ValueError("review_count must be a non-negative integer")
    if "meaning" in changes:
        changes["meaning_json"] = _json_dump(dict(changes.pop("meaning") or {}))
    if "metadata" in changes:
        changes["metadata_json"] = _json_dump(dict(changes.pop("metadata") or {}))
    assignments = ", ".join(f"{column} = ?" for column in changes)
    values = list(changes.values()) + [saved_word_id]
    with _connection(database, write=True) as connection:
        cursor = connection.execute(
            f"""
            UPDATE saved_words
            SET {assignments}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?
            """,
            values,
        )
        changed = cursor.rowcount > 0
    return get_saved_word(database, saved_word_id) if changed else None


def delete_saved_word(database: Database, saved_word_id: int) -> bool:
    with _connection(database, write=True) as connection:
        cursor = connection.execute("DELETE FROM saved_words WHERE id = ?", (saved_word_id,))
        return cursor.rowcount > 0


# Lesson progress -----------------------------------------------------------


def _validate_progress_values(
    *, status: str, progress_percent: int, quiz_score: int | None, time_spent_seconds: int
) -> None:
    if status not in {"not_started", "in_progress", "completed"}:
        raise ValueError("status must be one of: not_started, in_progress, completed")
    _validate_range(progress_percent, "progress_percent", 0, 100)
    if quiz_score is not None:
        _validate_range(quiz_score, "quiz_score", 0, 100)
    if isinstance(time_spent_seconds, bool) or not isinstance(time_spent_seconds, int) or time_spent_seconds < 0:
        raise ValueError("time_spent_seconds must be a non-negative integer")


def create_lesson_progress(
    database: Database,
    *,
    profile_id: str,
    song_id: str,
    status: str = "not_started",
    progress_percent: int = 0,
    current_step: str | None = None,
    quiz_score: int | None = None,
    time_spent_seconds: int = 0,
) -> dict[str, Any]:
    song_id = _require_nonempty(song_id, "song_id")
    _validate_progress_values(
        status=status,
        progress_percent=progress_percent,
        quiz_score=quiz_score,
        time_spent_seconds=time_spent_seconds,
    )
    with _connection(database, write=True) as connection:
        cursor = connection.execute(
            """
            INSERT INTO lesson_progress (
                profile_id, song_id, status, progress_percent, current_step,
                quiz_score, time_spent_seconds, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?,
                CASE WHEN ? = 'completed' THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END)
            """,
            (
                profile_id, song_id, status, progress_percent, current_step,
                quiz_score, time_spent_seconds, status,
            ),
        )
        progress_id = cursor.lastrowid
    return get_lesson_progress_by_id(database, progress_id)  # type: ignore[return-value]


def upsert_lesson_progress(
    database: Database,
    *,
    profile_id: str,
    song_id: str,
    status: str = "in_progress",
    progress_percent: int = 0,
    current_step: str | None = None,
    quiz_score: int | None = None,
    time_spent_seconds: int = 0,
) -> dict[str, Any]:
    song_id = _require_nonempty(song_id, "song_id")
    _validate_progress_values(
        status=status,
        progress_percent=progress_percent,
        quiz_score=quiz_score,
        time_spent_seconds=time_spent_seconds,
    )
    with _connection(database, write=True) as connection:
        connection.execute(
            """
            INSERT INTO lesson_progress (
                profile_id, song_id, status, progress_percent, current_step,
                quiz_score, time_spent_seconds, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?,
                CASE WHEN ? = 'completed' THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END)
            ON CONFLICT(profile_id, song_id) DO UPDATE SET
                status = CASE
                    WHEN lesson_progress.status = 'completed' THEN 'completed'
                    ELSE excluded.status
                END,
                progress_percent = MAX(lesson_progress.progress_percent, excluded.progress_percent),
                current_step = COALESCE(excluded.current_step, lesson_progress.current_step),
                quiz_score = COALESCE(excluded.quiz_score, lesson_progress.quiz_score),
                time_spent_seconds = MAX(lesson_progress.time_spent_seconds, excluded.time_spent_seconds),
                completed_at = CASE
                    WHEN excluded.status = 'completed' THEN COALESCE(
                        lesson_progress.completed_at,
                        strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                    )
                    ELSE lesson_progress.completed_at
                END,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            """,
            (
                profile_id, song_id, status, progress_percent, current_step,
                quiz_score, time_spent_seconds, status,
            ),
        )
    return get_lesson_progress(database, profile_id=profile_id, song_id=song_id)  # type: ignore[return-value]


def get_lesson_progress_by_id(database: Database, progress_id: int) -> dict[str, Any] | None:
    with _connection(database) as connection:
        row = connection.execute("SELECT * FROM lesson_progress WHERE id = ?", (progress_id,)).fetchone()
    return _row_to_dict(row)


def get_lesson_progress(database: Database, *, profile_id: str, song_id: str) -> dict[str, Any] | None:
    with _connection(database) as connection:
        row = connection.execute(
            "SELECT * FROM lesson_progress WHERE profile_id = ? AND song_id = ?",
            (profile_id, song_id),
        ).fetchone()
    return _row_to_dict(row)


def list_lesson_progress(
    database: Database,
    *,
    profile_id: str,
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, Any]]:
    limit, offset = _pagination(limit, offset)
    if status is not None and status not in {"not_started", "in_progress", "completed"}:
        raise ValueError("status must be one of: not_started, in_progress, completed")
    query = "SELECT * FROM lesson_progress WHERE profile_id = ?"
    parameters: list[Any] = [profile_id]
    if status is not None:
        query += " AND status = ?"
        parameters.append(status)
    query += " ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?"
    parameters.extend((limit, offset))
    with _connection(database) as connection:
        rows = connection.execute(query, parameters).fetchall()
    return _rows_to_dicts(rows)


def update_lesson_progress(database: Database, progress_id: int, **changes: Any) -> dict[str, Any] | None:
    allowed = {"status", "progress_percent", "current_step", "quiz_score", "time_spent_seconds"}
    unknown = set(changes) - allowed
    if unknown:
        raise ValueError(f"Unsupported lesson progress fields: {', '.join(sorted(unknown))}")
    current = get_lesson_progress_by_id(database, progress_id)
    if current is None or not changes:
        return current
    proposed = {
        "status": changes.get("status", current["status"]),
        "progress_percent": changes.get("progress_percent", current["progress_percent"]),
        "quiz_score": changes.get("quiz_score", current["quiz_score"]),
        "time_spent_seconds": changes.get("time_spent_seconds", current["time_spent_seconds"]),
    }
    _validate_progress_values(**proposed)
    assignments = [f"{column} = ?" for column in changes]
    values = list(changes.values())
    if changes.get("status") == "completed" and current["completed_at"] is None:
        assignments.append("completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")
    assignments.append("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")
    values.append(progress_id)
    with _connection(database, write=True) as connection:
        connection.execute(
            f"UPDATE lesson_progress SET {', '.join(assignments)} WHERE id = ?",
            values,
        )
    return get_lesson_progress_by_id(database, progress_id)


def delete_lesson_progress(database: Database, progress_id: int) -> bool:
    with _connection(database, write=True) as connection:
        cursor = connection.execute("DELETE FROM lesson_progress WHERE id = ?", (progress_id,))
        return cursor.rowcount > 0


# Lesson sessions and activity attempts -------------------------------------


def _validate_required_activity_ids(activity_ids: Sequence[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for value in activity_ids:
        if not isinstance(value, str):
            raise ValueError("required_activity_ids must contain strings")
        activity_id = _require_nonempty(value, "activity_id")
        if len(activity_id) > 160:
            raise ValueError("activity_id must be at most 160 characters")
        if activity_id in seen:
            raise ValueError("required_activity_ids must be unique")
        seen.add(activity_id)
        cleaned.append(activity_id)
    if not cleaned:
        raise ValueError("required_activity_ids must not be empty")
    if len(cleaned) > 100:
        raise ValueError("required_activity_ids must contain at most 100 items")
    return cleaned


def _session_from_row(
    connection: sqlite3.Connection, row: sqlite3.Row | None
) -> dict[str, Any] | None:
    session = _row_to_dict(row, kind="session")
    if session is None:
        return None
    required_ids = session["required_activity_ids"]
    attempts = connection.execute(
        """
        SELECT activity_id, COUNT(*) AS count, MAX(score) AS best_score
        FROM activity_attempts
        WHERE session_id = ?
        GROUP BY activity_id
        """,
        (session["id"],),
    ).fetchall()
    attempted_ids = {attempt["activity_id"] for attempt in attempts}
    completed_ids = [activity_id for activity_id in required_ids if activity_id in attempted_ids]
    missing_ids = [activity_id for activity_id in required_ids if activity_id not in attempted_ids]
    attempt_count = sum(int(attempt["count"]) for attempt in attempts)
    first_attempt_score = connection.execute(
        """
        SELECT AVG(score) AS average_score
        FROM activity_attempts
        WHERE session_id = ? AND attempt_number = 1 AND correct IS NOT NULL
        """,
        (session["id"],),
    ).fetchone()["average_score"]
    session.update(
        completed_activity_ids=completed_ids,
        missing_activity_ids=missing_ids,
        completed_activity_count=len(completed_ids),
        required_activity_count=len(required_ids),
        progress_percent=round(len(completed_ids) / len(required_ids) * 100),
        attempt_count=attempt_count,
        first_attempt_score=round(float(first_attempt_score or 0) * 100),
    )
    return session


def _get_session_row(connection: sqlite3.Connection, session_id: str) -> sqlite3.Row | None:
    return connection.execute(
        "SELECT * FROM lesson_sessions WHERE id = ?", (session_id,)
    ).fetchone()


def create_lesson_session(
    database: Database,
    *,
    profile_id: str,
    song_id: str,
    required_activity_ids: Sequence[str],
    lesson_version: str = "curated-v1",
    session_id: str | None = None,
    resume_active: bool = True,
) -> dict[str, Any]:
    """Start a session or return the latest active one with the same contract.

    The required activity snapshot is immutable for the lifetime of a session,
    so a changed lesson contract abandons the stale session and starts cleanly.
    """

    song_id = _require_nonempty(song_id, "song_id")
    lesson_version = _require_nonempty(lesson_version, "lesson_version")
    required_ids = _validate_required_activity_ids(required_activity_ids)
    session_id = session_id or str(uuid.uuid4())
    with _connection(database, write=True) as connection:
        if resume_active:
            existing = connection.execute(
                """
                SELECT * FROM lesson_sessions
                WHERE profile_id = ? AND song_id = ? AND lesson_version = ? AND status = 'active'
                ORDER BY last_active_at DESC, started_at DESC
                LIMIT 1
                """,
                (profile_id, song_id, lesson_version),
            ).fetchone()
            if existing is not None:
                existing_session = _session_from_row(connection, existing)
                if existing_session is not None and existing_session["required_activity_ids"] == required_ids:
                    return existing_session
                connection.execute(
                    """
                    UPDATE lesson_sessions
                    SET status = 'abandoned', current_activity_id = NULL,
                        last_active_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                    WHERE id = ?
                    """,
                    (existing["id"],),
                )
        connection.execute(
            """
            INSERT INTO lesson_sessions (
                id, profile_id, song_id, lesson_version, required_activity_ids_json,
                current_activity_id
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                session_id,
                profile_id,
                song_id,
                lesson_version,
                _json_dump(required_ids),
                required_ids[0],
            ),
        )
        row = _get_session_row(connection, session_id)
        return _session_from_row(connection, row)  # type: ignore[return-value]


def get_lesson_session(database: Database, session_id: str) -> dict[str, Any] | None:
    with _connection(database) as connection:
        return _session_from_row(connection, _get_session_row(connection, session_id))


def list_lesson_sessions(
    database: Database,
    *,
    profile_id: str,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    limit, offset = _pagination(limit, offset)
    if status is not None and status not in {"active", "completed", "abandoned"}:
        raise ValueError("status must be one of: active, completed, abandoned")
    query = "SELECT * FROM lesson_sessions WHERE profile_id = ?"
    parameters: list[Any] = [profile_id]
    if status is not None:
        query += " AND status = ?"
        parameters.append(status)
    query += " ORDER BY last_active_at DESC, started_at DESC LIMIT ? OFFSET ?"
    parameters.extend((limit, offset))
    with _connection(database) as connection:
        rows = connection.execute(query, parameters).fetchall()
        return [
            _session_from_row(connection, row) for row in rows
        ]  # type: ignore[misc]


def _sync_legacy_progress(
    connection: sqlite3.Connection,
    *,
    profile_id: str,
    song_id: str,
    status: str,
    progress_percent: int,
    current_step: str | None,
    quiz_score: int | None,
    time_spent_seconds: int,
) -> None:
    """Keep the original progress endpoint useful while sessions become canonical."""

    legacy_status = "completed" if status == "completed" else "in_progress"
    connection.execute(
        """
        INSERT INTO lesson_progress (
            profile_id, song_id, status, progress_percent, current_step,
            quiz_score, time_spent_seconds, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?,
            CASE WHEN ? = 'completed' THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END)
        ON CONFLICT(profile_id, song_id) DO UPDATE SET
            status = CASE
                WHEN lesson_progress.status = 'completed' THEN 'completed'
                ELSE excluded.status
            END,
            progress_percent = MAX(lesson_progress.progress_percent, excluded.progress_percent),
            current_step = COALESCE(excluded.current_step, lesson_progress.current_step),
            quiz_score = COALESCE(excluded.quiz_score, lesson_progress.quiz_score),
            time_spent_seconds = MAX(lesson_progress.time_spent_seconds, excluded.time_spent_seconds),
            completed_at = CASE
                WHEN excluded.status = 'completed' THEN COALESCE(
                    lesson_progress.completed_at,
                    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                )
                ELSE lesson_progress.completed_at
            END,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        """,
        (
            profile_id,
            song_id,
            legacy_status,
            progress_percent,
            current_step,
            quiz_score,
            time_spent_seconds,
            legacy_status,
        ),
    )


def create_activity_attempt(
    database: Database,
    *,
    session_id: str,
    activity_id: str,
    activity_kind: str,
    skill: str,
    score: float,
    correct: bool | None = None,
    duration_seconds: int = 0,
) -> dict[str, Any]:
    """Record outcome metadata only; answers, lyrics, audio and transcripts are absent."""

    activity_id = _require_nonempty(activity_id, "activity_id")
    activity_kind = _require_nonempty(activity_kind, "activity_kind")
    allowed_skills = {
        "orientation", "meaning", "vocabulary", "listening", "grammar", "speaking", "practice"
    }
    if skill not in allowed_skills:
        raise ValueError(f"skill must be one of: {', '.join(sorted(allowed_skills))}")
    if isinstance(score, bool) or not isinstance(score, (int, float)) or not 0 <= score <= 1:
        raise ValueError("score must be a number between 0 and 1")
    if (
        isinstance(duration_seconds, bool)
        or not isinstance(duration_seconds, int)
        or not 0 <= duration_seconds <= 3600
    ):
        raise ValueError("duration_seconds must be an integer between 0 and 3600")

    with _connection(database, write=True) as connection:
        row = _get_session_row(connection, session_id)
        session = _session_from_row(connection, row)
        if session is None:
            raise LookupError("Lesson session not found")
        if session["status"] != "active":
            raise ValueError("Only an active lesson session accepts attempts")
        attempt_number = connection.execute(
            """
            SELECT COUNT(*) + 1 AS next_attempt
            FROM activity_attempts
            WHERE session_id = ? AND activity_id = ?
            """,
            (session_id, activity_id),
        ).fetchone()["next_attempt"]
        cursor = connection.execute(
            """
            INSERT INTO activity_attempts (
                session_id, activity_id, activity_kind, skill, attempt_number,
                correct, score, duration_seconds
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                session_id,
                activity_id,
                activity_kind,
                skill,
                attempt_number,
                None if correct is None else int(correct),
                float(score),
                duration_seconds,
            ),
        )
        attempt_id = cursor.lastrowid
        attempted_rows = connection.execute(
            "SELECT DISTINCT activity_id FROM activity_attempts WHERE session_id = ?",
            (session_id,),
        ).fetchall()
        attempted_ids = {item["activity_id"] for item in attempted_rows}
        missing_ids = [
            required_id
            for required_id in session["required_activity_ids"]
            if required_id not in attempted_ids
        ]
        progress_percent = round(
            (len(session["required_activity_ids"]) - len(missing_ids))
            / len(session["required_activity_ids"])
            * 100
        )
        current_activity_id = missing_ids[0] if missing_ids else None
        connection.execute(
            """
            UPDATE lesson_sessions
            SET current_activity_id = ?,
                total_time_seconds = total_time_seconds + ?,
                last_active_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?
            """,
            (current_activity_id, duration_seconds, session_id),
        )
        _sync_legacy_progress(
            connection,
            profile_id=session["profile_id"],
            song_id=session["song_id"],
            status="active",
            progress_percent=progress_percent,
            current_step=activity_id,
            quiz_score=None,
            time_spent_seconds=session["total_time_seconds"] + duration_seconds,
        )
        attempt_row = connection.execute(
            "SELECT * FROM activity_attempts WHERE id = ?", (attempt_id,)
        ).fetchone()
        updated_session = _session_from_row(
            connection, _get_session_row(connection, session_id)
        )
    return {
        "attempt": _row_to_dict(attempt_row, kind="activity_attempt"),
        "session": updated_session,
    }


def list_activity_attempts(
    database: Database, *, session_id: str, activity_id: str | None = None
) -> list[dict[str, Any]]:
    query = "SELECT * FROM activity_attempts WHERE session_id = ?"
    parameters: list[Any] = [session_id]
    if activity_id is not None:
        query += " AND activity_id = ?"
        parameters.append(activity_id)
    query += " ORDER BY created_at ASC, id ASC"
    with _connection(database) as connection:
        rows = connection.execute(query, parameters).fetchall()
    return _rows_to_dicts(rows, kind="activity_attempt")


def complete_lesson_session(database: Database, session_id: str) -> dict[str, Any] | None:
    with _connection(database, write=True) as connection:
        row = _get_session_row(connection, session_id)
        session = _session_from_row(connection, row)
        if session is None:
            return None
        if session["status"] == "completed":
            return session
        if session["status"] != "active":
            raise ValueError("Only an active lesson session can be completed")
        if session["missing_activity_ids"]:
            raise IncompleteSessionError(session["missing_activity_ids"])
        average_score = connection.execute(
            """
            SELECT AVG(score) AS average_score
            FROM activity_attempts
            WHERE session_id = ? AND attempt_number = 1 AND correct IS NOT NULL
            """,
            (session_id,),
        ).fetchone()["average_score"]
        quiz_score = round(float(average_score or 0) * 100)
        connection.execute(
            """
            UPDATE lesson_sessions
            SET status = 'completed', current_activity_id = NULL,
                completed_at = COALESCE(
                    completed_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                ),
                last_active_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?
            """,
            (session_id,),
        )
        _sync_legacy_progress(
            connection,
            profile_id=session["profile_id"],
            song_id=session["song_id"],
            status="completed",
            progress_percent=100,
            current_step="completed",
            quiz_score=quiz_score,
            time_spent_seconds=session["total_time_seconds"],
        )
        return _session_from_row(connection, _get_session_row(connection, session_id))


# Review scheduling ---------------------------------------------------------


def list_due_reviews(
    database: Database,
    *,
    profile_id: str,
    limit: int = 20,
    offset: int = 0,
) -> list[dict[str, Any]]:
    limit, offset = _pagination(limit, offset)
    with _connection(database) as connection:
        rows = connection.execute(
            """
            SELECT * FROM saved_words
            WHERE profile_id = ?
              AND (next_review_at IS NULL OR datetime(next_review_at) <= datetime('now'))
            ORDER BY next_review_at IS NOT NULL, next_review_at ASC, created_at ASC
            LIMIT ? OFFSET ?
            """,
            (profile_id, limit, offset),
        ).fetchall()
    return _rows_to_dicts(rows, kind="saved_word")


def _iso_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def record_review_attempt(
    database: Database,
    *,
    profile_id: str,
    saved_word_id: int,
    rating: str,
    correct: bool | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    if rating not in {"again", "hard", "good", "easy"}:
        raise ValueError("rating must be one of: again, hard, good, easy")
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    with _connection(database, write=True) as connection:
        row = connection.execute(
            "SELECT * FROM saved_words WHERE id = ? AND profile_id = ?",
            (saved_word_id, profile_id),
        ).fetchone()
        if row is None:
            raise LookupError("Saved word not found")
        mastery_before = int(row["mastery_level"])
        if rating == "again":
            mastery_after = max(0, mastery_before - 1)
            next_review = now + timedelta(minutes=10)
        elif rating == "hard":
            mastery_after = mastery_before
            next_review = now + timedelta(days=1)
        elif rating == "good":
            mastery_after = min(5, mastery_before + 1)
            next_review = now + timedelta(days=[1, 2, 4, 7, 14, 30][mastery_after])
        else:
            mastery_after = min(5, mastery_before + 2)
            next_review = now + timedelta(days=[3, 7, 14, 30, 60, 90][mastery_after])
        next_review_at = _iso_utc(next_review)
        connection.execute(
            """
            UPDATE saved_words
            SET mastery_level = ?, review_count = review_count + 1,
                next_review_at = ?,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?
            """,
            (mastery_after, next_review_at, saved_word_id),
        )
        cursor = connection.execute(
            """
            INSERT INTO review_attempts (
                profile_id, saved_word_id, rating, correct,
                mastery_before, mastery_after, next_review_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                profile_id,
                saved_word_id,
                rating,
                None if correct is None else int(correct),
                mastery_before,
                mastery_after,
                next_review_at,
            ),
        )
        review_row = connection.execute(
            "SELECT * FROM review_attempts WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()
        word_row = connection.execute(
            "SELECT * FROM saved_words WHERE id = ?", (saved_word_id,)
        ).fetchone()
    return {
        "word": _row_to_dict(word_row, kind="saved_word"),
        "review": _row_to_dict(review_row, kind="review_attempt"),
    }


def list_review_attempts(
    database: Database, *, profile_id: str, saved_word_id: int | None = None
) -> list[dict[str, Any]]:
    query = "SELECT * FROM review_attempts WHERE profile_id = ?"
    parameters: list[Any] = [profile_id]
    if saved_word_id is not None:
        query += " AND saved_word_id = ?"
        parameters.append(saved_word_id)
    query += " ORDER BY created_at DESC, id DESC"
    with _connection(database) as connection:
        rows = connection.execute(query, parameters).fetchall()
    return _rows_to_dicts(rows, kind="review_attempt")


# Dashboard -----------------------------------------------------------------


def get_profile_dashboard(database: Database, *, profile_id: str) -> dict[str, Any] | None:
    with _connection(database) as connection:
        profile_row = connection.execute(
            "SELECT * FROM profiles WHERE id = ?", (profile_id,)
        ).fetchone()
        if profile_row is None:
            return None
        saved = connection.execute(
            """
            SELECT COUNT(*) AS saved_words,
                   SUM(CASE WHEN mastery_level >= 3 THEN 1 ELSE 0 END) AS mastered_words
            FROM saved_words WHERE profile_id = ?
            """,
            (profile_id,),
        ).fetchone()
        session_totals = connection.execute(
            """
            SELECT COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_lessons,
                   COALESCE(SUM(total_time_seconds), 0) AS learning_seconds
            FROM lesson_sessions WHERE profile_id = ?
            """,
            (profile_id,),
        ).fetchone()
        attempt_totals = connection.execute(
            """
            SELECT COUNT(*) AS first_attempts,
                   SUM(CASE WHEN aa.correct = 1 THEN 1 ELSE 0 END) AS correct_attempts
            FROM activity_attempts aa
            JOIN lesson_sessions ls ON ls.id = aa.session_id
            WHERE ls.profile_id = ? AND aa.attempt_number = 1 AND aa.correct IS NOT NULL
            """,
            (profile_id,),
        ).fetchone()
        all_attempts = connection.execute(
            """
            SELECT COUNT(*) AS count
            FROM activity_attempts aa
            JOIN lesson_sessions ls ON ls.id = aa.session_id
            WHERE ls.profile_id = ?
            """,
            (profile_id,),
        ).fetchone()["count"]
        due_reviews = connection.execute(
            """
            SELECT COUNT(*) AS count FROM saved_words
            WHERE profile_id = ?
              AND (next_review_at IS NULL OR datetime(next_review_at) <= datetime('now'))
            """,
            (profile_id,),
        ).fetchone()["count"]
        now = datetime.now(timezone.utc)
        monday = (now - timedelta(days=now.weekday())).date().isoformat()
        weekly = connection.execute(
            """
            SELECT COUNT(*) AS completed
            FROM lesson_sessions
            WHERE profile_id = ? AND status = 'completed' AND date(completed_at) >= date(?)
            """,
            (profile_id, monday),
        ).fetchone()["completed"]
        active_days = connection.execute(
            """
            SELECT COUNT(DISTINCT activity_date) AS count FROM (
                SELECT date(aa.created_at) AS activity_date
                FROM activity_attempts aa
                JOIN lesson_sessions ls ON ls.id = aa.session_id
                WHERE ls.profile_id = ? AND date(aa.created_at) >= date(?)
                UNION
                SELECT date(created_at) AS activity_date
                FROM review_attempts
                WHERE profile_id = ? AND date(created_at) >= date(?)
            )
            """,
            (profile_id, monday, profile_id, monday),
        ).fetchone()["count"]
        activity_dates = {
            row["activity_date"]
            for row in connection.execute(
                """
                SELECT DISTINCT activity_date FROM (
                    SELECT date(aa.created_at) AS activity_date
                    FROM activity_attempts aa
                    JOIN lesson_sessions ls ON ls.id = aa.session_id
                    WHERE ls.profile_id = ?
                    UNION
                    SELECT date(created_at) AS activity_date
                    FROM review_attempts WHERE profile_id = ?
                )
                WHERE activity_date IS NOT NULL
                """,
                (profile_id, profile_id),
            ).fetchall()
        }
        start_day = now.date()
        if start_day.isoformat() not in activity_dates:
            start_day -= timedelta(days=1)
        streak_days = 0
        while start_day.isoformat() in activity_dates:
            streak_days += 1
            start_day -= timedelta(days=1)
        skill_rows = connection.execute(
            """
            SELECT aa.skill, COUNT(*) AS attempts, AVG(aa.score) AS average_score
            FROM activity_attempts aa
            JOIN lesson_sessions ls ON ls.id = aa.session_id
            WHERE ls.profile_id = ? AND aa.attempt_number = 1
            GROUP BY aa.skill
            ORDER BY aa.skill
            """,
            (profile_id,),
        ).fetchall()
        active_row = connection.execute(
            """
            SELECT * FROM lesson_sessions
            WHERE profile_id = ? AND status = 'active'
            ORDER BY last_active_at DESC, started_at DESC LIMIT 1
            """,
            (profile_id,),
        ).fetchone()
        recent_rows = connection.execute(
            """
            SELECT * FROM lesson_sessions
            WHERE profile_id = ?
            ORDER BY last_active_at DESC, started_at DESC LIMIT 5
            """,
            (profile_id,),
        ).fetchall()
        first_attempts = int(attempt_totals["first_attempts"] or 0)
        correct_attempts = int(attempt_totals["correct_attempts"] or 0)
        return {
            "profile": _row_to_dict(profile_row),
            "active_session": _session_from_row(connection, active_row),
            "totals": {
                "saved_words": int(saved["saved_words"] or 0),
                "mastered_words": int(saved["mastered_words"] or 0),
                "learning_minutes": round(int(session_totals["learning_seconds"] or 0) / 60),
                "completed_lessons": int(session_totals["completed_lessons"] or 0),
                "attempts": int(all_attempts or 0),
                "first_attempt_accuracy": round(correct_attempts / first_attempts * 100)
                if first_attempts
                else 0,
            },
            "weekly": {
                "goal": int(profile_row["weekly_goal"]),
                "completed": int(weekly or 0),
                "active_days": int(active_days or 0),
            },
            "due_reviews": int(due_reviews or 0),
            "streak_days": streak_days,
            "skills": [
                {
                    "skill": row["skill"],
                    "attempts": int(row["attempts"]),
                    "score": round(float(row["average_score"] or 0) * 100),
                }
                for row in skill_rows
            ],
            "recent_sessions": [
                _session_from_row(connection, row) for row in recent_rows
            ],
        }


# Analysis history ----------------------------------------------------------


def create_analysis_history(
    database: Database,
    *,
    artist: str,
    title: str,
    interface_language: str,
    level: str,
    learning_score: int,
    total_words: int,
    unique_words: int,
    useful_words: Sequence[str] = (),
    slang: Sequence[str] = (),
    explicit_count: int = 0,
    classroom_fit: str = "safe",
    profile_id: str | None = None,
    song_id: str | None = None,
    metadata: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Persist a derived analysis summary; raw lyrics are never accepted or stored."""

    artist = _require_nonempty(artist, "artist")
    title = _require_nonempty(title, "title")
    level = _require_nonempty(level, "level")
    interface_language = _validate_language(interface_language)
    _validate_range(learning_score, "learning_score", 0, 100)
    for value, field in ((total_words, "total_words"), (unique_words, "unique_words"), (explicit_count, "explicit_count")):
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise ValueError(f"{field} must be a non-negative integer")
    if unique_words > total_words:
        raise ValueError("unique_words cannot exceed total_words")
    if classroom_fit not in {"safe", "guided"}:
        raise ValueError("classroom_fit must be one of: safe, guided")
    with _connection(database, write=True) as connection:
        cursor = connection.execute(
            """
            INSERT INTO analysis_history (
                profile_id, song_id, artist, title, interface_language, level,
                learning_score, total_words, unique_words, useful_words_json,
                slang_json, explicit_count, classroom_fit, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                profile_id, song_id, artist, title, interface_language, level,
                learning_score, total_words, unique_words, _json_dump(list(useful_words)),
                _json_dump(list(slang)), explicit_count, classroom_fit,
                _json_dump(dict(metadata or {})),
            ),
        )
        history_id = cursor.lastrowid
    return get_analysis_history(database, history_id)  # type: ignore[return-value]


def get_analysis_history(database: Database, history_id: int) -> dict[str, Any] | None:
    with _connection(database) as connection:
        row = connection.execute("SELECT * FROM analysis_history WHERE id = ?", (history_id,)).fetchone()
    return _row_to_dict(row, kind="analysis")


def update_analysis_history(
    database: Database, history_id: int, **changes: Any
) -> dict[str, Any] | None:
    """Correct fields in a stored summary without ever accepting raw lyrics."""

    allowed = {
        "song_id", "artist", "title", "interface_language", "level", "learning_score",
        "total_words", "unique_words", "useful_words", "slang", "explicit_count",
        "classroom_fit", "metadata",
    }
    unknown = set(changes) - allowed
    if unknown:
        raise ValueError(f"Unsupported analysis history fields: {', '.join(sorted(unknown))}")
    current = get_analysis_history(database, history_id)
    if current is None or not changes:
        return current

    for field in ("artist", "title", "level"):
        if field in changes:
            changes[field] = _require_nonempty(changes[field], field)
    if "interface_language" in changes:
        changes["interface_language"] = _validate_language(changes["interface_language"])
    if "learning_score" in changes:
        _validate_range(changes["learning_score"], "learning_score", 0, 100)
    for field in ("total_words", "unique_words", "explicit_count"):
        if field in changes:
            value = changes[field]
            if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                raise ValueError(f"{field} must be a non-negative integer")
    total_words = changes.get("total_words", current["total_words"])
    unique_words = changes.get("unique_words", current["unique_words"])
    if unique_words > total_words:
        raise ValueError("unique_words cannot exceed total_words")
    if "classroom_fit" in changes and changes["classroom_fit"] not in {"safe", "guided"}:
        raise ValueError("classroom_fit must be one of: safe, guided")
    if "useful_words" in changes:
        changes["useful_words_json"] = _json_dump(list(changes.pop("useful_words")))
    if "slang" in changes:
        changes["slang_json"] = _json_dump(list(changes.pop("slang")))
    if "metadata" in changes:
        changes["metadata_json"] = _json_dump(dict(changes.pop("metadata") or {}))

    assignments = ", ".join(f"{column} = ?" for column in changes)
    values = list(changes.values()) + [history_id]
    with _connection(database, write=True) as connection:
        connection.execute(
            f"UPDATE analysis_history SET {assignments} WHERE id = ?",
            values,
        )
    return get_analysis_history(database, history_id)


def list_analysis_history(
    database: Database,
    *,
    profile_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    limit, offset = _pagination(limit, offset)
    query = "SELECT * FROM analysis_history"
    parameters: list[Any] = []
    if profile_id is not None:
        query += " WHERE profile_id = ?"
        parameters.append(profile_id)
    query += " ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?"
    parameters.extend((limit, offset))
    with _connection(database) as connection:
        rows = connection.execute(query, parameters).fetchall()
    return _rows_to_dicts(rows, kind="analysis")


def delete_analysis_history(database: Database, history_id: int) -> bool:
    with _connection(database, write=True) as connection:
        cursor = connection.execute("DELETE FROM analysis_history WHERE id = ?", (history_id,))
        return cursor.rowcount > 0


def clear_analysis_history(database: Database, *, profile_id: str | None = None) -> int:
    """Delete history for one profile, or all history when profile_id is omitted."""

    with _connection(database, write=True) as connection:
        if profile_id is None:
            cursor = connection.execute("DELETE FROM analysis_history")
        else:
            cursor = connection.execute("DELETE FROM analysis_history WHERE profile_id = ?", (profile_id,))
        return cursor.rowcount
