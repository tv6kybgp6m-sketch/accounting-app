#!/usr/bin/env bash
# 把网页记账本打包成真正的 macOS .app（原生 Swift + WKWebView 壳）
set -e
cd "$(dirname "$0")/.."

APP_NAME=Bookkeeping
VERSION=1.36.0
APP_DIR="dist/$APP_NAME.app"
CONTENTS="$APP_DIR/Contents"
MACOS="$CONTENTS/MacOS"
RES="$CONTENTS/Resources"

rm -rf "$APP_DIR"
mkdir -p "$MACOS" "$RES"

echo "==> 编译原生壳 (arm64)..."
swiftc -target arm64-apple-macosx12.0 -O \
    -framework Cocoa -framework WebKit -framework UniformTypeIdentifiers -framework Network \
    native/Bookkeeping.swift native/MiniHTTPServer.swift \
    -o "$MACOS/$APP_NAME"

echo "==> 复制网页资源..."
cp index.html "$RES/"
cp version.json "$RES/"
cp -R css js vendor icons "$RES/"

echo "==> 生成应用图标..."
ICONSET="$(mktemp -d)/bookkeeping.iconset"
mkdir -p "$ICONSET"
SRC="icons/icon-512.png"
sips -z 16 16   "$SRC" --out "$ICONSET/icon_16x16.png"      >/dev/null
sips -z 32 32   "$SRC" --out "$ICONSET/icon_16x16@2x.png"   >/dev/null
sips -z 32 32   "$SRC" --out "$ICONSET/icon_32x32.png"      >/dev/null
sips -z 64 64   "$SRC" --out "$ICONSET/icon_32x32@2x.png"   >/dev/null
sips -z 128 128 "$SRC" --out "$ICONSET/icon_128x128.png"    >/dev/null
sips -z 256 256 "$SRC" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
sips -z 256 256 "$SRC" --out "$ICONSET/icon_256x256.png"    >/dev/null
sips -z 512 512 "$SRC" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
sips -z 512 512 "$SRC" --out "$ICONSET/icon_512x512.png"    >/dev/null
cp "$SRC" "$ICONSET/icon_512x512@2x.png"
iconutil --convert icns --output "$RES/AppIcon.icns" "$ICONSET"
rm -rf "$ICONSET"

echo "==> 写入 Info.plist..."
cp native/Info.plist "$CONTENTS/Info.plist"

echo "==> Ad-hoc 签名..."
codesign --force --sign - "$APP_DIR"

echo "==> 校验..."
test -x "$MACOS/$APP_NAME" && echo "executable OK"
test -f "$RES/index.html"  && echo "index.html OK"
test -f "$RES/AppIcon.icns" && echo "icon OK"
spctl -a -vv "$APP_DIR" 2>/dev/null | head -3 || true

echo ""
echo "完成： $APP_DIR"
