import logging
import os
import re
import sqlite3
import time
from collections import defaultdict, deque
from pathlib import Path
from threading import Lock
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from backend.ai_service import ai_status, generate_song_lesson
from backend import storage


logger = logging.getLogger("sonora.api")


def default_database_path() -> str:
    """Use Vercel's writable temp directory when running serverlessly."""

    if os.getenv("VERCEL"):
        return "/tmp/sonora.db"
    return str(storage.DEFAULT_DB_PATH)


DB_PATH = os.getenv("SONORA_DB_PATH", "").strip() or default_database_path()

storage.init_db(DB_PATH)


app = FastAPI(
    title="SONORA API",
    description="API foundation for learning English through popular music.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "SONORA_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


SONGS = [
    {
        "id": "lovely",
        "title": "lovely",
        "artist": "Billie Eilish & Khalid",
        "level": "B1",
        "duration": 18,
        "learning_score": 92,
        "safety": "Guided",
        "accent": "violet",
        "skills": ["Emotions", "Metaphors", "Pronunciation"],
    },
    {
        "id": "counting-stars",
        "title": "Counting Stars",
        "artist": "OneRepublic",
        "level": "B1",
        "duration": 16,
        "learning_score": 89,
        "safety": "Safe",
        "accent": "amber",
        "skills": ["Idioms", "Present continuous", "Listening"],
    },
    {
        "id": "flowers",
        "title": "Flowers",
        "artist": "Miley Cyrus",
        "level": "A2–B1",
        "duration": 14,
        "learning_score": 87,
        "safety": "Safe",
        "accent": "coral",
        "skills": ["Self-care", "Can / could", "Vocabulary"],
    },
    {
        "id": "believer",
        "title": "Believer",
        "artist": "Imagine Dragons",
        "level": "B1–B2",
        "duration": 20,
        "learning_score": 90,
        "safety": "Safe",
        "accent": "lime",
        "skills": ["Word stress", "Past tense", "Metaphors"],
    },
]


class AnalyzeRequest(BaseModel):
    artist: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=160)
    lyrics: str = Field(min_length=20, max_length=1600)
    interface_language: Literal["en", "ru", "kk"] = "en"
    use_ai: bool = True
    profile_id: str | None = None


class ProfileCreate(BaseModel):
    profile_id: str | None = Field(default=None, min_length=8, max_length=100)
    display_name: str = Field(min_length=1, max_length=80)
    interface_language: Literal["en", "ru", "kk"] = "en"
    current_level: str = "A1"
    weekly_goal: int = Field(default=5, ge=1, le=100)


class SavedWordPayload(BaseModel):
    word: str = Field(min_length=1, max_length=100)
    ipa: str | None = None
    cefr: str | None = None
    word_type: str | None = None
    example: str | None = None
    song_id: str | None = None
    meaning: dict[str, Any] = Field(default_factory=dict)
    mastery_level: int = Field(default=0, ge=0, le=5)


class ProgressPayload(BaseModel):
    status: Literal["not_started", "in_progress", "completed"] = "in_progress"
    progress_percent: int = Field(default=0, ge=0, le=100)
    current_step: str | None = None
    quiz_score: int | None = Field(default=None, ge=0, le=100)
    time_spent_seconds: int = Field(default=0, ge=0)


class SessionCreatePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    song_id: str = Field(alias="songId", min_length=1, max_length=160)
    lesson_version: str = Field(default="curated-v1", alias="lessonVersion", min_length=1, max_length=80)
    required_activity_ids: list[str] | None = Field(
        default=None, alias="requiredActivityIds", min_length=4, max_length=100
    )
    force_new: bool = Field(default=False, alias="forceNew")


