#!/usr/bin/env bash

# Backward-compatible wrapper kept for existing local instructions.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/check_web_ai.sh" "$@"
