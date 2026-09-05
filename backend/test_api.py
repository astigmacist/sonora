"""API, web-AI and legacy adapter tests that never contact a real provider."""

from __future__ import annotations

import asyncio
import importlib
import json
import os
import ssl
import tempfile
import unittest
from dataclasses import dataclass
from http.client import RemoteDisconnected
from pathlib import Path
from typing import Any
from unittest.mock import patch
from urllib import error, parse, request

from backend import ai_service, storage


@dataclass
class ASGIResponse:
    status_code: int
    headers: dict[str, str]
    content: bytes

    def json(self) -> Any:
        return json.loads(self.content.decode("utf-8"))


class ASGITestClient:
    """Tiny synchronous client for exercising the app without an httpx test dependency."""

    def __init__(self, app: Any) -> None:
        self.app = app

    def request(self, method: str, target: str, json_body: Any = None) -> ASGIResponse:
        split = parse.urlsplit(target)
        body = b"" if json_body is None else json.dumps(json_body).encode("utf-8")
        headers = [(b"host", b"testserver")]
        if json_body is not None:
            headers.extend(
                [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode("ascii")),
                ]
            )

        async def invoke() -> ASGIResponse:
            sent_request = False
            messages: list[dict[str, Any]] = []

            async def receive() -> dict[str, Any]:
                nonlocal sent_request
                if not sent_request:
                    sent_request = True
                    return {"type": "http.request", "body": body, "more_body": False}
                return {"type": "http.disconnect"}

            async def send(message: dict[str, Any]) -> None:
                messages.append(message)

            raw_path = split.path.encode("utf-8") or b"/"
            scope = {
                "type": "http",
                "asgi": {"version": "3.0", "spec_version": "2.3"},
                "http_version": "1.1",
                "scheme": "http",
                "method": method.upper(),
                "root_path": "",
                "path": parse.unquote(split.path or "/"),
                "raw_path": raw_path,
                "query_string": split.query.encode("ascii"),
                "headers": headers,
                "client": ("127.0.0.1", 50000),
                "server": ("testserver", 80),
            }
            await self.app(scope, receive, send)
            start = next(message for message in messages if message["type"] == "http.response.start")
            response_body = b"".join(
                message.get("body", b"")
                for message in messages
                if message["type"] == "http.response.body"
            )
            response_headers = {
                key.decode("latin-1"): value.decode("latin-1")
                for key, value in start.get("headers", [])
            }
            return ASGIResponse(start["status"], response_headers, response_body)

        return asyncio.run(invoke())

    def get(self, target: str) -> ASGIResponse:
        return self.request("GET", target)

    def post(self, target: str, json: Any = None) -> ASGIResponse:
        return self.request("POST", target, json)

    def put(self, target: str, json: Any = None) -> ASGIResponse:
        return self.request("PUT", target, json)

    def delete(self, target: str) -> ASGIResponse:
        return self.request("DELETE", target)


def generated_lesson_payload() -> dict[str, Any]:
    words = [
        {
            "word": "fragile",
            "pronunciation": "/ˈfrædʒ.aɪl/",
            "cefr": "B2",
            "register": "standard",
            "meaning_en": "easy to damage",
            "meaning_kk": "нәзік",
            "meaning_ru": "хрупкий",
            "example": "The old glass is fragile.",
            "recommendation": "learn_and_use",
        },
        {
            "word": "escape",
            "pronunciation": "/ɪˈskeɪp/",
            "cefr": "B1",
            "register": "standard",
            "meaning_en": "to get away",
            "meaning_kk": "қашып шығу",
            "meaning_ru": "сбежать",
            "example": "The bird escaped through a window.",
            "recommendation": "learn_and_use",
        },
        {
            "word": "gonna",
            "pronunciation": "/ˈɡənə/",
            "cefr": "A2",
            "register": "slang",
            "meaning_en": "informal going to",
            "meaning_kk": "going to тіркесінің бейресми түрі",
            "meaning_ru": "разговорная форма going to",
            "example": "I am going to call tomorrow.",
            "recommendation": "understand_only",
        },
        {
            "word": "someday",
            "pronunciation": "/ˈsʌm.deɪ/",
            "cefr": "A2",
            "register": "standard",
            "meaning_en": "at an unknown future time",
            "meaning_kk": "бір күні",
            "meaning_ru": "когда-нибудь",
            "example": "Someday I will visit the coast.",
            "recommendation": "learn_and_use",
        },
    ]
    notes = [
        {
            "song_form": "gonna",
            "standard_form": "going to",
            "note_en": "Common in casual speech.",
            "note_kk": "Күнделікті сөйлеуде жиі кездеседі.",
            "note_ru": "Часто встречается в разговорной речи.",
        },
        {
            "song_form": "wanna",
            "standard_form": "want to",
            "note_en": "Avoid it in formal writing.",
            "note_kk": "Ресми жазбада қолданбаған дұрыс.",
            "note_ru": "Не стоит использовать в формальном письме.",
        },
    ]
    return {
        "level": "B1",
        "learning_score": 91,
        "classroom_fit": "guided",
        "meaning_en": "The speaker feels trapped but still hopes to move forward.",
        "meaning_kk": "Кейіпкер өзін тұйықта сезінгенімен, алға жылжуға үміттенеді.",
        "meaning_ru": "Герой чувствует себя в ловушке, но надеется двигаться дальше.",
        "mood_en": "quiet and tense",
        "mood_kk": "тыныш әрі ширыққан",
        "mood_ru": "тихое и напряжённое",
        "cultural_context_en": "A modern pop treatment of difficult emotions.",
        "cultural_context_kk": "Күрделі сезімдерді заманауи поп тілінде жеткізу.",
        "cultural_context_ru": "Современный поп-взгляд на сложные эмоции.",
        "words": words,
        "language_notes": notes,
        "quiz": {
            "question_en": "What is the central feeling?",
            "question_kk": "Негізгі сезім қандай?",
            "question_ru": "Каково главное чувство?",
            "options_en": ["Freedom", "Feeling trapped", "Celebration"],
            "options_kk": ["Еркіндік", "Тұйықта қалу", "Мереке"],
            "options_ru": ["Свобода", "Ощущение ловушки", "Праздник"],
            "correct_index": 1,
        },
    }


class FastAPIRoutesTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        # main.py initializes its configured database during import. Point that one-time
        # side effect at a temporary location rather than the developer's local DB.
        cls.import_temp = tempfile.TemporaryDirectory()
        import_database = str(Path(cls.import_temp.name) / "import.db")
        with patch.dict(os.environ, {"SONORA_DB_PATH": import_database}):
            cls.main = importlib.import_module("backend.main")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.import_temp.cleanup()

    def setUp(self) -> None:
        self.temp_directory = tempfile.TemporaryDirectory()
        self.database = str(Path(self.temp_directory.name) / "api.db")
        storage.init_db(self.database)
        self.previous_database = self.main.DB_PATH
        self.main.DB_PATH = self.database
        self.client = ASGITestClient(self.main.app)

    def tearDown(self) -> None:
        self.main.DB_PATH = self.previous_database
        self.temp_directory.cleanup()

    def create_profile(self, name: str = "Aruzhan") -> dict[str, Any]:
        response = self.client.post(
            "/api/profiles",
            json={
                "display_name": name,
                "interface_language": "kk",
                "current_level": "B1",
                "weekly_goal": 6,
            },
        )
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()

    def analyze_payload(self, *, profile_id: str | None = None, use_ai: bool = False) -> dict[str, Any]:
        return {
            "artist": "Test Artist",
            "title": "Test Song",
            "lyrics": "I wanna escape this fragile place, but I gotta breathe again.",
            "interface_language": "kk",
            "profile_id": profile_id,
            "use_ai": use_ai,
        }

    def test_health_and_capabilities_report_mocked_qwen_readiness(self) -> None:
        status = {
            "provider": "qwen-local",
            "model": "qwen3.5:9b",
            "ready": True,
            "status": "ready",
            "local": True,
        }
        with patch.object(self.main, "ai_status", return_value=status) as ai_status:
            health = self.client.get("/api/health")
            capabilities = self.client.get("/api/capabilities")

        self.assertEqual(ai_status.call_count, 2)
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.json(), {"status": "ok", "service": "sonora-api", "ai": status})
        self.assertEqual(capabilities.status_code, 200)
        self.assertTrue(capabilities.json()["ai_lessons"])
        self.assertEqual(capabilities.json()["ai"], status)
        self.assertTrue(capabilities.json()["local_analysis"])
        self.assertFalse(capabilities.json()["lyrics_storage"])
        self.assertEqual(set(capabilities.json()["languages"]), {"en", "kk", "ru"})

    def test_deterministic_analyze_is_stable_and_does_not_require_ai(self) -> None:
        payload = self.analyze_payload(profile_id=None, use_ai=False)
        offline_status = {
            "provider": "qwen-local",
            "model": "qwen3.5:9b",
            "ready": False,
            "status": "ollama_offline",
            "local": True,
        }
        with patch.object(self.main, "ai_status", return_value=offline_status) as ai_status:
            first = self.client.post("/api/analyze", json=payload)
            second = self.client.post("/api/analyze", json=payload)

        self.assertEqual(ai_status.call_count, 2)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.json(), second.json())
        result = first.json()
        self.assertEqual(result["provider"], "heuristic")
        self.assertEqual(result["ai"], offline_status)
        self.assertIsNone(result["lesson"])
        self.assertIsNone(result["warning"])
        self.assertIsNone(result["warning_code"])
        self.assertEqual(result["analysis"], self.main.deterministic_analysis(payload["lyrics"]))
        self.assertEqual(result["analysis"]["slang"], ["gotta", "wanna"])
        self.assertIn("not stored", result["privacy"])

    def test_create_profile_with_explicit_id_is_idempotent(self) -> None:
        payload = {
            "profile_id": "idempotent-profile-001",
            "display_name": "Aruzhan",
            "interface_language": "kk",
            "current_level": "B1",
            "weekly_goal": 6,
        }

        first = self.client.post("/api/profiles", json=payload)
        second = self.client.post("/api/profiles", json=payload)

        self.assertEqual(first.status_code, 201, first.content)
        self.assertEqual(second.status_code, 201, second.content)
        self.assertEqual(second.json(), first.json())
        profiles = storage.list_profiles(self.database)
        self.assertEqual(len(profiles), 1)
        self.assertEqual(profiles[0]["id"], payload["profile_id"])

    def test_profile_words_and_progress_persist_across_requests(self) -> None:
        profile = self.create_profile()
        profile_id = profile["id"]
        fetched = self.client.get(f"/api/profiles/{profile_id}")
        self.assertEqual(fetched.status_code, 200)
        self.assertEqual(fetched.json()["display_name"], "Aruzhan")

        saved = self.client.post(
            f"/api/profiles/{profile_id}/words",
            json={
                "word": "Fragile",
                "ipa": "/ˈfrædʒ.aɪl/",
                "cefr": "B2",
                "word_type": "standard",
                "song_id": "lovely",
                "meaning": {"en": "easy to damage", "kk": "нәзік", "ru": "хрупкий"},
            },
        )
        self.assertEqual(saved.status_code, 200)
        saved_word_id = saved.json()["id"]

        enriched = self.client.post(
            f"/api/profiles/{profile_id}/words",
            json={"word": "  FRAGILE  ", "example": "The old glass is fragile.", "mastery_level": 2},
        )
        self.assertEqual(enriched.status_code, 200)
        self.assertEqual(enriched.json()["id"], saved_word_id)
        self.assertEqual(enriched.json()["meaning"]["kk"], "нәзік")

        progress = self.client.put(
            f"/api/profiles/{profile_id}/progress/lovely",
            json={
                "status": "in_progress",
                "progress_percent": 50,
                "current_step": "vocabulary",
                "time_spent_seconds": 360,
            },
        )
        self.assertEqual(progress.status_code, 200)
        completed = self.client.put(
            f"/api/profiles/{profile_id}/progress/lovely",
            json={
                "status": "completed",
                "progress_percent": 100,
                "current_step": "practice",
                "quiz_score": 92,
                "time_spent_seconds": 900,
            },
        )
        self.assertEqual(completed.status_code, 200)

        # A fresh ASGI client still reads records written through earlier requests.
        fresh_client = ASGITestClient(self.main.app)
        words = fresh_client.get(f"/api/profiles/{profile_id}/words")
        progress_items = fresh_client.get(f"/api/profiles/{profile_id}/progress")
        self.assertEqual(len(words.json()["items"]), 1)
        self.assertEqual(words.json()["items"][0]["example"], "The old glass is fragile.")
        self.assertEqual(len(progress_items.json()["items"]), 1)
        self.assertEqual(progress_items.json()["items"][0]["status"], "completed")
        self.assertEqual(progress_items.json()["items"][0]["quiz_score"], 92)
        self.assertIsNotNone(progress_items.json()["items"][0]["completed_at"])

    def test_session_attempt_completion_gating_and_dashboard_contract(self) -> None:
        profile = self.create_profile()
        profile_id = profile["id"]
        empty_dashboard = self.client.get(f"/api/profiles/{profile_id}/dashboard")
        self.assertEqual(empty_dashboard.status_code, 200)
        self.assertEqual(empty_dashboard.json()["totals"]["completed_lessons"], 0)
        self.assertEqual(empty_dashboard.json()["totals"]["attempts"], 0)
        self.assertEqual(empty_dashboard.json()["totals"]["first_attempt_accuracy"], 0)

        required = [
            "meaning.gist",
            "vocabulary.context",
            "listening.gist",
            "speaking.response",
        ]
        started = self.client.post(
            f"/api/profiles/{profile_id}/sessions",
            json={
                "songId": "lovely",
                "lessonVersion": "api-test-v1",
                "requiredActivityIds": required,
            },
        )
        self.assertEqual(started.status_code, 201, started.content)
        session = started.json()
        session_id = session["id"]
        self.assertEqual(session["required_activity_ids"], required)
        self.assertEqual(session["progress_percent"], 0)

        blocked = self.client.post(f"/api/sessions/{session_id}/complete")
        self.assertEqual(blocked.status_code, 409)
        self.assertEqual(
            blocked.json()["detail"],
            {"code": "required_activities_incomplete", "missing_activity_ids": required},
        )

        private_text = "This full speaking transcript must never be persisted."
        attempts = [
            (required[0], 0.2, False, 40),
            (required[0], 1.0, True, 10),
            (required[1], 0.8, True, 50),
            (required[2], 0.9, True, 60),
            (required[3], 0.7, True, 80),
        ]
        for activity_id, score, correct, duration in attempts:
            response = self.client.post(
                f"/api/sessions/{session_id}/attempts",
                json={
                    "activityId": activity_id,
                    "score": score,
                    "correct": correct,
                    "durationSeconds": duration,
                    "response": {"transcript": private_text},
                    "now": "2030-01-01T00:00:00.000Z",
                },
            )
            self.assertEqual(response.status_code, 201, response.content)
            self.assertNotIn(private_text, response.content.decode("utf-8"))

        rejected_private_field = self.client.post(
            f"/api/sessions/{session_id}/attempts",
            json={"activityId": "extra", "score": 1, "lyrics": "must not be accepted"},
        )
        self.assertEqual(rejected_private_field.status_code, 422)

        attempts_response = self.client.get(f"/api/sessions/{session_id}/attempts")
        self.assertEqual(attempts_response.status_code, 200)
        self.assertEqual(len(attempts_response.json()["items"]), 5)
        self.assertNotIn(private_text, attempts_response.content.decode("utf-8"))
        self.assertEqual(attempts_response.json()["items"][0]["attempt_number"], 1)
        self.assertEqual(attempts_response.json()["items"][1]["attempt_number"], 2)

        completed = self.client.post(f"/api/sessions/{session_id}/complete")
        self.assertEqual(completed.status_code, 200, completed.content)
        self.assertEqual(completed.json()["status"], "completed")
        self.assertEqual(completed.json()["progress_percent"], 100)

        fresh_client = ASGITestClient(self.main.app)
        dashboard = fresh_client.get(f"/api/profiles/{profile_id}/dashboard")
        self.assertEqual(dashboard.status_code, 200)
        totals = dashboard.json()["totals"]
        self.assertEqual(totals["completed_lessons"], 1)
        self.assertEqual(totals["attempts"], 5)
        self.assertEqual(totals["first_attempt_accuracy"], 75)
        self.assertEqual(totals["learning_minutes"], 4)
        self.assertIsNone(dashboard.json()["active_session"])

    def test_review_due_and_attempt_endpoints_update_schedule(self) -> None:
        profile = self.create_profile()
        profile_id = profile["id"]
        saved = self.client.post(
            f"/api/profiles/{profile_id}/words",
            json={"word": "fragile", "mastery_level": 0},
        )
        self.assertEqual(saved.status_code, 200)
        saved_word_id = saved.json()["id"]

        due = self.client.get(f"/api/profiles/{profile_id}/reviews/due")
        self.assertEqual(due.status_code, 200)
        self.assertEqual(due.json()["count"], 1)
        self.assertEqual(due.json()["items"][0]["id"], saved_word_id)

        reviewed = self.client.post(
            f"/api/profiles/{profile_id}/reviews/{saved_word_id}/attempt",
            json={"rating": "good", "correct": True},
        )
        self.assertEqual(reviewed.status_code, 201, reviewed.content)
        self.assertEqual(reviewed.json()["word"]["mastery_level"], 1)
        self.assertEqual(reviewed.json()["word"]["review_count"], 1)
        self.assertIsNotNone(reviewed.json()["word"]["next_review_at"])
        self.assertEqual(reviewed.json()["review"]["rating"], "good")

        due_after = self.client.get(f"/api/profiles/{profile_id}/reviews/due")
        self.assertEqual(due_after.status_code, 200)
        self.assertEqual(due_after.json(), {"items": [], "count": 0})
        dashboard = self.client.get(f"/api/profiles/{profile_id}/dashboard")
        self.assertEqual(dashboard.json()["totals"]["saved_words"], 1)
        self.assertEqual(dashboard.json()["due_reviews"], 0)

    def test_structured_web_ai_result_is_returned_and_summary_is_persisted(self) -> None:
        profile = self.create_profile()
        generated = ai_service.GeneratedSongLesson.model_validate(generated_lesson_payload())
        payload = self.analyze_payload(profile_id=profile["id"], use_ai=True)
        ready_status = {
            "provider": "web-ai",
            "service": "openrouter",
            "model": "minimax/minimax-m3:free",
            "ready": True,
            "status": "ready",
            "local": False,
        }

        with (
            patch.object(self.main, "ai_status", return_value=ready_status) as ai_status,
            patch.object(self.main, "generate_song_lesson", return_value=generated) as generate,
        ):
            response = self.client.post("/api/analyze", json=payload)

        self.assertEqual(response.status_code, 200)
        ai_status.assert_called_once_with()
        generate.assert_called_once_with(
            artist=payload["artist"], title=payload["title"], lyrics=payload["lyrics"]
        )
        result = response.json()
        self.assertEqual(result["provider"], "web-ai")
        self.assertEqual(result["ai"], ready_status)
        self.assertEqual(result["analysis"]["learning_score"], 91)
        self.assertEqual(result["analysis"]["slang"], ["gonna"])
        self.assertEqual(result["lesson"]["meaning_kk"], generated.meaning_kk)
        self.assertEqual(len(result["lesson"]["words"]), 4)

        history = self.client.get(f"/api/profiles/{profile['id']}/analyses")
        self.assertEqual(history.status_code, 200)
        entries = history.json()["items"]
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["metadata"], {
            "provider": "web-ai",
            "service": "openrouter",
            "model": "minimax/minimax-m3:free",
        })
        self.assertNotIn("lyrics", entries[0])
        self.assertNotIn(payload["lyrics"], json.dumps(entries[0], ensure_ascii=False))

    def test_web_ai_exception_falls_back_to_heuristic_analysis(self) -> None:
        payload = self.analyze_payload(profile_id=None, use_ai=True)
        ready_status = {
            "provider": "web-ai",
            "service": "openrouter",
            "model": "minimax/minimax-m3:free",
            "ready": True,
            "status": "ready",
            "local": False,
        }
        with (
            patch.object(self.main, "ai_status", return_value=ready_status) as ai_status,
            patch.object(
                self.main, "generate_song_lesson", side_effect=RuntimeError("mocked provider failure")
            ),
            self.assertLogs("sonora.api", level="ERROR"),
        ):
            response = self.client.post("/api/analyze", json=payload)

        self.assertEqual(response.status_code, 200)
        ai_status.assert_called_once_with()
        result = response.json()
        self.assertEqual(result["provider"], "heuristic")
        self.assertEqual(result["ai"], ready_status)
        self.assertIsNone(result["lesson"])
        self.assertEqual(result["analysis"], self.main.deterministic_analysis(payload["lyrics"]))
        self.assertIn("heuristic estimate", result["warning"])
        self.assertEqual(result["warning_code"], "provider_unavailable")

    def test_analyze_rejects_oversized_excerpt(self) -> None:
        payload = self.analyze_payload(use_ai=False)
        payload["lyrics"] = "a" * 1601
        response = self.client.post("/api/analyze", json=payload)
        self.assertEqual(response.status_code, 422)

    def test_web_ai_rate_limit_protects_server_side_key(self) -> None:
        generated = ai_service.GeneratedSongLesson.model_validate(generated_lesson_payload())
        payload = self.analyze_payload(use_ai=True)
        ready_status = {
            "provider": "web-ai",
            "service": "openrouter",
            "model": "minimax/minimax-m3:free",
            "ready": True,
            "status": "ready",
            "local": False,
        }
        self.main._ai_usage_by_client.clear()
        self.main._ai_usage_global.clear()
        with (
            patch.dict(os.environ, {"SONORA_AI_REQUESTS_PER_HOUR": "1", "SONORA_AI_REQUESTS_PER_DAY": "2"}),
            patch.object(self.main, "ai_status", return_value=ready_status),
            patch.object(self.main, "generate_song_lesson", return_value=generated),
        ):
            first = self.client.post("/api/analyze", json=payload)
            second = self.client.post("/api/analyze", json=payload)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 429)
        self.assertNotIn("API", second.json()["detail"])
        self.main._ai_usage_by_client.clear()
        self.main._ai_usage_global.clear()


