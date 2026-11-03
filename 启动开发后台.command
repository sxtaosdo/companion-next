#!/bin/zsh
set -eu
cd -- "${0:A:h}"
runtime="${COMPANION_NODE:-}"
if [[ -z "$runtime" && -f companion-host.local.json ]]; then
  runtime="$(/usr/bin/python3 -c 'import json; print(json.load(open("companion-host.local.json"))["nodeHost"])')"
fi
if [[ -z "$runtime" || ! -x "$runtime" ]]; then
  print -u2 '缺少本机 Node 25 配置。请先按 LOCAL_DEVELOPMENT.md 完成一次本机准备。'
  exit 1
fi
exec "$runtime" scripts/runtime-gate.mjs host-start -- scripts/start-companion.mjs
