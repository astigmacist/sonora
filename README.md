# SONORA

SONORA is a three-language web platform for learning English through popular songs. The interface works in English, Kazakh and Russian and combines curated song lessons, meaning and cultural context, vocabulary, slang and register notes, quizzes, speaking practice, persistent progress, a private lyrics analyzer and a research workspace for the Daryn project.

## What is implemented

- Six curated song lessons with meaning, context, vocabulary, idioms and grammar.
- English/Kazakh/Russian interface and lesson explanations.
- Private analysis of a user-provided short excerpt.
- Optional web-generated lessons with the free MiniMax M3 model through OpenRouter.
- Deterministic fallback when the web API is disabled, unavailable or out of quota.
- Saved words, lesson progress and derived analysis history in SQLite.
- A teacher/research workspace with pre-test/post-test views, cohort comparison, methodology and CSV export.

## Quick start

### 1. Frontend

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

### 2. Python API

In a second terminal, from the project root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8765
```

After the environment has been created, the API can also be started with:

```bash
npm run api
```

Useful local URLs:

- Frontend: `http://localhost:5173`
- API health: `http://localhost:8765/api/health`
- API capabilities: `http://localhost:8765/api/capabilities`
- Interactive API docs: `http://localhost:8765/docs`

The frontend works without the Python API, but the API is required for SQLite persistence and AI-generated lesson data.

## Web AI: free MiniMax M3 through OpenRouter

SONORA does not run a large model on the learner's computer. The default is `minimax/minimax-m3:free` through OpenRouter's OpenAI-compatible API. It requires one OpenRouter key, with no local model, cloud workspace, region or payment setup.

OpenRouter currently lists this endpoint at zero cost for prompt and completion tokens and confirms JSON-output support. SONORA validates the returned lesson against its own strict schema before using it. The free account tier is limited to 50 model requests per day; SONORA keeps its own lower 40-request daily ceiling to protect the key. Free availability can change, so this setup is appropriate for the project demo and study pilot rather than a high-traffic production service.

Official setup pages:

