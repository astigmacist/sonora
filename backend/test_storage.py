"""Tests for the standard-library SQLite storage layer."""

from __future__ import annotations

import sqlite3
import tempfile
import unittest
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from backend import storage


class StorageTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_directory = tempfile.TemporaryDirectory()
        self.database = Path(self.temp_directory.name) / "sonora-test.db"
        storage.init_db(self.database)

    def tearDown(self) -> None:
        self.temp_directory.cleanup()

    def create_profile(self, profile_id: str = "learner-1") -> dict:
        return storage.create_profile(
            self.database,
            profile_id=profile_id,
            display_name="Aruzhan",
            interface_language="kk",
            current_level="B1",
            weekly_goal=6,
        )

    def test_init_is_idempotent_and_creates_expected_schema(self) -> None:
        storage.init_db(self.database)
        with closing(storage.open_connection(self.database)) as connection:
            tables = {
                row[0]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table'"
                ).fetchall()
            }
            version = connection.execute("PRAGMA user_version").fetchone()[0]
            foreign_keys = connection.execute("PRAGMA foreign_keys").fetchone()[0]

        self.assertTrue(
            {
                "profiles",
                "saved_words",
                "lesson_progress",
                "analysis_history",
                "lesson_sessions",
                "activity_attempts",
                "review_attempts",
            }
            <= tables
        )
        self.assertEqual(version, storage.SCHEMA_VERSION)
        self.assertEqual(foreign_keys, 1)

    def test_profile_crud_and_validation(self) -> None:
        profile = self.create_profile()
        self.assertEqual(profile["id"], "learner-1")
        self.assertEqual(profile["interface_language"], "kk")
        self.assertEqual(storage.get_profile(self.database, "learner-1"), profile)

        updated = storage.update_profile(
            self.database,
            "learner-1",
            interface_language="ru",
            current_level="B2",
            weekly_goal=8,
        )
        self.assertEqual(updated["interface_language"], "ru")
        self.assertEqual(updated["weekly_goal"], 8)
        self.assertEqual(len(storage.list_profiles(self.database)), 1)

        with self.assertRaises(ValueError):
            storage.update_profile(self.database, "learner-1", interface_language="de")
        self.assertTrue(storage.delete_profile(self.database, "learner-1"))
        self.assertIsNone(storage.get_profile(self.database, "learner-1"))
        self.assertFalse(storage.delete_profile(self.database, "missing"))

    def test_saved_words_crud_upsert_and_json_round_trip(self) -> None:
        profile = self.create_profile()
        word = storage.create_saved_word(
            self.database,
            profile_id=profile["id"],
            word="Fragile",
            ipa="/ˈfrædʒ.aɪl/",
            cefr="B2",
            song_id="lovely",
            meaning={"en": "easy to damage", "ru": "хрупкий", "kk": "нәзік"},
            metadata={"source": "curated"},
        )
        self.assertEqual(word["normalized_word"], "fragile")
        self.assertEqual(word["meaning"]["kk"], "нәзік")
        self.assertEqual(word["metadata"], {"source": "curated"})
        self.assertEqual(
            storage.find_saved_word(self.database, profile_id=profile["id"], word="  FRAGILE  ")["id"],
            word["id"],
        )

        enriched = storage.upsert_saved_word(
            self.database,
            profile_id=profile["id"],
            word="fragile",
            example="Be gentle with fragile things.",
            mastery_level=2,
        )
        self.assertEqual(enriched["id"], word["id"])
        self.assertEqual(enriched["example"], "Be gentle with fragile things.")
        self.assertEqual(enriched["meaning"]["ru"], "хрупкий")
        self.assertEqual(len(storage.list_saved_words(self.database, profile_id=profile["id"])), 1)

        updated = storage.update_saved_word(
            self.database,
            word["id"],
            mastery_level=4,
            review_count=3,
        )
        self.assertEqual(updated["mastery_level"], 4)
        self.assertEqual(updated["review_count"], 3)
        self.assertTrue(storage.delete_saved_word(self.database, word["id"]))
        self.assertIsNone(storage.get_saved_word(self.database, word["id"]))

    def test_duplicate_saved_word_is_rejected_by_create(self) -> None:
        profile = self.create_profile()
        storage.create_saved_word(self.database, profile_id=profile["id"], word="Gonna")
        with self.assertRaises(sqlite3.IntegrityError):
            storage.create_saved_word(self.database, profile_id=profile["id"], word="  GONNA ")

    def test_lesson_progress_create_upsert_update_and_filters(self) -> None:
        profile = self.create_profile()
        progress = storage.create_lesson_progress(
            self.database,
            profile_id=profile["id"],
            song_id="lovely",
            status="in_progress",
            progress_percent=25,
            current_step="meaning",
            time_spent_seconds=120,
        )
        self.assertEqual(progress["progress_percent"], 25)

        progressed = storage.upsert_lesson_progress(
            self.database,
            profile_id=profile["id"],
            song_id="lovely",
            status="completed",
            progress_percent=100,
            current_step="practice",
            quiz_score=92,
            time_spent_seconds=900,
        )
        self.assertEqual(progressed["id"], progress["id"])
        self.assertEqual(progressed["status"], "completed")
        self.assertIsNotNone(progressed["completed_at"])
        self.assertEqual(
            storage.list_lesson_progress(
                self.database, profile_id=profile["id"], status="completed"
            )[0]["quiz_score"],
            92,
        )

        reopened = storage.update_lesson_progress(
            self.database, progress["id"], current_step="review", time_spent_seconds=960
        )
        self.assertEqual(reopened["current_step"], "review")
        self.assertEqual(reopened["time_spent_seconds"], 960)
        self.assertTrue(storage.delete_lesson_progress(self.database, progress["id"]))

    def test_analysis_history_stores_summary_but_has_no_lyrics_column(self) -> None:
        profile = self.create_profile()
        entry = storage.create_analysis_history(
            self.database,
            profile_id=profile["id"],
            artist="Billie Eilish & Khalid",
            title="lovely",
            interface_language="ru",
            level="B1",
            learning_score=92,
            total_words=42,
            unique_words=30,
            useful_words=["fragile", "escape"],
            slang=["gonna"],
            explicit_count=0,
            classroom_fit="safe",
            metadata={"analyzer_version": 1},
        )
        self.assertEqual(entry["useful_words"], ["fragile", "escape"])
        self.assertEqual(entry["slang"], ["gonna"])
        self.assertEqual(entry["metadata"], {"analyzer_version": 1})

        with closing(storage.open_connection(self.database)) as connection:
            columns = {
                row[1] for row in connection.execute("PRAGMA table_info(analysis_history)").fetchall()
            }
        self.assertNotIn("lyrics", columns)
        self.assertNotIn("lyrics", entry)
        updated = storage.update_analysis_history(
            self.database,
            entry["id"],
            learning_score=94,
            useful_words=["fragile", "escape", "someday"],
        )
        self.assertEqual(updated["learning_score"], 94)
        self.assertEqual(updated["useful_words"][-1], "someday")
        with self.assertRaises(ValueError):
            storage.update_analysis_history(self.database, entry["id"], lyrics="private text")
        self.assertEqual(
            storage.list_analysis_history(self.database, profile_id=profile["id"])[0]["id"],
            entry["id"],
        )
        self.assertEqual(storage.clear_analysis_history(self.database, profile_id=profile["id"]), 1)
        self.assertEqual(storage.list_analysis_history(self.database, profile_id=profile["id"]), [])

    def test_deleting_profile_cascades_owned_data(self) -> None:
        profile = self.create_profile()
        storage.create_saved_word(self.database, profile_id=profile["id"], word="escape")
        storage.create_lesson_progress(
            self.database, profile_id=profile["id"], song_id="lovely", status="in_progress"
        )
        storage.create_analysis_history(
            self.database,
            profile_id=profile["id"],
            artist="Artist",
            title="Song",
            interface_language="en",
            level="A2",
            learning_score=70,
            total_words=20,
            unique_words=12,
        )

        storage.delete_profile(self.database, profile["id"])
        self.assertEqual(storage.list_saved_words(self.database, profile_id=profile["id"]), [])
        self.assertEqual(storage.list_lesson_progress(self.database, profile_id=profile["id"]), [])
        self.assertEqual(storage.list_analysis_history(self.database, profile_id=profile["id"]), [])

    def test_sessions_gate_completion_and_feed_real_dashboard_metrics(self) -> None:
        profile = self.create_profile()
        dashboard = storage.get_profile_dashboard(self.database, profile_id=profile["id"])
        self.assertEqual(
            dashboard["totals"],
            {
                "saved_words": 0,
                "mastered_words": 0,
                "learning_minutes": 0,
                "completed_lessons": 0,
                "attempts": 0,
                "first_attempt_accuracy": 0,
            },
        )
        self.assertEqual(dashboard["due_reviews"], 0)
        self.assertIsNone(dashboard["active_session"])

        required = ["meaning.gist", "vocabulary.context", "speaking.response"]
        session = storage.create_lesson_session(
            self.database,
            profile_id=profile["id"],
            song_id="lovely",
            lesson_version="test-v1",
            required_activity_ids=required,
        )
        self.assertEqual(session["progress_percent"], 0)
        with self.assertRaises(storage.IncompleteSessionError) as blocked:
            storage.complete_lesson_session(self.database, session["id"])
        self.assertEqual(blocked.exception.missing_activity_ids, required)

        first = storage.create_activity_attempt(
            self.database,
            session_id=session["id"],
            activity_id=required[0],
            activity_kind="meaning",
            skill="meaning",
            score=0.4,
            correct=False,
            duration_seconds=60,
        )
        retry = storage.create_activity_attempt(
            self.database,
            session_id=session["id"],
            activity_id=required[0],
            activity_kind="meaning",
            skill="meaning",
            score=1,
            correct=True,
            duration_seconds=20,
        )
        self.assertEqual(first["attempt"]["attempt_number"], 1)
        self.assertEqual(retry["attempt"]["attempt_number"], 2)
        self.assertEqual(retry["session"]["progress_percent"], 33)
        self.assertEqual(retry["session"]["attempt_count"], 2)

        storage.create_activity_attempt(
            self.database,
            session_id=session["id"],
            activity_id=required[1],
            activity_kind="vocabulary",
            skill="vocabulary",
            score=0.8,
            correct=True,
            duration_seconds=60,
        )
        storage.create_activity_attempt(
            self.database,
            session_id=session["id"],
            activity_id=required[2],
            activity_kind="speaking",
            skill="speaking",
            score=0.7,
            correct=True,
            duration_seconds=60,
        )
        completed = storage.complete_lesson_session(self.database, session["id"])
        self.assertEqual(completed["status"], "completed")
        self.assertEqual(completed["progress_percent"], 100)
        self.assertEqual(completed["missing_activity_ids"], [])

        dashboard = storage.get_profile_dashboard(self.database, profile_id=profile["id"])
        self.assertEqual(dashboard["totals"]["completed_lessons"], 1)
        self.assertEqual(dashboard["totals"]["attempts"], 4)
        self.assertEqual(dashboard["totals"]["first_attempt_accuracy"], 67)
        self.assertEqual(dashboard["totals"]["learning_minutes"], 3)
        self.assertIsNone(dashboard["active_session"])
        self.assertEqual({item["skill"] for item in dashboard["skills"]}, {"meaning", "vocabulary", "speaking"})

        legacy = storage.get_lesson_progress(
            self.database, profile_id=profile["id"], song_id="lovely"
        )
        self.assertEqual(legacy["status"], "completed")
        self.assertEqual(legacy["progress_percent"], 100)

        with closing(storage.open_connection(self.database)) as connection:
            columns = {
                row[1]
                for row in connection.execute("PRAGMA table_info(activity_attempts)").fetchall()
            }
        self.assertTrue({"activity_id", "score", "correct", "duration_seconds"} <= columns)
        self.assertTrue({"lyrics", "audio", "transcript", "answer_json"}.isdisjoint(columns))

    def test_session_scores_exclude_subjective_first_attempts(self) -> None:
        profile = self.create_profile()
        required = ["objective.one", "objective.two", "subjective.reflection"]
        session = storage.create_lesson_session(
            self.database,
            profile_id=profile["id"],
            song_id="score-integrity",
            lesson_version="test-v1",
            required_activity_ids=required,
        )

        storage.create_activity_attempt(
            self.database,
            session_id=session["id"],
            activity_id=required[0],
            activity_kind="checkpoint",
            skill="meaning",
            score=0.25,
            correct=False,
            duration_seconds=10,
        )
        storage.create_activity_attempt(
            self.database,
            session_id=session["id"],
            activity_id=required[1],
            activity_kind="checkpoint",
            skill="vocabulary",
            score=0.75,
            correct=True,
            duration_seconds=10,
        )
        subjective = storage.create_activity_attempt(
            self.database,
            session_id=session["id"],
            activity_id=required[2],
            activity_kind="reflection",
            skill="speaking",
            score=1,
            correct=None,
            duration_seconds=10,
        )

        self.assertEqual(subjective["session"]["first_attempt_score"], 50)
        completed = storage.complete_lesson_session(self.database, session["id"])
        self.assertEqual(completed["first_attempt_score"], 50)
        legacy = storage.get_lesson_progress(
            self.database, profile_id=profile["id"], song_id="score-integrity"
        )
        self.assertEqual(legacy["quiz_score"], 50)

    def test_changed_activity_contract_starts_a_new_session(self) -> None:
        profile = self.create_profile()
        first = storage.create_lesson_session(
            self.database,
            profile_id=profile["id"],
            song_id="generated-song",
            lesson_version="web-ai-v1",
            required_activity_ids=["generated-song:setup", "generated-song:meaning"],
        )
        resumed = storage.create_lesson_session(
            self.database,
            profile_id=profile["id"],
            song_id="generated-song",
            lesson_version="web-ai-v1",
            required_activity_ids=["generated-song:setup", "generated-song:meaning"],
        )
        self.assertEqual(resumed["id"], first["id"])

        replacement = storage.create_lesson_session(
            self.database,
            profile_id=profile["id"],
            song_id="generated-song",
            lesson_version="web-ai-v1",
            required_activity_ids=[
                "generated-song:setup",
                "generated-song:meaning",
                "generated-song:listening",
            ],
        )

        self.assertNotEqual(replacement["id"], first["id"])
        self.assertEqual(replacement["status"], "active")
        self.assertEqual(replacement["required_activity_count"], 3)
        abandoned = storage.list_lesson_sessions(
            self.database, profile_id=profile["id"], status="abandoned"
        )
        self.assertEqual([item["id"] for item in abandoned], [first["id"]])

    def test_due_review_updates_mastery_and_next_review(self) -> None:
        profile = self.create_profile()
        word = storage.create_saved_word(
            self.database,
            profile_id=profile["id"],
            word="fragile",
            mastery_level=1,
        )
        self.assertEqual(
            [item["id"] for item in storage.list_due_reviews(self.database, profile_id=profile["id"])],
            [word["id"]],
        )

        result = storage.record_review_attempt(
            self.database,
            profile_id=profile["id"],
            saved_word_id=word["id"],
            rating="good",
            correct=True,
            now=datetime(2030, 1, 1, tzinfo=timezone.utc),
        )
        self.assertEqual(result["word"]["mastery_level"], 2)
        self.assertEqual(result["word"]["review_count"], 1)
        self.assertEqual(result["word"]["next_review_at"], "2030-01-05T00:00:00.000Z")
        self.assertTrue(result["review"]["correct"])
        self.assertEqual(result["review"]["mastery_before"], 1)
        self.assertEqual(result["review"]["mastery_after"], 2)
        self.assertEqual(
            storage.list_due_reviews(self.database, profile_id=profile["id"]), []
        )


if __name__ == "__main__":
    unittest.main()
