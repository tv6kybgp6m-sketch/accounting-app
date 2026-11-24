#!/usr/bin/env node
// v1.41.74 发版护栏：把「改了没生效」这类错误挡在提交之前。
//
// 为什么要它：这个项目里「改了没生效」几乎全是同一类原因 ——
// 发出去的东西和你在源码里改的东西不一致。两种形态：
//   ① 八处版本号漏改一处 → 手机上缓存不换 / 检查更新说已是最新 / 装上报旧版本号
//   ② js/app.min.js 没重新生成 → index.html 加载的是 min.js，你改的 app.js 根本没上页面
// 过去这两件事靠人眼和记性，现在靠脚本。
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const problems = [];
const found = {};

function grab(label, text, re, file) {
    const m = text.match(re);
    if (!m) { problems.push(`${file} 里找不到 ${label}（正则对不上，可能是写法变了）`); return; }
    found[label] = m[1];
}

// ---- ① 版本号：八处必须一模一样 ----
grab('APP_VERSION', read('js/app.js'), /const APP_VERSION = '([0-9][0-9.]*)'/, 'js/app.js');
grab('CACHE_NAME', read('sw.js'), /const CACHE_NAME = 'bookkeeping-v([0-9][0-9.]*)'/, 'sw.js');
grab('index.html ?v=', read('index.html'), /sw\.js\?v=([0-9][0-9.]*)/, 'index.html');
try {
    found['version.json'] = JSON.parse(read('version.json')).version;
} catch (e) { problems.push('version.json 读不出来或不是合法 JSON'); }
grab('build.sh VERSION', read('native/build.sh'), /^VERSION=([0-9][0-9.]*)$/m, 'native/build.sh');
const plist = read('native/Info.plist');
grab('Info.plist CFBundleVersion', plist, /<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/, 'native/Info.plist');
grab('Info.plist ShortVersion', plist, /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/, 'native/Info.plist');
try {
    found['package.json'] = JSON.parse(read('package.json')).version;
} catch (e) { problems.push('package.json 读不出来或不是合法 JSON'); }
grab('CHANGELOG 顶部', read('CHANGELOG.md'), /^## v([0-9][0-9.]*)/m, 'CHANGELOG.md (第一条 ## vX.Y.Z)');

const versions = Object.values(found);
const uniq = [...new Set(versions)];
if (uniq.length > 1) {
    problems.push('版本号不一致：' + Object.entries(found).map(([k, v]) => `${k}=${v}`).join('、'));
}

// ---- ② app.min.js 必须等于 terser 重压 app.js 的结果 ----
function findTerser() {
    const cands = [];
    try { cands.push(cp.execSync('command -v terser', { encoding: 'utf8' }).trim()); } catch (e) {}
    if (process.env.TERSER_BIN) cands.push(process.env.TERSER_BIN);
    cands.push(path.join(os.homedir(), '.workbuddy/binaries/node/workspace/node_modules/.bin/terser'));
    cands.push(path.join(ROOT, 'node_modules/.bin/terser'));
    return cands.find(p => p && fs.existsSync(p));
}

const terser = findTerser();
if (!terser) {
    console.log('  SKIP  app.min.js 一致性：没找到 terser（装了才会检查）');
} else {
    const tmp = path.join(os.tmpdir(), `bk-guard-${process.pid}.min.js`);
    try {
        cp.execFileSync(terser, ['js/app.js', '--compress', '--no-mangle', '-o', tmp], { cwd: ROOT, stdio: 'pipe' });
        const fresh = fs.readFileSync(tmp);
        const shipped = fs.readFileSync(path.join(ROOT, 'js/app.min.js'));
        if (!fresh.equals(shipped)) {
            problems.push(`js/app.min.js 和重新压缩 js/app.js 的结果不一致 `
                + `（线上 ${shipped.length} 字节 / 重压 ${fresh.length} 字节）——`
                + `请先跑 bash ./minify.sh 再提交，否则页面加载的还是旧代码`);
        }
    } catch (e) {
        problems.push('app.min.js 一致性检查跑不起来：' + (e.message || e));
    } finally {
        try { fs.unlinkSync(tmp); } catch (e2) {}
    }
}

// ---- 结果 ----
if (problems.length) {
    console.error('\n=== 发版护栏：不通过 ===');
    problems.forEach(p => console.error('  FAIL  ' + p));
    process.exit(1);
}
console.log(`  版本号八处一致：v${uniq[0]}`);
