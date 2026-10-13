#!/usr/bin/env bash
# 把未压缩的 js/app.js 压成 js/app.min.js。
# 只压缩（--compress）、不改名（--no-mangle）—— 因为代码大量使用行内 onclick="函数名(...)"，
# 一旦 mangle 改名这些处理函数就会失效；压缩能在不动函数名的前提下把体积砍约一半，零风险。
set -e
cd "$(dirname "$0")"

T="$(command -v terser || true)"
if [ -z "$T" ] && [ -n "$TERSER_BIN" ]; then T="$TERSER_BIN"; fi
if [ -z "$T" ] && [ -x "$HOME/.workbuddy/binaries/node/workspace/node_modules/.bin/terser" ]; then
  T="$HOME/.workbuddy/binaries/node/workspace/node_modules/.bin/terser"
fi
if [ -z "$T" ]; then
  echo "terser 未安装，跳过压缩（将使用已提交的 js/app.min.js）"
  exit 0
fi

"$T" js/app.js --compress --no-mangle -o js/app.min.js
echo "已生成 js/app.min.js ($(wc -c < js/app.min.js) 字节)"
