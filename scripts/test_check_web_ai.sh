#!/usr/bin/env bash

set +x
set -u

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
checker="${script_dir}/check_web_ai.sh"
wrapper="${script_dir}/check_qwen.sh"
dummy_key="sk-dummy-check-only-never-real"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

run_with_dotenv() {
  local dotenv_content="$1"
  env -i PATH="${PATH}" SONORA_ENV_FILE=/dev/fd/3 "${checker}" 3<<< "${dotenv_content}"
}

valid_config="$(printf '%s\n' \
  'SONORA_AI_ENABLED=true' \
  'SONORA_AI_PROVIDER=openrouter' \
  'SONORA_AI_BASE_URL=https://openrouter.ai/api/v1' \
  'SONORA_AI_MODEL=minimax/minimax-m3:free' \
  "SONORA_AI_API_KEY=${dummy_key}")"

valid_output="$(run_with_dotenv "${valid_config}" 2>&1)" || fail "valid dummy configuration was rejected"
[[ "${valid_output}" == *"[ready]"* ]] || fail "valid configuration did not report ready"
[[ "${valid_output}" != *"${dummy_key}"* ]] || fail "dummy secret appeared in normal output"

malformed_key="sk-dummy-leading-space-never-real"
malformed_config="$(printf '%s\n' \
  'SONORA_AI_ENABLED=true' \
  'SONORA_AI_PROVIDER=openrouter' \
  'SONORA_AI_BASE_URL=https://openrouter.ai/api/v1' \
  'SONORA_AI_MODEL=minimax/minimax-m3:free' \
  "SONORA_AI_API_KEY= ${malformed_key}")"
malformed_output="$(run_with_dotenv "${malformed_config}" 2>&1)"
malformed_status=$?
[[ "${malformed_status}" -ne 0 ]] || fail "whitespace after '=' was accepted"
[[ "${malformed_output}" == *"remove the whitespace immediately after '='"* ]] \
  || fail "whitespace error did not include corrective guidance"
[[ "${malformed_output}" != *"${malformed_key}"* ]] || fail "malformed dummy secret appeared in output"

inert_config="$(printf '%s\n' \
  'SONORA_AI_ENABLED=true' \
  'SONORA_AI_PROVIDER=openrouter' \
  'SONORA_AI_BASE_URL=https://openrouter.ai/api/v1' \
  'SONORA_AI_MODEL=minimax/minimax-m3:free' \
  'SONORA_AI_API_KEY=$(printf${IFS}DOTENV_COMMAND_EXECUTED>&2)')"
inert_output="$(run_with_dotenv "${inert_config}" 2>&1)" || fail "literal command-substitution test was rejected"
[[ "${inert_output}" != *"DOTENV_COMMAND_EXECUTED"* ]] || fail ".env content was executed"

xtrace_output="$(
  env -i \
    PATH="${PATH}" \
    SONORA_ENV_FILE=/dev/null \
    SONORA_AI_ENABLED=true \
    SONORA_AI_PROVIDER=openrouter \
    SONORA_AI_BASE_URL=https://openrouter.ai/api/v1 \
    SONORA_AI_MODEL=minimax/minimax-m3:free \
    SONORA_AI_API_KEY="${dummy_key}" \
    bash -x "${checker}" 2>&1
)" || fail "xtrace safety invocation failed"
[[ "${xtrace_output}" != *"${dummy_key}"* ]] || fail "dummy secret appeared in xtrace output"

wrapper_output="$(
  env -i \
    PATH="${PATH}" \
    SONORA_ENV_FILE=/dev/null \
    SONORA_AI_ENABLED=true \
    SONORA_AI_PROVIDER=openrouter \
    SONORA_AI_BASE_URL=https://openrouter.ai/api/v1 \
    SONORA_AI_MODEL=minimax/minimax-m3:free \
    SONORA_AI_API_KEY="${dummy_key}" \
    "${wrapper}" 2>&1
)" || fail "compatibility wrapper failed"
[[ "${wrapper_output}" != *"${dummy_key}"* ]] || fail "dummy secret appeared through the wrapper"

echo "PASS: safe dotenv parsing, whitespace rejection, injection resistance and secret redaction"
