#!/usr/bin/env bash

# Do not leak configuration values when the caller invokes this script with
# `bash -x`. In particular, an API key must never appear in xtrace output.
set +x
set -u

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${SONORA_ENV_FILE:-${project_root}/.env}"

file_enabled=""
file_enabled_set=0
file_provider=""
file_provider_set=0
file_model=""
file_model_set=0
file_base_url=""
file_base_url_set=0
file_api_key=""
file_api_key_set=0
file_openrouter_key=""
file_openrouter_key_set=0
file_dashscope_key=""
file_dashscope_key_set=0

dotenv_error() {
  local line_number="$1"
  local variable_name="$2"
  local explanation="$3"
  echo "[not ready] Invalid .env at line ${line_number}: ${explanation} (${variable_name})." >&2
  exit 1
}

parse_dotenv_value() {
  local raw_value="$1"
  local variable_name="$2"
  local line_number="$3"
  local first_character=""
  local remainder=""
  local suffix=""

  parsed_value=""
  if [[ -n "${raw_value}" && "${raw_value}" == [[:space:]]* ]]; then
    dotenv_error \
      "${line_number}" \
      "${variable_name}" \
      "remove the whitespace immediately after '='"
  fi

  if [[ -z "${raw_value}" ]]; then
    return
  fi

  first_character="${raw_value:0:1}"
  if [[ "${first_character}" == '"' ]]; then
    remainder="${raw_value:1}"
    if [[ "${remainder}" != *'"'* ]]; then
      dotenv_error "${line_number}" "${variable_name}" "missing the closing double quote"
    fi
    parsed_value="${remainder%%\"*}"
    suffix="${remainder#*\"}"
  elif [[ "${first_character}" == "'" ]]; then
    remainder="${raw_value:1}"
    if [[ "${remainder}" != *"'"* ]]; then
      dotenv_error "${line_number}" "${variable_name}" "missing the closing single quote"
    fi
    parsed_value="${remainder%%\'*}"
    suffix="${remainder#*\'}"
  else
    parsed_value="${raw_value}"
    if [[ "${parsed_value}" == *" #"* ]]; then
      parsed_value="${parsed_value%% \#*}"
    fi
    parsed_value="${parsed_value%"${parsed_value##*[![:space:]]}"}"
    return
  fi

  suffix="${suffix#"${suffix%%[![:space:]]*}"}"
  if [[ -n "${suffix}" && "${suffix:0:1}" != "#" ]]; then
    dotenv_error "${line_number}" "${variable_name}" "unexpected characters after the quoted value"
  fi
}

read_dotenv() {
  local line_number=0
  local raw_line=""
  local line=""
  local key=""
  local raw_value=""

  while IFS= read -r raw_line || [[ -n "${raw_line}" ]]; do
    line_number=$((line_number + 1))
    line="${raw_line%$'\r'}"
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "${line}" || "${line:0:1}" == "#" ]] && continue

    if [[ "${line}" == export[[:space:]]* ]]; then
      line="${line#export}"
      line="${line#"${line%%[![:space:]]*}"}"
    fi
    [[ "${line}" != *"="* ]] && continue

    key="${line%%=*}"
    key="${key%"${key##*[![:space:]]}"}"
    case "${key}" in
      SONORA_AI_ENABLED|SONORA_AI_PROVIDER|SONORA_AI_MODEL|SONORA_AI_BASE_URL|SONORA_AI_API_KEY|OPENROUTER_API_KEY|DASHSCOPE_API_KEY) ;;
      *) continue ;;
    esac

    raw_value="${line#*=}"
    parse_dotenv_value "${raw_value}" "${key}" "${line_number}"
    case "${key}" in
      SONORA_AI_ENABLED) file_enabled="${parsed_value}"; file_enabled_set=1 ;;
      SONORA_AI_PROVIDER) file_provider="${parsed_value}"; file_provider_set=1 ;;
      SONORA_AI_MODEL) file_model="${parsed_value}"; file_model_set=1 ;;
      SONORA_AI_BASE_URL) file_base_url="${parsed_value}"; file_base_url_set=1 ;;
      SONORA_AI_API_KEY) file_api_key="${parsed_value}"; file_api_key_set=1 ;;
      OPENROUTER_API_KEY) file_openrouter_key="${parsed_value}"; file_openrouter_key_set=1 ;;
      DASHSCOPE_API_KEY) file_dashscope_key="${parsed_value}"; file_dashscope_key_set=1 ;;
    esac
  done < "${env_file}"
}

