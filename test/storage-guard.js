// 静态护栏：本机存档的字段必须「读得回、写得进、同步里有的本机也得有」。
//
// 为什么需要它（三次同类事故）：
//   · v1.39.65  excludedAnomalies：只进了同步载荷，没进本机存档 → 断网刷新即丢
//   · v1.41.5   closedExclude：同上
//   · v1.41.76  insuranceTypes / insuranceTypeAddedAt：loadState 一直在读，
//               saveStateNow 却从没写过 → 新增的险种刷新即消失、改名的险种新旧都没了、
//               四笔钱「保险保障」总保额按险种清单逐项加 → 那些保单的保额凭空少掉
// 三次都是「改一处、忘了另一处」，靠肉眼 review 抓不住（两份字段列表隔了 3000 行），
// 所以做成静态断言：只要读了没写、或者同步里有而本机没有，直接红。
//
// 跑法：node test/storage-guard.js

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SRC = path.join(REPO, 'js', 'app.js');
const src = fs.readFileSync(SRC, 'utf8');

let failures = 0;
function ok(name, cond, extra) {
    console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (extra !== undefined ? '   → ' + JSON.stringify(extra) : ''));
    if (!cond) failures++;
}

// ---- 取一个顶层函数的函数体（到下一个顶格 function / async function 为止）----
function fnBody(name) {
    const re = new RegExp('^(?:async )?function ' + name + '\\s*\\(', 'm');
    const m = re.exec(src);
    if (!m) return null;
    const start = m.index;
    const rest = src.slice(start + 1);
    const nextRel = rest.search(/^(?:async )?function /m);
    return nextRel < 0 ? src.slice(start) : src.slice(start, start + 1 + nextRel);
}

// ---- 1. saveStateNow 实际写进本机存档的键 ----
const saveBody = fnBody('saveStateNow');
if (!saveBody) { console.log('  FAIL  找不到 saveStateNow'); process.exit(1); }
const dataStart = saveBody.indexOf('const data = {');
const dataEnd = saveBody.indexOf('\n    };', dataStart);
const dataBlock = saveBody.slice(dataStart, dataEnd);
const saved = new Set([...dataBlock.matchAll(/^ {8}([A-Za-z_$][\w$]*):/gm)].map(m => m[1]));
// uiPrefs 是嵌一层的小对象，里面的键单独算
const uiIdx = dataBlock.indexOf('uiPrefs: {');
if (uiIdx >= 0) {
    [...dataBlock.slice(uiIdx).matchAll(/^ {12}([A-Za-z_$][\w$]*):/gm)].forEach(m => saved.add(m[1]));
}

// ---- 2. loadState 从存档里读的键 ----
const loadBody = fnBody('loadState');
if (!loadBody) { console.log('  FAIL  找不到 loadState'); process.exit(1); }
const read = new Set([...loadBody.matchAll(/\bdata\.([A-Za-z_$][\w$]*)/g)].map(m => m[1]));

// ---- 3. 同步载荷里的键（云端有、本机却没有 = 断网就丢）----
const syncBody = fnBody('buildSyncPayload');
if (!syncBody) { console.log('  FAIL  找不到 buildSyncPayload'); process.exit(1); }
const sDataStart = syncBody.indexOf('data: {');
const sDataBlock = syncBody.slice(sDataStart, syncBody.indexOf('\n        },', sDataStart));
const inSync = new Set([...sDataBlock.matchAll(/^ {12}([A-Za-z_$][\w$]*):/gm)].map(m => m[1]));

console.log('\n=== 本机存档字段一致性护栏 ===\n');
console.log(`  saveStateNow 写入 ${saved.size} 个键 / loadState 读取 ${read.size} 个 / 同步载荷 ${inSync.size} 个`);

const readNotSaved = [...read].filter(k => !saved.has(k));
ok('loadState 读的每个键，saveStateNow 都写了（读了没写 = 刷新回默认）',
    readNotSaved.length === 0, readNotSaved.length ? readNotSaved : undefined);

const syncNotSaved = [...inSync].filter(k => !saved.has(k));
ok('同步载荷里的每个键，本机存档也写了（只在云端 = 断网/关同步就丢）',
    syncNotSaved.length === 0, syncNotSaved.length ? syncNotSaved : undefined);

// ---- 4. 已知的高风险字段点名（防止有人把它们从 data 里删掉）----
['insuranceTypes', 'insuranceTypeAddedAt', 'excludedAnomalies', 'closedExclude',
 'sheetCols', 'currencies', 'fxRates', 'lendings', 'reviews', 'fundTargets'].forEach(k => {
    ok(`存档里必须有 ${k}`, saved.has(k));
});

// ---- 5. 救命副本不能被日常副本覆盖（v1.41.76）----
const dismissBody = fnBody('dismissLoadLost') || '';
ok('dismissLoadLost 不覆盖已存在的救命副本',
    /!localStorage\.getItem\(STORAGE_RESCUE_KEY\)/.test(dismissBody));

const srcBody = fnBody('localPrevSource') || '';
ok('恢复时优先拿救命副本（它在，就该拿它）',
    srcBody.indexOf('STORAGE_RESCUE_KEY') >= 0 && srcBody.indexOf('STORAGE_RESCUE_KEY') < srcBody.indexOf('STORAGE_PREV_KEY'));

const restoreBody = fnBody('restoreFromLocalPrev') || '';
ok('恢复成功后清掉两处副本（否则下次恢复又把旧账本盖回来）',
    /removeItem\(STORAGE_RESCUE_KEY\)/.test(restoreBody) && /removeItem\(STORAGE_PREV_KEY\)/.test(restoreBody));

console.log('\n=== 结束 ===');
if (failures) { console.log(`✗ ${failures} 条不通过\n`); process.exit(1); }
console.log('全部通过\n');