- [Create an OpenRouter key](https://openrouter.ai/settings/keys)
- [MiniMax M3 free model](https://openrouter.ai/minimax/minimax-m3:free)
- [OpenRouter API quickstart](https://openrouter.ai/docs/quickstart)
- [Free-model limits](https://openrouter.ai/docs/faq)

### Configure SONORA

Copy the safe template and open the new gitignored file:

```bash
cp .env.example .env
open -e .env
```

Create one OpenRouter API key and paste it after `SONORA_AI_API_KEY=`. The other values are already correct. Never add `VITE_` to the key name and never paste the key into frontend code, screenshots, commits or chat messages.

```dotenv
SONORA_AI_ENABLED=true
SONORA_AI_PROVIDER=openrouter
SONORA_AI_BASE_URL=https://openrouter.ai/api/v1
SONORA_AI_MODEL=minimax/minimax-m3:free
SONORA_AI_API_KEY=your_server_side_key
```

Restart the Python API after changing `.env`, then verify the configuration:

```bash
npm run api
curl -s http://localhost:8765/api/capabilities
```

A configured response contains values equivalent to:

```json
{
  "ai_lessons": true,
  "ai": {
    "provider": "web-ai",
    "service": "openrouter",
    "model": "minimax/minimax-m3:free",
    "ready": true,
    "status": "ready",
    "local": false
  }
}
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `SONORA_AI_ENABLED` | `false` | Explicit switch preventing accidental cloud requests |
| `SONORA_AI_PROVIDER` | `openrouter` | Web-provider adapter |
| `SONORA_AI_BASE_URL` | `https://openrouter.ai/api/v1` | Server-side OpenAI-compatible API |
| `SONORA_AI_MODEL` | `minimax/minimax-m3:free` | Free JSON-output model ID |
| `SONORA_AI_API_KEY` | empty | Secret used only by FastAPI |
| `SONORA_AI_REQUESTS_PER_HOUR` | `10` | Per-client protection for the cloud quota |
| `SONORA_AI_REQUESTS_PER_DAY` | `40` | Process-wide daily protection |
| `SONORA_DB_PATH` | `backend/sonora.db` | SQLite database path |

## AI and fallback behavior

The analyzer remains usable at three levels:

1. **Web AI configured:** FastAPI sends the artist, title and short excerpt through OpenRouter and validates the returned three-language lesson against a strict schema.
2. **API disabled, missing a key, out of quota or unavailable:** FastAPI returns a deterministic basic estimate for language level, vocabulary, slang and content flags. It is explicitly not a validated CEFR or safety assessment.
3. **Python API offline:** prepared song lessons, vocabulary practice and local lesson progress continue to work in the browser; web generation is unavailable.

The fallback is intentionally less detailed than the web model. It keeps the demo reliable and must not be described as equivalent to teacher-reviewed linguistic analysis.

## Privacy and copyright

- Web AI is disabled by default until the server has an explicit provider configuration and secret key.
- When enabled, the artist, title and excerpt travel from the browser to FastAPI, OpenRouter and the selected model provider. Those services process the data under their own terms.
- The API key remains on the Python backend and is never returned by health, capabilities or analysis responses.
- Raw lyric excerpts are processed in memory and are **not written to SQLite**.
- Analysis history can store derived fields such as artist, title, CEFR estimate, scores, selected vocabulary, slang labels and provider. It never stores the submitted lyric text.
- Saved words and progress are stored locally in browser storage and/or `backend/sonora.db` for the current implementation.
- Use only short excerpts for educational analysis. Do not publish or store complete copyrighted lyrics without permission.

Cloud processing requires a school privacy review. Before a real study with minors, obtain parent/guardian consent, disclose cross-border processing, use participant codes, define a retention period and restrict access to the API key, SQLite file and exported CSV files.

## Research workspace: important demo-data notice

The research screen demonstrates the intended Daryn workflow:

- experimental and control cohort comparison;
- vocabulary, listening and speaking pre-test/post-test results;
- anonymized participant table;
- study design, measurement instruments and safeguards;
- client-side CSV export.

> **All participant rows, gains and charts currently shown in the research workspace are synthetic demo data created for interface testing. They are not results of a completed experiment and must not be cited as evidence.**

Before the Daryn presentation, replace the demo dataset with consented, anonymized results from the actual study, verify every score against the source tests and clearly report the sample size, missing sessions, scoring rubric, limitations and statistical method. Keep the `demo data` label visible until that replacement and validation are complete.

## Current learning flow

Each curated lesson is a gated seven-stage route with 25 required interactions:

1. Set a learning goal.
2. Predict and uncover meaning, mood and cultural context.
3. Open an authorised recording and complete gist/detail listening tasks.
4. Study six useful words through self-rating, active recall and context practice.
5. Compare song language with standard English and learn register.
6. Complete a five-question mastery checkpoint.
7. Give a short spoken or typed response using target vocabulary.

Future stages stay locked until the current work is completed. Only real activity attempts, first-attempt accuracy and active time feed the progress view. Learners can also save words for spaced review and turn a short excerpt from another song into a new lesson with free web AI.

## Basic checks

```bash
npm run build
npm test
.venv/bin/python -m unittest discover -s backend -p 'test*.py'
./scripts/check_web_ai.sh
```

The build and test commands validate the frontend lesson engine, API and storage layer. The final command reads the gitignored `.env`, validates the web-provider configuration without making an inference request and never prints the secret key.

## Vercel deployment

The repository includes a Vite production build and a Vercel Python Function at `api/index.py`. In production the browser calls FastAPI through the same `/api` origin, so no secret or localhost URL is bundled into the frontend.

Required Vercel environment variables:

```dotenv
SONORA_AI_ENABLED=true
SONORA_AI_PROVIDER=openrouter
SONORA_AI_BASE_URL=https://openrouter.ai/api/v1
SONORA_AI_MODEL=minimax/minimax-m3:free
SONORA_AI_API_KEY=your_server_side_key
SONORA_DB_PATH=/tmp/sonora.db
```

The OpenRouter key must be marked sensitive. Vercel Functions have an ephemeral filesystem, so `/tmp/sonora.db` keeps the API operational but is not durable storage across function replacements. Browser progress remains available through SONORA's local recovery storage. For a multi-user production rollout, replace SQLite with a managed database before collecting real research data.
