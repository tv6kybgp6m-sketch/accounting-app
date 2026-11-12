// v1.39.94 多币种改造的 DOM 级冒烟测试
// 记账本 —— 月度账单 / 多币种 / 成员维度的冒烟测试
//
// 跑法：在项目根目录执行 `npm test`
// 依赖 jsdom（浏览器环境的最小模拟）：
//   1) 先用项目里的 node_modules（npm i -D jsdom 装上就最省事）
//   2) 找不到就用 WorkBuddy 自带的运行时（无需安装）
//   3) 都没有时给出明确的提示，不会报一堆看不懂的错
const fs = require('fs');
const path = require('path');

function loadJsdom() {
    const candidates = [];
    try { candidates.push(require.resolve('jsdom')); } catch (e) { /* 本地没装，往下找 */ }
    const workspace = path.join(process.env.HOME || '', '.workbuddy', 'binaries', 'node', 'workspace', 'node_modules');
    candidates.push(path.join(workspace, 'jsdom'));
    for (const c of candidates) {
        try { return require(c); } catch (e) { /* 换下一个 */ }
    }
    console.error('\n[缺依赖] 这个测试需要 jsdom 才能跑。两种装法任选一种：');
    console.error('  1) 在项目根目录执行：npm i -D jsdom');
    console.error('  2) 或者用 WorkBuddy 自带的运行时（本测试会自动去找它）\n');
    process.exit(2);
}
const { JSDOM } = loadJsdom();

// 仓库根目录 = 本文件所在目录的上一级
const REPO = path.resolve(__dirname, '..');
process.on('unhandledRejection', (e) => { console.log('  [unhandledRejection]', e && e.message); });
process.on('uncaughtException', (e) => { console.log('  [uncaughtException]', e && e.message); });

let src = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
src = src.replace('js/app.min.js', 'js/app.js');
const tmpHtml = path.join(REPO, '__test_index.html');   // 临时改写版 index.html，测完删除
fs.writeFileSync(tmpHtml, src);

const store = new Map();
const localStorageStub = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i) => { const a = Array.from(store.keys()); return i < a.length ? a[i] : null; },
    get length() { return store.size; },
};

const dom = new JSDOM(src, {
    url: 'file://' + tmpHtml,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window) {
        Object.defineProperty(window, 'localStorage', { value: localStorageStub });
        Object.defineProperty(window, 'userAgent', { value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) test' });
        window.prompt = () => null;
        window.confirm = () => true;
        window.alert = () => {};
        window.scrollTo = () => {};
        window.HTMLCanvasElement.prototype.getContext = function () {
            return {
                font: '', measureText: (t) => ({ width: String(t == null ? '' : t).length * 7 }),
                fillRect() {}, clearRect() {}, fillText() {}, strokeText() {},
                save() {}, restore() {}, beginPath() {}, closePath() {}, stroke() {}, fill() {},
                translate() {}, scale() {}, rotate() {}, arc() {}, moveTo() {}, lineTo() {},
                drawImage() {}, setTransform() {}, getImageData() { return { data: [] }; },
                putImageData() {}, createImageData() { return { data: [] }; }
            };
        };
    },
});

const w = dom.window;
let stage = 'init';
const ev = (code) => {
    try { return w.eval(code); }
    catch (e) {
        console.log('  [EVAL ERROR @ ' + stage + '] ' + (e && e.message));
        console.log('    code: ' + String(code).slice(0, 200).replace(/\n/g, ' '));
        return undefined;
    }
};
let failures = 0;
function ok(name, cond, extra) {
    console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (extra !== undefined ? '   → ' + JSON.stringify(extra) : ''));
    if (!cond) failures++;
    return cond;
}

// 新口径：汇率 = 「1 人民币 = ? 外币」→ 外币金额 ÷ 汇率 = 人民币
const USD_RATE = 0.14;   // 1 元 = 0.14 美元 → 100 美元 = 714.29 元
const HKD_RATE = 1.09;   // 1 元 = 1.09 港币 → 200 港币 = 183.49 元

w.addEventListener('load', () => { setTimeout(run, 300); });
setTimeout(() => { if (!global.__ran) { console.log('[timeout] load 未触发'); process.exit(2); } }, 15000);

