// 静态检查：代码里调用的每个函数都必须有定义。
//
// 为什么需要它（v1.41.1 的教训）：
// 清理死函数时误删了 chartReadOptions —— 它是四个图表（报表走势 / 资产负债走势 /
// 总资产变化 / 投资收益走势）共用的配置函数。删掉之后图表一画就抛
// "chartReadOptions is not defined"，界面上就是**一片空白**，而且不报任何错。
// 这种错靠肉眼 review 和运行测试都很难发现（四个图表分别在四个页面里），
// 所以加一条静态护栏：谁被调用、谁没定义，直接列出来。
//
// 跑法：node test/lint-undefined.js

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SRC = path.join(REPO, 'js', 'app.js');
const raw = fs.readFileSync(SRC, 'utf8');

// ---- 0. 先把注释和字符串挖掉，只留真正的代码 ----
function stripCommentsAndStrings(src) {
    let out = '';
    let i = 0;
    const n = src.length;
    while (i < n) {
        const c = src[i];
        const c2 = src[i + 1];
        if (c === '/' && c2 === '/') {                 // 行注释
            while (i < n && src[i] !== '\n') i++;
            continue;
        }
        if (c === '/' && c2 === '*') {                 // 块注释
            i += 2;
            while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
            i += 2;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') {     // 字符串
            const quote = c;
            i++;
            while (i < n) {
                if (src[i] === '\\') { i += 2; continue; }
                if (src[i] === quote) { i++; break; }
                if (quote === '`' && src[i] === '$' && src[i + 1] === '{') {
                    // 模板字符串里的 ${...} 是代码，递归处理
                    let depth = 1, j = i + 2;
                    while (j < n && depth > 0) {
                        if (src[j] === '{') depth++;
                        else if (src[j] === '}') depth--;
                        j++;
                    }
                    out += ' ' + src.slice(i + 2, j - 1) + ' ';
                    i = j;
                    continue;
                }
                i++;
            }
            out += ' ';
            continue;
        }
        out += c;
        i++;
    }
    return out;
}
const code = stripCommentsAndStrings(raw);
// 行号映射：挖掉注释/字符串后，行数可能变少 —— 改用「按行挖」保持行号
function stripPerLine(src) {
    return src.split('\n').map(line => {
        let out = '', i = 0, n = line.length;
        while (i < n) {
            const c = line[i], c2 = line[i + 1];
            if (c === '/' && c2 === '/') break;
            if (c === '"' || c === "'" || c === '`') {
                const q = c; i++;
                while (i < n) {
                    if (line[i] === '\\') { i += 2; continue; }
                    if (line[i] === q) { i++; break; }
                    i++;
                }
                out += ' '; continue;
            }
            out += c; i++;
        }
        return out;
    }).join('\n');
}
const lines = stripPerLine(raw).split('\n');
const codeStr = lines.join('\n');

