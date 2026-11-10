#!/bin/zsh
set -eu
cd -- "${0:A:h}"
runtime="$(command -v node || true)"
for installed_node in /usr/local/bin/node /opt/homebrew/bin/node; do
  if [[ -z "$runtime" && -x "$installed_node" ]]; then
    runtime="$installed_node"
  fi
done
if [[ "$runtime" != /* || ! -x "$runtime" ]]; then
  print -u2 '请安装本机 Node.js 26.13.0 或更新的 Node 26。'
  exit 1
fi
exec "$runtime" scripts/runtime-gate.mjs host-start -- scripts/start-companion.mjs