class FakeHTTPResponse:
    def __init__(self, payload: dict[str, Any]) -> None:
        self.payload = payload

    def __enter__(self) -> "FakeHTTPResponse":
        return self

    def __exit__(self, *args: Any) -> None:
        return None

    def read(self, _size: int = -1) -> bytes:
        return json.dumps(self.payload, ensure_ascii=False).encode("utf-8")


class QwenAdapterTestCase(unittest.TestCase):
    def test_structured_generation_uses_mocked_ollama_responses(self) -> None:
        lesson_payload = generated_lesson_payload()
        captured_chat_payload: dict[str, Any] = {}

        def mocked_urlopen(target: str | request.Request, timeout: float) -> FakeHTTPResponse:
            if isinstance(target, str):
                self.assertTrue(target.endswith("/api/tags"))
                self.assertEqual(timeout, 0.8)
                return FakeHTTPResponse({"models": [{"name": "qwen3.5:9b"}]})

            self.assertTrue(target.full_url.endswith("/api/chat"))
            self.assertEqual(timeout, 2.5)
            captured_chat_payload.update(json.loads(target.data.decode("utf-8")))
            return FakeHTTPResponse(
                {"message": {"content": json.dumps(lesson_payload, ensure_ascii=False)}}
            )

        with (
            patch.dict(
                os.environ,
                {
                    "SONORA_AI_ENABLED": "true",
                    "SONORA_AI_PROVIDER": "ollama",
                    "OLLAMA_HOST": "http://127.0.0.1:11434/",
                    "SONORA_QWEN_MODEL": "qwen3.5:9b",
                    "SONORA_AI_TIMEOUT": "2.5",
                },
            ),
            patch.object(ai_service.request, "urlopen", side_effect=mocked_urlopen) as urlopen,
        ):
            lesson = ai_service.generate_song_lesson(
                artist="Test Artist",
                title="Test Song",
                lyrics="A private excerpt long enough for structured language analysis.",
            )

        self.assertEqual(urlopen.call_count, 2)
        self.assertEqual(lesson.level, "B1")
        self.assertEqual(lesson.learning_score, 91)
        self.assertEqual(lesson.words[2].usage_register, "slang")
        self.assertEqual(captured_chat_payload["model"], "qwen3.5:9b")
        self.assertFalse(captured_chat_payload["stream"])
        self.assertFalse(captured_chat_payload["think"])
        self.assertEqual(captured_chat_payload["options"], {"temperature": 0.2})
        self.assertIsInstance(captured_chat_payload["format"], dict)
        self.assertIn("Return JSON matching this schema", captured_chat_payload["messages"][1]["content"])

    def test_ai_status_reports_offline_when_ollama_fails(self) -> None:
        with (
            patch.dict(os.environ, {"SONORA_AI_ENABLED": "true", "SONORA_AI_PROVIDER": "ollama"}),
            patch.object(
                ai_service.request,
                "urlopen",
                side_effect=error.URLError("mocked connection refused"),
            ),
        ):
            status = ai_service.ai_status()

        self.assertFalse(status["ready"])
        self.assertEqual(status["provider"], "qwen-local")
        self.assertEqual(status["status"], "ollama_offline")
        self.assertTrue(status["local"])

    def test_ai_status_requires_exact_requested_model_tag(self) -> None:
        """An installed 4b variant must not satisfy a configured 9b model."""

        with (
            patch.dict(
                os.environ,
                {
                    "SONORA_AI_ENABLED": "true",
                    "SONORA_AI_PROVIDER": "ollama",
                    "OLLAMA_HOST": "http://127.0.0.1:11434",
                    "SONORA_QWEN_MODEL": "qwen3.5:9b",
                },
            ),
            patch.object(
                ai_service.request,
                "urlopen",
                return_value=FakeHTTPResponse({"models": [{"name": "qwen3.5:4b"}]}),
            ) as urlopen,
        ):
            status = ai_service.ai_status()

        urlopen.assert_called_once_with("http://127.0.0.1:11434/api/tags", timeout=0.8)
        self.assertFalse(status["ready"])
        self.assertEqual(status["status"], "model_missing")
        self.assertEqual(status["model"], "qwen3.5:9b")
        self.assertTrue(status["local"])

    def test_web_status_is_disabled_by_default_and_requires_a_server_key(self) -> None:
        with patch.dict(
            os.environ,
            {
                "SONORA_AI_ENABLED": "false",
                "SONORA_AI_PROVIDER": "openrouter",
                "SONORA_AI_MODEL": "minimax/minimax-m3:free",
                "SONORA_AI_API_KEY": "",
                "DASHSCOPE_API_KEY": "",
                "OPENROUTER_API_KEY": "",
            },
        ):
            disabled = ai_service.ai_status()
        self.assertFalse(disabled["ready"])
        self.assertEqual(disabled["provider"], "web-ai")
        self.assertEqual(disabled["status"], "disabled")
        self.assertFalse(disabled["local"])

        with patch.dict(
            os.environ,
            {
                "SONORA_AI_ENABLED": "true",
                "SONORA_AI_PROVIDER": "openrouter",
                "SONORA_AI_MODEL": "minimax/minimax-m3:free",
                "SONORA_AI_API_KEY": "",
                "DASHSCOPE_API_KEY": "",
                "OPENROUTER_API_KEY": "",
            },
        ):
            missing = ai_service.ai_status()
        self.assertFalse(missing["ready"])
        self.assertEqual(missing["status"], "api_key_missing")
        self.assertEqual(missing["model"], "minimax/minimax-m3:free")

    def test_web_status_rejects_insecure_base_url(self) -> None:
        with patch.dict(
            os.environ,
            {
                "SONORA_AI_ENABLED": "true",
                "SONORA_AI_PROVIDER": "openrouter",
                "SONORA_AI_BASE_URL": "http://openrouter.ai/api/v1",
                "SONORA_AI_API_KEY": "secret-test-key",
            },
        ):
            status = ai_service.ai_status()

        self.assertFalse(status["ready"])
        self.assertEqual(status["status"], "invalid_base_url")

    def test_web_generation_uses_openai_compatible_request_without_exposing_key(self) -> None:
        lesson_payload = generated_lesson_payload()
        captured: dict[str, Any] = {}

        def mocked_urlopen(
            target: request.Request,
            timeout: float,
            context: ssl.SSLContext,
        ) -> FakeHTTPResponse:
            self.assertIsInstance(target, request.Request)
            captured["url"] = target.full_url
            captured["headers"] = dict(target.header_items())
            captured["payload"] = json.loads(target.data.decode("utf-8"))
            captured["timeout"] = timeout
            captured["ssl_context"] = context
            return FakeHTTPResponse({
                "choices": [{"message": {"content": f"```json\n{json.dumps(lesson_payload, ensure_ascii=False)}\n```"}}]
            })

        with (
            patch.dict(
                os.environ,
                {
                    "SONORA_AI_ENABLED": "true",
                    "SONORA_AI_PROVIDER": "openrouter",
                    "SONORA_AI_BASE_URL": "https://openrouter.ai/api/v1",
                    "SONORA_AI_MODEL": "minimax/minimax-m3:free",
                    "SONORA_AI_API_KEY": "secret-test-key",
                    "SONORA_AI_TIMEOUT": "3.5",
                    "SONORA_SITE_URL": "https://sonora.example\n",
                },
            ),
            patch.object(ai_service.request, "urlopen", side_effect=mocked_urlopen) as urlopen,
        ):
            lesson = ai_service.generate_song_lesson(
                artist="Test Artist",
                title="Test Song",
                lyrics="A private excerpt long enough for structured language analysis.",
            )

        urlopen.assert_called_once()
        self.assertEqual(captured["url"], "https://openrouter.ai/api/v1/chat/completions")
        self.assertEqual(captured["timeout"], 3.5)
        self.assertEqual(captured["payload"]["model"], "minimax/minimax-m3:free")
        self.assertEqual(captured["payload"]["response_format"], {"type": "json_object"})
        self.assertEqual(captured["payload"]["max_tokens"], 3500)
        self.assertEqual(captured["payload"]["reasoning"], {"effort": "none", "exclude": True})
        self.assertEqual(captured["payload"]["provider"], {"require_parameters": True})
        self.assertIn(
            "Return JSON matching this schema exactly",
            captured["payload"]["messages"][1]["content"],
        )
        self.assertNotIn("enable_thinking", captured["payload"])
        self.assertEqual(captured["headers"]["Authorization"], "Bearer secret-test-key")
        self.assertEqual(captured["headers"]["Http-referer"], "https://sonora.example")
        self.assertEqual(captured["headers"]["X-openrouter-title"], "SONORA")
        self.assertNotIn("secret-test-key", json.dumps(captured["payload"]))
        self.assertIsInstance(captured["ssl_context"], ssl.SSLContext)
        self.assertTrue(captured["ssl_context"].check_hostname)
        self.assertEqual(captured["ssl_context"].verify_mode, ssl.CERT_REQUIRED)
        self.assertEqual(lesson.learning_score, 91)

    def test_strict_json_schema_is_limited_to_explicit_model_allowlist(self) -> None:
        schema = {"type": "object", "properties": {"level": {"type": "string"}}}

        generic_format = ai_service._web_response_format(
            provider="openrouter",
            model="minimax/minimax-m3:free",
            schema=schema,
        )
        strict_format = ai_service._web_response_format(
            provider="openrouter",
            model="z-ai/glm-5.2:free",
            schema=schema,
        )

        self.assertEqual(generic_format, {"type": "json_object"})
        self.assertEqual(strict_format["type"], "json_schema")
        self.assertTrue(strict_format["json_schema"]["strict"])
        self.assertIs(strict_format["json_schema"]["schema"], schema)

    def test_openrouter_retries_once_with_free_router_on_404_and_429(self) -> None:
        lesson_payload = generated_lesson_payload()
        for retry_status in (404, 429):
            with self.subTest(status=retry_status):
                attempted_payloads: list[dict[str, Any]] = []

                def mocked_urlopen(
                    target: request.Request,
                    timeout: float,
                    context: ssl.SSLContext,
                ) -> FakeHTTPResponse:
                    del timeout, context
                    attempted_payloads.append(json.loads(target.data.decode("utf-8")))
                    if len(attempted_payloads) == 1:
                        raise error.HTTPError(
                            target.full_url,
                            retry_status,
                            "private upstream detail",
                            {},
                            None,
                        )
                    return FakeHTTPResponse({
                        "choices": [{"message": {"content": json.dumps(lesson_payload)}}]
                    })

                with (
                    patch.dict(
                        os.environ,
                        {
                            "SONORA_AI_ENABLED": "true",
                            "SONORA_AI_PROVIDER": "openrouter",
                            "SONORA_AI_BASE_URL": "https://openrouter.ai/api/v1",
                            "SONORA_AI_MODEL": "minimax/minimax-m3:free",
                            "SONORA_AI_API_KEY": "secret-test-key",
                        },
                    ),
                    patch.object(
                        ai_service.request,
                        "urlopen",
                        side_effect=mocked_urlopen,
                    ) as urlopen,
                ):
                    lesson = ai_service.generate_song_lesson(
                        artist="Test Artist",
                        title="Test Song",
                        lyrics="A private excerpt long enough for structured language analysis.",
                    )

                self.assertEqual(urlopen.call_count, 2)
                self.assertEqual(
                    [payload["model"] for payload in attempted_payloads],
                    ["minimax/minimax-m3:free", "openrouter/free"],
                )
                self.assertEqual(
                    attempted_payloads[1]["response_format"],
                    {"type": "json_object"},
                )
                self.assertEqual(lesson.learning_score, 91)

    def test_openrouter_uses_free_router_after_remote_disconnect(self) -> None:
        lesson_payload = generated_lesson_payload()
        attempted_models: list[str] = []

        def mocked_urlopen(
            target: request.Request,
            timeout: float,
            context: ssl.SSLContext,
        ) -> FakeHTTPResponse:
            del timeout, context
            attempted_models.append(json.loads(target.data.decode("utf-8"))["model"])
            if len(attempted_models) == 1:
                raise RemoteDisconnected("private transient detail")
            return FakeHTTPResponse({
                "choices": [{"message": {"content": json.dumps(lesson_payload)}}]
            })

        with (
            patch.dict(
                os.environ,
                {
                    "SONORA_AI_ENABLED": "true",
                    "SONORA_AI_PROVIDER": "openrouter",
                    "SONORA_AI_BASE_URL": "https://openrouter.ai/api/v1",
                    "SONORA_AI_MODEL": "minimax/minimax-m3:free",
                    "SONORA_AI_API_KEY": "secret-test-key",
                },
            ),
            patch.object(
                ai_service.request,
                "urlopen",
                side_effect=mocked_urlopen,
            ) as urlopen,
        ):
            lesson = ai_service.generate_song_lesson(
                artist="Test Artist",
                title="Test Song",
                lyrics="A private excerpt long enough for structured language analysis.",
            )

        self.assertEqual(urlopen.call_count, 2)
        self.assertEqual(
            attempted_models,
            ["minimax/minimax-m3:free", "openrouter/free"],
        )
        self.assertEqual(lesson.learning_score, 91)

    def test_openrouter_does_not_retry_auth_failures(self) -> None:
        for auth_status in (401, 403):
            with self.subTest(status=auth_status):
                upstream_error = error.HTTPError(
                    "https://openrouter.ai/api/v1/chat/completions",
                    auth_status,
                    "private upstream detail",
                    {},
                    None,
                )
                with (
                    patch.dict(
                        os.environ,
                        {
                            "SONORA_AI_ENABLED": "true",
                            "SONORA_AI_PROVIDER": "openrouter",
                            "SONORA_AI_BASE_URL": "https://openrouter.ai/api/v1",
                            "SONORA_AI_MODEL": "minimax/minimax-m3:free",
                            "SONORA_AI_API_KEY": "secret-test-key",
                        },
                    ),
                    patch.object(
                        ai_service.request,
                        "urlopen",
                        side_effect=upstream_error,
                    ) as urlopen,
                ):
                    with self.assertRaises(RuntimeError) as raised:
                        ai_service.generate_song_lesson(
                            artist="Test Artist",
                            title="Test Song",
                            lyrics="A private excerpt long enough for structured language analysis.",
                        )

                self.assertEqual(urlopen.call_count, 1)
                self.assertEqual(
                    str(raised.exception),
                    f"Web AI request failed with HTTP {auth_status}",
                )
                self.assertNotIn("private upstream detail", str(raised.exception))
                self.assertNotIn("secret-test-key", str(raised.exception))

    def test_openrouter_retry_surfaces_final_http_status_and_stops(self) -> None:
        endpoint = "https://openrouter.ai/api/v1/chat/completions"
        with (
            patch.dict(
                os.environ,
                {
                    "SONORA_AI_ENABLED": "true",
                    "SONORA_AI_PROVIDER": "openrouter",
                    "SONORA_AI_BASE_URL": "https://openrouter.ai/api/v1",
                    "SONORA_AI_MODEL": "minimax/minimax-m3:free",
                    "SONORA_AI_API_KEY": "secret-test-key",
                },
            ),
            patch.object(
                ai_service.request,
                "urlopen",
                side_effect=[
                    error.HTTPError(endpoint, 429, "private first error", {}, None),
                    error.HTTPError(endpoint, 503, "private final error", {}, None),
                ],
            ) as urlopen,
        ):
            with self.assertRaises(RuntimeError) as raised:
                ai_service.generate_song_lesson(
                    artist="Test Artist",
                    title="Test Song",
                    lyrics="A private excerpt long enough for structured language analysis.",
                )

        self.assertEqual(urlopen.call_count, 2)
        self.assertEqual(str(raised.exception), "Web AI request failed with HTTP 503")
        self.assertNotIn("private", str(raised.exception))
        self.assertNotIn("secret-test-key", str(raised.exception))

    def test_openrouter_recovers_once_when_first_lesson_json_is_invalid(self) -> None:
        lesson_payload = generated_lesson_payload()
        attempted_payloads: list[dict[str, Any]] = []
        invalid_lesson = '{"level":"B1","private_marker":"must-not-be-reused"}'

        def mocked_urlopen(
            target: request.Request,
            timeout: float,
            context: ssl.SSLContext,
        ) -> FakeHTTPResponse:
            del timeout, context
            attempted_payloads.append(json.loads(target.data.decode("utf-8")))
            content = invalid_lesson if len(attempted_payloads) == 1 else json.dumps(lesson_payload)
            return FakeHTTPResponse({"choices": [{"message": {"content": content}}]})

        with (
            patch.dict(
                os.environ,
                {
                    "SONORA_AI_ENABLED": "true",
                    "SONORA_AI_PROVIDER": "openrouter",
                    "SONORA_AI_BASE_URL": "https://openrouter.ai/api/v1",
                    "SONORA_AI_MODEL": "minimax/minimax-m3:free",
                    "SONORA_AI_API_KEY": "secret-test-key",
                },
            ),
            patch.object(
                ai_service.request,
                "urlopen",
                side_effect=mocked_urlopen,
            ) as urlopen,
        ):
            lesson = ai_service.generate_song_lesson(
                artist="Test Artist",
                title="Test Song",
                lyrics="A private excerpt long enough for structured language analysis.",
            )

        self.assertEqual(urlopen.call_count, 2)
        self.assertEqual(
            [payload["model"] for payload in attempted_payloads],
            ["minimax/minimax-m3:free", "openrouter/free"],
        )
        self.assertEqual(attempted_payloads[1]["messages"], attempted_payloads[0]["messages"])
        self.assertNotIn(invalid_lesson, json.dumps(attempted_payloads[1]))
        self.assertNotIn("secret-test-key", json.dumps(attempted_payloads[1]))
        self.assertEqual(lesson.learning_score, 91)

    def test_openrouter_invalid_lesson_json_twice_stops_with_safe_error(self) -> None:
        malformed_outputs = iter([
            "private-malformed-output-one",
            '{"level":"B1","private_marker":"malformed-output-two"}',
        ])
        attempted_models: list[str] = []

        def mocked_urlopen(
            target: request.Request,
            timeout: float,
            context: ssl.SSLContext,
        ) -> FakeHTTPResponse:
            del timeout, context
            payload = json.loads(target.data.decode("utf-8"))
            attempted_models.append(payload["model"])
            return FakeHTTPResponse({
                "choices": [{"message": {"content": next(malformed_outputs)}}]
            })

        with (
            patch.dict(
                os.environ,
                {
                    "SONORA_AI_ENABLED": "true",
                    "SONORA_AI_PROVIDER": "openrouter",
                    "SONORA_AI_BASE_URL": "https://openrouter.ai/api/v1",
                    "SONORA_AI_MODEL": "minimax/minimax-m3:free",
                    "SONORA_AI_API_KEY": "secret-test-key",
                },
            ),
            patch.object(
                ai_service.request,
                "urlopen",
                side_effect=mocked_urlopen,
            ) as urlopen,
        ):
            with self.assertRaises(RuntimeError) as raised:
                ai_service.generate_song_lesson(
                    artist="Test Artist",
                    title="Test Song",
                    lyrics="A private excerpt long enough for structured language analysis.",
                )

        self.assertEqual(urlopen.call_count, 2)
        self.assertEqual(
            attempted_models,
            ["minimax/minimax-m3:free", "openrouter/free"],
        )
        self.assertEqual(
            str(raised.exception),
            "Web AI returned invalid lesson JSON after one recovery attempt",
        )
        self.assertNotIn("private-malformed-output", str(raised.exception))
        self.assertNotIn("secret-test-key", str(raised.exception))
        self.assertTrue(raised.exception.__suppress_context__)

    def test_web_generation_builds_ssl_context_from_certifi_bundle(self) -> None:
        lesson_payload = generated_lesson_payload()
        verified_context = object()

        with (
            patch.dict(
                os.environ,
                {
                    "SONORA_AI_ENABLED": "true",
                    "SONORA_AI_PROVIDER": "openrouter",
                    "SONORA_AI_BASE_URL": "https://openrouter.ai/api/v1",
                    "SONORA_AI_MODEL": "minimax/minimax-m3:free",
                    "SONORA_AI_API_KEY": "secret-test-key",
                },
            ),
            patch.object(
                ai_service.ssl,
                "create_default_context",
                return_value=verified_context,
            ) as create_context,
            patch.object(
                ai_service.request,
                "urlopen",
                return_value=FakeHTTPResponse({
                    "choices": [{"message": {"content": json.dumps(lesson_payload, ensure_ascii=False)}}]
                }),
            ) as urlopen,
        ):
            lesson = ai_service.generate_song_lesson(
                artist="Test Artist",
                title="Test Song",
                lyrics="A private excerpt long enough for structured language analysis.",
            )

        create_context.assert_called_once_with(cafile=ai_service.certifi.where())
        self.assertIs(urlopen.call_args.kwargs["context"], verified_context)
        self.assertEqual(lesson.learning_score, 91)


if __name__ == "__main__":
    unittest.main()