// ---- 1. 收集所有「定义出来」的名字（顶层和局部都算）----
const defined = new Set();
const defPatterns = [
    /(?:^|[\s;{}])(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g,
    /(?:^|[\s;{}])(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g,
    /(?:^|[\s;{}])class\s+([A-Za-z_$][\w$]*)/g,
    /(?:^|[\s{,;])(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{/g,
    /(?:^|[\s;,])(?:async\s+)?([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g,
    /(?:^|[\s;,])(?:async\s+)?([A-Za-z_$][\w$]*)\s*=\s*function/g,
];
for (const re of defPatterns) {
    let m;
    while ((m = re.exec(codeStr)) !== null) defined.add(m[1]);
}
// 函数参数、回调参数也算「已定义」（resolve / reject / e / ctx 这类）：
// 凡是出现在任意一层括号里的标识符，都当成已声明的参数
(codeStr.match(/\(([^()]*)\)/g) || []).forEach(g => {
    (g.replace(/[()]/g, ' ').match(/[A-Za-z_$][\w$]*/g) || []).forEach(p => defined.add(p));
});
// 函数参数也算「已定义」（resolve / reject / e / ctx 这类）
// 参数表允许一层嵌套（new Promise((resolve, reject) => …) 这种）
const paramRe = /(?:function\s*\*?\s*[A-Za-z_$][\w$]*|\b[A-Za-z_$][\w$]*)\s*\(((?:[^()]|\([^()]*\))*)\)/g;
let pm;
while ((pm = paramRe.exec(codeStr)) !== null) {
    (pm[1].match(/[A-Za-z_$][\w$]*/g) || []).forEach(p => defined.add(p));
}

// ---- 2. 全局对象与浏览器 API（不在本文件里定义，但可以调）----
const EXTERNAL = new Set([
    'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'RegExp', 'Error',
    'TypeError', 'RangeError', 'SyntaxError', 'Promise', 'Symbol', 'Map', 'Set', 'WeakMap', 'WeakSet',
    'Proxy', 'Reflect', 'BigInt', 'Intl', 'ArrayBuffer', 'DataView', 'Uint8Array', 'Int8Array',
    'Uint16Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'Blob', 'File', 'FileReader',
    'FormData', 'URL', 'URLSearchParams', 'Response', 'Request', 'Headers', 'AbortController',
    'TextEncoder', 'TextDecoder', 'crypto', 'performance', 'CustomEvent', 'Event', 'Function',
    'parseInt', 'parseFloat', 'isFinite', 'isNaN', 'encodeURIComponent', 'decodeURIComponent',
    'encodeURI', 'decodeURI', 'btoa', 'atob', 'setTimeout', 'clearTimeout', 'setInterval',
    'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'queueMicrotask',
    'fetch', 'alert', 'confirm', 'prompt', 'structuredClone', 'getComputedStyle',
    'console', 'window', 'document', 'localStorage', 'sessionStorage', 'navigator', 'location',
    'history', 'Chart', 'XLSX', 'fflate', 'CompressionStream', 'DecompressionStream',
    // 关键字（不是函数调用，但正则可能误抓）
    'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'await', 'new',
    'delete', 'void', 'in', 'of', 'do', 'else', 'try', 'throw', 'case', 'yield', 'super',
    'instanceof', 'async', 'let', 'const', 'var', 'this', 'null', 'true', 'false',
]);

// ---- 3. 找出所有「调用」的名字（前面不是点号的才算函数调用）----
// ⚠️ 展开语法 ...fn() 前面也是点号，但它是全局函数调用、不是成员访问 ——
//    所以先把 ... 换成两个占位符，免得把 fn() 误当成 obj.fn() 放过去
//    （chartReadOptions 就是被 ...chartReadOptions() 这样调用的，差点漏掉）
const callScan = codeStr.replace(/\.\.\./g, '@@');
const called = new Map();
const callRe = /(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g;
let m;
while ((m = callRe.exec(callScan)) !== null) {
    const name = m[1];
    if (EXTERNAL.has(name)) continue;
    if (!called.has(name)) called.set(name, []);
    called.get(name).push(callScan.slice(0, m.index).split('\n').length);
}

// ---- 4. 比对 ----
const missing = [];
for (const [name, ln] of called) {
    if (defined.has(name)) continue;
    missing.push({ name, lines: ln.slice(0, 3) });
}

if (missing.length) {
    console.log('\n❌ 这些名字被调用了，但整个 js/app.js 里找不到定义：\n');
    missing.forEach(x => console.log(`   ${x.name}()  ← 行 ${x.lines.join(', ')}`));
    console.log('\n（多半是「死函数清理」把还被人调用的函数删掉了 —— 调用点会在运行时抛' +
        ' ReferenceError，界面上往往表现为某个区域一片空白而不报错。）\n');
    process.exit(1);
}

console.log(`✅ 调用完整性检查通过：${called.size} 个被调用的名字全部有定义（js/app.js 共定义 ${defined.size} 个）`);
process.exit(0);