async function run() {
    global.__ran = true;
    try {
        console.log('\n=== v1.39.94 冒烟测试（除法汇率 / 按币种锁 / 隐藏 / 按成员）===\n');

        // ---------- 1) 汇率是除法 ----------
        stage = '1';
        ok('fxToCNY 是除法：100 ÷ 0.14 = 714.29', Math.abs(ev('fxToCNY(100, 0.14)') - 714.2857) < 0.01, ev('fxToCNY(100, 0.14)'));
        ok('人民币恒等于 1：50 ÷ 1 = 50', ev('fxToCNY(50, 1)') === 50);
        // 老口径迁移：7.15（旧：1 美元 = 7.15 元）→ 1/7.15
        ev(`state.fxRates = { '2026-09': { USD: 7.15 } };`);
        ev(`localStorage.removeItem('bookkeeping_fx_div_v1'); migrateFxRatesToDiv();`);
        ok('老汇率取倒数迁移成新口径', Math.abs(ev("state.fxRates['2026-09'].USD") - 1 / 7.15) < 1e-9, ev("state.fxRates['2026-09'].USD"));
        ev(`localStorage.setItem('bookkeeping_fx_div_v1','1'); migrateFxRatesToDiv();`);
        ok('迁移只做一次（第二次不再翻）', Math.abs(ev("state.fxRates['2026-09'].USD") - 1 / 7.15) < 1e-9);

        // ---------- 2) 场景：两个账户 + 多币种 + 两个成员 ----------
        stage = '2';
        ev(`state.accounts = [
            { id:'a_plain', name:'支付宝', kind:'asset', group:'流动资金', color:'#111111', order:1, members:['本人'] },
            { id:'a_multi', name:'东方证券', kind:'asset', group:'投资理财', color:'#222222', order:2, multiCur:true, members:['本人','家人'] },
            { id:'a_wife',  name:'她的卡',   kind:'asset', group:'流动资金', color:'#333333', order:3, members:['家人'] }
        ];
            state.balanceMembers = ['本人','家人'];
            state.balances = []; state.returns = [];
            state.currencies = [{code:'USD',label:'美元',symbol:'$'},{code:'HKD',label:'港币',symbol:'HK$'}];
            state.deleted.currencies = [];
            state.monthlyOpen = {};
            state.fxRates = {};
            setFxRate('2026-09','USD',${USD_RATE}); setFxRate('2026-09','HKD',${HKD_RATE});
            paintModalMonth('monthly','2026-09'); openMonthlyModal('2026-09');`);
        ok('本人名下只看到自己的账户（支付宝 1 行 + 东方证券 3 行 = 4 行）',
            ev(`document.querySelectorAll('#monthlyEntryList .mw-tr[data-mw-account]').length`) === 4,
            ev(`document.querySelectorAll('#monthlyEntryList .mw-tr[data-mw-account]').length`));
        ok('家人的账户本人看不到',
            ev(`!document.getElementById('monthlyEntryList') ||
                document.querySelectorAll('#monthlyEntryList [data-mw-account="a_wife"]').length === 0`));

        // ---------- 3) 换算：÷ ----------
        stage = '3';
        ev(`var u = document.querySelector('#monthlyEntryList [data-bal="a_multi"][data-cat="cash"][data-cur="USD"]');
            u.value='100'; u.dispatchEvent(new Event('input',{bubbles:true}));
            var h = document.querySelector('#monthlyEntryList [data-bal="a_multi"][data-cat="cash"][data-cur="HKD"]');
            h.value='200'; h.dispatchEvent(new Event('input',{bubbles:true}));`);
        const sums = ev(`JSON.stringify(Array.from(document.querySelectorAll('#monthlyEntryList .mw-tr[data-mw-account]')).map(t=>({cur:t.dataset.mwCur, sum:(t.querySelector('[data-wsum]')||{}).textContent})))`);
        console.log('  各行小计:', sums);
        const parsed = JSON.parse(sums);
        ok('美元行小计 = 100 ÷ 0.14 = 714.29', parsed.find(x=>x.cur==='USD').sum.indexOf('714.29') >= 0, parsed.find(x=>x.cur==='USD'));
        ok('港币行小计 = 200 ÷ 1.09 = 183.49', parsed.find(x=>x.cur==='HKD').sum.indexOf('183.49') >= 0, parsed.find(x=>x.cur==='HKD'));
        ok('汇率框下面没有那行换算说明了',
            ev(`!document.querySelector('#mwFxStrip .mw-fx-hint')`));
        ok('「⋯」按钮跟输入框在同一行（对得齐）',
            ev(`(function(){
                var g = document.querySelector('#mwFxStrip [data-fx-item="USD"]');
                if (!g) return false;
                var inp = g.querySelector('.mw-fx-in');
                var more = g.querySelector('.mw-fx-more');
                if (!inp || !more) return false;
                var a = inp.getBoundingClientRect(), b = more.getBoundingClientRect();
                return Math.abs(a.top - b.top) < 12 && b.left >= a.left;
            })()`));

        // ---------- 4) 保存也是除法 ----------
        stage = '4';
        ev('saveMonthly();');
        const usdRec = ev(`JSON.stringify(state.balances.find(b=>b.cur==='USD'))`);
        console.log('  美元记录:', usdRec);
        ok('存下来的 amount = 714.29（÷ 汇率）', JSON.parse(usdRec).amount === 714.29, JSON.parse(usdRec).amount);
        ok('存下来的 foreign = 100（原币真实数）', JSON.parse(usdRec).foreign === 100);

        // ---------- 5) 锁按币种单独设置 ----------
        stage = '5';
        ev(`state.monthlyOpen = {};
            setChannelOpen('本人','a_multi','cash', true, 'CNY');
            setChannelOpen('本人','a_multi','cash', false, 'USD');`);
        const lockState = ev(`JSON.stringify({
            usd: isChannelOpen('本人','a_multi','cash','2026-09','USD'),
            cny: isChannelOpen('本人','a_multi','cash','2026-09','CNY')
        })`);
        console.log('  锁状态:', lockState);
        const ls = JSON.parse(lockState);
        ok('锁住美元那一行，不影响人民币那一行', ls.usd === false && ls.cny === true, ls);
        ok('锁状态按币种分层存',
            ev(`!!(state.monthlyOpen['本人']['a_multi']['USD'] && state.monthlyOpen['本人']['a_multi']['USD'].cash === false)`));
        // 老结构迁移
        ev(`state.monthlyOpen = { '本人': { 'a_multi': { cash: false } } }; migrateMonthlyOpenCur();`);
        ok('老的一层锁结构迁移到每个币种',
            ev(`state.monthlyOpen['本人']['a_multi'].USD.cash === false && state.monthlyOpen['本人']['a_multi'].CNY.cash === false`));

        // ---------- 6) 隐藏行 / 隐藏列 ----------
        stage = '6';
        ev(`hideSheetColumn('gold');`);
        ok('收起的列在当月不显示了', ev(`!document.querySelector('#monthlyEntryList [data-col-key="gold"]')`));
        ok('「隐藏的」按钮出现了并带数量',
            ev(`!document.getElementById('mwHiddenBtn').classList.contains('hidden') && document.getElementById('mwHiddenBtn').textContent.indexOf('1') >= 0`),
            ev(`document.getElementById('mwHiddenBtn').textContent`));
        // v1.41.17：收起改成「以后每个月都保持」，不再只对当月生效
        ev(`paintModalMonth('monthly','2026-08'); renderMonthlyEntry();`);
        ok('换到 8 月：那一列仍然收起（跨月保持）',
            ev(`!document.querySelector('#monthlyEntryList [data-col-key="gold"]')`));
        ok('长期收起按成员存、不带月份',
            ev(`(state.hiddenForever['本人'] && state.hiddenForever['本人'].cols || []).indexOf('gold') >= 0`));
        ev(`paintModalMonth('monthly','2026-09'); renderMonthlyEntry();`);
        ok('换回 9 月：那列仍然是收起的',
            ev(`!document.querySelector('#monthlyEntryList [data-col-key="gold"]')`));
        ev(`unhideSheetColumn('gold');`);
        ok('展开后列回来了', ev(`!!document.querySelector('#monthlyEntryList [data-col-key="gold"]')`));
        ev(`paintModalMonth('monthly','2026-08'); renderMonthlyEntry();`);
        ok('展开后换月份也不会再冒出来（两处一起清干净了）',
            ev(`!!document.querySelector('#monthlyEntryList [data-col-key="gold"]')`));
        ev(`paintModalMonth('monthly','2026-09'); renderMonthlyEntry();`);
        // 账户行同理
        ev(`hideMonthlyAccount('a_plain');`);
        ok('收起的账户在当月不显示',
            ev(`document.querySelectorAll('#monthlyEntryList [data-mw-account="a_plain"]').length === 0`));
        ev(`paintModalMonth('monthly','2026-08'); renderMonthlyEntry();`);
        ok('换到 8 月：那个账户也仍然收起（跨月保持）',
            ev(`document.querySelectorAll('#monthlyEntryList [data-mw-account="a_plain"]').length === 0`));
        ev(`paintModalMonth('monthly','2026-09'); renderMonthlyEntry();`);
        // 换成员：本人收起的，家人那边不受影响
        ev(`var s4 = document.getElementById('monthlyMemberSelect');
            s4.value='家人'; s4.dispatchEvent(new Event('change',{bubbles:true}));`);
        ok('本人收起的账户，在家人那边照旧显示（各人各记各的）',
            ev(`document.querySelectorAll('#monthlyEntryList [data-mw-account="a_wife"]').length >= 1`));
        ev(`var s5 = document.getElementById('monthlyMemberSelect');
            s5.value='本人'; s5.dispatchEvent(new Event('change',{bubbles:true}));
            paintModalMonth('monthly','2026-09'); renderMonthlyEntry();`);
        ok('切回本人：那个账户仍然是收起的',
            ev(`document.querySelectorAll('#monthlyEntryList [data-mw-account="a_plain"]').length === 0`));
        ev(`unhideMonthlyAccount('a_plain');`);
        ok('展开后账户回来了',
            ev(`document.querySelectorAll('#monthlyEntryList [data-mw-account="a_plain"]').length >= 1`));

        // ---------- 7) 币种条目：⋯ 菜单 / 预览模式 / 排序 ----------
        stage = '7';
        ok('没有常驻的 × 删除按钮了', ev(`document.querySelectorAll('#mwFxStrip .mw-fx-del').length`) === 0);
        ok('每个非人民币币种都有「⋯」按钮', ev(`document.querySelectorAll('#mwFxStrip [data-fx-more]').length`) === 2);
        ok('填过数据的币种是预览模式（框只读）',
            ev(`document.querySelector('#mwFxStrip [data-fx-cur="USD"]').readOnly`) === true);
        ev(`monthlyViewMode = false; renderFxStrip();
            document.querySelector('#mwFxStrip [data-fx-cur="USD"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));`);
        ok('点一下汇率数字就进编辑态（可改）',
            ev(`document.querySelector('#mwFxStrip [data-fx-cur="USD"]').readOnly`) === false);
        ok('币种条目可以拖动排序（draggable）',
            ev(`document.querySelectorAll('#mwFxStrip .mw-fx-grp[draggable="true"]').length`) === 3);
        ev(`reorderCurrency('HKD','USD');`);
        ok('拖动排序生效（港币排到美元前面）',
            ev(`state.currencies.map(c=>c.code).join(',')`) === 'HKD,USD', ev(`state.currencies.map(c=>c.code).join(',')`));

        // ---------- 8) 切家庭成员：草稿各留各的 + 自动存上一份 ----------
        stage = '8';
        ev(`state.balances = []; state.returns = []; state.monthlyOpen = {};
            paintModalMonth('monthly','2026-09'); openMonthlyModal('2026-09');
            var sel = document.getElementById('monthlyMemberSelect');
            sel.value='本人'; sel.dispatchEvent(new Event('change',{bubbles:true}));
            var a1 = document.querySelector('#monthlyEntryList [data-bal="a_plain"][data-cat="cash"][data-cur="CNY"]');
            a1.value='888'; a1.dispatchEvent(new Event('input',{bubbles:true}));`);
        ev('captureMonthlyInputs();');
        ok('本人名下填的数收进了草稿',
            ev(`(monthlyInput.bal['a_plain__CNY__cash'] || '') === '888'`, ev(`monthlyInput.bal['a_plain__CNY__cash']`)));
        ev(`var sel2 = document.getElementById('monthlyMemberSelect');
            sel2.value='家人'; sel2.dispatchEvent(new Event('change',{bubbles:true}));`);
        ok('切到家人后，本人那份自动存进了库里',
            ev(`!!state.balances.find(b=>b.member==='本人' && b.accountId==='a_plain' && b.amount===888)`),
            ev(`JSON.stringify(state.balances.map(b=>b.member+':'+b.accountId+':'+b.amount))`));
        ok('家人那边看不到本人账户的行',
            ev(`document.querySelectorAll('#monthlyEntryList [data-mw-account="a_plain"]').length === 0`));
        ok('家人那边能看到自己的账户',
            ev(`document.querySelectorAll('#monthlyEntryList [data-mw-account="a_wife"]').length === 1`));
        ev(`var a2 = document.querySelector('#monthlyEntryList [data-bal="a_wife"][data-cat="cash"][data-cur="CNY"]');
            a2.value='666'; a2.dispatchEvent(new Event('input',{bubbles:true}));`);
        ev(`var sel3 = document.getElementById('monthlyMemberSelect');
            sel3.value='本人'; sel3.dispatchEvent(new Event('change',{bubbles:true}));`);
        ok('切回本人：家人那份也自动存了',
            ev(`!!state.balances.find(b=>b.member==='家人' && b.accountId==='a_wife' && b.amount===666)`),
            ev(`JSON.stringify(state.balances.map(b=>b.member+':'+b.accountId+':'+b.amount))`));
        ok('切回本人后显示的还是本人填的数（888）',
            ev(`String(document.querySelector('#monthlyEntryList [data-bal="a_plain"][data-cat="cash"][data-cur="CNY"]').value)`) === '888',
            ev(`document.querySelector('#monthlyEntryList [data-bal="a_plain"][data-cat="cash"][data-cur="CNY"]').value`));

        // ---------- 9) 账户编辑窗口：成员勾选 ----------
        stage = '9';
        ev(`openAccountEdit('a_plain');`);
        ok('账户编辑窗口里有「属于哪些家庭成员」勾选框',
            ev(`!!document.getElementById('acctEditMembers') && document.querySelectorAll('#acctEditMembers input[type="checkbox"]').length`) === 2);
        ok('本人账户默认只勾了「本人」',
            ev(`Array.from(document.querySelectorAll('#acctEditMembers input:checked')).map(i=>i.value).join(',')`) === '本人');
        ev(`var cb = document.querySelector('#acctEditMembers input[value="家人"]');
            cb.checked = true;
            document.getElementById('acctEditName').value = '支付宝';
            saveAccountEdit();`);
        ok('保存后账户归属两个成员',
            ev(`(state.accounts.find(a=>a.id==='a_plain').members||[]).slice().sort().join(',') === '家人,本人'`),
            ev(`JSON.stringify(state.accounts.find(a=>a.id==='a_plain').members)`));

        // ---------- 9b) 共享账户：切成员不串草稿（v1.41.12 回归） ----------
        // 支付宝在 stage 9 里已勾成「本人 + 家人」共用，两人的格子 key 完全一样。
        // 以前切成员时下拉先变、表格还没重画，旧格子会被收进新成员的草稿，
        // 本人的数就显示（并被保存）到家人名下。旧测试用的是成员专属账户，切过去整行消失，抓不到。
        stage = '9b';
        ev(`state.balances = []; state.returns = []; state.monthlyOpen = {};
            paintModalMonth('monthly','2026-09'); openMonthlyModal('2026-09');
            var s0 = document.getElementById('monthlyMemberSelect');
            s0.value='本人'; s0.dispatchEvent(new Event('change',{bubbles:true}));
            var ali = document.querySelector('#monthlyEntryList [data-bal="a_plain"][data-cat="cash"][data-cur="CNY"]');
            ali.value='5000'; ali.dispatchEvent(new Event('input',{bubbles:true}));`);
        ok('本人在共用的「支付宝」里填了 5000',
            ev(`(document.querySelector('#monthlyEntryList [data-bal="a_plain"][data-cat="cash"][data-cur="CNY"]')||{}).value`) === '5000');
        ev(`var s1 = document.getElementById('monthlyMemberSelect');
            s1.value='家人'; s1.dispatchEvent(new Event('change',{bubbles:true}));`);
        ok('切到家人：本人那 5000 自动存在本人名下',
            ev(`!!state.balances.find(b=>b.member==='本人' && b.accountId==='a_plain' && b.amount===5000)`),
            ev(`JSON.stringify(state.balances.map(b=>b.member+':'+b.accountId+':'+b.amount))`));
        ok('重画后表格归属已跟着切到家人',
            ev(`monthlyRenderedMember`) === '家人', ev(`monthlyRenderedMember`));
        ok('家人页面里同一个支付宝格子是空的，不是 5000',
            ev(`(function(){ var i=document.querySelector('#monthlyEntryList [data-bal="a_plain"][data-cat="cash"][data-cur="CNY"]'); return !!i && String(i.value).trim()===''; })()`),
            ev(`(document.querySelector('#monthlyEntryList [data-bal="a_plain"][data-cat="cash"][data-cur="CNY"]')||{}).value`));
        ok('家人的草稿里没有混进本人的数',
            ev(`!monthlyDrafts['家人'] || monthlyDrafts['家人'].bal['a_plain__CNY__cash'] === undefined`),
            ev(`JSON.stringify((monthlyDrafts['家人']||{}).bal)`));
        ev(`saveMonthlyFor('家人', { quiet:true });`);
        ok('在家人页面点保存，也不会把 5000 记到家人名下',
            ev(`!state.balances.find(b=>b.member==='家人' && b.amount===5000)`),
            ev(`JSON.stringify(state.balances.map(b=>b.member+':'+b.accountId+':'+b.amount))`));
        ev(`var s2 = document.getElementById('monthlyMemberSelect');
            s2.value='本人'; s2.dispatchEvent(new Event('change',{bubbles:true}));`);
        ok('切回本人，5000 还在',
            ev(`String((document.querySelector('#monthlyEntryList [data-bal="a_plain"][data-cat="cash"][data-cur="CNY"]')||{}).value)`) === '5000',
            ev(`(document.querySelector('#monthlyEntryList [data-bal="a_plain"][data-cat="cash"][data-cur="CNY"]')||{}).value`));


        // ---------- 10) 顺序按家庭成员分开 ----------
        stage = '10';
        ev(`state.accounts = [
            { id:'a1', name:'账户A', kind:'asset', group:'流动资金', color:'#111111', order:1, members:['本人','家人'] },
            { id:'a2', name:'账户B', kind:'asset', group:'流动资金', color:'#222222', order:2, members:['本人','家人'] },
            { id:'a3', name:'账户C', kind:'asset', group:'流动资金', color:'#333333', order:3, members:['本人','家人'] }
        ];
            state.sheetColOrder = {};
            state.hiddenItems = {};
            paintModalMonth('monthly','2026-09'); openMonthlyModal('2026-09');
            var sel7 = document.getElementById('monthlyMemberSelect');
            sel7.value='本人'; sel7.dispatchEvent(new Event('change',{bubbles:true}));`);
        const orderBefore = ev(`Array.from(document.querySelectorAll('#monthlyEntryList .mw-tr[data-mw-account]')).map(t=>t.dataset.mwAccount).join(',')`);
        ok('本名的行序是 A,B,C', orderBefore === 'a1,a2,a3', orderBefore);
        ev(`reorderMonthlyAccount('a1','a3');`);
        const orderAfter = ev(`Array.from(document.querySelectorAll('#monthlyEntryList .mw-tr[data-mw-account]')).map(t=>t.dataset.mwAccount).join(',')`);
        ok('本人拖动后行序变了（A 插到 C 前面）', orderAfter === 'a2,a1,a3', orderAfter);
        ok('次序只写进了本人名下',
            ev(`!!(state.accounts.find(a=>a.id==='a1').orders||{})['本人']`));
        ev(`var sel8 = document.getElementById('monthlyMemberSelect');
            sel8.value='家人'; sel8.dispatchEvent(new Event('change',{bubbles:true}));
            paintModalMonth('monthly','2026-09'); renderMonthlyEntry();`);
        const orderFam = ev(`Array.from(document.querySelectorAll('#monthlyEntryList .mw-tr[data-mw-account]')).map(t=>t.dataset.mwAccount).join(',')`);
        ok('家人那边的行序没跟着变（还是 A,B,C）', orderFam === 'a1,a2,a3', orderFam);
        // 列也一样
        ev(`var sel9 = document.getElementById('monthlyMemberSelect');
            sel9.value='本人'; sel9.dispatchEvent(new Event('change',{bubbles:true}));
            paintModalMonth('monthly','2026-09'); renderMonthlyEntry();
            moveSheetColumn('gold','cash');`);
        ok('本人名下把「黄金」拖到了「现金」前面',
            ev(`sheetColsFor('本人').map(c=>c.key).join(',')`).indexOf('gold') <
            ev(`sheetColsFor('本人').map(c=>c.key).join(',')`).indexOf('cash'));
        ok('家人那边的列顺序没跟着变（还是默认顺序）',
            ev(`sheetColsFor('家人').map(c=>c.key).join(',')`) === ev(`getSheetCols().map(c=>c.key).join(',')`),
            ev(`sheetColsFor('家人').map(c=>c.key).join(',')`));

        // ---------- 11) 文字 / 布局 ----------
        stage = '11';
        ok('表头写的是「账户 / 类型」',
            ev(`(document.querySelector('#monthlyEntryList .mw-corner')||{}).textContent`) === '账户 / 类型');
        ok('加币种按钮的文字是「加币种」',
            ev(`(document.getElementById('mwAddCurBtn')||{}).textContent`) === '加币种');
        ok('「⋯」跟币种名字同一行（不在输入框那行）',
            ev(`(function(){
                var g = document.querySelector('#mwFxStrip [data-fx-item="USD"]');
                if (!g) return false;
                var name = g.querySelector('.mw-fx-cur');
                var more = g.querySelector('.mw-fx-more');
                var inp = g.querySelector('.mw-fx-in');
                if (!name || !more || !inp) return false;
                var a = name.getBoundingClientRect(), b = more.getBoundingClientRect(), c = inp.getBoundingClientRect();
                return Math.abs(a.top - b.top) < 8 && b.bottom <= c.top + 2;
            })()`));
        ok('这一行的控件高度统一（样式表里都是 32px）',
            ev(`(function(){
                function ruleOf(sel, prop){
                    for (var i=0;i<document.styleSheets.length;i++){
                        var rules; try { rules = document.styleSheets[i].cssRules; } catch(e){ continue; }
                        if (!rules) continue;
                        for (var j=0;j<rules.length;j++){
                            var r = rules[j];
                            if (r.selectorText === sel) return r.style[prop] || '';
                        }
                    }
                    return '';
                }
                return ruleOf('.mw-fx-in', 'height') === '32px'
                    && ruleOf('.bal-entry-head .mw-fxstrip .btn-mini', 'height') === '32px';
            })()`));
        ok('家庭成员下拉比之前窄了',
            ev(`(function(){
                var g = document.querySelector('.bal-entry-head .mw-member-group');
                return g ? g.getBoundingClientRect().width <= 140 : false;
            })()`));


        // ---------- 12) 汇率只读模式 + 成员下拉自适应宽度 ----------
        stage = '12';
        ev(`state.balances = [{ id:'x1', member:'本人', accountId:'a_plain', cur:'USD', cat:'cash',
                month:'2026-09', amount:100, foreign:100, rate:0.14, createdAt:1, updatedAt:1 }];
            state.returns = [];
            state.currencies = [{code:'USD',label:'美元',symbol:'$'}];
            state.balanceMembers = ['本人'];
            paintModalMonth('monthly','2026-09'); openMonthlyModal('2026-09');`);
        ok('这个月有数据 → 页面默认是查看模式', ev(`monthlyViewMode`) === true);
        ok('查看模式下汇率框只读',
            ev(`document.querySelector('#mwFxStrip [data-fx-cur="USD"]').readOnly`) === true);
        ev(`document.querySelector('#mwFxStrip [data-fx-cur="USD"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));`);
        ok('查看模式下点汇率数字也不会变成可编辑',
            ev(`document.querySelector('#mwFxStrip [data-fx-cur="USD"]').readOnly`) === true);
        ev(`monthlyViewMode = false; renderMonthlyEntry();`);
        ok('切到编辑模式后：这个币种记过数 → 仍然只读',
            ev(`document.querySelector('#mwFxStrip [data-fx-cur="USD"]').readOnly`) === true);
        ev(`document.querySelector('#mwFxStrip [data-fx-cur="USD"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));`);
        ok('点一下这个数字才进编辑态（可以输入了）',
            ev(`document.querySelector('#mwFxStrip [data-fx-cur="USD"]').readOnly`) === false);
        ok('没记过数的币种不受影响（直接能填）',
            ev(`(function(){
                state.currencies = [{code:'USD',label:'美元',symbol:'$'},{code:'JPY',label:'日元',symbol:'¥'}];
                renderFxStrip();
                var j = document.querySelector('#mwFxStrip [data-fx-cur="JPY"]');
                return j ? j.readOnly === false : false;
            })()`));

        // 成员下拉宽度按最长名字
        ev(`state.balanceMembers = ['本人','丈母娘','小王'];
            paintModalMonth('monthly','2026-09'); renderMonthlyEntry();`);
        ok('三个字的成员名 → 下拉宽度跟着变（77px）',
            ev(`document.querySelector('.bal-entry-head .mw-member-group').style.width`) === '77px',
            ev(`document.querySelector('.bal-entry-head .mw-member-group').style.width`));
        ev(`state.balanceMembers = ['本人'];
            paintModalMonth('monthly','2026-09'); renderMonthlyEntry();`);
        ok('只有两个字时收窄（76px）',
            ev(`document.querySelector('.bal-entry-head .mw-member-group').style.width`) === '76px',
            ev(`document.querySelector('.bal-entry-head .mw-member-group').style.width`));


        // ---------- 13) 汇率不自动沿用上月 + 缺汇率标红 + 隐藏单行能找回 ----------
        stage = '13';
        ev(`state.accounts = [{ id:'a_m2', name:'券商', kind:'asset', group:'投资理财', color:'#333333', order:1, multiCur:true, members:['本人'] }];
            state.balanceMembers = ['本人'];
            state.currencies = [{code:'USD',label:'美元',symbol:'$'}];
            state.deleted.currencies = [];
            state.fxRates = { '2026-08': { USD: 0.14 } };   // 上个月填过
            state.balances = []; state.returns = [];
            state.hiddenItems = {};
            state.monthlyOpen = {};
            monthlyViewMode = false;
            paintModalMonth('monthly','2026-09'); openMonthlyModal('2026-09');`);
        ok('上个月填过汇率，这个月的框还是空的（不自动沿用）',
            ev(`String(document.querySelector('#mwFxStrip [data-fx-cur="USD"]').value)`) === '',
            ev(`String(document.querySelector('#mwFxStrip [data-fx-cur="USD"]').value)`));
        ok('没填外币时汇率框不标红',
            ev(`document.querySelector('#mwFxStrip [data-fx-cur="USD"]').classList.contains('mw-fx-missing')`) === false);
        // 填了外币但没填汇率 → 标红 + 不许保存
        ev(`var u = document.querySelector('#monthlyEntryList [data-bal="a_m2"][data-cat="cash"][data-cur="USD"]');
            u.value='100'; u.dispatchEvent(new Event('input',{bubbles:true}));`);
        ok('填了外币但没填汇率 → 那个汇率框变红',
            ev(`document.querySelector('#mwFxStrip [data-fx-cur="USD"]').classList.contains('mw-fx-missing')`) === true);
        const balBefore = ev('state.balances.length');
        ev('saveMonthly();');
        ok('缺汇率时存不了（数据没丢）',
            ev('state.balances.length') === balBefore && ev('state.balances.length') === balBefore);
        ok('缺汇率时弹窗还开着',
            ev(`!document.getElementById('monthlyModal').classList.contains('hidden')`));
        // 填上汇率 → 不标红了 → 能存
        ev(`var r = document.querySelector('#mwFxStrip [data-fx-cur="USD"]');
            r.value='0.14'; r.dispatchEvent(new Event('input',{bubbles:true}));
            updateMonthlyDerived();`);
        ok('填上汇率后不标红了',
            ev(`document.querySelector('#mwFxStrip [data-fx-cur="USD"]').classList.contains('mw-fx-missing')`) === false);
        ev('saveMonthly();');
        ok('填了汇率就能存了',
            ev(`!!state.balances.find(b=>b.cur==='USD' && b.amount===714.29)`),
            ev(`JSON.stringify(state.balances.map(b=>b.cur+':'+b.amount))`));

        // 隐藏单行 + 能找回
        ev(`paintModalMonth('monthly','2026-09'); openMonthlyModal('2026-09');
            monthlyViewMode = false; renderMonthlyEntry();`);
        const rowsAll = ev(`Array.from(document.querySelectorAll('#monthlyEntryList .mw-tr[data-mw-account]')).map(t=>t.dataset.mwCur).join(',')`);
        ok('多资产账户默认 3 行（人民币/美元/…）', rowsAll.split(',').length === 2, rowsAll);
        ev(`hideMonthlyAccountRow('a_m2','CNY');`);
        const rowsHidden = ev(`Array.from(document.querySelectorAll('#monthlyEntryList .mw-tr[data-mw-account]')).map(t=>t.dataset.mwCur).join(',')`);
        ok('隐藏人民币那一行后只剩美元那行', rowsHidden === 'USD', rowsHidden);
        ok('隐藏行不删数据（记录还在）',
            ev(`!!state.balances.find(b=>b.accountId==='a_m2'&&b.cur==='USD')`));
        ok('「隐藏的」按钮数量把行也算进去',
            ev(`document.getElementById('mwHiddenBtn').textContent.indexOf('1') >= 0`),
            ev(`document.getElementById('mwHiddenBtn').textContent`));
        ev(`unhideMonthlyAccountRow('a_m2','CNY');`);
        const rowsBack = ev(`Array.from(document.querySelectorAll('#monthlyEntryList .mw-tr[data-mw-account]')).map(t=>t.dataset.mwCur).join(',')`);
        ok('展开后人民币那行回来了', rowsBack.indexOf('CNY') >= 0, rowsBack);


        // ---------- 14) 负收益：负号不能丢 ----------
        stage = '14';
        ok('月度账单的解析保留负号（-100 → -100）', ev(`parseMonthlyAmount('-100')`) === -100);
        ok('记账页的金额仍然只存正数（收支方向由类型决定）', ev(`pasteToCalcExpr('-100')`) === '100');
        ok('带加减的表达式也正常', ev(`parseMonthlyAmount('100-50')`) === 50);
        ev(`state.accounts = [{ id:'a_neg', name:'券商', kind:'asset', group:'投资理财', color:'#333333', order:1, members:['本人'] }];
            state.balanceMembers = ['本人'];
            state.balances = []; state.returns = [];
            state.monthlyOpen = {}; state.hiddenItems = {}; state.fxRates = {};
            state.currencies = [];
            monthlyViewMode = false;
            paintModalMonth('monthly','2026-09'); openMonthlyModal('2026-09');
            monthlyViewMode = false; renderMonthlyEntry();`);
        ev(`var r = document.querySelector('#monthlyEntryList [data-ret="a_neg"][data-cur="CNY"]');
            r.value='-100'; r.dispatchEvent(new Event('input',{bubbles:true}));`);
        ok('填了负收益，框里还是 -100', ev(`String(document.querySelector('#monthlyEntryList [data-ret="a_neg"][data-cur="CNY"]').value)`) === '-100');
        ev('saveMonthly();');
        ok('负收益按 -100 存进去了（不是 +100）',
            ev(`!!state.returns.find(r=>r.accountId==='a_neg' && r.amount===-100)`),
            ev(`JSON.stringify(state.returns.map(r=>r.amount))`));
        ev(`paintModalMonth('monthly','2026-09'); renderMonthlyEntry();`);
        ok('重新打开还是 -100',
            ev(`String(document.querySelector('#monthlyEntryList [data-ret="a_neg"][data-cur="CNY"]').value)`) === '-100',
            ev(`String(document.querySelector('#monthlyEntryList [data-ret="a_neg"][data-cur="CNY"]').value)`));
        ok('收益合计也是负的',
            ev(`(function(){
                var c = document.querySelector('#monthlyEntryList .mw-total-row [data-tcol="__ret"] [data-tval]');
                return c ? c.textContent : '';
            })()`).indexOf('-100') >= 0,
            ev(`(function(){
                var c = document.querySelector('#monthlyEntryList .mw-total-row [data-tcol="__ret"] [data-tval]');
                return c ? c.textContent : '';
            })()`));

        // ---------- 15) 交易记录：同一天按时刻晚→早 ----------
        stage = '15';
        ev("state.monthFilter=''; state.searchQuery=''; state.transactionFilter='all'; txnAnomalyOnly=false; state.excludedAnomalies={};" +
           "state.transactions = [" +
           "{id:'a',date:'2026-09-10',time:'09:05',type:'expense',amount:10,categoryId:'c1',paymentMethod:'现金'}," +
           "{id:'b',date:'2026-09-10',time:'12:30',type:'expense',amount:20,categoryId:'c1',paymentMethod:'现金'}," +
           "{id:'c',date:'2026-09-10',time:'19:40',type:'expense',amount:30,categoryId:'c1',paymentMethod:'现金'}," +
           "{id:'d',date:'2026-09-10',time:'',type:'expense',amount:40,categoryId:'c1',paymentMethod:'现金'}," +
           "{id:'e',date:'2026-09-11',time:'08:00',type:'expense',amount:50,categoryId:'c1',paymentMethod:'现金'}," +
           "{id:'f',date:'2026-09-09',time:'23:00',type:'expense',amount:60,categoryId:'c1',paymentMethod:'现金'}" +
           "]; renderTransactions();");
        const txnOrder = JSON.parse(ev("JSON.stringify(Array.from(document.querySelectorAll('#allTransactions .transaction-item')).map(function(el){ return el.getAttribute('onclick'); }))") || '[]');
        ok('同一天按时刻晚→早（19:40 → 12:30 → 09:05 → 未填时刻）',
            JSON.stringify(txnOrder) === JSON.stringify([
                "editTransaction('e')", "editTransaction('c')", "editTransaction('b')",
                "editTransaction('a')", "editTransaction('d')", "editTransaction('f')"
            ]), txnOrder);
        ok('日期分组仍然新→旧（9/11 在最上、9/9 在最下）',
            txnOrder[0] === "editTransaction('e')" && txnOrder[txnOrder.length - 1] === "editTransaction('f')");
        ok('排序不动 state.transactions 的存储顺序', ev("state.transactions[0].id") === 'a');
        ok('时刻解析兼容 H:m / HH:mm / HH:mm:ss / 空值',
            ev("JSON.stringify([txnTimeMinutes({time:'9:5'}),txnTimeMinutes({time:'09:05'}),txnTimeMinutes({time:'19:40:30'}),txnTimeMinutes({time:''})])")
                === JSON.stringify([545, 545, 1180, -1]));

        // ---------- 16) 每次进入报表页：当月 + 月报 + 饼图 ----------
        stage = '16';
        ev("state.reportPeriod='year'; state.reportYear=2020; state.reportMonth=3; state.reportChartType='line'; state.reportGranularity='year'; switchView('reports');");
        ok('点进报表页自动回到「月报 + 今年 + 本月」',
            ev("(function(){var d=new Date();return state.reportPeriod==='month' && state.reportYear===d.getFullYear() && state.reportMonth===(d.getMonth()+1);})()"),
            ev("JSON.stringify([state.reportPeriod,state.reportYear,state.reportMonth])"));
        ok('点进报表页默认是饼图', ev("state.reportChartType") === 'pie', ev("state.reportChartType"));
        ok('顶部「月报」按钮跟着高亮',
            ev("(function(){var b=document.querySelector('#view-reports .period-btn.active');return b?b.dataset.period:'';})()") === 'month');
        // 页面内部的刷新不该把用户刚选的月份冲掉
        ev("state.reportMonth=9; state.reportChartType='bar'; renderReports();");
        ok('在报表页里改月份/图表后，页面内部刷新不会重置',
            ev("state.reportMonth===9 && state.reportChartType==='bar'"),
            ev("JSON.stringify([state.reportMonth,state.reportChartType])"));

        // ---------- 17) 金额眼睛默认闭着 + 月结排除可同步 ----------
        stage = '17';
        ev("state.moneyVisibleByPage = {balance:true,funds:true,returns:true}; switchView('balance');");
        ok('点进资产负债表，金额眼睛默认闭着', ev("state.moneyVisibleByPage.balance") === false);
        ev("switchView('funds'); switchView('returns');");
        ok('点进四笔钱 / 投资收益，眼睛也闭着',
            ev("state.moneyVisibleByPage.funds===false && state.moneyVisibleByPage.returns===false"));
        ev("toggleMoneyEye('returns'); renderView('returns');");
        ok('页面内点开眼睛后，页内刷新不会把它按回去', ev("state.moneyVisibleByPage.returns") === true);
        ev("switchView('returns');");
        ok('退出再进来又闭着', ev("state.moneyVisibleByPage.returns") === false);

        // 月结「排除」：载荷 / 指纹 / 落盘 / 恢复墓碑
        ev("state.closedExclude = {a_x:true};");
        ok('月结排除名单进了同步载荷',
            ev("(function(){var d=buildSyncPayload().data;return !!d.closedExclude && d.closedExclude.a_x===true;})()"));
        const fpEx1 = ev("fingerprintOfPayload(buildSyncPayload())");
        ev("state.closedExclude.a_y = true;");
        const fpEx2 = ev("fingerprintOfPayload(buildSyncPayload())");
        ok('新排除一个账户会改变指纹（才会触发上传）', fpEx1 !== fpEx2);
        ev("clearAllClosedExclude();");
        ok('点「恢复」留下 false 墓碑，不是清空名单',
            ev("state.closedExclude.a_x===false && state.closedExclude.a_y===false"));
        ok('「恢复」也改变指纹（能同步出去）', fpEx2 !== ev("fingerprintOfPayload(buildSyncPayload())"));
        ev("saveStateNow();");
        ok('排除名单写进本机存储（刷新不会丢）',
            ev("(function(){var raw=localStorage.getItem(STORAGE_KEY);if(!raw)return false;var d=JSON.parse(unpackFromStorage(raw));return !!d.closedExclude && d.closedExclude.a_x===false;})()"));
        ok('另一台设备的旧 true 不会把「恢复」搬回来',
            ev("(function(){try{state.closedExclude={a_x:false};mergeRemoteData({data:{closedExclude:{a_x:true}}});return state.closedExclude.a_x===false;}catch(e){return false;}})()"));

        // ---------- 18) v1.41.6：四项改动的回归 ----------
        stage = '18';
        // 18a) 交易异常提示：无异常时不显示「已排除 N 笔」
        ev("state.transactions=[{id:'t1',type:'expense',amount:10,date:'2026-11-01',categoryId:'c1',member:'本人'}]; state.excludedAnomalies={t1:true}; renderTxnAnomalyHint();");
        ok('无异常时只显示「未发现异常」，不显示「已排除 N 笔」',
            ev("document.getElementById('txnAnomalyHint').innerHTML.indexOf('已排除')<0 && document.getElementById('txnAnomalyHint').innerHTML.indexOf('未发现异常')>=0"),
            ev("document.getElementById('txnAnomalyHint').innerHTML"));

        // 18b) 净资产变动桥跟随时间选择器：year 取该年最后有记录月 vs 上一年最后有记录月
        ev("state.balances=[{id:'本人__a__CNY__asset__2025-11',member:'本人',accountId:'a',cur:'CNY',cat:'asset',amount:100,month:'2025-11',updatedAt:1},{id:'本人__a__CNY__asset__2026-03',member:'本人',accountId:'a',cur:'CNY',cat:'asset',amount:200,month:'2026-03',updatedAt:2},{id:'本人__a__CNY__asset__2026-05',member:'本人',accountId:'a',cur:'CNY',cat:'asset',amount:300,month:'2026-05',updatedAt:3}]; state.balanceOwner='本人';");
        ev("state.balancePeriod='year'; state.balanceYear=2026;");
        const nb = ev("(function(){var info={period:'year'};var mp=netBridgeMonths(info);return mp?mp.cur+'|'+mp.prev:'null';})()");
        ok('净资产桥 year 模式：该年最后有记录月 vs 上一年最后有记录月', nb === '2026-05|2025-11', nb);
        ev("state.balancePeriod='month'; state.balanceYear=2026; state.balanceMonth=3;");
        const nb2 = ev("(function(){var info=balancePeriodInfo();var mp=netBridgeMonths(info);return mp?mp.cur+'|'+mp.prev:'null';})()");
        ok('净资产桥 month 模式：选定月 vs 上月', nb2 === '2026-03|2026-02', nb2);

        // 18c) 保险险种：远端名单并集 + 删除墓碑跨设备生效
        ev("state.insuranceTypes=['重疾险','医疗险'];");
        ev("mergeRemoteData({data:{insuranceTypes:['重疾险','医疗险','意外险']}});");
        ok('合并远端险种清单（并集，不丢本地）', ev("state.insuranceTypes.indexOf('意外险')>=0 && state.insuranceTypes.length===3"), ev("JSON.stringify(state.insuranceTypes)"));
        ev("addTombstone('insuranceTypes','意外险');");
        const itAfter = ev("(function(){applyTombstones();return state.insuranceTypes.indexOf('意外险');})()");
        ok('险种删除墓碑生效（applyTombstones 把它从清单剔除）', itAfter < 0, itAfter);

        // ---------- 19) v1.41.8：保险 ⋯ 贴着险种名 + 缴费日期日历弹层 ----------
        stage = '19';
        ev("state.insuranceTypes=['重疾险']; state.insuranceMembers=['本人']; fundEditMember='本人'; state.insurancePolicies=[{id:'重疾险__本人',type:'重疾险',member:'本人',covered:true,amount:0,premium:0,renewAt:'2026-11-20',createdAt:1,updatedAt:1}]; renderInsuranceSection();");
        ok('⋯ 紧跟险种名称右边，不再排在理赔记录后面',
            ev("(function(){var row=document.querySelector('#insList .ins-row');if(!row)return false;var wrap=row.querySelector('.ins-name-wrap');var more=row.querySelector('.ins-type-more');var claim=row.querySelector('.ins-claim-btn');var kids=Array.prototype.slice.call(row.children);return !!wrap && !!more && wrap.contains(more) && !!wrap.querySelector('.ins-type') && kids.indexOf(more)<kids.indexOf(claim);})()"));
        ev("document.querySelector('#insList .ins-renew-at').click();");
        ok('点日期框弹出日历窗口，日历下面有「清除缴费日期」',
            ev("(function(){var p=document.querySelector('.ins-date-pop');if(!p)return false;var foot=p.querySelector('.idp-foot .idp-clear');return !!p.querySelector('.idp-grid .idp-day') && !!foot && foot.textContent.indexOf('清除缴费日期')>=0;})()"));
        ok('日历停在已设日期那个月并高亮那天',
            ev("(function(){var p=document.querySelector('.ins-date-pop');return !!p && p.querySelector('.idp-title').textContent==='2026年11月' && !!p.querySelector('.idp-day.active[data-idp-day=\"2026-11-20\"]');})()"));
        ev("document.querySelector('.ins-date-pop .idp-clear').click();");
        ok('点「清除缴费日期」真清掉 renewAt 且窗口关闭',
            ev("(function(){return insPolicy('重疾险',fundEditMember).renewAt===null && !document.querySelector('.ins-date-pop');})()"));
        ok('3 点菜单里已不再放「清除缴费日期」',
            ev("(function(){document.querySelector('#insList .ins-type-more').click();var m=document.querySelector('.mw-ctx-menu');return !!m && m.textContent.indexOf('清除缴费日期')<0 && m.textContent.indexOf('修改名称')>=0 && m.textContent.indexOf('删除')>=0;})()"));
        ev("closeMwMenu(); closeInsDatePop();");

        // ---------- 20) v1.41.9：净资产桥 年 / 全部 按整段区间累计 ----------
        stage = '20';
        // 自洽的假账：2025-12 净资产 100 万；2026 年每月存 1 万、投资赚 5000；
        // 到 2026-12 是 118 万。若只算 12 月，待核对会虚增 16.5 万（这就是"假账"）。
        ev("(function(){var k=sheetAssetCats()[0].key; state.balanceOwner='本人'; state.balances=[{id:'x1',member:'本人',accountId:'a',cur:'CNY',cat:k,amount:1000000,month:'2025-12',updatedAt:1},{id:'x2',member:'本人',accountId:'a',cur:'CNY',cat:k,amount:1180000,month:'2026-12',updatedAt:2}]; state.transactions=[]; state.returns=[]; for(var m=1;m<=12;m++){var mm=String(m).padStart(2,'0'); state.transactions.push({id:'t'+m,type:'income',amount:10000,date:'2026-'+mm+'-15',member:'本人'}); state.returns.push({id:'r'+m,month:'2026-'+mm,accountId:'a',amount:5000,member:'本人'});} state.balancePeriod='year'; state.balanceYear=2026;})()");
        const yrRange = ev("(function(){var mp=netBridgeMonths(balancePeriodInfo());return mp?mp.cur+'|'+mp.prev+'|'+mp.range.length+'|'+mp.fallback:'null';})()");
        ok('年报：去年最后有记录月 → 今年最后有记录月，区间 12 个月', yrRange === '2026-12|2025-12|12|null', yrRange);
        const yrSum = ev("(function(){var mp=netBridgeMonths(balancePeriodInfo());var b=netWorthBridge(mp.cur,mp.prev,mp.range);return JSON.stringify([b.delta,b.saved,b.profit,b.unexplained,b.balanced]);})()");
        ok('年报把中间 11 个月的储蓄/收益都累计，待核对回到 0（不再造假账）', yrSum === '[180000,120000,60000,0,true]', yrSum);
        ok('单 month 老口径不变（只累计 1 个月）',
            ev("(function(){state.balancePeriod='month';state.balanceMonth=12;var mp=netBridgeMonths(balancePeriodInfo());var b=netWorthBridge(mp.cur,mp.prev,mp.range);return mp.cur+'|'+mp.prev+'|'+mp.range.length+'|'+b.saved+'|'+b.profit;})()") === '2026-12|2026-11|1|10000|5000');

        // 全部：从账本最早那个月累计到最新那个月（区间按自然月，不是只挑有余额的月）
        ev("(function(){var k=sheetAssetCats()[0].key; state.balances.unshift({id:'x0',member:'本人',accountId:'a',cur:'CNY',cat:k,amount:800000,month:'2024-06',updatedAt:0}); state.balancePeriod='all';})()");
        const allInfo = ev("(function(){var mp=netBridgeMonths(balancePeriodInfo());return mp.cur+'|'+mp.prev+'|'+mp.range.length+'|'+mp.fallback;})()");
        ok('全部：从账本最早月累计到最新月，30 个自然月', allInfo === '2026-12|2024-06|30|fromFirst', allInfo);

        // 去年空白 / 今年才开始：不悄悄退化成单月，而是从账本最早月算起并标记原因
        ev("(function(){var k=sheetAssetCats()[0].key; state.balances=[{id:'y1',member:'本人',accountId:'a',cur:'CNY',cat:k,amount:1000000,month:'2026-01',updatedAt:1},{id:'y2',member:'本人',accountId:'a',cur:'CNY',cat:k,amount:1180000,month:'2026-12',updatedAt:2}]; state.balancePeriod='year'; state.balanceYear=2026;})()");
        const fbInfo = ev("(function(){var mp=netBridgeMonths(balancePeriodInfo());return mp.cur+'|'+mp.prev+'|'+mp.range.length+'|'+mp.fallback;})()");
        ok('去年没记录 → 从账本最早月算起，不退化成单月', fbInfo === '2026-12|2026-01|11|noLastYear', fbInfo);

        // 数据说明真的写进了页面（标题 / 标签 / 区间文字）
        ev("(function(){window.Chart=function(){this.destroy=function(){};}; charts.bridge=null; renderNetBridge();})()");
        ok('页面上有数据说明：区间、共几个月、其中几个月有余额记录',
            ev("(function(){var t=document.getElementById('bridgeNote').innerHTML;return t.indexOf('数据说明')>=0 && t.indexOf('统计区间')>=0 && t.indexOf('共 11 个月')>=0 && t.indexOf('其中 1 个月有余额记录')>=0;})()"),
            ev("document.getElementById('bridgeNote').textContent.slice(0,120)"));
        ok('跨期时行标签改成「本期储蓄」，标题写明回退原因',
            ev("(function(){var r=document.getElementById('bridgeRows').innerHTML;var t=document.getElementById('bridgeNote').innerHTML;return r.indexOf('本期储蓄')>=0 && t.indexOf('去年没有余额记录')>=0;})()"));
        ev("closeMwMenu(); closeInsDatePop();");

        // ---------- 21) v1.41.10：Mac 侧栏层次 + 启动锁屏 + 一次口令全会话复用 ----------
        stage = '21';
        const cssText = fs.readFileSync(path.join(REPO, 'css/style.css'), 'utf8');
        ok('Mac 壳里侧栏用更深的专用色，网页 / 手机不受影响',
            cssText.indexOf('--bg-sidebar-mac') >= 0 &&
            cssText.indexOf('body.native-shell .sidebar') >= 0 &&
            cssText.indexOf('background: var(--bg-sidebar-mac)') >= 0);
        ok('锁屏层默认藏着；没开加密时启动不会把窗口锁上',
            ev("(function(){var l=document.getElementById('startupLock');return !!l && l.classList.contains('hidden') && !document.body.classList.contains('app-locked');})()"));
        ok('锁屏期间整窗毛玻璃 + 禁止点按，顶层遮罩自己也带模糊',
            /body\.app-locked \.mac-window\s*\{[^}]*filter:\s*blur\(/m.test(cssText) &&
            /body\.app-locked \.mac-window\s*\{[^}]*pointer-events:\s*none/m.test(cssText) &&
            /#startupLock\s*\{[^}]*backdrop-filter:\s*blur\(/m.test(cssText));
        ev("(function(){var old=LedgerCrypto.isEnabled; LedgerCrypto.isEnabled=function(){return true;}; window.__gateP=startupUnlockGate(); LedgerCrypto.isEnabled=old; return true;})()");
        ok('开了加密：启动门禁先盖锁屏再加 app-locked（底下的账本被糊住）',
            ev("(function(){var l=document.getElementById('startupLock');return document.body.classList.contains('app-locked') && !!l && !l.classList.contains('hidden');})()"));

        const lockFlow = await ev(`(async function(){
            var oldUnlock = LedgerCrypto.unlock;
            LedgerCrypto.unlock = function(s){ return s === 'test-pass' ? Promise.resolve(true) : Promise.reject(new Error('bad')); };
            document.getElementById('startupLockInput').value = 'test-pass';
            await submitStartupLock();
            var out = [__sessionSecret, document.body.classList.contains('app-locked'), document.getElementById('startupLock').classList.contains('hidden')];
            LedgerCrypto.unlock = oldUnlock;
            return JSON.stringify(out);
        })()`);
        ok('输一次正确口令就放行，并把口令记在本次会话里', lockFlow === '["test-pass",false,true]', lockFlow);

        const noSecondAsk = await ev(`(async function(){
            var oldAsk = window.askSecret, oldHas = LedgerCrypto.hasLocalKey, oldUnlock = LedgerCrypto.unlock;
            var asks = 0, unlocks = 0;
            window.askSecret = function(){ asks++; return Promise.resolve(null); };
            LedgerCrypto.hasLocalKey = function(){ return Promise.resolve(false); };
            LedgerCrypto.unlock = function(){ unlocks++; return Promise.resolve(true); };
            var saved = __sessionSecret; __sessionSecret = 'test-pass';
            var r = false;
            try { r = await ensureUnlocked(null, '测试', false); } catch (e) {}
            __sessionSecret = saved;
            window.askSecret = oldAsk; LedgerCrypto.hasLocalKey = oldHas; LedgerCrypto.unlock = oldUnlock;
            return JSON.stringify([r, asks, unlocks]);
        })()`);
        ok('后续同步链路再要钥匙时静默复用本次口令，不弹第二次', noSecondAsk === '[true,0,1]', noSecondAsk);

        const cloudSecret = await ev(`(async function(){
            var oldLooks = LedgerCrypto.looksEncrypted, oldDec = LedgerCrypto.decryptEnvelope,
                oldHas = LedgerCrypto.hasLocalKey, oldDecode = window.decodeSyncPayload;
            var got = 'none';
            LedgerCrypto.looksEncrypted = function(){ return true; };
            LedgerCrypto.hasLocalKey = function(){ return Promise.resolve(true); };
            LedgerCrypto.decryptEnvelope = function(env, sec){ got = sec === undefined ? 'undefined' : sec; return Promise.resolve('{}'); };
            window.decodeSyncPayload = function(){ return Promise.resolve({data:{}}); };
            var saved = __sessionSecret; __sessionSecret = 'test-pass';
            try { await resolveCloudPayload({ enc: 'BKE1', keyring: {} }); } catch (e) {}
            __sessionSecret = saved;
            LedgerCrypto.looksEncrypted = oldLooks; LedgerCrypto.decryptEnvelope = oldDec;
            LedgerCrypto.hasLocalKey = oldHas; window.decodeSyncPayload = oldDecode;
            return got;
        })()`);
        ok('云端那份用别的钥匙加密时，拿本次口令静默重解', cloudSecret === 'test-pass', cloudSecret);
        ev("__sessionSecret=''; closeStartupLock();");

        // ---------- 22) v1.41.11：不再惊动钥匙串 + 手机输完自动进入 ----------
        stage = '22';
        const lcText = fs.readFileSync(path.join(REPO, 'js/ledger-crypto.js'), 'utf8');
        ok('主钥匙改存普通字节（master-raw），不再把 CryptoKey 塞进 IndexedDB',
            lcText.indexOf("CRYPTO_MASTER_RAW_KEY = 'master-raw'") >= 0 &&
            lcText.indexOf("exportKey('raw'") >= 0 &&
            lcText.indexOf("importKey('raw'") >= 0 &&
            lcText.indexOf("idbGet('master')") < 0 &&
            lcText.indexOf("idbPut(k, 'master')") < 0 &&
            lcText.indexOf("idbPut(masterKey, 'master')") < 0);
        ok('本机缓存只读新键，绝不碰会触发钥匙串的旧 master 记录',
            /function hasLocalKey\(\)[\s\S]{0,200}loadMaster\(\)/.test(lcText) &&
            lcText.indexOf('saveMaster(k)') >= 0);

        const touchFlow = await ev(`(async function(){
            var oldMM = window.matchMedia, oldEnabled = LedgerCrypto.isEnabled, oldUnlock = LedgerCrypto.unlock;
            window.matchMedia = function(){ return { matches: true }; };
            LedgerCrypto.isEnabled = function(){ return true; };
            LedgerCrypto.unlock = function(s){ return s === 'test-pass' ? Promise.resolve(true) : Promise.reject(new Error('bad')); };
            var out = {};
            out.touch = startupIsTouch();
            window.__gateP2 = startupUnlockGate();
            out.hint = (document.getElementById('startupLockHint')||{}).textContent;
            out.locked = document.body.classList.contains('app-locked');
            document.getElementById('startupLockInput').value = 'test-pass';
            await startupAutoUnlock();
            out.after = [__sessionSecret, document.body.classList.contains('app-locked')];
            window.matchMedia = oldMM; LedgerCrypto.isEnabled = oldEnabled; LedgerCrypto.unlock = oldUnlock;
            return JSON.stringify(out);
        })()`);
        ok('触屏设备：输完口令自动放行，不用点「解锁并进入」',
            touchFlow === '{"touch":true,"hint":"输完会直接进去，不用点按钮","locked":true,"after":["test-pass",false]}', touchFlow);

        const quietFail = await ev(`(async function(){
            var oldEnabled = LedgerCrypto.isEnabled, oldUnlock = LedgerCrypto.unlock;
            LedgerCrypto.isEnabled = function(){ return true; };
            LedgerCrypto.unlock = function(){ return Promise.reject(new Error('bad')); };
            window.__gateP3 = startupUnlockGate();
            var inp = document.getElementById('startupLockInput');
            inp.value = 'half-typed';
            await startupAutoUnlock();
            var out = [inp.value, document.body.classList.contains('app-locked'), document.getElementById('startupLockError').classList.contains('hidden')];
            LedgerCrypto.isEnabled = oldEnabled; LedgerCrypto.unlock = oldUnlock;
            closeStartupLock();
            return JSON.stringify(out);
        })()`);
        ok('手机输到一半的自动试探失败：不清空、不报红字、照样停在锁屏',
            quietFail === '["half-typed",true,true]', quietFail);

        const timerSet = ev(`(function(){
            var oldMM = window.matchMedia, oldEnabled = LedgerCrypto.isEnabled;
            window.matchMedia = function(){ return { matches: true }; };
            LedgerCrypto.isEnabled = function(){ return true; };
            window.__gateP4 = startupUnlockGate();
            var inp = document.getElementById('startupLockInput');
            inp.value = 'test-pass';
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            var has = !!__startupAutoTimer;
            window.matchMedia = oldMM; LedgerCrypto.isEnabled = oldEnabled;
            closeStartupLock();
            return has;
        })()`);
        ok('触屏输入会排一次自动解锁，解锁 / 关闭后定时器清干净',
            timerSet === true && ev('__startupAutoTimer') === null, [timerSet, ev('__startupAutoTimer')]);

        const desktopNoAuto = ev(`(function(){
            var oldMM = window.matchMedia, oldEnabled = LedgerCrypto.isEnabled;
            window.matchMedia = function(){ return { matches: false }; };
            LedgerCrypto.isEnabled = function(){ return true; };
            window.__gateP5 = startupUnlockGate();
            var hint = (document.getElementById('startupLockHint')||{}).textContent;
            var inp = document.getElementById('startupLockInput');
            inp.value = 'test-pass';
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            var has = !!__startupAutoTimer;
            window.matchMedia = oldMM; LedgerCrypto.isEnabled = oldEnabled;
            closeStartupLock();
            return JSON.stringify([hint, has]);
        })()`);
        ok('桌面端不自动提交（打字停顿不误触），仍可按回车 / 点按钮',
            desktopNoAuto === '["输完按回车，或点上面的按钮",false]', desktopNoAuto);
        ev("__sessionSecret='';");

        // ---------- 23) v1.41.13：连着记（切成员 / 切月份不被打断） + 手机数字键盘 ----------
        stage = '23';
        ev(`state.balances = []; state.returns = []; state.monthlyOpen = {};
            state.accounts = [
                { id:'a_plain', name:'支付宝', kind:'asset', group:'流动资金', color:'#111111', order:1, members:['本人','家人'] },
                { id:'a_wife',  name:'她的卡', kind:'asset', group:'流动资金', color:'#333333', order:2, members:['家人'] }
            ];
            state.balanceMembers = ['本人','家人'];
            state.hiddenItems = {}; state.sheetColOrder = {};
            paintModalMonth('monthly','2026-03'); openMonthlyModal('2026-03');
            var s0 = document.getElementById('monthlyMemberSelect');
            s0.value='本人'; s0.dispatchEvent(new Event('change',{bubbles:true}));`);
        ok('空白的 3 月打开就能填（编辑模式、格子不只读）',
            ev(`monthlyViewMode === false`) &&
            ev(`!document.querySelector('#monthlyEntryList [data-bal="a_plain"][data-cat="cash"]').readOnly`));
        ev(`var m3 = document.querySelector('#monthlyEntryList [data-bal="a_plain"][data-cat="cash"][data-cur="CNY"]');
            m3.value='5000'; m3.dispatchEvent(new Event('input',{bubbles:true}));
            var s1 = document.getElementById('monthlyMemberSelect');
            s1.value='家人'; s1.dispatchEvent(new Event('change',{bubbles:true}));`);
        ok('切到家人：还是编辑模式，不用先点「编辑」',
            ev(`monthlyViewMode === false`) &&
            ev(`!document.querySelector('#monthlyEntryList [data-bal="a_plain"][data-cat="cash"]').readOnly`));
        ev(`var s2 = document.getElementById('monthlyMemberSelect');
            s2.value='本人'; s2.dispatchEvent(new Event('change',{bubbles:true}));`);
        ok('切回本人（这次这个月已经有数据了）：仍然能直接输入，不会变成只读',
            ev(`monthlyViewMode === false`) &&
            ev(`!document.querySelector('#monthlyEntryList [data-bal="a_plain"][data-cat="cash"]').readOnly`),
            ev(`JSON.stringify([monthlyViewMode, monthlyHasData])`));
        // 模拟用户说的：3 月刚改完数，不点保存，直接点上面的月份切到 4 月
        ev(`var m3b = document.querySelector('#monthlyEntryList [data-bal="a_plain"][data-cat="cash"][data-cur="CNY"]');
            m3b.value='5200'; m3b.dispatchEvent(new Event('input',{bubbles:true}));
            stepModalMonth('monthly', 1);`);
        ok('切月份走到了 4 月', ev(`getModalMonth('monthly')`) === '2026-04', ev(`getModalMonth('monthly')`));
        ok('3 月刚改的 5200 自动存进 3 月，4 月格子是空白（没被带过去）',
            ev(`!!state.balances.find(b=>b.month==='2026-03' && b.member==='本人' && b.amount===5200)`) &&
            ev(`String(document.querySelector('#monthlyEntryList [data-bal="a_plain"][data-cat="cash"][data-cur="CNY"]').value).trim()===''`),
            ev(`JSON.stringify(state.balances.map(b=>b.month+':'+b.member+':'+b.accountId+':'+b.amount))`));
        ok('5200 没有被写进 4 月（存的时候认的是旧月份）',
            ev(`!state.balances.find(b=>b.month==='2026-04' && b.amount===5200)`));
        ok('4 月也是编辑模式，可以接着填', ev(`monthlyViewMode === false`));
        ev(`var m4 = document.querySelector('#monthlyEntryList [data-bal="a_plain"][data-cat="cash"][data-cur="CNY"]');
            m4.value='7777'; m4.dispatchEvent(new Event('input',{bubbles:true}));
            stepModalMonth('monthly', -1);`);
        ok('切回 3 月：4 月的 7777 归 4 月，3 月还是 5200',
            ev(`!!state.balances.find(b=>b.month==='2026-04' && b.member==='本人' && b.amount===7777)`) &&
            ev(`String(document.querySelector('#monthlyEntryList [data-bal="a_plain"][data-cat="cash"][data-cur="CNY"]').value)`) === '5200',
            ev(`JSON.stringify(state.balances.map(b=>b.month+':'+b.member+':'+b.amount))`));
        ok('来回切好几次也不会变成只读', ev(`monthlyViewMode === false`));
        // 手机数字键盘：左右间隙收到和上下一样、按键高一点点
        ok('手机端：每列按键的左右间隙 = 每行按键的上下间隙（都是 1px）',
            /#transactionModal \.numpad-row\s*\{[^}]*gap:\s*1px/m.test(cssText) &&
            /#transactionModal \.numpad\s*\{[^}]*gap:\s*1px/m.test(cssText));
        ok('手机端数字键调高了一点点（45 → 48px）',
            /#transactionModal \.numpad-btn\s*\{[^}]*height:\s*48px/m.test(cssText));
        ok('桌面 / 网页端键盘不受影响（基础键高 50px、行距 8px、触摸响应还在）',
            /\.numpad-btn\s*\{[^}]*height:\s*50px/m.test(cssText) &&
            /\.numpad-row\s*\{[^}]*gap:\s*8px/m.test(cssText) &&
            cssText.indexOf('touch-action: manipulation') >= 0);

        // ---------- 24) v1.41.14：键盘左右留白 + 只禁键盘区的长按复制 ----------
        stage = '24';
        ok('手机端键盘左右留白从 14px 收到 6px（最左 / 最右不再空一大条）',
            /#transactionModal \.numpad\s*\{[^}]*padding:\s*10px 6px/m.test(cssText));
        ok('桌面 / 网页端键盘留白不变（还是 14px）',
            /\.numpad\s*\{[^}]*padding:\s*10px 14px 14px/m.test(cssText));
        const npLock = cssText.match(/\.numpad, \.numpad \*\s*\{([^}]*)\}/m);
        ok('数字键盘区（含数字、⌫、OK 等所有按键）压掉长按呼出菜单和文字选择',
            !!npLock &&
            /-webkit-touch-callout:\s*none/.test(npLock[1]) &&
            /-webkit-user-select:\s*none/.test(npLock[1]) &&
            /user-select:\s*none/.test(npLock[1]));
        ok('触屏下连原生拖拽也关掉（长按不会被系统抢走）',
            /@media \(pointer: coarse\)\s*\{\s*\.numpad, \.numpad \*\s*\{[^}]*-webkit-user-drag:\s*none/m.test(cssText));
        ok('手机底部导航标签也不弹长按复制（只写在触屏块里，桌面侧栏照旧）',
            /\.nav-menu, \.nav-menu \*\s*\{[^}]*-webkit-touch-callout:\s*none/m.test(cssText) &&
            /@media \(pointer: coarse\)\s*\{[\s\S]{0,600}\.nav-menu, \.nav-menu \*/m.test(cssText));
        ok('账本其它地方照旧可以长按复制（没有写全局禁止规则）',
            cssText.indexOf('user-select: all') >= 0 &&
            !/^\s*\*\s*\{[^}]*-webkit-touch-callout/m.test(cssText));
        const menuGuard = ev(`(function(){
            bindNumpadPressFeedback();
            var pad = document.getElementById('numpad');
            var btn = document.getElementById('numpadBack');
            var c = new MouseEvent('contextmenu', {bubbles:true, cancelable:true});
            btn.dispatchEvent(c);
            var s = new Event('selectstart', {bubbles:true, cancelable:true});
            btn.dispatchEvent(s);
            var out = document.getElementById('amountInput');
            var s2 = new Event('selectstart', {bubbles:true, cancelable:true});
            if (out) out.dispatchEvent(s2);
            return JSON.stringify([c.defaultPrevented, s.defaultPrevented, s2.defaultPrevented, !!pad.dataset.menuBound]);
        })()`);
        ok('键盘上长按不再弹「拷贝 / 选择」，金额输入框里照样能选文字',
            menuGuard === '[true,true,false,true]', menuGuard);
        const backFlow = ev(`(function(){
            calc.expr='123'; renderCalc();
            document.getElementById('numpadBack').dispatchEvent(new MouseEvent('click',{bubbles:true}));
            return calc.expr;
        })()`);
        ok('按一下删除键照样删掉一位（没有把点击处理一起挡掉）',
            backFlow === '12', backFlow);

        // ---------- 25) v1.41.15：借出款 / 回顾报告 / 收益率缺料清单 / 加钱提醒 ----------
        stage = '25';
        const appSrc = fs.readFileSync(path.join(REPO, 'js', 'app.js'), 'utf8');
        const _balBefore = ev(`state.balances.length`);
        // v1.41.16 回归：空台账时入口也必须看得见。此前整张卡片被 hidden，
        // 而唯一的「记一笔借出」按钮在卡片里 → 没有第一笔就永远打不开登记。
        ev(`renderLendingCard();`);
        ok('一笔借出款都没有时，资产负债页的「借出款」卡片也看得见',
            ev(`!document.getElementById('lendingCard').classList.contains('hidden')`));
        ok('空状态有说明文字，并讲清不用在「记月度账单」里重复填',
            ev(`document.getElementById('lendingList').innerHTML`).indexOf('记月度账单') >= 0);
        ok('空状态下「记一笔借出」按钮就在，点了能打开登记弹窗',
            ev(`!!document.querySelector('#lendingCard button[onclick^="openLendingModal"]')`) &&
            ev(`(function(){ openLendingModal();
                 var v = !document.getElementById('lendingModal').classList.contains('hidden');
                 closeLendingModal(); return v; })()`));
        ok('切到资产负债页会重画这张卡片',
            /function renderBalance\(\)[\s\S]{0,6000}renderLendingCard\(\);/.test(appSrc));
        ev(`document.getElementById('lendingPerson').value='张三';
            document.getElementById('lendingAmount').value='10000';
            document.getElementById('lendingDate').value='2026-08-15';
            document.getElementById('lendingDue').value='';
            document.getElementById('lendingId').value='';
            saveLending();`);
        ok('借出款登记成功，台账里有一笔', ev(`state.lendings.length`) === 1,
            ev(`JSON.stringify(state.lendings.map(l=>l.person+':'+l.amount+':'+l.lendDate))`));
        ok('没往 state.balances 写任何东西（不自动写余额，不碰历史数据）',
            ev(`state.balances.length`) === _balBefore);
        const _assetBefore = ev(`(function(){ var s=state.lendings; state.lendings=[];
            var v=totalsFromCat(balancesByCat('2026-10','all')).asset; state.lendings=s; return v; })()`);
        ok('借出当月自动出现在总资产里', ev(`lendingOutstandingAt('2026-08')`) === 10000);
        ok('中间月份、当前月也自动出现，不用点「沿用上期」',
            ev(`JSON.stringify([lendingOutstandingAt('2026-09'),lendingOutstandingAt('2026-10')])`) === '[10000,10000]');
        ok('借款之前的月份不会出现', ev(`lendingOutstandingAt('2026-07')`) === 0);
        ok('总资产里确实多了这一万（只多这一万）',
            ev(`totalsFromCat(balancesByCat('2026-10','all')).asset`) - _assetBefore === 10000,
            JSON.stringify([_assetBefore, ev(`totalsFromCat(balancesByCat('2026-10','all')).asset`)]));
        ok('录入表格里没有这个虚拟账户（不用手填、保存也不会写回）',
            ev(`Object.keys(balanceCellsByCurAtMonth('2026-10','all')).indexOf(LENDING_ACCOUNT_ID) < 0`));
        ok('虚拟账户在图表里也有名字，不会空白',
            ev(`accountById(LENDING_ACCOUNT_ID).name`) === '借出款');
        ev(`toggleLendingRepaid(state.lendings[0].id);`);
        ok('标记已还会记下还款日期', ev(`!!state.lendings[0].repaidAt`));
        ev(`state.lendings[0].repaidAt='2026-10-05';`);
        ok('还款当月起不再计入总资产，之前月份照旧',
            ev(`JSON.stringify([lendingOutstandingAt('2026-09'),lendingOutstandingAt('2026-10')])`) === '[10000,0]',
            ev(`JSON.stringify([lendingOutstandingAt('2026-09'),lendingOutstandingAt('2026-10')])`));
        ev(`toggleLendingRepaid(state.lendings[0].id);`);
        ok('撤销已还后又回到未还', ev(`lendingOutstandingAt('2026-10')`) === 10000);

        ev(`reviewMonth='2026-10'; reviewTab='month'; renderReviewModal();`);
        ok('自动月报是一屏四行（收支 / 分类前五 / 家底与投资 / 记账习惯）',
            ev(`document.querySelectorAll('#reviewAuto .rr-row').length`) === 4);
        ok('月报只摆事实，不写「应该花多少」这类判断',
            ev(`document.getElementById('reviewAuto').innerHTML`).indexOf('应该') < 0);
        ev(`document.getElementById('reviewText').value='10 月装修花了 9 万'; saveReviewText();`);
        ok('手写的月度回顾存下来了',
            ev(`state.reviews.monthly['2026-10'] && state.reviews.monthly['2026-10'].text`) === '10 月装修花了 9 万');
        ev(`reviewTab='year'; renderReviewModal();`);
        ok('一年一页纸给三个数（总支出 / 投资收益 / 净资产增加）',
            ev(`document.querySelectorAll('#reviewAuto .rr-big').length`) === 3);
        ok('一页纸里能翻到这一年写过的月度备注',
            ev(`document.getElementById('reviewAuto').innerHTML`).indexOf('10 月装修花了 9 万') >= 0);

        ev(`renderReturnMissing({month:'2026-10'});`);
        ok('收益率缺料清单能跑、且不改任何账本数据',
            ev(`!!document.getElementById('retMissingCard')`) && ev(`state.balances.length`) === _balBefore);
        ok('缺料清单分开列「被剔出比率」和「只进分母没进分子」两种原因',
            appSrc.indexOf('unknown.length') >= 0 && appSrc.indexOf('noProfit.length') >= 0);
        ok('加钱提醒是只读的：只提示、不写数',
            appSrc.indexOf('是不是往里加过钱') >= 0 && appSrc.indexOf('maybeTopUp.push') >= 0 &&
            appSrc.indexOf('（只提醒，不改任何数）') >= 0);

        // ---------- 26) v1.41.17：借出款单独成类 / 月度账单只读行 / 长按连删 ----------
        stage = '26';
        const _bal26 = ev(`state.balances.length`);
        ok('借出款单独成一类，不再混进「其他」',
            ev(`balancesByCat('2026-10','all').lending`) === 10000 &&
            ev(`balancesByCat('2026-10','all').other || 0`) === 0);
        ok('总资产仍然只多这一万（台账和账单没有双算）',
            ev(`totalsFromCat(balancesByCat('2026-10','all')).asset`) -
            ev(`(function(){ var s=state.lendings; state.lendings=[];
                var v=totalsFromCat(balancesByCat('2026-10','all')).asset; state.lendings=s; return v; })()`) === 10000);
        ev(`state.balancePeriod='month'; state.balanceYear=2026; state.balanceMonth=10; renderBalanceBreakdown();`);
        const _bdHtml = ev(`document.getElementById('balBreakdownList').innerHTML`);
        ok('资产构成里「借出款」单独一行、带占比', _bdHtml.indexOf('借出款') >= 0 && _bdHtml.indexOf('%') >= 0);
        ok('资产饼图也没漏掉借出款（各块加起来对得上总资产）',
            ev(`balancePieEntries({month:'2026-10'}, 'asset').some(r => r.id==='lending' && r.amount===10000)`));
        ev(`paintModalMonth('monthly','2026-10'); renderMonthlyEntry();`);
        ok('月度账单里有「借出款」这一行，点得到明细',
            ev(`!!document.querySelector('#monthlyEntryList .mw-lend-row[onclick^="openLendingDetail"]')`));
        ok('这一行是只读的：没有可填的余额格、也不写 state.balances',
            ev(`document.querySelectorAll('#monthlyEntryList .mw-lend-row [data-bal]').length`) === 0 &&
            ev(`state.balances.length`) === _bal26);
        ok('悬停提示里有「这个月未还」和笔数',
            ev(`document.querySelector('#monthlyEntryList .mw-lend-row').getAttribute('title')`).indexOf('这个月未还') >= 0 &&
            ev(`document.querySelector('#monthlyEntryList .mw-lend-row').getAttribute('title')`).indexOf('笔') >= 0);
        ev(`openLendingDetail('2026-07');`);
        ok('翻到借款之前的月份，明细里没有这笔',
            ev(`document.getElementById('lendingDetailList').innerHTML`).indexOf('没有还没还') >= 0);
        ev(`openLendingDetail('2026-10');`);
        const _ldHtml = ev(`document.getElementById('lendingDetailList').innerHTML`);
        ok('翻到 10 月，明细里能看到借给谁、什么时候借的、合计',
            _ldHtml.indexOf('张三') >= 0 && _ldHtml.indexOf('2026-08-15') >= 0 && _ldHtml.indexOf('这个月未还合计') >= 0);
        ev(`closeLendingDetail();`);

        ev(`calc.expr='123456'; renderCalc();`);
        const _down = ev(`typeof window.PointerEvent === 'function' ? 'pointerdown' : 'mousedown'`);
        const _up = ev(`typeof window.PointerEvent === 'function' ? 'pointerup' : 'mouseup'`);
        ev(`document.getElementById('numpadBack').dispatchEvent(new MouseEvent('${_down}',{bubbles:true}));`);
        await new Promise(r => setTimeout(r, 620));
        const _afterHold = ev(`calc.expr`);
        ev(`document.getElementById('numpadBack').dispatchEvent(new MouseEvent('${_up}',{bubbles:true}));`);
        ok('长按 ⌫ 会连续删掉好几位', _afterHold.length <= 3 && _afterHold.length >= 1, _afterHold);
        await new Promise(r => setTimeout(r, 200));
        ok('松手后立刻停，不会继续删', ev(`calc.expr`) === _afterHold, ev(`calc.expr`));
        ev(`document.getElementById('numpadBack').dispatchEvent(new MouseEvent('click',{bubbles:true}));`);
        ok('长按松手后补的那下 click 不会多删一位', ev(`calc.expr`) === _afterHold);
        ev(`document.getElementById('numpadBack').dispatchEvent(new MouseEvent('${_down}',{bubbles:true}));`);
        ev(`document.getElementById('numpadBack').dispatchEvent(new MouseEvent('${_up}',{bubbles:true}));`);
        const _beforeTap = ev(`calc.expr`);
        ev(`document.getElementById('numpadBack').dispatchEvent(new MouseEvent('click',{bubbles:true}));`);
        ok('短按仍然只删一位', ev(`calc.expr`).length === Math.max(0, _beforeTap.length - 1), ev(`calc.expr`));

        // ---------- 27) v1.41.18：只读行精简 / 眼睛口径 / 删除撤回 / 弹窗字号 / 卡片位置 ----------
        stage = '27';
        const htmlSrc = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
        const cssSrc = fs.readFileSync(path.join(REPO, 'css', 'style.css'), 'utf8');
        ev(`moneyVisible=false; paintModalMonth('monthly','2026-10'); renderMonthlyEntry(); renderLendingCard();`);
        ok('月度账单那行，行名只剩「借出款」三个字',
            ev(`document.querySelector('#monthlyEntryList .mw-lend-row .mw-rowname').textContent.trim()`) === '借出款');
        const _rowHtml = ev(`document.querySelector('#monthlyEntryList .mw-lend-row .mw-sumcol').innerHTML`);
        ok('闭着眼时，月度账单里的借出款金额照样明文显示',
            _rowHtml.indexOf('****') < 0 && /10,?000/.test(_rowHtml), _rowHtml);
        ok('资产负债表页的借出款金额跟着小眼睛打码',
            ev(`document.getElementById('lendingSub').textContent`).indexOf('****') >= 0,
            ev(`document.getElementById('lendingSub').textContent`));
        ev(`moneyVisible=true; renderLendingCard();`);
        ok('小眼睛打开后，资产负债页金额显示出来',
            /10,?000/.test(ev(`document.getElementById('lendingSub').textContent`)),
            ev(`document.getElementById('lendingSub').textContent`));
        ok('借出款卡片挪到了资产负债页最下面（家庭成员汇总之后）',
            htmlSrc.indexOf('id="lendingCard"') > htmlSrc.indexOf('id="familySummaryCard"'));
        ok('记一笔借出弹窗的输入框字号放大到 16px',
            cssSrc.indexOf('#lendingModal .text-input { font-size: 16px;') >= 0);
        ev(`window.confirm = () => true; deleteLending(state.lendings[0].id);`);
        ok('删除后这笔不再计入（软删）', ev(`lendingList().length`) === 0);
        ok('删完弹出 8 秒撤回条', ev(`!!document.querySelector('#toastContainer .lend-undo .toast-undo-btn')`));
        ev(`document.querySelector('#toastContainer .lend-undo .toast-undo-btn').click();`);
        ok('点撤回后这笔回来了、deletedAt 也清掉了',
            ev(`lendingList().length`) === 1 && ev(`!state.lendings[0].deletedAt`),
            ev(`JSON.stringify(state.lendings.map(l => ({p:l.person,d:!!l.deletedAt})))`));
        ok('撤回后金额重新计入总资产', ev(`lendingOutstandingAt('2026-10')`) === 10000,
            ev(`lendingOutstandingAt('2026-10')`));
        // v1.41.19：上一轮放大规则没生效，根因是这四个 input 压根没带 text-input 类
        const _lendForm = htmlSrc.slice(htmlSrc.indexOf('id="lendingModal"'), htmlSrc.indexOf('id="lendingDetailModal"'));
        ok('「记一笔借出」四个输入框都带 text-input 类，放大规则才匹配得到',
            (_lendForm.match(/class="text-input"/g) || []).length === 4,
            String((_lendForm.match(/class="text-input"/g) || []).length));
        ok('输入框有明确的 46px 高度（WKWebView 里日期框也撑得开）',
            cssSrc.indexOf('#lendingModal .text-input { font-size: 16px; padding: 12px 14px; height: 46px;') >= 0);

        // ---------- 28) v1.41.20：外观「跟随系统」 ----------
        stage = '28';
        const html28 = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
        const appSrc28 = fs.readFileSync(path.join(REPO, 'js', 'app.js'), 'utf8');
        ok('设置页外观有三档：浅色 / 深色 / 跟随系统',
            /data-theme="light"/.test(html28) && /data-theme="dark"/.test(html28) && /data-theme="system"/.test(html28));
        ok('「跟随系统」用的是这份 Font Awesome 里真有的图标',
            html28.indexOf('fa-circle-half-stroke') >= 0);
        ok('外观是本机偏好，不进云同步载荷（另一台设备盖不掉它）',
            ev(`buildSyncPayload().data.settings.theme`) === undefined);
        ok('云端合并时也把 theme 摘掉，本地外观不会被远端覆盖',
            appSrc28.indexOf('theme: _dropTheme') >= 0);
        ok('手机上三档按钮改成整行平分、文字不换行，还带着 theme-row 这个类',
            html28.indexOf('settings-row theme-row') >= 0 &&
            cssSrc.indexOf('.settings-row.theme-row { flex-direction: column;') >= 0 &&
            cssSrc.indexOf('white-space: nowrap; padding: 8px 6px;') >= 0);

        // jsdom 本身没有 matchMedia，装一个可控的，再把系统主题监听接上
        ev(`
            var __mmDark = false, __mmCbs = [], __mmOld = window.matchMedia;
            window.matchMedia = function (q) {
                if (String(q).indexOf('prefers-color-scheme') < 0)
                    return { matches: false, addEventListener: function(){}, addListener: function(){} };
                return { media: q, get matches(){ return __mmDark; },
                    addEventListener: function(t,f){ if(t==='change') __mmCbs.push(f); },
                    addListener: function(f){ __mmCbs.push(f); } };
            };
            state.currentView = 'transactions';   // 别让重画图表把前面的断言环境搅了
            watchSystemTheme();
        `);
        ok('系统主题监听挂上了', ev(`__mmCbs.length`) >= 1);
        ok('老环境没有 matchMedia 时不报错、只是不自动跟随',
            ev(`(function(){ var m=window.matchMedia; window.matchMedia=undefined; var r=watchSystemTheme(); window.matchMedia=m; return r; })()`) === false);

        ev(`applyTheme('system');`);
        ok('选「跟随系统」时，存下来的是 system 这个选择',
            ev(`state.settings.theme`) === 'system');
        ok('系统是浅色时，DOM 上解析成 light（绝不会把 system 写进 data-theme）',
            ev(`document.documentElement.getAttribute('data-theme')`) === 'light');
        ok('设置页高亮的是「跟随系统」而不是浅色',
            ev(`document.querySelector('.theme-btn[data-theme="system"]').classList.contains('active')`) &&
            !ev(`document.querySelector('.theme-btn[data-theme="light"]').classList.contains('active')`));
        ok('图表配色读的是解析后的实际主题',
            ev(`chartPalette().isDark`) === false);

        ev(`__mmDark = true; __mmCbs.forEach(function(f){ f({matches:true}); });`);
        ok('系统自动切成深色后，App 跟着变深色',
            ev(`document.documentElement.getAttribute('data-theme')`) === 'dark');
        ok('自动切换时图表配色也跟着变',
            ev(`chartPalette().isDark`) === true);
        ok('自动切换只改显示，不改存下来的选择（不会触发写盘 / 同步）',
            ev(`state.settings.theme`) === 'system');
        ok('自动切换后高亮的仍是「跟随系统」',
            ev(`document.querySelector('.theme-btn[data-theme="system"]').classList.contains('active')`));

        ev(`applyTheme('light'); __mmDark = false; __mmCbs.forEach(function(f){ f({matches:false}); });`);
        ok('手动选了浅色后，系统主题再变化也不来干预',
            ev(`document.documentElement.getAttribute('data-theme')`) === 'light' &&
            ev(`state.settings.theme`) === 'light');
        ok('手动选深色就是深色，跟系统无关',
            ev(`applyTheme('dark'); document.documentElement.getAttribute('data-theme')`) === 'dark');
        ok('老备份里的异常主题值兜底成浅色，不会把 CSS 打瞎',
            ev(`resolvedTheme('banana')`) === 'light' &&
            ev(`applyTheme('banana'); document.documentElement.getAttribute('data-theme')`) === 'light');
        ok('init / 合并走的是同一个解析函数，data-theme 永远只有 light 或 dark',
            ev(`(function(){ __mmDark = true; state.settings.theme='system'; refreshAppliedTheme(); return document.documentElement.getAttribute('data-theme'); })()`) === 'dark' &&
            ev(`document.documentElement.getAttribute('data-theme') !== 'system'`));
        ev(`applyTheme('light'); window.matchMedia = __mmOld;`);

        // ---------- 29) v1.41.21：设置小字精简 / 深色顶部 / 手机按钮高度 ----------
        stage = '29';
        const html29 = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
        const css29 = fs.readFileSync(path.join(REPO, 'css', 'style.css'), 'utf8');
        const app29 = fs.readFileSync(path.join(REPO, 'js', 'app.js'), 'utf8');
        ['跟着电脑 / 手机自动切换深浅色', '启动时自动进入的页面',
            '打开应用时直接弹出记账输入框', '移动端导航已收起，从这里进入'].forEach(t => {
            ok('设置页多余的灰色小字已删：' + t, html29.indexOf(t) < 0);
        });
        ok('备份 / 导出那些较长的说明文字没被误删',
            html29.indexOf('存一份带日期的完整账本') >= 0 && html29.indexOf('从 .xlsx 表格读回账本') >= 0);
        ok('两个状态栏 meta 与启动预读脚本都在 head 里',
            html29.indexOf('id="themeColorMeta"') >= 0 && html29.indexOf('id="statusBarStyleMeta"') >= 0 &&
            html29.indexOf('bookkeeping_theme_choice') >= 0 &&
            html29.indexOf('id="themeColorMeta"') < html29.indexOf('<link rel="stylesheet" href="css/style.css">'));
        ev(`applyTheme('dark');`);
        ok('选深色时 theme-color / iOS 状态栏样式一起变深',
            ev(`document.getElementById('themeColorMeta').getAttribute('content')`) === '#1c1c1e' &&
            ev(`document.getElementById('statusBarStyleMeta').getAttribute('content')`) === 'black');
        ok('启动预读键写的是「选择」本身', ev(`localStorage.getItem('bookkeeping_theme_choice')`) === 'dark');
        ev(`applyTheme('light');`);
        ok('选浅色时状态栏 meta 回到白底黑字',
            ev(`document.getElementById('themeColorMeta').getAttribute('content')`) === '#f5f5f7' &&
            ev(`document.getElementById('statusBarStyleMeta').getAttribute('content')`) === 'default');
        ok('跟随系统存的是 system，下次启动第一帧就不会先白一下',
            ev(`applyTheme('system'); localStorage.getItem('bookkeeping_theme_choice')`) === 'system');
        ok('系统主题自动切换不会重复写盘（只在「选择」变化时写轻量键）',
            app29.indexOf("if (localStorage.getItem(THEME_CHOICE_KEY) !== choice)") >= 0);
        ev(`applyTheme('light');`);
        const _bootLine = css29.split('\n').find(l => l.indexOf('#bootLoading {') === 0) || '';
        ok('启动骨架屏底色不再是写死的 #f7f8fa',
            _bootLine.indexOf('background: var(--bg-content)') >= 0 && _bootLine.indexOf('#f7f8fa') < 0);
        ok('手机标题栏改成实色，不再透出状态栏的白',
            /\.title-bar \{[\s\S]{0,320}?background: var\(--bg-content\);/.test(css29));
        ok('四页按钮统一 32px 外框，且规则只写在手机端 media 里',
            css29.indexOf('@media (max-width: 640px) {\n    :root { --ctrl-h: 32px; }') >= 0 &&
            css29.indexOf('.filter-bar .filter-right .filter-select') >= 0 &&
            css29.indexOf('.view-header .report-controls .primary-btn') >= 0 &&
            css29.indexOf('.view-header .report-controls .money-eye-btn') >= 0);
        ok('桌面端那套按钮样式没被改动',
            css29.indexOf('.primary-btn {\n    background: var(--accent-solid);') >= 0 &&
            css29.indexOf('.filter-select {\n    background: var(--bg-card);') >= 0);

        // ---------- 30) v1.41.22：iOS 27 状态栏采样 / 底部导航栏 ----------
        stage = '30';
        const html30 = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
        const css30 = fs.readFileSync(path.join(REPO, 'css', 'style.css'), 'utf8');
        const mf30 = JSON.parse(fs.readFileSync(path.join(REPO, 'manifest.json'), 'utf8'));
        ok('状态栏探针在 body 最前面、排在 .mac-window 之前',
            html30.indexOf('id="statusBarProbe"') > 0 &&
            html30.indexOf('id="statusBarProbe"') < html30.indexOf('<div class="mac-window">'));
        ok('探针默认藏着，只有手机端才显示',
            css30.indexOf('#statusBarProbe { display: none; }') >= 0 &&
            /#statusBarProbe \{\s*display: block;/.test(css30));
        ok('探针 ≥12px 且层级压过所有弹窗 / 启动骨架',
            css30.indexOf('height: 14px;') >= 0 && css30.indexOf('z-index: 2147483647;') >= 0);
        ok('探针颜色跟主题变量走，弹窗打开时同步换成弹窗色（状态栏不会变纯白）',
            css30.indexOf('body:has(.modal-overlay:not(.hidden)) #statusBarProbe { background: var(--bg-modal); }') >= 0);
        ok('手机端顶部去掉渐变、弹窗遮罩去掉毛玻璃',
            css30.indexOf('body, [data-theme="dark"] body { background: var(--bg-content); }') >= 0 &&
            css30.indexOf('backdrop-filter: none;') >= 0);
        ok('manifest 里紫色 / 米白的启动配色统一掉了',
            mf30.theme_color === '#f5f5f7' && mf30.background_color === '#f5f5f7');
        ok('底部导航 74px → 67px（约 10%），悬浮按钮与主内容留白同步',
            css30.indexOf('height: calc(67px + env(safe-area-inset-bottom, 0px));') >= 0 &&
            css30.indexOf('bottom: calc(67px + env(safe-area-inset-bottom, 0px));') >= 0 &&
            css30.indexOf('padding-bottom: calc(143px + env(safe-area-inset-bottom, 0px));') >= 0 &&
            css30.indexOf('calc(74px + env(safe-area-inset-bottom') < 0);
        ok('小红点贴在图标右侧、竖向上与图标居中对齐（不再悬空在图标上方）',
            /\.nav-item \.nav-dot \{[\s\S]{0,240}?top: 50%;[\s\S]{0,160}?transform: translate\(calc\(-50% \+ 12px\), -50%\);/.test(css30));
        ok('探针元素真的在 DOM 里、且对读屏隐藏',
            ev(`!!document.getElementById('statusBarProbe')`) &&
            ev(`document.getElementById('statusBarProbe').getAttribute('aria-hidden')`) === 'true');

        // ---------- 31) v1.41.24：账户管理「新增」走完整编辑弹窗 + 家庭成员下移 ----------
        stage = '31';
        const html31 = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
        const css31 = fs.readFileSync(path.join(REPO, 'css', 'style.css'), 'utf8');
        const app31 = fs.readFileSync(path.join(REPO, 'js', 'app.js'), 'utf8');
        const acctModalHtml = html31.slice(html31.indexOf('id="accountsModal"'), html31.indexOf('<!-- Insurance Claim Modal -->'));
        ok('内嵌的简易新增表单整套删掉了，不再有两套新增逻辑',
            acctModalHtml.indexOf('acctAddFields') < 0 &&
            acctModalHtml.indexOf('newAccountName') < 0 &&
            acctModalHtml.indexOf('newAccountGroup') < 0 &&
            acctModalHtml.indexOf('onclick="addAccount()"') < 0 &&
            app31.indexOf('function addAccount()') < 0 &&
            css31.indexOf('.account-new {') < 0);
        ok('点「＋ 新增账户」直接开完整编辑弹窗（成员 / 图标 / 颜色 / 多币种都在里面）',
            /<button class="acct-add-toggle" id="acctAddToggle" onclick="openAccountEdit\(\)"/.test(acctModalHtml) &&
            acctModalHtml.indexOf('fa-chevron-right') >= 0 &&
            html31.indexOf('id="acctEditMembers"') >= 0 &&
            html31.indexOf('id="acctEditIcons"') >= 0 &&
            html31.indexOf('id="acctEditColors"') >= 0 &&
            html31.indexOf('id="acctEditMulti"') >= 0 &&
            html31.indexOf('id="acctEditEarns"') >= 0);
        ok('新增按钮在账户清单之前，清单容器还在原位',
            acctModalHtml.indexOf('id="acctAddToggle"') > 0 &&
            acctModalHtml.indexOf('id="acctAddToggle"') < acctModalHtml.indexOf('id="accountManageList"'));
        ok('编辑 / 只读开关仍在标题栏右侧',
            acctModalHtml.indexOf('class="acct-head-actions"') >= 0 &&
            acctModalHtml.indexOf('id="accEditBtn"') > acctModalHtml.indexOf('class="modal-header"') &&
            acctModalHtml.indexOf('id="accEditBtn"') < acctModalHtml.indexOf('class="modal-body"') &&
            acctModalHtml.indexOf('onclick="toggleAccountsViewMode()"') >= 0 &&
            ['accountManageList', 'accViewTag', 'accEditBtnLabel'].every(id => acctModalHtml.indexOf('id="' + id + '"') >= 0));
        ok('添加账户弹窗新增模式不再有那段引导文字（副标题只留编辑模式的统计）',
            app31.indexOf('新账户：起个名字（放钱的地方）、选好分类就能记了') < 0);
        ok('月度账单副标题不再堆说明，只留「成员 · 年月」',
            app31.indexOf('一行 = 一个放钱的地方') < 0 &&
            app31.indexOf('右侧合计按汇率换算成人民币') < 0);
        ok('月度账单里「余额填期末数…」那行提示也删掉了',
            html31.indexOf('余额填期末数；收益只填市值变动') < 0);

        // 假数据：两个账户 + 两个成员，绝不碰真实账本
        ev(`state.accounts = [
            { id:'acct_a', name:'中国银行', kind:'asset', group:'现金', color:'#007aff', icon:'fa-wallet', order:1, members:['本人'] },
            { id:'acct_b', name:'支付宝', kind:'asset', group:'现金', color:'#34c759', icon:'fa-wallet', order:2, members:['本人','家人'] }
        ]; state.balanceMembers = ['本人','家人']; accountsMembersOpen = false;`);
        ev(`openAccountsModal();`);
        const listHtml31 = ev(`document.getElementById('accountManageList').innerHTML`);
        ok('家庭成员折叠区排在「新增账户」正下方、账户清单之上',
            listHtml31.indexOf('acct-member-fold') >= 0 &&
            listHtml31.indexOf('acct-member-fold') < listHtml31.indexOf('account-section-title') &&
            css31.indexOf('#accountsModal .acct-member-fold { margin: 0 0 12px;') >= 0);
        ok('默认进只读查看模式，编辑按钮在标题栏可见',
            ev(`document.getElementById('accountsModal').classList.contains('acc-viewmode')`) === true &&
            ev(`document.getElementById('accEditBtn').style.display`) !== 'none');
        ok('只读模式下每行只剩图标 + 名字 + 小标签（分组下拉藏起来）',
            css31.indexOf('#accountsModal.acc-viewmode .acct-group-select { display: none; }') >= 0 &&
            ev(`document.querySelectorAll('#accountManageList .account-row').length`) === 2 &&
            ev(`document.querySelectorAll('#accountManageList .ar-title').length`) === 2);
        ok('家庭成员入口一直在，默认收起',
            ev(`!!document.getElementById('acctMemberHead')`) &&
            ev(`document.getElementById('acctMemberPanel').classList.contains('hidden')`) === true &&
            ev(`document.getElementById('acctMemberHead').textContent.indexOf('家庭成员（2）') >= 0`));
        ev(`toggleAccountMembers();`);
        ok('点一下展开成员，再点一下收回',
            ev(`!document.getElementById('acctMemberPanel').classList.contains('hidden')`) &&
            ev(`document.getElementById('acctMemberHead').classList.contains('open')`) === true);
        ev(`renderAccountManageList();`);
        ok('重画列表不会把用户展开的成员面板弹回去',
            ev(`!document.getElementById('acctMemberPanel').classList.contains('hidden')`));
        ev(`toggleAccountMembers();`);
        ok('收起后重画也保持收起',
            ev(`renderAccountManageList(); document.getElementById('acctMemberPanel').classList.contains('hidden')`));

        // 点「＋ 新增账户」→ 完整编辑弹窗，并真的存出一个带成员 / 图标 / 颜色 / 桶的账户
        ev(`document.getElementById('acctAddToggle').click();`);
        ok('点新增账户打开的是完整编辑弹窗，而且压在账户管理弹窗之上',
            ev(`!document.getElementById('accountEditModal').classList.contains('hidden')`) === true &&
            ev(`document.getElementById('acctEditTitle').textContent`) === '添加账户' &&
            ev(`parseInt(document.getElementById('accountEditModal').style.zIndex,10) > parseInt(document.getElementById('accountsModal').style.zIndex,10)`) === true);
        ok('完整弹窗默认有名称 / 分类 / 成员 / 图标 / 颜色可选（币种下拉已移除）',
            ev(`document.getElementById('acctEditGroup').options.length`) >= 3 &&
            ev(`document.querySelectorAll('#acctEditMembers input[type="checkbox"]').length`) === 2 &&
            ev(`document.querySelectorAll('#acctEditIcons .icon-pick-item').length`) >= 8 &&
            ev(`document.querySelectorAll('#acctEditColors .color-pick-item').length`) >= 8 &&
            ev(`document.querySelectorAll('#acctEditColors .color-pick-item.selected').length`) === 1);
        ev(`document.getElementById('acctEditName').value = '测试账户';
            document.getElementById('acctEditGroup').value = '流动资金';
            var _boxes = document.querySelectorAll('#acctEditMembers input[type="checkbox"]');
            _boxes.forEach(function(b){ b.checked = true; });
            acctEditDraft.icon = 'fa-building-columns';
            acctEditDraft.earnsReturn = true;
            saveAccountEdit();`);
        const newAcc31 = JSON.parse(ev(`JSON.stringify(state.accounts[state.accounts.length-1])`));
        ok('保存出来的账户带齐成员、图标、色板色、收益开关和四笔钱归桶',
            newAcc31.name === '测试账户' && newAcc31.members.length === 2 &&
            newAcc31.icon === 'fa-building-columns' &&
            ev(`COLOR_OPTIONS.indexOf(state.accounts[state.accounts.length-1].color) >= 0`) === true &&
            newAcc31.earnsReturn === true && newAcc31.bucket === 'cash',
            { name: newAcc31.name, members: newAcc31.members, icon: newAcc31.icon, color: newAcc31.color, bucket: newAcc31.bucket });
        ok('保存后账户管理清单立刻多出这一行，编辑弹窗自己关掉',
            ev(`document.getElementById('accountEditModal').classList.contains('hidden')`) === true &&
            ev(`document.querySelectorAll('#accountManageList .account-row').length`) === 3);

        // 空台账防死锁：唯一添加入口常驻可见（v1.41.16 借出款踩过）
        ev(`state.accounts = []; openAccountsModal();`);
        ok('一个账户都没有时新增按钮照样看得见、点得开',
            ev(`!!document.getElementById('acctAddToggle')`) &&
            ev(`document.getElementById('acctAddToggle').offsetParent !== null || !document.getElementById('acctAddToggle').classList.contains('hidden')`) === true &&
            ev(`document.getElementById('accountManageList').innerHTML.indexOf('点上面「＋ 新增账户」添加')`) >= 0);
        ev(`document.getElementById('acctAddToggle').click();`);
        ok('空账户也能从新增按钮进完整编辑弹窗',
            ev(`!document.getElementById('accountEditModal').classList.contains('hidden')`) === true);
        ev(`closeAccountEdit(); closeAccountsModal();`);
        ok('新样式全部 scoped 到 #accountsModal，不误伤别的弹窗',
            css31.indexOf('#accountsModal .acct-add-toggle {') >= 0 &&
            css31.indexOf('#accountsModal .acct-member-fold {') >= 0);
        ok('手机端新增按钮和成员折叠按钮都有 44px 触屏高度',
            css31.indexOf('#accountsModal .acct-add-toggle,\n    #accountsModal .acct-fold-head { min-height: 44px; }') >= 0);
        ok('手机上完整编辑弹窗的「取消 / 保存」吸底，不用滚到底才看得见',
            /@media \(max-width: 640px\) \{\s*#accountEditModal \.acct-edit-actions \{\s*position: sticky;/.test(css31) &&
            css31.indexOf('background: var(--bg-modal);') >= 0);

        // ---------- 32) v1.41.24：iOS WebKit 解密错误要当成「钥匙不对」 ----------
        stage = '32';
        ok('新增 isKeyMismatch：自家 WRONG_KEY / NEED_SECRET 照旧认',
            /function isKeyMismatch\(e, msg\)[\s\S]{0,500}text === 'WRONG_KEY'/.test(app31) &&
            ev(`isKeyMismatch(new Error('WRONG_KEY'), 'WRONG_KEY')`) === true &&
            ev(`isKeyMismatch(new Error('NEED_SECRET'), 'NEED_SECRET')`) === true);
        ok('iOS 的 OperationError / operation-specific reason 也归成钥匙不对',
            ev(`isKeyMismatch({ name:'OperationError' }, 'The operation failed for an operation-specific reason')`) === true &&
            ev(`isKeyMismatch({ name:'InvalidAccessError' }, 'boom')`) === true &&
            ev(`isKeyMismatch(new Error('The operation failed for an operation-specific reason'), '')`) === true &&
            ev(`isKeyMismatch(new Error('网络断了'), '网络断了')`) === false);
        ok('钥匙不对时第一次失败会重试，第二次强制走口令框',
            /const keyBad = isKeyMismatch\(e, msg\);[\s\S]{0,120}if \(keyBad && attempt === 0\) continue;/.test(app31) &&
            app31.indexOf("await ensureUnlocked(raw.keyring, '读取云端数据', attempt > 0)") >= 0);
        ok('拉取一开头就给强制弹口令框留一次配额',
            /async function remotePullAndMerge\(\) \{\s*\n\s*beginAskCycle\(1\);/.test(app31));
        ok('「拉不开就不推」的保护原样保留',
            app31.indexOf('if (!pulled && __remoteLastError) return false;') >= 0);

        const webkitFail = await ev(`(async function(){
            var oldLooks = LedgerCrypto.looksEncrypted, oldDec = LedgerCrypto.decryptEnvelope,
                oldHas = LedgerCrypto.hasLocalKey, oldUnlock = LedgerCrypto.unlock,
                oldAsk = window.askSecret, oldSecret = __sessionSecret, oldErr = __remoteLastError;
            var decCalls = 0, forced = [];
            var oe = new Error('The operation failed for an operation-specific reason'); oe.name = 'OperationError';
            LedgerCrypto.looksEncrypted = function(){ return true; };
            LedgerCrypto.hasLocalKey = function(){ return Promise.resolve(true); };
            LedgerCrypto.unlock = function(){ return Promise.resolve(true); };
            LedgerCrypto.decryptEnvelope = function(){ decCalls++; return Promise.reject(oe); };
            window.askSecret = function(){ return Promise.resolve(null); };
            __sessionSecret = 'test-pass'; __remoteLastError = ''; beginAskCycle(1);
            var result = await resolveCloudPayload({ enc:'BKE1', keyring:{} });
            var out = [result, decCalls, __remoteLastError];
            __sessionSecret = oldSecret; __remoteLastError = oldErr;
            LedgerCrypto.looksEncrypted = oldLooks; LedgerCrypto.decryptEnvelope = oldDec;
            LedgerCrypto.hasLocalKey = oldHas; LedgerCrypto.unlock = oldUnlock; window.askSecret = oldAsk;
            return JSON.stringify(out);
        })()`);
        const webkitOut = JSON.parse(webkitFail);
        ok('两次都解不开时重试过一次，状态栏换成人话而不是那句英文',
            webkitOut[0] === null && webkitOut[1] === 2 &&
            webkitOut[2].indexOf('加密钥匙没对齐') >= 0 &&
            webkitOut[2].indexOf('operating') < 0 && webkitOut[2].indexOf('operation-specific') < 0 &&
            webkitOut[2].indexOf('和 Mac 相同的加密口令') >= 0,
            webkitOut);

        // ---------- 33) v1.41.25：两台设备主钥匙不同也不该写出「错位封套」 ----------
        stage = '33';
        const vm = require('vm');
        const nodeCrypto = require('crypto');
        const lc33 = fs.readFileSync(path.join(REPO, 'js', 'ledger-crypto.js'), 'utf8');
        const app33 = fs.readFileSync(path.join(REPO, 'js', 'app.js'), 'utf8');
        ok('加密时把「同一把钥匙的说明」写进封套，不再固定用本机 keyring',
            /const kring = kr \|\| cachedKeyring \|\| keyring\(\);/.test(lc33) &&
            lc33.indexOf('cachedKeyring = kring') >= 0 &&
            lc33.indexOf('knownKeyrings: readKnownKeyrings()') >= 0);
        ok('解密按多份候选逐个试，能救回历史错位封套',
            /push\(env\.keyring\); push\(keyring\(\)\); readKnownKeyrings\(\)\.forEach\(push\);/.test(lc33) &&
            lc33.indexOf('env.knownKeyrings.forEach(push)') >= 0 &&
            lc33.indexOf('let unwrapped = false') >= 0);
        ok('见过的钥匙说明只留本机，不进云同步载荷',
            app33.indexOf('bookkeeping_app_crypto_keyrings') < 0 &&
            lc33.indexOf("CRYPTO_KNOWN_KEYRINGS_KEY = 'bookkeeping_app_crypto_keyrings'") >= 0);
        ok('问到一次口令就写回本次会话，切后台后不必反复问',
            /await LedgerCrypto\.unlock\(secret, kr\);[\s\S]{0,260}?__sessionSecret = secret;/.test(app33));

        ok('拉到旧版封套会自动标脏并强制重推一次（内容没变也推），把云端坏封套换掉',
            /if \(raw !== null && LedgerCrypto\.looksEncrypted\(raw\) && !Array\.isArray\(raw\.knownKeyrings\)\)\s*\n\s*__remoteNeedRewrite = true;/.test(app33) &&
            app33.indexOf('if (!__remoteNeedRewrite && __remoteSeenFingerprint && mine === __remoteSeenFingerprint)') >= 0 &&
            app33.indexOf('__remoteNeedRewrite = false;') >= 0);
        const rewriteFlow = await ev(`(async function(){
            var oldApi = window.gistApi, oldFp = window.fingerprintOfPayload,
                oldEnabled = LedgerCrypto.isEnabled, oldNeed = __remoteNeedRewrite,
                oldSeen = __remoteSeenFingerprint, oldLast = __lastPushedFingerprint;
            var calls = 0;
            window.gistApi = function(){ calls++; return Promise.resolve({ status: 200, body: {} }); };
            window.fingerprintOfPayload = function(){ return 'fixed-fp'; };
            LedgerCrypto.isEnabled = function(){ return false; };
            __remoteSeenFingerprint = 'fixed-fp';
            __remoteNeedRewrite = false;
            var skipped = await remotePush();
            var afterSkip = calls;
            __remoteNeedRewrite = true;
            var forced = await remotePush();
            var afterForce = calls;
            __remoteNeedRewrite = oldNeed; __remoteSeenFingerprint = oldSeen; __lastPushedFingerprint = oldLast;
            window.gistApi = oldApi; window.fingerprintOfPayload = oldFp; LedgerCrypto.isEnabled = oldEnabled;
            return JSON.stringify([skipped, afterSkip, forced, afterForce]);
        })()`);
        ok('内容相同：平时跳过推送，标脏后确实强制写了一次云端',
            rewriteFlow === '[true,0,true,1]', rewriteFlow);

        // 真 crypto 回归：两台设备各自 setup（两把随机主钥匙 + 同一个口令），
        // 全程假字符串，绝不加载账本、不联网。
        function dev33() {
            const store = new Map();
            const localStorage = {
                getItem: k => (store.has(k) ? store.get(k) : null),
                setItem: (k, v) => store.set(k, String(v)),
                removeItem: k => store.delete(k),
                clear: () => store.clear(),
            };
            const indexedDB = { open() { const r = {}; setTimeout(() => r.onerror && r.onerror(new Error('no idb')), 0); return r; } };
            const box = {
                window: { crypto: nodeCrypto.webcrypto, localStorage, indexedDB },
                localStorage, indexedDB, crypto: nodeCrypto.webcrypto,
                btoa: x => Buffer.from(x, 'binary').toString('base64'),
                atob: x => Buffer.from(x, 'base64').toString('binary'),
                TextEncoder, TextDecoder, setTimeout, clearTimeout, console,
                Date, Promise, Error, Uint8Array, ArrayBuffer, JSON, Set, Map,
            };
            const ctx = vm.createContext(box);
            vm.runInContext(lc33, ctx, { filename: 'ledger-crypto.js' });
            return { C: vm.runInContext('LedgerCrypto', ctx), store };
        }
        const reboot33 = (from) => {
            const d = dev33();
            for (const [k, v] of from.store) d.store.set(k, v);
            return d;
        };
        const t33 = await (async () => {
            const PASS = 'same-password-2026';
            const mac = dev33(), phone = dev33();
            const krA = (await mac.C.setup(PASS)).keyring;
            const krB = (await phone.C.setup(PASS)).keyring;
            const twoKeys = krA.pass.data !== krB.pass.data;

            // 手机解开 Mac 的封套后，再推的封套必须「data 与 keyring 同一把钥匙」
            const envMac = await mac.C.encryptString('Mac 的数据');
            await phone.C.decryptEnvelope(envMac, PASS);
            const envPhone = await phone.C.encryptString('手机记的一笔账');
            const stillMismatched = envPhone.keyring.pass.data === krB.pass.data;
            const phoneReboot = reboot33(phone);
            await phoneReboot.C.unlock(PASS, phoneReboot.C.keyring());
            let selfRead = '';
            try { selfRead = await phoneReboot.C.decryptEnvelope(envPhone, PASS); } catch (e) { selfRead = 'ERR ' + (e && e.message); }

            // 旧版写坏的封套（data 用 A、keyring 写 B）也必须能救回
            const bad = Object.assign({}, envPhone, {
                keyring: { v: krB.v, alg: 'AES-GCM', pass: krB.pass, recovery: krB.recovery, hint: krB.hint },
                knownKeyrings: undefined,
            });
            const phone2 = reboot33(phone);
            await phone2.C.unlock(PASS, phone2.C.keyring());
            let legacy = '';
            try { legacy = await phone2.C.decryptEnvelope(bad, PASS); } catch (e) { legacy = 'ERR ' + (e && e.message); }

            // 救回之后推的新封套，Mac 重启后也能解开
            const fresh = await phone2.C.encryptString('修好之后推的新数据');
            const macReboot = reboot33(mac);
            await macReboot.C.unlock(PASS, macReboot.C.keyring());
            let other = '';
            try { other = await macReboot.C.decryptEnvelope(fresh, PASS); } catch (e) { other = 'ERR ' + (e && e.message); }
            return { twoKeys, stillMismatched, selfRead, legacy, other,
                known: phone.C.readKnownKeyrings().length };
        })();
        ok('两台设备同口令也确实是两把主钥匙，本机记住了见过的钥匙说明',
            t33.twoKeys && t33.known >= 2, { known: t33.known });
        ok('解开别台设备的数据后再推，封套不再错位；自己重启后照样解得开',
            !t33.stillMismatched && t33.selfRead === '手机记的一笔账', t33.selfRead);
        ok('云端现存的旧版错位封套，重启后也能用同一口令解开',
            t33.legacy === '手机记的一笔账', t33.legacy);
        ok('救回之后推的新封套，另一台设备重启后也能解开（不再需要 Mac 先推一次）',
            t33.other === '修好之后推的新数据', t33.other);

        // ---------- 34) v1.41.26：同步失败全局提醒 + 账户编辑弹窗统一尺寸 ----------
        stage = '34';
        const html34 = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
        const css34 = fs.readFileSync(path.join(REPO, 'css', 'style.css'), 'utf8');
        const app34 = fs.readFileSync(path.join(REPO, 'js', 'app.js'), 'utf8');
        ok('添加账户弹窗里那段「账户不再分资产还是负债」说明已删除',
            html34.indexOf('账户不再分资产还是负债') < 0 &&
            html34.indexOf('欠款填「负债」列就行') < 0);
        ok('弹窗内输入框统一 46px / 16px，同类文字统一一档，且只作用于这个弹窗',
            /#accountEditModal \.modal-body \.text-input \{\s*height: 46px; min-height: 46px; padding: 0 12px;\s*font-size: 16px; box-sizing: border-box;/.test(css34) &&
            css34.indexOf('#accountEditModal .acct-edit-pair .settings-label') >= 0 &&
            css34.indexOf('#accountEditModal .switch-row { font-size: 14px;') >= 0 &&
            css34.indexOf('#accountEditModal .switch-row .sr-hint { font-size: 12px;') >= 0 &&
            css34.indexOf('#accountEditModal .acct-member-pick { font-size: 14px;') >= 0);
        ok('同步失败提醒挂进同步周期收尾和切页面入口，任何页面都能弹出来',
            /function maybeAlertSyncIssue\(force\)/.test(app34) &&
            app34.indexOf('maybeAlertSyncIssue(reason === \'manual\');') >= 0 &&
            /function switchView\(viewName\) \{\s*\n\s*maybeAlertSyncIssue\(false\);/.test(app34) &&
            app34.indexOf("showToast('云同步没成功：' + __remoteLastError, 'error', 6000)") >= 0);
        ok('同一条错误 10 分钟内不重复弹，手动同步必弹',
            app34.indexOf('const quiet = !force && __remoteAlertedError === __remoteLastError') >= 0 &&
            app34.indexOf('10 * 60 * 1000') >= 0);
        ok('提示条能停留 6 秒，长文案不会撑出屏幕',
            app34.indexOf("function showToast(message, type = 'success', duration = 2500)") >= 0 &&
            app34.indexOf('}, duration);') >= 0 &&
            /\.toast \{[\s\S]{0,220}max-width: min\(92vw, 520px\);/.test(css34));

        // 运行时：假错误 + 假的「已配置」，全程不碰真实账本 / 不联网
        const alertFlow = await ev(`(function(){
            var oldReady = window.remoteSyncReady, oldErr = __remoteLastError,
                oldAlerted = __remoteAlertedError, oldAt = __remoteAlertedAt;
            var box = document.getElementById('toastContainer');
            window.remoteSyncReady = function(){ return true; };
            box.innerHTML = '';
            __remoteLastError = '云端数据解不开'; __remoteAlertedError = ''; __remoteAlertedAt = 0;
            maybeAlertSyncIssue(true);
            var first = box.querySelectorAll('.toast.error').length;
            var text = (box.querySelector('.toast.error') || {}).textContent || '';
            maybeAlertSyncIssue(false);
            var afterRepeat = box.querySelectorAll('.toast.error').length;
            __remoteLastError = '网络不通'; maybeAlertSyncIssue(false);
            var afterChange = box.querySelectorAll('.toast.error').length;
            __remoteLastError = ''; maybeAlertSyncIssue(false);
            __remoteLastError = '云端数据解不开'; maybeAlertSyncIssue(false);
            var afterRecover = box.querySelectorAll('.toast.error').length;
            box.innerHTML = '';
            __remoteLastError = oldErr; __remoteAlertedError = oldAlerted; __remoteAlertedAt = oldAt;
            window.remoteSyncReady = oldReady;
            return JSON.stringify([first, text.indexOf('云同步没成功：云端数据解不开') >= 0,
                afterRepeat, afterChange, afterRecover]);
        })()`);
        const alertOut = JSON.parse(alertFlow);
        ok('有错就弹、同样错误不重复弹、错误变了或恢复后再错会再弹',
            alertOut[0] === 1 && alertOut[1] === true &&
            alertOut[2] === 1 && alertOut[3] === 2 && alertOut[4] === 3,
            alertOut);
        ok('删掉说明后，添加账户弹窗该有的字段一个没少（币种下拉已移除，不再要求）',
            ['acctEditName', 'acctEditGroup', 'acctEditMembers',
                'acctEditEarns', 'acctEditMulti', 'acctEditIcons', 'acctEditColors']
                .every(id => html34.indexOf('id="' + id + '"') >= 0) &&
            html34.indexOf('id="acctEditCurrency"') < 0);

        // ---------- 35) v1.41.29：非收益账户不显「本金未知」+ 自检挪到 footer + 顶部收纳 ----------
        stage = '35';
        ok('收益率角标只给「算收益率」的账户：普通账户填余额不再冒「本金未知」',
            app34.indexOf('const investIds = new Set(investmentAccountIds());') >= 0 &&
            app34.indexOf('if (!investIds.has(id)) return;') >= 0);
        ok('记月度账单标题旁的「成员 · 年月」副标题已删干净',
            html34.indexOf('monthlyModalSub') < 0 &&
            app34.indexOf('monthlyModalSub') < 0);
        ok('录入自检挪到弹窗底部（取消/保存上方）：紧凑一行、明细默认收起、可展开',
            html34.indexOf('class="monthly-selfcheck msc-footer"') >= 0 &&
            html34.indexOf('class="footer-btns"') >= 0 &&
            html34.indexOf('id="monthlySelfCheck" class="monthly-selfcheck"') < 0 &&
            app34.indexOf('function toggleMonthlySelfCheck()') >= 0 &&
            app34.indexOf('msc-summary') >= 0 && app34.indexOf('msc-detail') >= 0);
        ok('编辑 / 只读查看 / 已核对 挪到标题那一行，表上方只剩沿用上期/清空/撤销',
            html34.indexOf('class="bal-entry-mode"') >= 0 &&
            /<div class="bal-entry-mode">[\s\S]{0,500}id="mwChkCount"[\s\S]{0,300}id="mwEditBtn"/.test(html34) &&
            /<div class="bal-entry-actions">[\s\S]{0,700}撤销这次填写<\/button>\s*<\/div>/.test(html34) &&
            html34.indexOf('<button class="primary-btn" id="mwEditBtn"') < 0);
        ok('自检进 footer 后手机端 safe-area 兜底仍在',
            /#monthlyModal \.modal-footer \{\s*flex-direction: column;/.test(css34) &&
            css34.indexOf('#monthlyModal .modal-footer { padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px)); }') >= 0);

        console.log('\n=== 结束' + (failures ? '（有 ' + failures + ' 项失败）' : '（全过）') + ' ===');
    } catch (e) {
        console.log('  [FATAL @ ' + stage + '] ' + (e && e.stack || e));
        failures++;
    }
    try { fs.unlinkSync(tmpHtml); } catch (e) {}
    setTimeout(() => { dom.window.close(); process.exit(failures ? 1 : 0); }, 200);
}