if [[ -e "${env_file}" ]]; then
  if [[ ! -r "${env_file}" ]]; then
    echo "[not ready] The configured .env file is not readable." >&2
    exit 1
  fi
  read_dotenv
elif [[ -n "${SONORA_ENV_FILE+x}" ]]; then
  echo "[not ready] SONORA_ENV_FILE does not point to a readable file." >&2
  exit 1
fi

if [[ -n "${SONORA_AI_ENABLED+x}" ]]; then enabled="${SONORA_AI_ENABLED}"
elif [[ "${file_enabled_set}" == 1 ]]; then enabled="${file_enabled}"
else enabled="false"
fi

if [[ -n "${SONORA_AI_PROVIDER+x}" ]]; then provider="${SONORA_AI_PROVIDER}"
elif [[ "${file_provider_set}" == 1 ]]; then provider="${file_provider}"
else provider="openrouter"
fi

if [[ -n "${SONORA_AI_MODEL+x}" ]]; then model="${SONORA_AI_MODEL}"
elif [[ "${file_model_set}" == 1 ]]; then model="${file_model}"
else model="minimax/minimax-m3:free"
fi

if [[ -n "${SONORA_AI_BASE_URL+x}" ]]; then base_url="${SONORA_AI_BASE_URL}"
elif [[ "${file_base_url_set}" == 1 ]]; then base_url="${file_base_url}"
else base_url="https://openrouter.ai/api/v1"
fi

if [[ -n "${SONORA_AI_API_KEY+x}" ]]; then configured_api_key="${SONORA_AI_API_KEY}"
elif [[ "${file_api_key_set}" == 1 ]]; then configured_api_key="${file_api_key}"
else configured_api_key=""
fi

if [[ -n "${OPENROUTER_API_KEY+x}" ]]; then configured_openrouter_key="${OPENROUTER_API_KEY}"
elif [[ "${file_openrouter_key_set}" == 1 ]]; then configured_openrouter_key="${file_openrouter_key}"
else configured_openrouter_key=""
fi

if [[ -n "${DASHSCOPE_API_KEY+x}" ]]; then configured_dashscope_key="${DASHSCOPE_API_KEY}"
elif [[ "${file_dashscope_key_set}" == 1 ]]; then configured_dashscope_key="${file_dashscope_key}"
else configured_dashscope_key=""
fi

if [[ -n "${configured_api_key}" ]]; then
  api_key="${configured_api_key}"
elif [[ "${provider}" == "openrouter" ]]; then
  api_key="${configured_openrouter_key}"
elif [[ "${provider}" == "dashscope" ]]; then
  api_key="${configured_dashscope_key}"
else
  api_key=""
fi

if [[ -n "${api_key}" && "${api_key}" == *[[:space:]]* ]]; then
  echo "[not ready] The server-side API key contains whitespace. Remove spaces around the key value." >&2
  exit 1
fi

echo "SONORA web AI configuration check"
echo "Provider: ${provider}"
echo "Endpoint: ${base_url}"
echo "Model: ${model}"

case "${enabled}" in
  1|true|TRUE|yes|YES|on|ON) ;;
  *)
    echo "[not ready] SONORA_AI_ENABLED is not true."
    exit 1
    ;;
esac

if [[ "${provider}" != "openrouter" ]]; then
  echo "[not ready] This simple setup expects SONORA_AI_PROVIDER=openrouter."
  exit 1
fi

if [[ "${base_url}" != "https://openrouter.ai/api/v1" ]]; then
  echo "[not ready] Use SONORA_AI_BASE_URL=https://openrouter.ai/api/v1."
  exit 1
fi

if [[ -z "${model}" ]]; then
  echo "[not ready] SONORA_AI_MODEL is empty."
  exit 1
fi

if [[ -z "${api_key}" ]]; then
  echo "[not ready] No server-side OpenRouter key was found."
  echo "Set SONORA_AI_API_KEY in the gitignored .env file."
  exit 1
fi

echo "[ready] Free web AI is configured. The secret key was not printed."
echo "Start the API and confirm /api/capabilities before sending an excerpt."