class ActivityAttemptPayload(BaseModel):
    """Outcome-only attempt payload; raw answers and recordings are intentionally forbidden."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    activity_id: str = Field(alias="activityId", min_length=1, max_length=160)
    score: float = Field(ge=0, le=1)
    correct: bool | None = None
    duration_seconds: int = Field(default=0, alias="durationSeconds", ge=0, le=3600)
    activity_kind: str | None = Field(default=None, alias="activityKind", max_length=60)
    skill: Literal[
        "orientation", "meaning", "vocabulary", "listening", "grammar", "speaking", "practice"
    ] | None = None
    # The browser engine may keep a local recovery response and clock value.
    # They are accepted for wire compatibility but deliberately never passed to storage.
    response: Any | None = None
    now: str | None = Field(default=None, max_length=50)


class ReviewAttemptPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rating: Literal["again", "hard", "good", "easy"]
    correct: bool | None = None


def default_required_activity_ids(song_id: str) -> list[str]:
    """Seven representative gates used when a client has no richer lesson plan."""

    return [
        f"{song_id}:setup:goal",
        f"{song_id}:meaning:prediction",
        f"{song_id}:listening:gist",
        f"{song_id}:vocabulary:context",
        f"{song_id}:language:register:0",
        f"{song_id}:checkpoint:q:0",
        f"{song_id}:speaking:response",
    ]


def infer_activity_metadata(activity_id: str) -> tuple[str, str]:
    """Derive non-sensitive analytics labels from a stable activity id."""

    segments = activity_id.replace(".", ":").split(":")
    stages = {"setup", "onboarding", "meaning", "listening", "vocabulary", "language", "quiz", "checkpoint", "speaking"}
    stage = next((segment for segment in segments if segment in stages), "practice")
    if stage in {"setup", "onboarding"}:
        return stage, "orientation"
    if stage == "meaning":
        return stage, "meaning"
    if stage == "listening":
        return stage, "listening"
    if stage == "vocabulary":
        return stage, "vocabulary"
    if stage == "language":
        return stage, "grammar"
    if stage == "speaking":
        return stage, "speaking"
    if stage in {"quiz", "checkpoint"}:
        joined = ":".join(segments)
        if "vocabulary" in joined:
            return stage, "vocabulary"
        if "listening" in joined:
            return stage, "listening"
        if "meaning" in joined:
            return stage, "meaning"
        if "grammar" in joined or "register" in joined:
            return stage, "grammar"
    return stage, "practice"


def deterministic_analysis(lyrics: str) -> dict:
    tokens = re.findall(r"[a-z]+(?:'[a-z]+)?", lyrics.lower())
    common = {
        "the", "and", "that", "this", "with", "from", "your", "you", "are",
        "was", "for", "but", "have", "has", "not", "all", "can", "just",
        "like", "into", "when", "what",
    }
    unique_words = list(dict.fromkeys(word for word in tokens if word not in common))
    slang_lexicon = {"wanna", "gonna", "gotta", "ain't", "kinda", "lemme", "yeah", "bro", "cause"}
    explicit_lexicon = {"fuck", "shit", "bitch", "damn"}
    slang = sorted(set(tokens) & slang_lexicon)
    explicit_count = sum(word in explicit_lexicon for word in tokens)
    average_length = sum(map(len, tokens)) / len(tokens) if tokens else 0
    level = "B2" if average_length > 5.2 else "B1" if average_length > 4.35 else "A2"
    return {
        "level": level,
        "learning_score": min(94, 62 + min(len(unique_words), 32)),
        "total_words": len(tokens),
        "unique_words": len(unique_words),
        "useful_words": [word for word in unique_words if len(word) >= 5][:8],
        "slang": slang,
        "explicit_count": explicit_count,
        "classroom_fit": "guided" if explicit_count else "safe",
    }


_ai_usage_lock = Lock()
_ai_usage_by_client: dict[str, deque[float]] = defaultdict(deque)
_ai_usage_global: deque[float] = deque()


def enforce_ai_rate_limit(client_id: str) -> None:
    """Protect a server-side cloud key with small demo-safe request budgets."""

    now = time.time()
    hour_ago = now - 3600
    day_ago = now - 86400
    per_hour = max(1, int(os.getenv("SONORA_AI_REQUESTS_PER_HOUR", "10")))
    per_day = max(1, int(os.getenv("SONORA_AI_REQUESTS_PER_DAY", "40")))
    with _ai_usage_lock:
        client_usage = _ai_usage_by_client[client_id]
        while client_usage and client_usage[0] < hour_ago:
            client_usage.popleft()
        while _ai_usage_global and _ai_usage_global[0] < day_ago:
            _ai_usage_global.popleft()
        if len(client_usage) >= per_hour or len(_ai_usage_global) >= per_day:
            raise HTTPException(
                status_code=429,
                detail="Web AI request limit reached. Try again later.",
            )
        client_usage.append(now)
        _ai_usage_global.append(now)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "sonora-api", "ai": ai_status()}


@app.get("/api/capabilities")
def capabilities():
    runtime = ai_status()
    return {
        "ai_lessons": runtime["ready"],
        "ai": runtime,
        "local_analysis": True,
        "lyrics_storage": False,
        "lesson_sessions": True,
        "review_queue": True,
        "languages": ["en", "kk", "ru"],
    }


@app.get("/api/profiles/{profile_id}")
def get_profile(profile_id: str):
    profile = storage.get_profile(DB_PATH, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@app.post("/api/profiles", status_code=201)
def create_profile(payload: ProfileCreate):
    if payload.profile_id:
        existing = storage.get_profile(DB_PATH, payload.profile_id)
        if existing is not None:
            return existing
    try:
        return storage.create_profile(DB_PATH, **payload.model_dump())
    except sqlite3.IntegrityError as exc:
        if payload.profile_id:
            existing = storage.get_profile(DB_PATH, payload.profile_id)
            if existing is not None:
                return existing
        raise HTTPException(status_code=409, detail="Profile already exists") from exc


@app.get("/api/profiles/{profile_id}/words")
def saved_words(profile_id: str):
    return {"items": storage.list_saved_words(DB_PATH, profile_id=profile_id)}


@app.post("/api/profiles/{profile_id}/words")
def save_word(profile_id: str, payload: SavedWordPayload):
    if storage.get_profile(DB_PATH, profile_id) is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return storage.upsert_saved_word(DB_PATH, profile_id=profile_id, **payload.model_dump())


@app.delete("/api/words/{saved_word_id}", status_code=204)
def delete_saved_word(saved_word_id: int):
    if not storage.delete_saved_word(DB_PATH, saved_word_id):
        raise HTTPException(status_code=404, detail="Saved word not found")


@app.delete("/api/profiles/{profile_id}/words/by-name/{word:path}", status_code=204)
def delete_saved_word_by_name(profile_id: str, word: str):
    saved_word = storage.find_saved_word(DB_PATH, profile_id=profile_id, word=word)
    if saved_word is None or not storage.delete_saved_word(DB_PATH, saved_word["id"]):
        raise HTTPException(status_code=404, detail="Saved word not found")


@app.get("/api/profiles/{profile_id}/progress")
def lesson_progress(profile_id: str):
    return {"items": storage.list_lesson_progress(DB_PATH, profile_id=profile_id)}


@app.put("/api/profiles/{profile_id}/progress/{song_id}")
def save_lesson_progress(profile_id: str, song_id: str, payload: ProgressPayload):
    if storage.get_profile(DB_PATH, profile_id) is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return storage.upsert_lesson_progress(
        DB_PATH,
        profile_id=profile_id,
        song_id=song_id,
        **payload.model_dump(),
    )


@app.post("/api/profiles/{profile_id}/sessions", status_code=201)
def start_lesson_session(profile_id: str, payload: SessionCreatePayload):
    if storage.get_profile(DB_PATH, profile_id) is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    required_ids = payload.required_activity_ids or default_required_activity_ids(payload.song_id)
    try:
        return storage.create_lesson_session(
            DB_PATH,
            profile_id=profile_id,
            song_id=payload.song_id,
            lesson_version=payload.lesson_version,
            required_activity_ids=required_ids,
            resume_active=not payload.force_new,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/profiles/{profile_id}/sessions")
def profile_lesson_sessions(
    profile_id: str,
    status: Literal["active", "completed", "abandoned"] | None = None,
):
    if storage.get_profile(DB_PATH, profile_id) is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {
        "items": storage.list_lesson_sessions(DB_PATH, profile_id=profile_id, status=status)
    }


@app.get("/api/sessions/{session_id}")
def lesson_session(session_id: str):
    session = storage.get_lesson_session(DB_PATH, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Lesson session not found")
    return session


@app.get("/api/sessions/{session_id}/attempts")
def lesson_session_attempts(session_id: str):
    if storage.get_lesson_session(DB_PATH, session_id) is None:
        raise HTTPException(status_code=404, detail="Lesson session not found")
    return {"items": storage.list_activity_attempts(DB_PATH, session_id=session_id)}


@app.post("/api/sessions/{session_id}/attempts", status_code=201)
def record_activity_attempt(session_id: str, payload: ActivityAttemptPayload):
    inferred_kind, inferred_skill = infer_activity_metadata(payload.activity_id)
    try:
        return storage.create_activity_attempt(
            DB_PATH,
            session_id=session_id,
            activity_id=payload.activity_id,
            activity_kind=payload.activity_kind or inferred_kind,
            skill=payload.skill or inferred_skill,
            score=payload.score,
            correct=payload.correct,
            duration_seconds=payload.duration_seconds,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/sessions/{session_id}/complete")
def complete_lesson_session(session_id: str):
    try:
        session = storage.complete_lesson_session(DB_PATH, session_id)
    except storage.IncompleteSessionError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "required_activities_incomplete",
                "missing_activity_ids": exc.missing_activity_ids,
            },
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if session is None:
        raise HTTPException(status_code=404, detail="Lesson session not found")
    return session


@app.get("/api/profiles/{profile_id}/dashboard")
def profile_dashboard(profile_id: str):
    dashboard = storage.get_profile_dashboard(DB_PATH, profile_id=profile_id)
    if dashboard is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return dashboard


@app.get("/api/profiles/{profile_id}/reviews/due")
def due_reviews(profile_id: str, limit: int = 20, offset: int = 0):
    if storage.get_profile(DB_PATH, profile_id) is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    try:
        items = storage.list_due_reviews(
            DB_PATH, profile_id=profile_id, limit=limit, offset=offset
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"items": items, "count": len(items)}


@app.post("/api/profiles/{profile_id}/reviews/{saved_word_id}/attempt", status_code=201)
def record_word_review(
    profile_id: str, saved_word_id: int, payload: ReviewAttemptPayload
):
    if storage.get_profile(DB_PATH, profile_id) is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    try:
        return storage.record_review_attempt(
            DB_PATH,
            profile_id=profile_id,
            saved_word_id=saved_word_id,
            rating=payload.rating,
            correct=payload.correct,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/profiles/{profile_id}/analyses")
def analysis_history(profile_id: str):
    return {"items": storage.list_analysis_history(DB_PATH, profile_id=profile_id)}


@app.get("/api/songs")
def list_songs():
    return {"items": SONGS, "total": len(SONGS)}


@app.get("/api/songs/{song_id}")
def get_song(song_id: str):
    song = next((song for song in SONGS if song["id"] == song_id), None)
    if song is None:
        raise HTTPException(status_code=404, detail="Song not found")
    return song


@app.post("/api/analyze")
def analyze_song(payload: AnalyzeRequest, http_request: Request):
    """Analyze an excerpt and optionally ask the configured web-AI provider."""
    analysis = deterministic_analysis(payload.lyrics)
    lesson = None
    provider = "heuristic"
    ai_warning = None
    ai_warning_code = None
    runtime = ai_status()

    if payload.use_ai and runtime["ready"]:
        enforce_ai_rate_limit(http_request.client.host if http_request.client else "unknown")
        try:
            generated = generate_song_lesson(
                artist=payload.artist,
                title=payload.title,
                lyrics=payload.lyrics,
            )
            lesson = generated.model_dump(by_alias=True)
            analysis.update(
                level=generated.level,
                learning_score=generated.learning_score,
                useful_words=[item.word for item in generated.words],
                slang=[item.word for item in generated.words if item.usage_register in {"slang", "vulgar", "offensive"}],
                classroom_fit=generated.classroom_fit,
            )
            provider = str(runtime["provider"])
        except Exception:
            logger.exception("Web lesson generation failed; returning deterministic analysis")
            ai_warning = "Web lesson generation was unavailable; a basic heuristic estimate was returned."
            ai_warning_code = "provider_unavailable"
    elif payload.use_ai:
        ai_warning = "Web AI is not configured; a basic heuristic estimate was returned."
        ai_warning_code = "not_configured"

    if payload.profile_id and storage.get_profile(DB_PATH, payload.profile_id) is not None:
        storage.create_analysis_history(
            DB_PATH,
            profile_id=payload.profile_id,
            artist=payload.artist,
            title=payload.title,
            interface_language=payload.interface_language,
            level=analysis["level"],
            learning_score=analysis["learning_score"],
            total_words=analysis["total_words"],
            unique_words=analysis["unique_words"],
            useful_words=analysis["useful_words"],
            slang=analysis["slang"],
            explicit_count=analysis["explicit_count"],
            classroom_fit="safe" if analysis["classroom_fit"] == "safe" else "guided",
            metadata={
                "provider": provider,
                **(
                    {"service": runtime.get("service"), "model": runtime.get("model")}
                    if provider == "web-ai"
                    else {}
                ),
            },
        )

    return {
        "status": "complete",
        "song": {"artist": payload.artist, "title": payload.title},
        "language": payload.interface_language,
        "provider": provider,
        "ai": runtime,
        "analysis": analysis,
        "lesson": lesson,
        "warning": ai_warning,
        "warning_code": ai_warning_code,
        "privacy": (
            "The submitted excerpt was not stored by SONORA. When web AI is enabled, "
            "OpenRouter and its selected model provider receive the artist, title and excerpt "
            "under their own data terms."
        ),
    }
