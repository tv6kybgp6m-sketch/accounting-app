#!/usr/bin/env bash
# 把网页记账本打包成真正的 macOS .app（原生 Swift + WKWebView 壳）
set -e
cd "$(dirname "$0")/.."

# 发布前先把未压缩的 app.js 压成 app.min.js（仅压缩、不改名，避免行内 onclick 处理函数名被改坏）
# v1.41.74：这里原来在这句后面跟了一个兜底的 echo —— 那个兜底把 minify 的失败吃掉，
# 于是压缩没做也照样出包。现在压不了就直接中断（set -e）。
bash ./minify.sh

APP_NAME=Bookkeeping
VERSION=1.41.76

# v1.41.74：VERSION 以前定义了却没人用，Info.plist 只能手改 —— 漏一处就打出一个
# 版本号不对的包（"检查更新说已是最新、装上报旧版本号"就是这么来的）。先在这里卡一道。
PLIST_VER="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' native/Info.plist 2>/dev/null || echo '')"
if [ "$PLIST_VER" != "$VERSION" ]; then
    echo "✗ native/Info.plist 版本是 ${PLIST_VER:-读不出来}，build.sh 里是 $VERSION —— 先统一再打包" >&2
    exit 1
fi
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
# sw.js 漏过一次（v1.39.31 手动塞进 /Applications 才补上）：
# 原生壳跑在 http://127.0.0.1，页面照样注册 service worker，站点缓存名就在这文件里。
# 少了它 —— 打出来的 .app 和 DMG 里 SW 是空的，PWA 离线缓存整个失效。
cp sw.js "$RES/"
cp manifest.json "$RES/"   # index.html 里链了它；PWA 启动配色也在这里，别漏
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
# dist 只是中间产物，装到 /Applications 时还会再签一次；
# 这里签不上（沙箱/权限偶发 Operation not permitted）不该让整次构建中断。
codesign --force --sign - "$APP_DIR" || echo "（dist 签名跳过，安装时再签）"

echo "==> 校验..."
test -x "$MACOS/$APP_NAME" && echo "executable OK"
test -f "$RES/index.html"  && echo "index.html OK"
test -f "$RES/AppIcon.icns" && echo "icon OK"
test -f "$RES/sw.js" && grep -q "CACHE_NAME" "$RES/sw.js" && echo "sw.js OK"
# v1.41.74：app.min.js 是页面真正加载的那份 —— 它没更新，改了 app.js 也等于没改
test -f "$RES/js/app.min.js" && echo "app.min.js OK"
grep -q "\"version\": \"$VERSION\"" "$RES/version.json" && echo "version.json OK" || { echo "✗ 打进包里的 version.json 不是 $VERSION" >&2; exit 1; }
spctl -a -vv "$APP_DIR" 2>/dev/null | head -3 || true

echo ""
echo "完成： $APP_DIR"
