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
  # v1.41.74：以前这里 exit 0 装作成功，继续用仓库里旧的 app.min.js ——
  # 于是"改了代码、装上新版、行为没变"，而且一声不响。这是最坑的一种假失败。
  echo "✗ 找不到 terser，无法生成 js/app.min.js。" >&2
  echo "  请不要用旧的 app.min.js 发版：index.html 加载的是它，你改的 js/app.js 根本上不了页面。" >&2
  echo "  解决：npm i -g terser    或者    export TERSER_BIN=/path/to/terser" >&2
  exit 1
fi

"$T" js/app.js --compress --no-mangle -o js/app.min.js
echo "已生成 js/app.min.js ($(wc -c < js/app.min.js) 字节)"
