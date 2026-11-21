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
        ok('空状态有说明文字，并讲清不用在「月度盘点」里重复填',
            ev(`document.getElementById('lendingList').innerHTML`).indexOf('月度盘点') >= 0);
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
        ok('年报给四个数（总支出 / 净结余 / 投资收益 / 净资产增加）',
            ev(`document.querySelectorAll('#reviewAuto .rr-big').length`) === 4);
        ok('年度页签已改叫「年报」',
            ev(`document.getElementById('reviewTabYear').textContent.trim()`) === '年报');
        ok('年报里能翻到这一年写过的月度备注',
            ev(`document.getElementById('reviewAuto').innerHTML`).indexOf('10 月装修花了 9 万') >= 0);
        const _rrBigVal = (label) => ev("(function(){var bs=document.querySelectorAll('#reviewAuto .rr-big');for(var i=0;i<bs.length;i++){if(bs[i].querySelector('span').textContent===" + JSON.stringify(label) + ")return bs[i].querySelector('b').textContent;}return null;})()");
        const _yrNetFromTxns = ev(`(function(){var inc=0,exp=0;
            state.transactions.forEach(function(t){if(String(getMonthKey(t.date||'')).slice(0,4)!=='2026')return;
            var a=Number(t.amount)||0;if(t.type==='income')inc+=a;else if(t.type==='expense')exp+=a;});
            return inc-exp;})()`);
        ok('年报「一年净结余」= 全年收入 − 全年支出（跟交易流水一致）',
            _rrBigVal('一年净结余') === ev(`_fmtY(${_yrNetFromTxns})`),
            [_rrBigVal('一年净结余'), _yrNetFromTxns]);
        ev(`state.transactions.push({id:'__probe_exp',type:'expense',amount:3000,date:'2026-06-10',member:'本人'}); renderReviewModal();`);
        ok('临时多记一笔 3000 支出，净结余正好少 3000（不是写死的数、也不是净资产增加）',
            _rrBigVal('一年净结余') === ev(`_fmtY(${_yrNetFromTxns} - 3000)`), _rrBigVal('一年净结余'));
        ev(`state.transactions = state.transactions.filter(function(t){return t.id!=='__probe_exp';}); renderReviewModal();`);
        ok('回顾弹窗底部不再有「完成」按钮（关窗口走右上角 X）',
            ev(`!Array.prototype.some.call(document.querySelectorAll('#reviewModal button'),function(b){return b.textContent.trim()==='完成';})`));
        ok('月报底部「不判断该花多少 / 不预测下个月」那句已删',
            appSrc.indexOf('也不预测下个月') < 0);
        ok('回顾历史空态「还没写过 / 随时能翻」那句已删',
            appSrc.indexOf('写过的会留在这里') < 0);

        // v1.41.44：本机开始存回顾 → 清空必须留墓碑，否则重启后 / 另一台设备上会「复活」
        ev(`reviewTab='month'; reviewMonth='2026-10';
            document.getElementById('reviewText').value=''; saveReviewText();`);
        ok('清空某期回顾留一条「删过」墓碑，不是直接抹掉',
            ev(`!!(state.reviews.monthly['2026-10'] && state.reviews.monthly['2026-10'].deletedAt)`));
        ok('重新打开这一期：输入框空、不显示「已保存过」、历史里也没有那段话',
            ev(`renderReviewModal(); document.getElementById('reviewText').value`) === '' &&
            ev(`document.getElementById('reviewSaved').textContent`) === '' &&
            ev(`document.getElementById('reviewHistory').innerHTML`).indexOf('10 月装修花了 9 万') < 0);
        ok('另一台设备的旧文字盖不掉本机较新的墓碑（删了就是删了）',
            ev(`(function(){mergeRemoteData({data:{reviews:{monthly:{'2026-10':{text:'旧文字',updatedAt:1}}}}});
                var v=state.reviews.monthly['2026-10'];return !!v && !!v.deletedAt;})()`));
        ok('之后重新写这一期，文字能盖掉墓碑',
            ev(`(function(){document.getElementById('reviewText').value='重新写的话';saveReviewText();
                var v=state.reviews.monthly['2026-10'];return v.text==='重新写的话' && !v.deletedAt;})()`));
        ev(`document.getElementById('reviewText').value='10 月装修花了 9 万'; saveReviewText();`);

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
        ok('v1.41.67：标题栏右侧只留 × 关闭，切只读的「完成/编辑」按钮已删除',
            acctModalHtml.indexOf('class="acct-head-actions"') >= 0 &&
            acctModalHtml.indexOf('onclick="closeAccountsModal()"') > acctModalHtml.indexOf('class="modal-header"') &&
            acctModalHtml.indexOf('onclick="closeAccountsModal()"') < acctModalHtml.indexOf('class="modal-body"') &&
            acctModalHtml.indexOf('id="accEditBtn"') < 0 &&
            acctModalHtml.indexOf('toggleAccountsViewMode()') < 0 &&
            acctModalHtml.indexOf('id="accountManageList"') >= 0);
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
        ok('默认直接进编辑模式（点账户就是要改），无切换按钮，关窗口走 ×',
            ev(`document.getElementById('accountsModal').classList.contains('acc-viewmode')`) === false &&
            ev(`!document.getElementById('accEditBtn')`) === true);
        ok('编辑态每行有可选分组下拉；只读 CSS 保留兼容但已无入口',
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
            /function switchView\(viewName(?:, slideDir)?\) \{\s*\n\s*maybeAlertSyncIssue\(false\);/.test(app34) &&
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
        ok('月度盘点标题旁的「成员 · 年月」副标题已删干净',
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

        // ---------- 36) v1.41.44：手写回顾 / 借出款台账本机落盘 + 重启读回 ----------
        stage = '36';
        ev(`reviewTab='month'; reviewMonth='2026-10';
            document.getElementById('reviewText').value='重启后还应该在'; saveReviewText();
            if(!state.lendings.length) state.lendings.push({id:'__probe_lend',person:'探针',amount:1,lendDate:'2026-01-01',updatedAt:Date.now()});
            saveStateNow();`);
        ok('本机那份账本里真的存了手写回顾和借出款台账（不再只靠云端）',
            ev(`(function(){var raw=localStorage.getItem(STORAGE_KEY);if(!raw)return false;
                var d=JSON.parse(unpackFromStorage(raw));
                return !!(d.reviews && d.reviews.monthly['2026-10'] && d.reviews.monthly['2026-10'].text==='重启后还应该在'
                    && Array.isArray(d.lendings) && d.lendings.length>0);})()`));
        ok('模拟重启：清空内存后 loadState() 能把这两份读回来',
            ev(`(function(){state.reviews={monthly:{},yearly:{}};state.lendings=[];
                loadState();
                return !!(state.reviews.monthly['2026-10'] && state.reviews.monthly['2026-10'].text==='重启后还应该在'
                    && state.lendings.length>0);})()`));
        ok('同步载荷里也有这两份（本机清单与云端清单一致）',
            ev(`(function(){var d=buildSyncPayload().data;return !!d.reviews && Array.isArray(d.lendings);})()`));

        // ---------- 37) v1.41.45：取「今天」一律按设备本地日期（凌晨 0–8 点不再写成昨天）----------
        stage = '37';
        const app37 = fs.readFileSync(path.join(REPO, 'js', 'app.js'), 'utf8');
        const _probeUTC = new Date(2026, 10, 14, 0, 30, 0).toISOString().slice(0, 10);
        ok('探针时刻本地已是 11-14 00:30，但世界时仍是 11-13（用例真覆盖跨天窗口）',
            _probeUTC === '2026-11-13', _probeUTC);
        const _at = (y, mo, d) => JSON.parse(ev(`(function(){var real=Date.now;try{
            Date.now=function(){return new Date(${y},${mo - 1},${d},0,30,0).getTime();};
            return JSON.stringify({today:todayStr(),month:getCurrentMonthKey(),imp:normalizeImportDate('')});
            }finally{Date.now=real;}})()`));
        const _p1 = _at(2026, 11, 14);
        ok('凌晨 00:30：记一笔默认日期 = 本地 11-14（旧写法会给 11-13）', _p1.today === '2026-11-14', _p1);
        ok('凌晨 00:30：当前月份仍是 2026-11（往返抵消，行为不变）', _p1.month === '2026-11', _p1);
        ok('导入日期留空时的兜底也跟着用本地今天', _p1.imp === '2026-11-14', _p1);
        const _p2 = _at(2026, 12, 1);
        ok('跨月 12-01 00:30：日期与月份都落在 12 月', _p2.today === '2026-12-01' && _p2.month === '2026-12', _p2);
        const _p3 = _at(2027, 1, 1);
        ok('跨年 2027-01-01 00:30：不退回 2026-12-31 / 2026-12',
            _p3.today === '2027-01-01' && _p3.month === '2027-01', _p3);
        ok('时间栏仍读设备本地时钟（getHours / getMinutes 没被改掉）',
            app37.indexOf('d.getHours()') >= 0 && app37.indexOf('d.getMinutes()') >= 0);
        ok('全库不再用「世界时字符串切前 10 位」当今天',
            app37.indexOf('new Date().toISOString().slice(0, 10)') < 0 &&
            app37.indexOf('formatDateFull(new Date().toISOString())') < 0);
        ok('备份文件名与 Excel 文件名都改走设备本地日期 _ymd(Date.now())',
            /const stamp = _ymd\(Date\.now\(\)\)/.test(app37) &&
            /记账本-\$\{_ymd\(Date\.now\(\)\)\}/.test(app37));
        ok('Excel 日期序列号仍按 UTC 还原（故意保留，没被这次改动带走）',
            ev(`normalizeImportDate(45000)`) === (() => {
                const dd = new Date(Math.round((45000 - 25569) * 86400000));
                const p = n => String(n).padStart(2, '0');
                return `${dd.getUTCFullYear()}-${p(dd.getUTCMonth() + 1)}-${p(dd.getUTCDate())}`;
            })());
        ok('getMonthKey 解析已存日期没被改坏（2026-11-14 → 2026-11）',
            ev(`getMonthKey('2026-11-14')`) === '2026-11');

        // ---------- 38) v1.41.46：只看不改不弹提醒 / 分类空白图标 / 账户图标增删 ----------
        stage = '38';
        const css38 = fs.readFileSync(path.join(REPO, 'css', 'style.css'), 'utf8');
        // jsdom 没实现 matchMedia，openTransactionModal 的渲染链会用到；补一个只读 stub。
        ev(`window.matchMedia = window.matchMedia || function(){return {matches:false,media:'',
            addEventListener:function(){},removeEventListener:function(){},
            addListener:function(){},removeListener:function(){}};};`);
        const _tid = ev(`state.transactions[0] && state.transactions[0].id`);
        ev(`editTransaction(${JSON.stringify(_tid)});`);
        ok('打开弹窗时确实记下了快照（不是靠 null 蒙混过关）',
            ev(`txnOpenSnapshot !== null`) === true);
        ok('从列表点开一笔已有交易（金额/备注本来就有值），只看不改 → 不算未保存',
            ev(`transactionHasUnsavedContent()`) === false);
        ok('点 X 不会弹「放弃未保存的填写？」',
            ev(`(function(){var real=window.confirm,n=0;window.confirm=function(){n++;return true;};
                try{confirmCloseTransactionModal();}finally{window.confirm=real;}return n;})()`) === 0);
        ev(`editTransaction(${JSON.stringify(_tid)});`);
        ok('真改了金额 → 算未保存',
            ev(`(function(){var e=document.getElementById('amountValue'),o=e.value;e.value='999';
                var r=transactionHasUnsavedContent();e.value=o;return r;})()`) === true);
        ok('改完又改回原值 → 不算未保存', ev(`transactionHasUnsavedContent()`) === false);
        ok('改备注 / 改日期也认得出来',
            ev(`(function(){var e=document.getElementById('noteInput'),o=e.value;e.value='改一下';
                var a=transactionHasUnsavedContent();e.value=o;
                var d=document.getElementById('dateInput'),od=d.value;d.value='2026-01-01';
                var b=transactionHasUnsavedContent();d.value=od;return !!(a&&b);})()`) === true);
        ok('只选分类仍不算有内容（沿用既有口径）',
            ev(`(function(){var o=state.selectedCategoryId;state.selectedCategoryId='__probe_cat__';
                var r=transactionHasUnsavedContent();state.selectedCategoryId=o;return r;})()`) === false);
        ok('左滑与点 X 走同一个判断函数，不会分叉',
            /if \(modal\.id === 'transactionModal'\) return transactionHasUnsavedContent\(\);/.test(appSrc) &&
            appSrc.indexOf('if (transactionHasUnsavedContent() && !window.confirm') >= 0);
        ok('连续记账（再记一笔）后重设快照，不会拿旧值误弹',
            /opts\.reopen[\s\S]{0,900}txnOpenSnapshot = captureTxnSnapshot\(\);/.test(appSrc));
        ev(`openTransactionModal();`);
        ok('新增模式刚打开、什么都没填 → 不算未保存',
            ev(`transactionHasUnsavedContent()`) === false);
        ok('新增模式填了金额 → 算未保存',
            ev(`(function(){document.getElementById('amountValue').value='50';return transactionHasUnsavedContent();})()`) === true);

        ok('分类图标删掉第 15 个空白的 fa-red-envelope，剩 27 个',
            ev(`ICON_OPTIONS.length`) === 27 && ev(`ICON_OPTIONS.indexOf('fa-red-envelope')`) === -1 &&
            ev(`ICON_OPTIONS[14]`) === 'fa-plane');
        ev(`renderIconPicker();`);
        ok('分类图标选择器也只剩 27 个，没有空白格',
            ev(`document.querySelectorAll('#iconPicker .icon-pick-item').length`) === 27);
        ok('账户图标删掉原第 3 / 第 6 个、加入微信与支付宝，仍是 16 个',
            ev(`ACCOUNT_ICON_CHOICES.length`) === 16 &&
            ev(`ACCOUNT_ICON_CHOICES.indexOf('fa-vault')`) === -1 &&
            ev(`ACCOUNT_ICON_CHOICES.indexOf('fa-certificate')`) === -1 &&
            ev(`ACCOUNT_ICON_CHOICES.indexOf('fa-weixin')`) >= 0 &&
            ev(`ACCOUNT_ICON_CHOICES.indexOf('fa-alipay')`) >= 0 &&
            ev(`ACCOUNT_ICON_CHOICES[2]`) === 'fa-coins' && ev(`ACCOUNT_ICON_CHOICES[5]`) === 'fa-car-side');
        ev(`acctEditDraft = {icon:'fa-wallet', color:'#ff6b6b'}; renderAcctEditPickers();`);
        ok('添加账户弹窗里能看到微信 / 支付宝两个图标',
            ev(`!!document.querySelector('#acctEditIcons [data-icon="fa-weixin"]')`) &&
            ev(`!!document.querySelector('#acctEditIcons [data-icon="fa-alipay"]')`) &&
            ev(`document.querySelectorAll('#acctEditIcons .icon-pick-item').length`) === 16);
        ok('品牌图标字体规则在（否则 fa-solid 下微信/支付宝会显示空白）',
            css38.indexOf('.fa-solid.fa-weixin') >= 0 && css38.indexOf('"Font Awesome 6 Brands"') >= 0);
        const fa38 = fs.readFileSync(path.join(REPO, 'vendor', 'fontawesome', 'css', 'all.min.css'), 'utf8');
        ok('FontAwesome 里确实有微信/支付宝图形码与 Brands 字体；fa-red-envelope 确实不存在',
            fa38.indexOf('.fa-weixin:before') >= 0 && fa38.indexOf('.fa-alipay:before') >= 0 &&
            fa38.indexOf('"Font Awesome 6 Brands"') >= 0 && fa38.indexOf('fa-red-envelope') < 0);
        ok('图标按名字存、不是按序号（删选项不会让已有账户/分类错位）',
            appSrc.indexOf('data-icon="${i}"') >= 0 && appSrc.indexOf("onclick=\"selectIcon('${icon}')\"") >= 0);

        // ---------- 39) v1.41.47：Mac 壳里五个页面控件高度统一，手机端零影响 ----------
        stage = '39';
        const css39 = fs.readFileSync(path.join(REPO, 'css', 'style.css'), 'utf8');
        const html39 = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
        const macEnd39 = css39.indexOf('/* ===== v1.41.48');
        const macBlock = css39.slice(css39.indexOf('/* ===== v1.41.47'), macEnd39 > 0 ? macEnd39 : css39.length);
        const macCss = macBlock.replace(/\/\*[\s\S]*?\*\//g, '');
        const macSelectors = macCss.split('}').map(s => s.split('{')[0].trim()).filter(Boolean);

        ok('Mac 标记由 head 首帧脚本按原生壳 UA 挂上（手机不会带这个 class）',
            html39.indexOf("navigator.userAgent.indexOf('BookkeepingMacApp')") >= 0 &&
            html39.indexOf("document.documentElement.classList.add('mac-app')") >= 0 &&
            html39.indexOf("classList.add('mac-app')") < html39.indexOf('<link rel="stylesheet"'));
        ok('高度规则每一条选择器都以 html.mac-app 开头（不裸改全局按钮）',
            macSelectors.length >= 5 &&
            macSelectors.every(s => s.split(',').every(x => x.trim().indexOf('html.mac-app') === 0)) &&
            macSelectors.every(s => /#view-(transactions|reports|balance|returns|settings)/.test(s)),
            macSelectors.length);
        ok('五个页面列出的控件都覆盖到了（含结账清单的恢复 / 看变动明细、外观开关）',
            ['#view-transactions', '#view-reports', '#view-balance', '#view-returns', '#view-settings']
                .every(id => macBlock.indexOf(id) >= 0) &&
            ['.filter-tab', '.search-box', '.period-btn', '.filter-select', '.secondary-btn',
             '.primary-btn', '.money-eye-btn', '.ci-act', '.ci-exclude', '.theme-toggle',
             '.theme-btn', '.settings-select', '.ios-toggle'].every(c => macBlock.indexOf(c) >= 0));
        ok('手机端 v1.41.21 的 32px 口径仍在，没有被这次改动回退',
            css39.indexOf('v1.41.21：手机端同一行的筛选') >= 0 &&
            css39.indexOf('--ctrl-h: 32px') >= 0);

        ev(`(function(){
            var s=document.createElement('style'); s.id='macHeightProbe';
            s.textContent=${JSON.stringify(macCss)};
            document.head.appendChild(s);
            document.documentElement.classList.add('mac-app');
            var list=document.getElementById('closeList');
            if(list) list.innerHTML='<div class="close-item"><span class="ci-actions">'+
                '<button class="ci-act">恢复</button><button class="ci-exclude">排除</button></span></div>';
        })();`);
        const h39 = sel => ev(`(function(){var e=document.querySelector(${JSON.stringify(sel)});` +
            `return e?getComputedStyle(e).height:null;})()`);
        const mac32 = [
            '#view-transactions .view-header-right .search-box',
            '#view-transactions .view-header-right .primary-btn',
            '#view-transactions .filter-bar .filter-right .filter-select',
            '#view-reports .view-header .report-controls .filter-select',
            '#view-reports .view-header .report-controls .ym-review-btn',
            '#view-reports .close-head .secondary-btn',
            '#view-reports .close-head .filter-select.close-month',
            '#view-reports .ci-act', '#view-reports .ci-exclude',
            '#view-balance .view-header .report-controls .filter-select',
            '#view-balance .view-header .report-controls .secondary-btn',
            '#view-balance .view-header .report-controls .primary-btn',
            '#view-balance .view-header .report-controls .money-eye-btn',
            '#view-returns .view-header .report-controls .filter-select',
            '#view-returns .view-header .report-controls .secondary-btn',
            '#view-returns .view-header .report-controls .primary-btn',
            '#view-returns .view-header .report-controls .money-eye-btn',
            '#view-settings .settings-sections > .settings-section:first-child .settings-row .theme-toggle',
            '#view-settings .settings-sections > .settings-section:first-child .settings-row .settings-select',
            '#view-settings .settings-sections > .settings-section:first-child .settings-row .ios-toggle',
            '#view-settings .settings-sections > .settings-section:first-child .settings-row > .secondary-btn',
        ];
        const mac26 = [
            '#view-transactions .filter-bar .filter-tabs .filter-tab',
            '#view-reports .view-header .report-controls .period-btn',
            '#view-balance .view-header .report-controls .period-btn',
            '#view-returns .view-header .report-controls .period-btn',
        ];
        const vals32 = mac32.map(h39);
        const vals26 = mac26.map(h39);
        ok('Mac 上 21 个独立控件（含外观基准）实际计算高度全是 32px',
            vals32.every(v => v === '32px'), vals32);
        ok('四组胶囊内部按钮全是 26px（外框 + 3px×2 = 32px）',
            vals26.every(v => v === '26px'), vals26);
        ok('外观那一排没有变形：三个主题按钮撑满外观外框的内容高',
            macBlock.indexOf('.theme-btn {') >= 0 &&
            /\.theme-btn \{\s*height: 100%;/.test(macBlock));

        ev(`document.documentElement.classList.remove('mac-app');`);
        const noMacTab = h39('#view-transactions .filter-bar .filter-tabs .filter-tab');
        const noMacEye = h39('#view-balance .view-header .report-controls .money-eye-btn');
        ok('去掉 Mac 标记（手机 / 普通浏览器）后一个都不命中，高度恢复原样',
            noMacTab !== '26px' && noMacEye !== '32px', { tab: noMacTab, eye: noMacEye });
        ev(`(function(){var s=document.getElementById('macHeightProbe');if(s)s.remove();})();`);

        // ---------- 40) v1.41.48：手机端补齐按钮高度 + 外观不换行，Mac 零影响 ----------
        stage = '40';
        const css40 = fs.readFileSync(path.join(REPO, 'css', 'style.css'), 'utf8');
        const pStart40 = css40.indexOf('/* ===== v1.41.48');
        const pEnd40 = css40.indexOf('/* ===== v1.', pStart40 + 10);
        const phoneBlock = css40.slice(pStart40, pEnd40 > 0 ? pEnd40 : css40.length);
        const macBlock40 = css40.slice(css40.indexOf('/* ===== v1.41.47'), css40.indexOf('/* ===== v1.41.48'));
        const mediaAt = phoneBlock.indexOf('@media (max-width: 640px) {');
        const phoneCss = mediaAt >= 0
            ? phoneBlock.slice(phoneBlock.indexOf('{', mediaAt) + 1, phoneBlock.lastIndexOf('}')).replace(/\/\*[\s\S]*?\*\//g, '')
            : '';

        ok('手机规则整块包在 @media (max-width:640px) 里，且不带 html.mac-app（Mac 不命中）',
            mediaAt >= 0 && phoneCss.length > 200 &&
            phoneCss.indexOf('html.mac-app') < 0 &&
            phoneBlock.lastIndexOf('}') > mediaAt);
        ok('上一版 Mac 专属规则原样保留，没被手机改动覆盖',
            macBlock40.indexOf('html.mac-app') >= 0 &&
            (macBlock40.match(/html\.mac-app/g) || []).length >= 29 &&
            macBlock40.indexOf('height: 32px') >= 0);
        ok('漏掉的内容区按钮都补上了（结账清单 / 设置归类 / 设置六行 / 外观不换行）',
            ['.close-head .secondary-btn', '.filter-select.close-month', '.ci-act', '.ci-exclude',
             '.chart-header-btn', '.settings-select', '.ios-toggle', '.theme-toggle',
             '.settings-row.theme-row', 'flex-direction: row', 'flex-wrap: nowrap']
                .every(s => phoneBlock.indexOf(s) >= 0));
        ok('手机端 v1.41.21 顶部那排的 32px 口径仍在',
            css40.indexOf('v1.41.21：手机端同一行的筛选') >= 0 && css40.indexOf('--ctrl-h: 32px') >= 0);

        ev(`(function(){
            var s=document.createElement('style'); s.id='phoneHeightProbe';
            s.textContent=${JSON.stringify(phoneCss)};
            document.head.appendChild(s);
            var list=document.getElementById('closeList');
            if(list) list.innerHTML='<div class="close-item"><span class="ci-actions">'+
                '<button class="ci-act">恢复</button><button class="ci-exclude">排除</button></span></div>';
        })();`);
        const h40 = sel => ev(`(function(){var e=document.querySelector(${JSON.stringify(sel)});` +
            `return e?getComputedStyle(e).height:null;})()`);
        const content32 = [
            '#view-reports .close-head .secondary-btn',
            '#view-reports .close-head .filter-select.close-month',
            '#view-reports .ci-act',
            '#view-reports .ci-exclude',
            '#view-balance .chart-header .chart-header-btn',
        ];
        const vals40 = content32.map(h40);
        ok('报表页结账清单 4 个按钮 + 资产负债「设置归类」实际高度全是 32px',
            vals40.every(v => v === '32px'), vals40);
        const six40 = ev(`(function(){
            var pre='#view-settings .settings-sections > .settings-section:first-child .settings-row ';
            var sel=[pre+'.theme-toggle', pre+'.settings-select', pre+'.ios-toggle', pre+'> .secondary-btn'].join(',');
            return JSON.stringify(Array.from(document.querySelectorAll(sel)).map(function(n){return getComputedStyle(n).height;}));
        })()`);
        const sixVals = JSON.parse(six40 || '[]');
        ok('设置页通用六行的控件（含外观基准）全部 32px',
            sixVals.length === 6 && sixVals.every(v => v === '32px'), sixVals);
        const row40 = JSON.parse(ev(`(function(){
            var e=document.querySelector('#view-settings .settings-row.theme-row');
            var s=getComputedStyle(e); var l=getComputedStyle(e.querySelector('.settings-label'));
            var t=getComputedStyle(e.querySelector('.theme-toggle'));
            return JSON.stringify({dir:s.flexDirection,wrap:s.flexWrap,label:l.whiteSpace,
                toggleHeight:t.height,toggleGrow:t.flexGrow,
                btnHeight:getComputedStyle(e.querySelector('.theme-btn')).height});
        })()`) || '{}');
        ok('外观文字和三档按钮同一行、不换行，按钮组占满文字右侧',
            row40.dir === 'row' && row40.wrap === 'nowrap' && row40.label === 'nowrap' &&
            row40.toggleHeight === '32px' && row40.toggleGrow === '1' && row40.btnHeight === '100%',
            row40);
        ev(`(function(){var s=document.getElementById('phoneHeightProbe');if(s)s.remove();})();`);

        // ---------- 41) v1.41.49：Mac 自动备份文件名改成日期打头 + 本地时间 ----------
        stage = '41';
        const swift41 = fs.readFileSync(path.join(REPO, 'native', 'Bookkeeping.swift'), 'utf8');
        const snap41 = swift41.slice(swift41.indexOf('func snapshot()'), swift41.indexOf('func snapshot()') + 900);
        ok('快照名改成日期打头、设备本地时间（不再是 UTC 的 Z）',
            snap41.indexOf('fmt.dateFormat = "yyyy-MM-dd_HH-mm-ss"') >= 0 &&
            snap41.indexOf('fmt.timeZone = .current') >= 0 &&
            snap41.indexOf('Locale(identifier: "en_US_POSIX")') >= 0 &&
            snap41.indexOf('ISO8601DateFormatter()') < 0);
        ok('去掉 bookkeeping- 前缀，名字从 37 字符缩到 24 字符',
            snap41.indexOf('"\\(fmt.string(from: Date())).json"') >= 0 &&
            snap41.indexOf('bookkeeping-\\(') < 0 &&
            /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/.test('2026-11-14_16-29-50.json') &&
            'bookkeeping-2026-11-14T08:29:50Z.json'.length === 37 &&
            '2026-11-14_16-29-50.json'.length === 24);
        ok('旧快照按文件修改时间找回/排序，不解析文件名（改名不影响已有 180 份）',
            swift41.indexOf('contentModificationDateKey') >= 0 &&
            swift41.indexOf('func primeSnapshotBaseline()') >= 0 &&
            swift41.indexOf('func listBackups(') >= 0);

        // ---------- 42) v1.41.50：周期记账表单 / Mac 深色 Token 到期日 ----------
        stage = '42';
        const app42 = fs.readFileSync(path.join(REPO, 'js', 'app.js'), 'utf8');
        const css42 = fs.readFileSync(path.join(REPO, 'css', 'style.css'), 'utf8');
        const bStart42 = css42.indexOf('/* ===== v1.41.50');
        const bEnd42 = css42.indexOf('/* ===== v1.', bStart42 + 10);
        const block42 = css42.slice(bStart42, bEnd42 > 0 ? bEnd42 : css42.length);
        ok('周期记账空态那句说明文字已删掉',
            app42.indexOf('还没有周期规则，用下面表单添加一条') < 0);
        const savedRecur42 = ev(`state.recurring`);
        ev(`state.recurring = []; renderRecurringSection();`);
        ok('8 个格子都带可见小标题（手机也看得懂空日期框是干嘛的）',
            ev(`document.querySelectorAll('#recurringSection .rf-field .rf-lab').length`) === 8 &&
            ev(`document.querySelectorAll('#recurringSection .rf-field').length`) === 8 &&
            ev(`document.getElementById('recurringSection').innerHTML.indexOf('开始日期')`) >= 0 &&
            ev(`document.getElementById('recurringSection').innerHTML.indexOf('截止日期')`) >= 0);
        ok('开始日期与截止日期紧挨着，落在同一行',
            ev(`(function(){var a=document.getElementById('rfStart').closest('.rf-field');` +
               `var b=document.getElementById('rfUntil').closest('.rf-field');` +
               `return !!(a && b && a.nextElementSibling === b);})()`) === true);
        ok('开始日期仍默认今天，截止日期保持空',
            ev(`document.getElementById('rfStart').value`) === ev(`todayStr()`) &&
            ev(`document.getElementById('rfUntil').value`) === '');
        ok('空规则时不再渲染那句提示',
            ev(`document.querySelectorAll('#recurringSection .breakdown-empty').length`) === 0);
        ok('单元格高度统一 32px，Mac 改 4 列把 4 行压成 2 行',
            /\.recur-form-grid \.text-input,\s*\.recur-form \.primary-btn \{[^}]*height: 32px/s.test(block42) &&
            block42.indexOf('html.mac-app .recur-form-grid { grid-template-columns: repeat(4') >= 0);
        ok('Mac 深色 Token 到期日：只在 mac-app + dark 下改，手机零影响',
            block42.indexOf('html.mac-app[data-theme="dark"] #remoteSyncExpiry') >= 0 &&
            block42.indexOf('color-scheme: dark') >= 0 &&
            block42.indexOf('::-webkit-calendar-picker-indicator') >= 0 &&
            !/^\[data-theme="dark"\] #remoteSyncExpiry/m.test(block42));
        ev(`(function(){var s=document.createElement('style');s.id='rfProbe42';` +
           `s.textContent=${JSON.stringify(block42.replace(/\/\*[\s\S]*?\*\//g, ''))};` +
           `document.head.appendChild(s);})();`);
        const h42 = id => ev(`getComputedStyle(document.querySelector('${id}')).height`);
        ok('实际计算高度：金额 / 开始日期 / 截止日期 / 添加按钮全是 32px',
            ['#rfAmount', '#rfStart', '#rfUntil', '#rfAdd'].every(id => h42(id) === '32px'),
            ['#rfAmount', '#rfStart', '#rfUntil', '#rfAdd'].map(h42));
        ev(`document.documentElement.classList.add('mac-app');`);
        const cols42 = ev(`getComputedStyle(document.querySelector('.recur-form-grid')).gridTemplateColumns`);
        ok('加上 Mac 标记后表单确实变 4 列',
            typeof cols42 === 'string' && cols42.indexOf('repeat(4') >= 0, cols42);
        ev(`document.documentElement.classList.remove('mac-app');`);
        ev(`(function(){var s=document.getElementById('rfProbe42');if(s)s.remove();})();`);
        ev(`state.recurring = ${JSON.stringify(savedRecur42 || [])};`);

        // ---------- 43) v1.41.51：分类管理的框缩小，一屏显示更多行列 ----------
        stage = '43';
        const css43 = fs.readFileSync(path.join(REPO, 'css', 'style.css'), 'utf8');
        const bStart43 = css43.indexOf('/* ===== v1.41.51');
        const bEnd43 = css43.indexOf('/* ===== v1.', bStart43 + 10);
        const block43 = css43.slice(bStart43, bEnd43 > 0 ? bEnd43 : css43.length);
        ok('分类卡片缩小规则写在 v1.41.51 块里', bStart43 >= 0);
        ok('每列最小宽收到 108px、格子间距 8px',
            block43.indexOf('minmax(108px, 1fr)') >= 0 &&
            /\.category-grid \{[^}]*gap: 8px/s.test(block43));
        ok('卡片最小高 44px、图标 26px、名字 13px',
            /#view-categories \.category-card \{[^}]*min-height: 44px/s.test(block43) &&
            /\.category-card-icon \{[^}]*width: 26px/s.test(block43) &&
            /\.category-card-name \{[^}]*font-size: 13px/s.test(block43));
        ok('规则全挂在 #view-categories 下且不包 media，Mac / 手机都生效、别的页不受影响',
            (block43.match(/#view-categories/g) || []).length >= 8 &&
            block43.indexOf('@media') < 0);
        ev(`(function(){var s=document.createElement('style');s.id='catProbe43';` +
           `s.textContent=${JSON.stringify(block43.replace(/\/\*[\s\S]*?\*\//g, ''))};` +
           `document.head.appendChild(s);})();`);
        ev(`renderCategories();`);
        const card43 = ev(`(function(){var c=document.querySelector('#view-categories .category-card');` +
            `if(!c)return null;var i=c.querySelector('.category-card-icon'),n=c.querySelector('.category-card-name');` +
            `return {pt:getComputedStyle(c).paddingTop,pl:getComputedStyle(c).paddingLeft,` +
            `minH:getComputedStyle(c).minHeight,gap:getComputedStyle(c).gap,` +
            `iconW:getComputedStyle(i).width,iconH:getComputedStyle(i).height,` +
            `nameSize:getComputedStyle(n).fontSize};})();`);
        ok('实测计算样式：padding 9/8、最小高 44px、间距 6px、图标 26px、名字 13px',
            !!card43 && card43.pt === '9px' && card43.pl === '8px' && card43.minH === '44px' &&
            card43.gap === '6px' && card43.iconW === '26px' && card43.iconH === '26px' &&
            card43.nameSize === '13px', card43);
        ok('分类数据没被改坏：支出/收入卡片都在，名字与图标齐全',
            ev(`document.querySelectorAll('#expenseCategories .category-card').length`) > 0 &&
            ev(`document.querySelectorAll('#incomeCategories .category-card').length`) > 0 &&
            ev(`(function(){var c=document.querySelector('#view-categories .category-card');` +
               `return !!c.querySelector('.category-card-name').textContent.trim() &&` +
               `!!c.querySelector('.category-card-icon i');})()`) === true);
        ev(`(function(){var s=document.getElementById('catProbe43');if(s)s.remove();})();`);

        // ---------- 44) v1.41.52：收入专属图标 / 新建支付方式 / pmStyles 对照表 ----------
        stage = '44';
        const app44 = fs.readFileSync(path.join(REPO, 'js', 'app.js'), 'utf8');
        const html44 = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
        const fa44 = fs.readFileSync(path.join(REPO, 'vendor/fontawesome/css/all.min.css'), 'utf8');
        ok('新建分类弹窗有支出 / 收入 / 支付方式三种类型',
            (html44.match(/data-cat-type="(expense|income|payment)"/g) || []).length === 3);
        const incIcons = JSON.parse(ev('JSON.stringify(INCOME_ICON_OPTIONS)'));
        const payIcons = JSON.parse(ev('JSON.stringify(PAYMENT_ICON_OPTIONS)'));
        ok('收入 / 支付两套图标里每个字形在 FA 字体表里都存在（不再有空白格）',
            incIcons.length >= 20 && payIcons.length >= 15 &&
            incIcons.concat(payIcons).every(ic => fa44.indexOf('.' + ic + ':before') >= 0),
            incIcons.length + ' / ' + payIcons.length);
        ok('收入默认图标不再是支出的餐饮，颜色也不再是支出红',
            ev('CAT_TYPE_DEFAULTS.income.icon') === 'fa-sack-dollar' &&
            ev('CAT_TYPE_DEFAULTS.income.color') === '#00b894' &&
            ev('CAT_TYPE_DEFAULTS.expense.icon') === 'fa-utensils');

        ev(`openCategoryModal();`);
        ok('新建分类默认仍是支出那套', ev(`state.selectedIcon`) === 'fa-utensils');
        ev(`document.querySelector('#categoryModal .type-btn[data-cat-type="income"]').click();`);
        const inc44 = ev(`(function(){var s=document.querySelector('#iconPicker .icon-pick-item.selected i');` +
            `return {icon:state.selectedIcon,color:state.selectedColor,sel:s?s.className:'',` +
            `count:document.querySelectorAll('#iconPicker .icon-pick-item').length};})()`);
        ok('点「收入分类」后整套图标、默认选中、颜色都跟着换',
            inc44.icon === 'fa-sack-dollar' && inc44.color === '#00b894' &&
            inc44.sel.indexOf('fa-sack-dollar') >= 0 && inc44.count === incIcons.length, inc44);
        ev(`document.querySelector('#categoryModal .type-btn[data-cat-type="payment"]').click();`);
        ok('点「支付方式」后换成支付图标集、标题改为新建支付方式',
            ev(`state.selectedIcon`) === 'fa-wallet' &&
            ev(`document.getElementById('categoryModalTitle').textContent`) === '新建支付方式' &&
            ev(`document.querySelectorAll('#iconPicker .icon-pick-item').length`) === payIcons.length);
        ok('编辑已有分类时「支付方式」按钮隐藏，不会把分类 type 写成 payment',
            ev(`(function(){openCategoryModal(state.categories[0].id);` +
               `return document.querySelector('#categoryModal .type-btn[data-cat-type="payment"]').style.display;})()`) === 'none' &&
            ev(`state.selectedCategoryType`) !== 'payment');

        ev(`openCategoryModal();`);
        ev(`document.querySelector('#categoryModal .type-btn[data-cat-type="payment"]').click();`);
        ev(`document.getElementById('catNameInput').value = '测试钱包';`);
        const catsBefore44 = ev(`state.categories.length`);
        ev(`saveCategory();`);
        ok('从弹窗新建支付方式：写进支付方式清单，分类一条不多',
            ev(`state.paymentMethods.indexOf('测试钱包') >= 0`) === true &&
            ev(`state.categories.length`) === catsBefore44);
        const st44 = ev(`JSON.stringify(state.pmStyles['测试钱包'])`);
        ok('图标与颜色存进独立对照表，交易里的 paymentMethod 字段形状不变',
            !!st44 && JSON.parse(st44).icon === 'fa-wallet' && JSON.parse(st44).color === '#0984e3', st44);
        ev(`renderPaymentMethodsManage();`);
        const chip44 = ev(`(function(){var c=document.querySelector('#paymentMethodsList .pm-chip[data-pm="测试钱包"] i');` +
            `return c ? {cls:c.className, col:c.style.color, attr:c.getAttribute('style')||''} : null;})()`);
        ok('分类管理页的支付方式卡片显示自定义图标与颜色',
            !!chip44 && chip44.cls.indexOf('fa-wallet') >= 0 &&
            /9, ?132, ?227|0984e3/i.test(chip44.col + ' ' + chip44.attr), chip44);
        ev(`renderPaymentOptions();`);
        ok('记一笔的支付方式标签旁小图标跟随选中项（原生 option 放不了图标）',
            ev(`document.getElementById('paymentIconBadge').className`).indexOf('fa-') >= 0);
        const clean44 = JSON.parse(ev(`JSON.stringify(normalizePmStyles({` +
            `a:{icon:'fa-wallet',color:'#123456',updatedAt:5},` +
            `b:{icon:'javascript:alert(1)',color:'red'},c:null}))`));
        ok(' normalizePmStyles 挡掉非法颜色与图标（拼进 style 前先过滤）'.trim(),
            Object.keys(clean44).length === 1 && clean44.a.icon === 'fa-wallet' && clean44.a.color === '#123456');
        ok('pmStyles 同时进本机存储与云同步载荷，改名/删除会跟着搬走或删掉',
            (app44.match(/pmStyles: state\.pmStyles \|\| \{\}/g) || []).length === 2 &&
            app44.indexOf('state.pmStyles = normalizePmStyles(data.pmStyles)') >= 0 &&
            app44.indexOf('normalizePmStyles(remoteData.data.pmStyles)') >= 0 &&
            app44.indexOf('state.pmStyles[n] = { ...state.pmStyles[old]') >= 0 &&
            app44.indexOf('delete state.pmStyles[name]') >= 0);
        ev(`(function(){var n='测试钱包';` +
           `state.paymentMethods=state.paymentMethods.filter(p=>p!==n);` +
           `delete state.pmStyles[n]; delete state.pmAddedAt[n];` +
           `closeCategoryModal(); renderPaymentMethodsManage();})();`);

        // ---------- 45) v1.41.53：Mac 面板跟手 / 编辑锁类型 / 支付方式统一弹窗 / 手机记账全屏 ----------
        stage = '45';
        const app45 = fs.readFileSync(path.join(REPO, 'js', 'app.js'), 'utf8');
        const css45 = fs.readFileSync(path.join(REPO, 'css', 'style.css'), 'utf8');
        const html45 = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
        const bStart45 = css45.indexOf('/* ===== v1.41.53');
        // ⚠️ 截到下一个版本块为止，别 slice 到文件末尾（后面追加新版本时会被算进本块）
        const bEnd45 = css45.indexOf('/* ===== v1.', bStart45 + 10);
        const block53 = bStart45 >= 0 ? css45.slice(bStart45, bEnd45 > 0 ? bEnd45 : css45.length) : '';
        const media45 = block53.indexOf('@media (max-width: 640px) {');
        const macPart45 = media45 > 0 ? block53.slice(0, media45) : block53;
        const inner45 = media45 > 0
            ? block53.slice(media45 + '@media (max-width: 640px) {'.length, block53.lastIndexOf('}'))
            : '';
        ok('v1.41.53 只写一个版本块头（同一版的第二块用 ---- 小标题）',
            bStart45 >= 0 && (css45.match(/\/\* ===== v1\.41\.53/g) || []).length === 1 &&
            block53.indexOf('/* ---- 同一版：') >= 0);
        ok('Mac 面板规则只在 html.mac-app 下、读 --sheet-x/--sheet-y，别的面板照旧底部弹',
            /html\.mac-app #catActionSheet > \.action-sheet[\s\S]*position: absolute/s.test(macPart45) &&
            macPart45.indexOf('var(--sheet-x') >= 0 && macPart45.indexOf('var(--sheet-y') >= 0 &&
            macPart45.indexOf('sheetPop') >= 0 && macPart45.indexOf('excludeBalanceSheet') < 0);
        ok('分类 / 支付方式的点击委托都把鼠标坐标传进面板',
            app45.indexOf('openPmActionSheet(chip.dataset.pm, e.clientX, e.clientY)') >= 0 &&
            app45.indexOf('openCatActionSheet(card.dataset.id, e.clientX, e.clientY)') >= 0);

        ev(`(function(){document.documentElement.classList.add('mac-app');` +
           `var s=document.getElementById('catActionSheet');` +
           `s.style.removeProperty('--sheet-x'); s.style.removeProperty('--sheet-y');` +
           `openCatActionSheet(state.categories[0].id, 120, 80);})();`);
        const macXY45 = ev(`(function(){var s=document.getElementById('catActionSheet');` +
            `return {x:s.style.getPropertyValue('--sheet-x'),y:s.style.getPropertyValue('--sheet-y')};})()`);
        ok('Mac 上分类面板落在鼠标点的位置', macXY45.x === '120px' && macXY45.y === '80px', macXY45);
        ev(`(function(){document.documentElement.classList.add('mac-app');` +
           `openPmActionSheet(state.paymentMethods[0], 99999, 99999);})();`);
        const clamp45 = ev(`(function(){var s=document.getElementById('pmActionSheet');` +
            `return {x:parseInt(s.style.getPropertyValue('--sheet-x')),y:parseInt(s.style.getPropertyValue('--sheet-y')),` +
            `w:window.innerWidth,h:window.innerHeight};})()`);
        ok('点在屏幕右下角时面板会夹回屏幕内，不会被切掉',
            clamp45.x >= 8 && clamp45.y >= 8 && clamp45.x + 240 <= clamp45.w && clamp45.y + 230 <= clamp45.h, clamp45);
        ev(`(function(){document.documentElement.classList.remove('mac-app');` +
           `var s=document.getElementById('catActionSheet');` +
           `s.style.removeProperty('--sheet-x'); s.style.removeProperty('--sheet-y');` +
           `openCatActionSheet(state.categories[0].id, 120, 80);})();`);
        ok('去掉 Mac 标记后不写坐标，手机仍是从底部弹出',
            ev(`document.getElementById('catActionSheet').style.getPropertyValue('--sheet-x')`) === '');

        const exp45 = ev(`(function(){var c=state.categories.find(x=>x.type==='expense');return c?c.id:null;})()`);
        ev(`openCategoryModal(${JSON.stringify(exp45)});`);
        const lock45 = ev(`(function(){return {` +
            `title:document.getElementById('categoryModalTitle').textContent,` +
            `toggle:document.querySelector('#categoryModal .type-toggle').style.display,` +
            `type:state.selectedCategoryType,icon:state.selectedIcon,` +
            `allDisabled:[].slice.call(document.querySelectorAll('#categoryModal .type-btn')).every(b=>b.disabled)};})()`);
        ok('编辑支出分类：类型整排收起并禁用，标题写明是支出分类',
            lock45.title === '编辑支出分类' && lock45.toggle === 'none' &&
            lock45.type === 'expense' && lock45.allDisabled, lock45);
        ev(`document.querySelector('#categoryModal .type-btn[data-cat-type="income"]').click();`);
        ok('就算程序去点「收入分类」也换不了类型、换不了那套图标',
            ev(`state.selectedCategoryType`) === 'expense' && ev(`state.selectedIcon`) === lock45.icon);
        ev(`saveCategory();`);
        ok('保存后分类 type 原样不动，不再从弹窗状态回写',
            ev(`(function(){var c=state.categories.find(x=>x.id===${JSON.stringify(exp45)});return c?c.type:null;})()`) === 'expense');
        const inc45 = ev(`(function(){var c=state.categories.find(x=>x.type==='income');return c?c.id:null;})()`);
        ev(`openCategoryModal(${JSON.stringify(inc45)});`);
        ok('编辑收入分类同样锁死（标题 / 类型 / 收起类型排）',
            ev(`document.getElementById('categoryModalTitle').textContent`) === '编辑收入分类' &&
            ev(`state.selectedCategoryType`) === 'income' &&
            ev(`document.querySelector('#categoryModal .type-toggle').style.display`) === 'none');
        ok('新建分类时三个类型按钮全部恢复可用',
            (ev(`(function(){openCategoryModal();return [].slice.call(document.querySelectorAll('#categoryModal .type-btn'))` +
                `.map(b=>b.disabled).join(',');})()`) || '') === 'false,false,false');

        ev(`(function(){var n='测试卡片A';` +
           `if(state.paymentMethods.indexOf(n)<0)state.paymentMethods.push(n);` +
           `state.pmAddedAt[n]=Date.now();` +
           `state.pmStyles[n]={icon:'fa-wallet',color:'#123456',updatedAt:Date.now()};` +
           `window.__promptHits=0; window.prompt=function(){window.__promptHits++;return null;};})();`);
        ev(`openPmActionSheet('测试卡片A');`);
        ev(`pmSheetEdit();`);
        const pe45 = ev(`(function(){return {` +
            `title:document.getElementById('categoryModalTitle').textContent,` +
            `name:document.getElementById('catNameInput').value,icon:state.selectedIcon,color:state.selectedColor,` +
            `hidden:document.getElementById('categoryModal').classList.contains('hidden'),` +
            `toggle:document.querySelector('#categoryModal .type-toggle').style.display,` +
            `sel:!!document.querySelector('#iconPicker .icon-pick-item.selected')};})()`);
        ok('支付方式「编辑」开的是同一个弹窗，名字 / 图标 / 颜色全带出来',
            pe45.title === '编辑支付方式' && pe45.name === '测试卡片A' &&
            pe45.icon === 'fa-wallet' && pe45.color === '#123456' &&
            !pe45.hidden && pe45.toggle === 'none' && pe45.sel, pe45);
        ok('操作面板上的按钮文案不再只说「编辑名称」',
            html45.indexOf('onclick="pmSheetEdit()"') >= 0 &&
            html45.indexOf('编辑名称 / 图标 / 颜色') >= 0 &&
            html45.indexOf('pmSheetRename') < 0);
        ev(`(function(){document.getElementById('catNameInput').value='测试卡片B';` +
           `selectIcon('fa-qrcode'); selectColor('#e17055');})();`);
        const catsBefore45 = ev(`state.categories.length`);
        ev(`saveCategory();`);
        const saved45 = ev(`(function(){return {` +
            `hasB:state.paymentMethods.indexOf('测试卡片B')>=0,` +
            `hasA:state.paymentMethods.indexOf('测试卡片A')>=0,` +
            `style:JSON.stringify(state.pmStyles['测试卡片B']||null),` +
            `oldStyle:JSON.stringify(state.pmStyles['测试卡片A']||null),` +
            `cats:state.categories.length,prompts:window.__promptHits};})()`);
        ok('保存后改名 + 图标 + 颜色一起落下，全程不弹系统输入框，分类一条不多',
            saved45.hasB && !saved45.hasA && saved45.cats === catsBefore45 &&
            saved45.prompts === 0 && saved45.oldStyle === 'null' &&
            JSON.parse(saved45.style).icon === 'fa-qrcode' && JSON.parse(saved45.style).color === '#e17055', saved45);
        ok('分类管理页的支付方式卡片也跟着换成新名字和新图标',
            ev(`(function(){var c=document.querySelector('#paymentMethodsList .pm-chip[data-pm="测试卡片B"] i');` +
               `return c?c.className:'';})()`).indexOf('fa-qrcode') >= 0);
        const brand45 = ev(`(function(){var n='微信';var old=state.pmStyles[n];` +
            `state.pmStyles[n]={icon:'fa-brands fa-weixin',color:'#00b894',updatedAt:Date.now()};` +
            `openCategoryModal(null,n);var i=document.querySelector('#iconPicker .icon-pick-item.selected i');` +
            `var r=i?i.className:'';if(old)state.pmStyles[n]=old;else delete state.pmStyles[n];` +
            `closeCategoryModal();return r;})()`) || '';
        ok('品牌图标（fa-brands fa-weixin）进图标选择器时不会被硬拼上 fa-solid',
            brand45.indexOf('fa-brands fa-weixin') >= 0 && brand45.indexOf('fa-solid fa-brands') < 0, brand45);

        ok('手机全屏规则只在手机：媒体块里全是 html:not(.mac-app)，没有裸 html.mac-app',
            media45 > 0 && inner45.indexOf('html:not(.mac-app)') >= 0 &&
            inner45.indexOf('html.mac-app') < 0 && inner45.indexOf('#transactionModal') >= 0);
        ok('宽高 / 位置全部 !important，压掉缩放手柄留下的行内尺寸',
            ['width: 100vw !important', 'height: 100dvh !important',
             'max-width: 100vw !important', 'max-height: 100dvh !important',
             'left: auto !important', 'top: auto !important',
             'position: relative !important', 'border-radius: 0 !important']
                .every(s => inner45.indexOf(s) >= 0));
        ok('内容超高时能滑到底，手机上的缩放手柄收起',
            inner45.indexOf('overflow-y: auto !important') >= 0 &&
            inner45.indexOf('.modal-resize-grip') >= 0);
        const probe45 = inner45.replace(/\/\*[\s\S]*?\*\//g, '');
        ev(`(function(){var s=document.createElement('style');s.id='probe45';` +
           `s.textContent=${JSON.stringify(probe45)};document.head.appendChild(s);})();`);
        const wPhone45 = ev(`getComputedStyle(document.querySelector('#transactionModal > .modal')).width`);
        const wVw45 = ev(`window.innerWidth`);
        ev(`document.documentElement.classList.add('mac-app');`);
        const wMac45 = ev(`getComputedStyle(document.querySelector('#transactionModal > .modal')).width`);
        ev(`document.documentElement.classList.remove('mac-app');`);
        ev(`(function(){var s=document.getElementById('probe45');if(s)s.remove();})();`);
        // jsdom 会把 100vw 折成 px（= innerWidth），真浏览器保留 100vw，两种都算命中
        ok('同一份规则：手机命中整屏宽，加了 Mac 标记就不命中（Mac 宽度不变）',
            (wPhone45 === '100vw' || parseInt(wPhone45, 10) === wVw45) &&
            wMac45 !== wPhone45 && wMac45 !== '100vw', { wPhone45, wMac45, wVw45 });

        ev(`(function(){['测试卡片A','测试卡片B'].forEach(function(n){` +
           `state.paymentMethods=state.paymentMethods.filter(p=>p!==n);` +
           `delete state.pmStyles[n];delete state.pmAddedAt[n];});` +
           `closeCategoryModal();renderPaymentMethodsManage();})();`);

        // ---------- 46) v1.41.54：手机口令页整屏、顶部按钮完整、上下同色 ----------
        stage = '46';
        const css46 = fs.readFileSync(path.join(REPO, 'css', 'style.css'), 'utf8');
        const bStart46 = css46.indexOf('/* ===== v1.41.54');
        const bEnd46 = css46.indexOf('/* ===== v1.', bStart46 + 10);
        const block54 = bStart46 >= 0 ? css46.slice(bStart46, bEnd46 > 0 ? bEnd46 : css46.length) : '';
        const media46 = block54.indexOf('@media (max-width: 640px) {');
        const inner46 = media46 > 0
            ? block54.slice(media46 + '@media (max-width: 640px) {'.length, block54.lastIndexOf('}'))
            : '';
        ok('v1.41.54 只一个版本块头，整块包在手机 media 里、Mac 一条都不命中',
            bStart46 >= 0 && (css46.match(/\/\* ===== v1\.41\.54/g) || []).length === 1 &&
            media46 > 0 && inner46.indexOf('html:not(.mac-app)') >= 0 &&
            inner46.indexOf('html.mac-app') < 0);
        ok('口令页从 340px 圆角卡片改成整屏：满宽 / 100dvh / 去边框圆角 / 上下留安全区',
            /#startupLock \.startup-lock-card \{[^}]*width: 100% !important/s.test(inner46) &&
            inner46.indexOf('min-height: 100dvh !important') >= 0 &&
            inner46.indexOf('border-radius: 0 !important') >= 0 &&
            inner46.indexOf('border: 0 !important') >= 0 &&
            inner46.indexOf('justify-content: center !important') >= 0 &&
            inner46.indexOf('env(safe-area-inset-top') >= 0 &&
            inner46.indexOf('env(safe-area-inset-bottom') >= 0);
        ok('锁屏外层与顶端状态栏采样条都换成同一底色，不再有一块异色方块',
            /html:not\(\.mac-app\) #startupLock \{[^}]*background: var\(--bg-modal\) !important/s.test(inner46) &&
            inner46.indexOf('body.app-locked #statusBarProbe') >= 0);
        ok('记一笔头部让开状态栏色条，X / 删除按钮整颗都画得出来',
            /#transactionModal \.modal-header \{[^}]*padding-top: calc\(env\(safe-area-inset-top/s.test(inner46));
        ok('弹窗 / 内容区 / 数字键盘统一底色，下半屏不再是一块方形',
            inner46.indexOf('#transactionModal > .modal,') >= 0 &&
            inner46.indexOf('#transactionModal .numpad') >= 0 &&
            /html:not\(\.mac-app\) #transactionModal > \.modal,[\s\S]*background: var\(--bg-modal\) !important/s.test(inner46));
        const probe46 = inner46.replace(/\/\*[\s\S]*?\*\//g, '');
        ev(`(function(){var s=document.createElement('style');s.id='probe46';` +
           `s.textContent=${JSON.stringify(probe46)};document.head.appendChild(s);})();`);
        const card46 = ev(`(function(){var c=document.querySelector('#startupLock .startup-lock-card');` +
            `var s=getComputedStyle(c);return {w:s.width,br:s.borderTopLeftRadius};})()`);
        ev(`document.documentElement.classList.add('mac-app');`);
        const cardMac46 = ev(`(function(){var c=document.querySelector('#startupLock .startup-lock-card');` +
            `var s=getComputedStyle(c);return {w:s.width,br:s.borderTopLeftRadius};})()`);
        ev(`document.documentElement.classList.remove('mac-app');`);
        ev(`(function(){var s=document.getElementById('probe46');if(s)s.remove();})();`);
        ok('实测：手机口令卡片满宽无圆角，加了 Mac 标记后完全不命中（仍是 340px 卡片）',
            (card46.w === '100%' || parseInt(card46.w, 10) === ev('window.innerWidth')) &&
            /^(0|0px)$/.test(card46.br) && cardMac46.w === '340px' && cardMac46.w !== card46.w,
            { card46, cardMac46 });

        // ---------- 47) v1.41.55：月度结账清单的「云同步已开启」在手机上也带上次同步时间 ----------
        stage = '47';
        const app47 = fs.readFileSync(path.join(REPO, 'js', 'app.js'), 'utf8');
        const clBody47 = app47.slice(app47.indexOf('function closeChecklist('));
        ok('手机写死的「数据自动同步」已删，Mac / 手机共用同一句带时间的文案',
            app47.indexOf('云同步已开启，数据自动同步') < 0 &&
            (app47.match(/text: _syncOkText/g) || []).length === 2 &&
            app47.indexOf('const _syncOkText = `云同步已开启（上次同步 ') >= 0 &&
            clBody47.indexOf('if (isElectron())') > clBody47.indexOf('const _syncOkText'));
        const month47 = ev(`closeCheckMonth()`);
        const savedCfg47 = ev(`JSON.stringify(remoteSyncCfg)`);
        ev(`remoteSyncCfg = { enabled: true, token: 'x', gistId: 'g',` +
           ` lastSyncAt: Date.now() - 3 * 60000, tokenExpiresAt: 0, tokenExpiresAtAt: 0 };`);
        const findSync47 = m => `(function(){var r=closeChecklist(${JSON.stringify(m)});` +
            `return (r.items.filter(i=>i.text.indexOf('云同步已开启')>=0).map(i=>i.text)[0]||'');})()`;
        const phone47 = ev(findSync47(month47));
        ok('手机 / 网页端结账清单显示「云同步已开启（上次同步 3 分钟前）」',
            phone47.indexOf('云同步已开启（上次同步 3 分钟前）') >= 0, phone47);
        ev(`remoteSyncCfg.lastSyncAt = 0;`);
        const never47 = ev(findSync47(month47));
        ok('一次都没同步成功时明确写「尚未同步」，不再假装一切正常',
            never47.indexOf('云同步已开启（上次同步 尚未同步）') >= 0, never47);
        ev(`window.electronAPI = { isElectron: true };`);
        const mac47 = ev(findSync47(month47));
        ok('Mac 分支仍是同一句，没有被这次改动带坏', !!mac47 && mac47 === never47, { mac47, never47 });
        ev(`(function(){remoteSyncCfg = ${savedCfg47}; delete window.electronAPI;})();`);

        // ---------- 48) v1.41.56：三张统计表 + 小符号关联回顾 / 月报 ----------
        stage = '48';
        const app48 = fs.readFileSync(path.join(REPO, 'js', 'app.js'), 'utf8');
        const css48 = fs.readFileSync(path.join(REPO, 'css', 'style.css'), 'utf8');
        const html48 = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
        const bStart48 = css48.indexOf('/* ===== v1.41.56');
        const bEnd48 = css48.indexOf('/* ===== v1.', bStart48 + 10);
        const block56 = bStart48 >= 0 ? css48.slice(bStart48, bEnd48 > 0 ? bEnd48 : css48.length) : '';
        ok('v1.41.56 只有一个版本块头，小符号 / 纯图标按钮样式都在这一块',
            bStart48 >= 0 && (css48.match(/\/\* ===== v1\.41\.56/g) || []).length === 1 &&
            block56.indexOf('.bill-stats .bs-review-btn') >= 0 &&
            block56.indexOf('.ym-review-btn') >= 0 &&
            block56.indexOf('.bs-avg-year') >= 0);
        ok('回顾弹窗支持带「哪一期 + 月报/年报」打开，且不传参数还是老行为',
            app48.indexOf('function openReviewModal(tab, key, from)') >= 0 &&
            app48.indexOf("if (tab === 'month' || tab === 'year') reviewTab = tab;") >= 0 &&
            app48.indexOf('if (!reviewMonth) reviewMonth = _monthKeyNow();') >= 0);
        ok('小符号带 stopPropagation，不会抢整行原有的「看明细」点击',
            app48.indexOf("onclick=\"event.stopPropagation();openReviewModal('${tab}','${key}','${from}')\"") >= 0);
        ok('三个页面各有一个纯图标的日期联动入口，没有把回顾文字铺在页面上',
            (html48.match(/ym-review-btn/g) || []).length === 3 &&
            html48.indexOf("openReviewForCurrent('balance')") >= 0 &&
            html48.indexOf("openReviewForCurrent('returns')") >= 0 &&
            html48.indexOf("openReviewForCurrent('reports')") >= 0 &&
            html48.indexOf('id="reviewAuto"') >= 0 &&
            html48.slice(html48.indexOf('id="view-reports"'), html48.indexOf('id="view-funds"')).indexOf('class="review-report"') < 0);

        // 造一套跨年的假账（3 年流水 / 4 期余额快照 / 5 期收益），专门验口径
        ev(`(function(){
            var k = sheetAssetCats()[0].key;
            state.balanceOwner = 'all'; moneyVisible = true; state.lendings = [];
            state.transactions = [
                {id:'s1',date:'2024-01-15',type:'expense',amount:100,member:'本人',categoryId:'c1'},
                {id:'s2',date:'2025-03-10',type:'expense',amount:200,member:'本人',categoryId:'c1'},
                {id:'s3',date:'2025-06-10',type:'income',amount:300,member:'本人',categoryId:'c1'},
                {id:'s4',date:'2026-01-10',type:'expense',amount:400,member:'本人',categoryId:'c1'},
                {id:'s5',date:'2026-02-10',type:'expense',amount:500,member:'本人',categoryId:'c1'}
            ];
            state.balances = [
                {id:'q1',member:'本人',accountId:'a',cur:'CNY',cat:k,amount:100,month:'2025-12',updatedAt:1},
                {id:'q2',member:'本人',accountId:'a',cur:'CNY',cat:k,amount:200,month:'2026-01',updatedAt:2},
                {id:'q3',member:'本人',accountId:'a',cur:'CNY',cat:k,amount:300,month:'2026-02',updatedAt:3},
                {id:'q4',member:'本人',accountId:'a',cur:'CNY',cat:k,amount:900,month:'2026-12',updatedAt:4}
            ];
            state.returns = [
                {id:'u1',month:'2025-11',accountId:'a',amount:10,member:'本人'},
                {id:'u2',month:'2025-12',accountId:'a',amount:20,member:'本人'},
                {id:'u3',month:'2026-01',accountId:'a',amount:30,member:'本人'},
                {id:'u4',month:'2026-02',accountId:'a',amount:-5,member:'本人'},
                {id:'u5',month:'2026-03',accountId:'a',amount:15,member:'本人'}
            ];
            state.reportPeriod='all'; state.balancePeriod='all'; state.returnPeriod='all';
            billYearExpanded.clear(); balanceYearExpanded.clear(); returnYearExpanded.clear();
            billYearExpanded.add(2025); balanceYearExpanded.add('2026'); returnYearExpanded.add('2026');
        })();`);

        ev(`renderBillStats();`);
        const bill48 = ev(`document.getElementById('billStatsBody').innerHTML`);
        ok('账单统计「全部」有年均行，位置在月均上方，且写明按几个有记录年份平均',
            bill48.indexOf('年均 · 3 年') >= 0 &&
            bill48.indexOf('年均 · 3 年') > bill48.indexOf('bs-total') &&
            bill48.indexOf('年均 · 3 年') < bill48.lastIndexOf('月均'),
            bill48.slice(0, 160));
        ok('年均 = 合计 ÷ 有记录年份数（−900 ÷ 3 = −300），月均仍是 ÷ 有记录月份数',
            bill48.indexOf('>-300</span>') >= 0 && bill48.indexOf('>-180</span>') >= 0,
            bill48.match(/bs-avg[\s\S]{0,220}/g));
        ok('年报档 / 月报档都不冒出年均行',
            ev(`(function(){state.reportPeriod='year';state.reportYear=2026;renderBillStats();` +
               `var a=document.getElementById('billStatsBody').innerHTML.indexOf('年均');` +
               `state.reportPeriod='month';state.reportMonth=1;renderBillStats();` +
               `var b=document.getElementById('billStatsBody').innerHTML.indexOf('年均');` +
               `state.reportPeriod='all';renderBillStats();return a+'|'+b;})()`) === '-1|-1');
        ok('账单统计：年份行跳年报、展开的月份行跳当时的月报（不是当前月）',
            /openReviewModal\('year','2025'/.test(bill48) &&
            /openReviewModal\('month','2025-06'/.test(bill48) &&
            bill48.indexOf("openBillStatsLedger(2025, 6") >= 0, bill48.match(/openReviewModal\([^)]*\)/g));

        ev(`renderBalanceStats();`);
        const bal48 = ev(`document.getElementById('balanceStatsBody').innerHTML`);
        ok('资产负债统计：全部档按年分组折叠，不再把全部月份平铺',
            (bal48.match(/class="bs-year/g) || []).length === 2 &&
            /toggleBalanceYear\('2026'\)/.test(bal48) &&
            (bal48.match(/class="bs-row bs-sub/g) || []).length === 3,
            bal48.match(/class="bs-year[^"]*"/g));
        ok('资产负债「期末」只放最后一期 900，不是把 4 期相加成 1500',
            bal48.indexOf('期末 · 最后一期') >= 0 &&
            /期末 · 最后一期<\/td>[\s\S]{0,240}?>900<\/span>/.test(bal48) &&
            bal48.indexOf('>1500</span>') < 0, bal48.slice(0, 300));
        ok('资产负债年份行显示该年最后一期（2026 → 900），不是 12 个月相加',
            /2026 年[\s\S]{0,300}?>900<\/span>/.test(bal48) &&
            bal48.indexOf('>1400</span>') < 0);
        ok('资产负债统计三档联动：月报档不再隐藏卡片，且只剩当期一行',
            ev(`(function(){state.balancePeriod='month';state.balanceYear=2026;state.balanceMonth=1;` +
               `renderBalanceStats();var c=document.getElementById('balanceStatsCard');` +
               `var h=document.getElementById('balanceStatsBody').innerHTML;` +
               `state.balancePeriod='all';renderBalanceStats();` +
               `return (!c.classList.contains('hidden'))+'|'+(h.match(/class="bs-row/g)||[]).length;})()`) === 'true|1');
        ok('资产负债表的月份行 / 年份行都带回顾小符号（点月跳月报、点年跳年报）',
            /openReviewModal\('month','2026-01'/.test(bal48) &&
            /openReviewModal\('year','2026'/.test(bal48) &&
            bal48.indexOf("openAccountHistoryForPeriod('2026-01'") >= 0);

        ev(`renderReturnMonthly();`);
        const ret48 = ev(`document.getElementById('retMonthlyBody').innerHTML`);
        ok('投资收益表也按年分组折叠，合计 / 年均 / 月均三行都在',
            (ret48.match(/class="bs-year/g) || []).length === 2 &&
            /toggleReturnYear\('2026'\)/.test(ret48) &&
            ret48.indexOf('年均 · 2 年') >= 0 &&
            ret48.indexOf('月均 · 5 期') >= 0, ret48.slice(0, 200));
        ok('投资收益的均值行只有「本期收益」填数，累计/收益率/环比三列留 —（不平均、不相加）',
            ev(`(function(){var trs=document.querySelectorAll('#retMonthlyBody tr.bs-avg');` +
               `return Array.prototype.map.call(trs,function(tr){` +
               `return (tr.querySelectorAll('td').length)+':'+(tr.innerHTML.match(/>—<|>—<\\/span>/g)||[]).length;});})()`)
                .join('|') === '5:3|5:3',
            ev(`Array.prototype.map.call(document.querySelectorAll('#retMonthlyBody tr.bs-avg'),function(t){return t.textContent.trim();})`));
        ok('投资收益表按档位联动：月报档只显示当期，年报档只显示该年',
            ev(`(function(){state.returnPeriod='month';state.returnYear=2026;state.returnMonth=2;` +
               `renderReturnMonthly();var a=(document.getElementById('retMonthlyBody').innerHTML.match(/class="bs-row/g)||[]).length;` +
               `state.returnPeriod='year';renderReturnMonthly();` +
               `var b=(document.getElementById('retMonthlyBody').innerHTML.match(/class="bs-row/g)||[]).length;` +
               `state.returnPeriod='all';renderReturnMonthly();return a+'|'+b;})()`) === '1|3');
        ok('投资收益的月份行 / 年份行也带回顾小符号，点行仍是看各账户明细',
            /openReviewModal\('month','2026-02'/.test(ret48) &&
            /openReviewModal\('year','2026'/.test(ret48) &&
            ret48.indexOf("openReturnDetailForMonth('2026-02')") >= 0);

        // 真点一次：从三张表的小符号跳进去，弹窗要对上那一期
        const jump48 = ev(`(function(){
            openReviewModal('month','2025-06');
            var a=[reviewTab,reviewMonth,document.getElementById('reviewModal').classList.contains('hidden'),
                   document.getElementById('reviewAuto').innerHTML.indexOf('收支结余')>=0,
                   document.getElementById('reviewPeriodLabel').textContent];
            openReviewModal('year','2025');
            var b=[reviewTab,reviewMonth,document.getElementById('reviewAuto').innerHTML.indexOf('一年总支出')>=0,
                   document.getElementById('reviewPeriodLabel').textContent];
            return JSON.stringify([a,b]);})()`);
        const j48 = JSON.parse(jump48 || '[[]]');
        ok('点月份小符号 → 弹窗打开那一期的月报（不是当前月，也不是年报）',
            j48[0] && j48[0][0] === 'month' && j48[0][1] === '2025-06' &&
            j48[0][2] === false && j48[0][3] === true && j48[0][4].indexOf('2025') >= 0, j48[0]);
        ok('点年份小符号 → 弹窗切到那一年的年报',
            j48[1] && j48[1][0] === 'year' && j48[1][1] === '2025-01' &&
            j48[1][2] === true && j48[1][3].indexOf('2025') >= 0, j48[1]);
        const cur48 = ev(`(function(){
            state.reportPeriod='month'; state.reportYear=2026; state.reportMonth=2;
            openReviewForCurrent('reports'); var a=[reviewTab,reviewMonth];
            state.reportPeriod='all'; openReviewForCurrent('reports'); var b=[reviewTab,reviewMonth.slice(0,4)];
            state.reportPeriod='year'; openReviewForCurrent('reports'); var c=[reviewTab,reviewMonth.slice(0,4)];
            return JSON.stringify([a,b,c]);})()`);
        ok('日期联动：月报档跳当月月报、年报档跳该年年报、全部档跳最近有记录年份的年报',
            cur48 === JSON.stringify([['month', '2026-02'], ['year', '2026'], ['year', '2026']]), cur48);
        ok('三个统计页都没有把回顾文字内嵌展示，只有点了小符号才弹',
            ev(`JSON.stringify(['view-reports','view-balance','view-returns'].map(function(id){` +
               `var s=document.getElementById(id);return s.innerHTML.indexOf('class="review-report"')>=0;}))`)
                === '[false,false,false]');


        // ---------- 49) v1.41.57：回顾页重点 + 按来源换开场 ----------
        stage = '49';
        const app49 = fs.readFileSync(path.join(REPO, 'js', 'app.js'), 'utf8');
        const css49 = fs.readFileSync(path.join(REPO, 'css', 'style.css'), 'utf8');
        const bS49 = css49.indexOf('/* ===== v1.41.57');
        const bE49 = css49.indexOf('/* ===== v1.', bS49 + 10);
        const block57 = bS49 >= 0 ? css49.slice(bS49, bE49 > 0 ? bE49 : css49.length) : '';
        ok('v1.41.57 只有一个版本块头，重点块 / 条形 / 拆解 / 折叠样式都在这一块',
            bS49 >= 0 && (css49.match(/\/\* ===== v1\.41\.57/g) || []).length === 1 &&
            block57.indexOf('.rr-hero') >= 0 && block57.indexOf('.rr-bar-fill') >= 0 &&
            block57.indexOf('.rr-bridge') >= 0 && block57.indexOf('.rr-more') >= 0);
        ok('配色全部走主题变量，深色下不会白底白字',
            block57.indexOf('var(--income-light)') >= 0 &&
            block57.indexOf('var(--warning-light)') >= 0 &&
            block57.indexOf('var(--bg-card)') >= 0 && block57.indexOf('#ffffff') < 0);
        ok('三个来源开场各看各的：报表看分类、收益看写过的话、家底看拆解',
            ev(`(function(){var out=[];['reports','returns','balance'].forEach(function(p){
                openReviewModal('month','2025-06',p);
                var h=document.getElementById('reviewAuto').innerHTML;
                out.push([reviewFrom,h.indexOf('钱花在哪')>=0,h.indexOf('这一期你写过的话')>=0,h.indexOf('家底为什么变了')>=0]);
                });return JSON.stringify(out);})()`)
            === JSON.stringify([
                ['reports', true, false, false],
                ['returns', false, true, false],
                ['balance', false, false, true]
            ]));
        const h49 = JSON.parse(ev(`JSON.stringify([
            reviewHeroHTML(8000,6000,false,0,0,null),
            reviewHeroHTML(4000,6000,false,0,0,null),
            reviewHeroHTML(6000,6000,false,0,0,null),
            reviewHeroHTML(8000,null,false,0,0,null)
        ])`) || '[]');
        ok('重点块只给一个比较：多花标橙、少花标绿、持平平色、没历史不硬比',
            h49.length === 4 && h49[0].indexOf('rr-hero bad') >= 0 && h49[0].indexOf('比平时多花 2000') >= 0 &&
            h49[1].indexOf('rr-hero good') >= 0 && h49[1].indexOf('比平时少花 2000') >= 0 &&
            h49[2].indexOf('rr-hero flat') >= 0 && h49[3].indexOf('还没有足够的历史月份可比') >= 0,
            h49.map(x => x.slice(0, 70)));
        const inc49 = ev(`reviewIncomeHTML([{type:'income',amount:20000,categoryId:'salary'},{type:'income',amount:2000,categoryId:'bonus'}],22000)`);
        ev(`openReviewModal('month','2025-06','reports');`);
        ok('收入异常时也能看到「赚在哪」，不再只有支出分类前五',
            inc49.indexOf('20000') >= 0 && inc49.indexOf('2000') >= 0 &&
            ev(`document.getElementById('reviewAuto').innerHTML`).indexOf('赚在哪') >= 0);
        const br49 = ev(`reviewBridgeHTML(netWorthBridge('2026-01'),false)`);
        ok('资产负债开场把变动拆成结余 / 投资收益 / 固定资产 / 待核对',
            br49.indexOf('这个月结余') >= 0 && br49.indexOf('投资收益') >= 0 &&
            br49.indexOf('固定资产变动') >= 0 && br49.indexOf('待核对差额') >= 0);
        const seg49 = app49.slice(app49.indexOf('// ---- v1.41.57'), app49.indexOf('// ---- 收益率缺料清单'));
        ok('新报告整段只读：不写任何数、不替人判断该不该花',
            seg49.length > 1000 && seg49.indexOf('saveState') < 0 && seg49.indexOf('应该') < 0);
        ok('填写仍只有一处：一个输入框、一个保存按钮，云同步 / 墓碑那套没动',
            ev(`document.querySelectorAll('#reviewModal #reviewText').length`) === 1 &&
            ev(`Array.prototype.filter.call(document.querySelectorAll('#reviewModal button'),function(b){return b.textContent.trim()==='保存这段话';}).length`) === 1 &&
            app49.indexOf('function saveReviewText()') >= 0);
        const revBefore49 = ev(`JSON.stringify(state.reviews)`);
        ev(`openReviewModal('month','2025-06','balance');`);
        ok('点开回顾只读，不往账本写任何数', ev(`JSON.stringify(state.reviews)`) === revBefore49);
        ev(`reviewFrom=''; reviewTab='month'; reviewMonth='2026-10'; renderReviewModal();`);
        ok('原来那一屏四行事实没丢，收进「更多事实」',
            ev(`document.querySelectorAll('#reviewAuto .rr-row').length`) === 4 &&
            ev(`document.getElementById('reviewAuto').innerHTML`).indexOf('收支结余') >= 0);
        ev(`reviewTab='year'; reviewMonth='2026-01'; renderReviewModal();`);
        ok('年报四个数仍在，只是给主次让位',
            ev(`document.querySelectorAll('#reviewAuto .rr-big').length`) === 4 &&
            ev(`document.getElementById('reviewAuto').innerHTML`).indexOf('一年总支出') >= 0);
        ok('年报也按来源换开场（全年拆解 / 当年写过的说明）',
            ev(`(function(){
                openReviewModal('year','2025','balance');var a=document.getElementById('reviewAuto').innerHTML;
                openReviewModal('year','2025','returns');var b=document.getElementById('reviewAuto').innerHTML;
                return JSON.stringify([a.indexOf('家底为什么变了')>=0,a.indexOf('一年净结余')>=0,b.indexOf('这一期你写过的话')>=0]);})()`)
            === '[true,true,true]');
        ok('三张统计表的小符号都带上了各自的来源页',
            ev(`(function(){
                state.reportPeriod='all'; billYearExpanded.add(2025); renderBillStats();
                var a=document.getElementById('billStatsBody').innerHTML;
                state.balancePeriod='all'; balanceYearExpanded.add('2026'); renderBalanceStats();
                var b=document.getElementById('balanceStatsBody').innerHTML;
                state.returnPeriod='all'; returnYearExpanded.add('2026'); renderReturnMonthly();
                var c=document.getElementById('retMonthlyBody').innerHTML;
                return JSON.stringify([a.indexOf("'reports'")>=0,b.indexOf("'balance'")>=0,c.indexOf("'returns'")>=0]);})()`)
            === '[true,true,true]');
        ok('不传来源仍是老行为（默认开场）',
            ev(`(function(){openReviewModal('month','2025-06');return reviewFrom;})()`) === '' &&
            ev(`document.getElementById('reviewAuto').innerHTML`).indexOf('钱花在哪') >= 0);


        // ---------- 50) v1.41.58：回顾页三处细节 ----------
        stage = '50';
        const app50 = fs.readFileSync(path.join(REPO, 'js', 'app.js'), 'utf8');
        const css50 = fs.readFileSync(path.join(REPO, 'css', 'style.css'), 'utf8');
        const html50 = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
        ok('弹窗里那句「先看这一期的重点…」已删，连整行副标题一起去掉',
            html50.indexOf('先看这一期的重点，想记的话还是写在下面那一个框里') < 0 &&
            html50.indexOf('id="reviewSub"') < 0);
        const bS50 = css50.indexOf('/* ===== v1.41.58');
        ok('v1.41.58 只有一个版本块头，同比对比样式在这一块',
            bS50 >= 0 && (css50.match(/\/\* ===== v1\.41\.58/g) || []).length === 1 &&
            css50.slice(bS50).indexOf('.rr-compare') >= 0);
        ev(`(function(){var k=sheetAssetCats()[0].key;
            state.balances.push(
              {id:'qy1',member:'本人',accountId:'a',cur:'CNY',cat:k,amount:50,month:'2025-01',updatedAt:5},
              {id:'qy2',member:'本人',accountId:'a',cur:'CNY',cat:k,amount:120,month:'2025-02',updatedAt:6});
            state.balanceOwner='all';})();`);
        ev(`openReviewModal('month','2026-02','balance');`);
        const balHero50 = ev(`document.querySelector('#reviewAuto .rr-hero-val').textContent`);
        const balSub50 = ev(`document.querySelector('#reviewAuto .rr-hero-sub').textContent`);
        ok('从资产负债页进来，第一眼只看净资产增加 / 减少',
            /^净资产(增加|减少|没变)/.test(balHero50) && balHero50.indexOf('100') >= 0, balHero50);
        ok('重点块副行对比去年同月：去年多少、比去年多 / 少多少',
            balSub50.indexOf('去年同月') >= 0 && balSub50.indexOf('70') >= 0 &&
            /比去年同月(多|少) 30/.test(balSub50), balSub50);
        const cmp50 = ev(`(function(){var e=document.querySelector('#reviewAuto .rr-compare');return e?e.textContent:'';})()`);
        ok('下面显示净结余、投资收益比去年增加还是减少',
            cmp50.indexOf('净结余') >= 0 && cmp50.indexOf('投资收益') >= 0 &&
            /比去年同月(多|少)/.test(cmp50), cmp50);
        ev(`openReviewModal('month','2026-02','returns');`);
        const retHero50 = ev(`document.querySelector('#reviewAuto .rr-hero-val').textContent`);
        const retFocus50 = ev(`document.querySelector('#reviewAuto .rr-focus').textContent`);
        ok('从投资收益页进来，第一眼只看投资收益率',
            retHero50.indexOf('投资收益率') >= 0 && retHero50.indexOf('投资收益 ') < 0, retHero50);
        ok('有数据时重点块真显示百分比，不是永远一个破折号',
            ev(`reviewReturnsHeroHTML({profit:3400,rate:0.0325},false)`).indexOf('投资收益率 3.25%') >= 0 &&
            ev(`reviewReturnsHeroHTML({profit:-800,rate:-0.021},true)`).indexOf('投资收益率 -2.10%') >= 0);
        ok('投资收益金额放在下面，不再跟收益率挤在一起',
            retFocus50.indexOf('这一期的投资收益金额') >= 0 &&
            retFocus50.indexOf('收益率') < 0 && retFocus50.indexOf('投资收益 ') >= 0, retFocus50);
        ok('自己写过的那段话仍在，且排在金额后面',
            retFocus50.indexOf('这一期你写过的话') >= 0 &&
            retFocus50.indexOf('这一期的投资收益金额') < retFocus50.indexOf('这一期你写过的话'));
        ev(`openReviewModal('month','2026-02','reports');`);
        ok('报表分析来源的重点块没被带坏，仍是支出跟平时比',
            /比平时(多花|少花)|和平时一样|这个月支出/.test(
                ev(`document.querySelector('#reviewAuto .rr-hero-val').textContent`)));
        ok('三处细节都没动填写侧，仍只有一个输入框',
            ev(`document.querySelectorAll('#reviewModal #reviewText').length`) === 1 &&
            app50.indexOf('function saveReviewText()') >= 0);

        // ---------- 51) v1.41.59：回顾弹窗紧凑化，一屏看完这一期 ----------
        stage = '51';
        const app51 = fs.readFileSync(path.join(REPO, 'js', 'app.js'), 'utf8');
        const css51 = fs.readFileSync(path.join(REPO, 'css', 'style.css'), 'utf8');
        const html51 = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
        const bS51 = css51.indexOf('/* ===== v1.41.59');
        const bE51 = css51.indexOf('/* ===== v1.', bS51 + 10);
        const block59 = bS51 >= 0 ? css51.slice(bS51, bE51 > 0 ? bE51 : css51.length) : '';
        const mediaTag51 = '@media (min-width: 641px) {';
        const mAt51 = block59.indexOf(mediaTag51);
        const rules51 = mAt51 >= 0 ? block59.slice(mAt51 + mediaTag51.length, block59.lastIndexOf('}')) : '';
        const singleCol51 = '#reviewModal .rr-cols { display: grid; grid-template-columns: 1fr;';
        ok('v1.41.59 只有一个版本块头，紧凑规则全在这一块',
            bS51 >= 0 && (css51.match(/\/\* ===== v1\.41\.59/g) || []).length === 1 &&
            block59.indexOf('#reviewModal .modal-body') >= 0 &&
            block59.indexOf('max-height: 88vh') >= 0 &&
            block59.indexOf('.review-top') >= 0 && block59.indexOf('.rr-hist') >= 0);
        ok('加宽 / 加高用的是后代选择器（#reviewModal 是遮罩，.review-modal 才是弹窗）',
            block59.indexOf('#reviewModal.review-modal') < 0 &&
            block59.indexOf('#reviewModal .review-modal') >= 0 && block59.indexOf('840px') >= 0);
        ok('单列是默认值、两栏只在大屏覆盖，顺序没写反',
            mAt51 > 0 && mAt51 < block59.indexOf('max-height: 88vh') &&
            block59.indexOf(singleCol51) >= 0 && block59.indexOf(singleCol51) < mAt51 &&
            block59.indexOf('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)') >= 0);
        // jsdom 不匹配 media：剥掉外壳注入探针，确认选择器真的命中，而不是写错或写反
        ev(`(function(){var s=document.createElement('style');s.id='probe59';s.textContent=${JSON.stringify(rules51)};document.head.appendChild(s);return 1;})()`);
        const vh51 = Number(ev(`window.innerHeight`));
        ev(`openReviewModal('month','2026-02','reports');`);
        const mh51 = ev(`getComputedStyle(document.querySelector('#reviewModal .modal-body')).maxHeight`);
        const cols51 = ev(`(function(){var c=document.querySelector('#reviewAuto .rr-cols');return c?getComputedStyle(c).gridTemplateColumns:'';})()`);
        // jsdom 会把 vh 折算成 px（默认视口 768 → 88vh = 675.84px），按视口比例验而不是硬编码 88
        ok('探针实测：可视区放宽到视口的 88%（不再是 66vh）、两栏真的生效',
            Math.abs(parseFloat(mh51) - vh51 * 0.88) < 2 && String(cols51).indexOf('1fr') >= 0,
            { mh51, vh51, cols51 });
        const topSeg51 = html51.slice(html51.indexOf('<div class="review-top">'), html51.indexOf('id="reviewAuto"'));
        ok('顶部 tab 与翻期合成一行，输入框缩到 2 行，三块内容容器都在',
            topSeg51.indexOf('class="review-tabs"') >= 0 && topSeg51.indexOf('class="review-ym"') >= 0 &&
            html51.indexOf('id="reviewText" rows="2"') >= 0 &&
            html51.indexOf('id="reviewAuto"') >= 0 && html51.indexOf('id="reviewHistory"') >= 0);
        ok('支出 / 收入两栏真的渲染出来，各自带自己的标题',
            ev(`document.querySelectorAll('#reviewAuto .rr-cols .rr-col').length`) === 2 &&
            ev(`(function(){var c=document.querySelectorAll('#reviewAuto .rr-cols .rr-col');
                return c[0].textContent.indexOf('钱花在哪')>=0 && c[1].textContent.indexOf('赚在哪')>=0;})()`));
        ok('历史默认收起，写过的每一期文字一条没丢',
            ev(`(function(){document.getElementById('reviewText').value='四月记的一笔';saveReviewText();
                var d=document.querySelector('#reviewHistory details.rr-hist'),h=document.getElementById('reviewHistory').innerHTML;
                return JSON.stringify([!!d && !d.hasAttribute('open'),h.indexOf('以前写的 · ')>=0,h.indexOf('四月记的一笔')>=0]);})()`)
            === '[true,true,true]');
        const revBefore51 = ev(`JSON.stringify(state.reviews)`);
        ok('三种来源开场没被紧凑化带坏，点开仍是只读',
            ev(`(function(){var o=[];['reports','returns','balance'].forEach(function(p){
                openReviewModal('month','2026-02',p);var h=document.getElementById('reviewAuto').innerHTML;
                o.push([h.indexOf('钱花在哪')>=0,h.indexOf('这一期你写过的话')>=0,h.indexOf('家底为什么变了')>=0]);
                });return JSON.stringify(o);})()`)
            === JSON.stringify([[true, false, false], [false, true, false], [false, false, true]]) &&
            ev(`JSON.stringify(state.reviews)`) === revBefore51);
        ok('旧的四行事实和年报四个数都还在，紧凑没删任何事实',
            ev(`(function(){reviewFrom='';reviewTab='month';reviewMonth='2026-02';renderReviewModal();
                return document.querySelectorAll('#reviewAuto .rr-row').length;})()`) === 4 &&
            ev(`(function(){reviewTab='year';reviewMonth='2026-01';renderReviewModal();
                return document.querySelectorAll('#reviewAuto .rr-big').length;})()`) === 4);
        ok('填写仍只有一处：一个输入框、一个保存按钮',
            ev(`document.querySelectorAll('#reviewModal #reviewText').length`) === 1 &&
            ev(`Array.prototype.filter.call(document.querySelectorAll('#reviewModal button'),function(b){return b.textContent.trim()==='保存这段话';}).length`) === 1);

        // ---------- 52) v1.41.60：删掉重点块标签 + 切成员后图表不再被别的页遮住 ----------
        stage = '52';
        const app52 = fs.readFileSync(path.join(REPO, 'js', 'app.js'), 'utf8');
        const css52 = fs.readFileSync(path.join(REPO, 'css', 'style.css'), 'utf8');
        ok('「第一眼只看这个」整行删掉，重点块只剩数字和说明',
            app52.indexOf('第一眼只看这个') < 0 && app52.indexOf('rr-hero-lab') < 0 &&
            css52.indexOf('.rr-hero-lab') < 0);
        ev(`openReviewModal('month','2026-02','balance');`);
        ok('三种来源的重点块里都不再出现那句话',
            ev(`(function(){var o=[];['reports','returns','balance'].forEach(function(p){
                openReviewModal('month','2026-02',p);
                o.push(document.querySelector('#reviewAuto .rr-hero').textContent.indexOf('第一眼只看这个')>=0);
                });return JSON.stringify(o);})()`) === '[false,false,false]');
        ok('每张图都按自己那一页的眼睛拨回遮罩，tooltip 改用闭包里的读数函数',
            app52.indexOf('function chartMaskFor(page)') >= 0 &&
            (app52.match(/const mm = chartMaskFor\('balance'\)/g) || []).length === 3 &&
            app52.indexOf("chartMaskFor('balance');") >= 0 &&
            app52.indexOf("chartMaskFor('returns');") >= 0 &&
            app52.indexOf('${mm(e0.raw)}') >= 0 &&
            (app52.match(/\$\{mm\(c\.raw\)\}/g) || []).length === 3);
        const trendSeg52 = app52.slice(app52.indexOf('function renderBalanceTrend'), app52.indexOf('function renderBalancePie'));
        ok('资产负债走势图的准星与提示框不再读全局 moneyVisible',
            trendSeg52.indexOf('maskMoney(') < 0 && trendSeg52.indexOf('${mm(e0.raw)}') >= 0);
        ok('模拟「切成员 → 收益页把开关改关 → 下一帧画资产负债图」：图上是可见的',
            ev(`(function(){
                state.moneyVisibleByPage.balance = true;
                state.moneyVisibleByPage.returns = false;
                moneyVisible = false;
                renderBalanceTrend(document.getElementById('balanceChart'), 'line', {}, 'net');
                return moneyVisible;})()`) === true);
        ok('反向也成立：收益页眼睛闭着时，资产负债的饼图不会把它带亮',
            ev(`(function(){
                state.moneyVisibleByPage.balance = false;
                state.moneyVisibleByPage.returns = false;
                moneyVisible = true;
                renderBalancePie(document.getElementById('balanceChart'), { month: '2026-02' });
                return moneyVisible;})()`) === false);

        // ---------- 53) v1.41.60：清仓月「本金未知」的提示指对地方，算法不猜数 ----------
        stage = '53';
        const app53 = fs.readFileSync(path.join(REPO, 'js', 'app.js'), 'utf8');
        ok('收益率算法一行没改：缺的期末余额仍不当 0，也不替人猜本金',
            app53.indexOf('const ok = capKnown && (flowKnownOf[id] || curKnown);') >= 0 &&
            app53.indexOf('base = flowKnown ? (v0 + flow / 2) : ((v0 + v1) / 2);') >= 0);
        const cap53 = ev(`(function(){
            var k = sheetAssetCats()[0].key;
            state.balances.push({id:'cap160a',member:'本人',accountId:'acct160',cur:'CNY',cat:k,amount:100000,month:'2026-01',updatedAt:9});
            state.returns.push({id:'ret160a',member:'本人',accountId:'acct160',cur:'CNY',month:'2026-02',amount:5000,updatedAt:9});
            var s=portfolioMonthStats('2026-02',['acct160'],null,'all');
            return JSON.stringify({rate:s.rate,reason:s.reason,
                hasPrev:balancesAtMonth('2026-01','all')['acct160'],
                hasProfitRec:returnsAtMonth('2026-02','all')['acct160'],
                missingClosing:s.missingClosing});
        })()`);
        const o53 = JSON.parse(cap53 || '{}');
        ok('造「上月 10 万、本月清仓没填月末、赚 5000」：数都在，就是分母拿不到，且标明缺的是本月月末',
            o53.rate === null && o53.reason === 'no-closing' && o53.hasPrev === 100000 && o53.hasProfitRec === 5000 &&
            o53.missingClosing && o53.missingClosing.length === 1 && o53.missingClosing[0] === 'acct160', cap53);
        ok('把清仓那月的月末余额补成 0 就能算（分母按期初期末平均会偏高，软件不擅自改口径）',
            ev(`(function(){
                var k = sheetAssetCats()[0].key;
                state.balances.push({id:'cap160b',member:'本人',accountId:'acct160',cur:'CNY',cat:k,amount:0,month:'2026-02',updatedAt:10});
                var s=portfolioMonthStats('2026-02',['acct160'],null,'all');
                return JSON.stringify([s.rate,s.base,s.reason]);
            })()`) === '[0.1,50000,""]');
        ok('提示与跳转都改指当月，缺上月余额的旧文案仍在',
            app53.indexOf("'no-closing': '本金未知：这个月没填月末余额（清仓了就记一笔 0）") >= 0 &&
            app53.indexOf("'no-capital': '本金未知：这些账户缺上月余额、也没填净入金") >= 0 &&
            app53.indexOf('openBalanceModal(targetM)') >= 0 &&
            app53.indexOf('清仓了请记一笔 0') >= 0 &&
            app53.indexOf('按月看那个月会留空，按年会跳过它') >= 0);
        ok('按年 / 全部档会把算不出的月份跳过去（所以换个档位看着像「又好了」，不是数据变了）',
            app53.indexOf('if (st.rate !== null && isFinite(st.rate)) { acc *= (1 + st.rate); n += 1; }') >= 0 &&
            app53.indexOf('const cumulative = n > 0 ? acc - 1 : null;') >= 0);

        // ---------- 54) v1.41.61：报表「月度结账」可折叠，默认收起只留标题 + 待办数 ----------
        stage = '54';
        const app61 = fs.readFileSync(path.join(REPO, 'js', 'app.js'), 'utf8');
        const html61 = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
        const css61 = fs.readFileSync(path.join(REPO, 'css', 'style.css'), 'utf8');
        ok('结账卡片有可点的折叠头，月份下拉点选不会误触折叠',
            html61.indexOf('id="closeToggle"') >= 0 && html61.indexOf('onclick="toggleCloseCard()"') >= 0 &&
            html61.indexOf('id="closeMonthSelect" onclick="event.stopPropagation()"') >= 0 &&
            html61.indexOf('class="secondary-btn close-recheck"') >= 0);
        ok('折叠状态走 uiPrefs 落盘（本地 UI 偏好，不进云同步），默认收起',
            app61.indexOf('closeCollapsed: true,') >= 0 &&
            app61.indexOf('closeCollapsed: !!state.closeCollapsed,') >= 0 &&
            app61.indexOf("if (typeof ui.closeCollapsed === 'boolean') state.closeCollapsed = ui.closeCollapsed;") >= 0);
        ok('CSS 收起时只藏清单、留标题；箭头旋转，版本块只写一次',
            css61.indexOf('#closeCard.collapsed #closeList { display: none; }') >= 0 &&
            css61.indexOf('#closeCard.collapsed .close-head-text .close-caret { transform: rotate(-90deg); }') >= 0 &&
            (css61.match(/\/\* ===== v1\.41\.61/g) || []).length === 1);
        ok('点标题真能切换折叠状态并落盘，标题的 aria-expanded 同步',
            (function () {
                const before = ev('state.closeCollapsed');
                ev('toggleCloseCard()');
                const after = ev('state.closeCollapsed');
                const cardCls = ev("document.getElementById('closeCard').className");
                const aria = ev("document.getElementById('closeToggle').getAttribute('aria-expanded')");
                ev('toggleCloseCard()');
                return before === true && after === false && cardCls.indexOf('collapsed') < 0 &&
                    aria === 'true';
            })());
        ok('重绘后折叠状态保持：renderCloseCard 会按 state 拨回 collapsed 和 aria',
            app61.indexOf("card.classList.toggle('collapsed', !!state.closeCollapsed);") >= 0 &&
            app61.indexOf("toggle.setAttribute('aria-expanded', state.closeCollapsed ? 'false' : 'true');") >= 0);
        ok('折叠只动展示，不动清单内容本身：待办数与导航红点照旧',
            app61.indexOf('const todo = cl.items.filter(i => i.state === \'warn\').length;') >= 0 &&
            app61.indexOf('dot.classList.toggle(\'hidden\', todo === 0);') >= 0);

        // ---------- 55) v1.41.62：净资产变动重点块，第一眼看到增减多少 ----------
        stage = '55';
        const app62 = fs.readFileSync(path.join(REPO, 'js', 'app.js'), 'utf8');
        const html62 = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
        const css62 = fs.readFileSync(path.join(REPO, 'css', 'style.css'), 'utf8');
        ok('等式结构：变动 = 结余 + 投资收益 三项齐全，旧的「增加/减少」大字行删掉，版本块只写一次',
            html62.indexOf('id="bridgeHeroVal"') >= 0 &&
            html62.indexOf('id="bridgeSavedVal"') >= 0 && html62.indexOf('id="bridgeProfitVal"') >= 0 &&
            html62.indexOf('id="bridgeProfitOp"') >= 0 &&
            html62.indexOf('id="bridgeHeroSub"') >= 0 &&
            html62.indexOf('id="bridgeHeroLabel"') < 0 &&
            html62.indexOf('class="be-lab">结余') >= 0 && html62.indexOf('class="be-lab">投资收益') >= 0 &&
            html62.indexOf('class="be-lab">净资产变动') < 0 &&
            (css62.match(/\/\* ===== v1\.41\.63/g) || []).length === 1);
        ok('标签居中对齐数字：第一列无标签，整行改为顶部对齐让三个数字齐平',
            css62.indexOf('.be-part { display: inline-flex; flex-direction: column; align-items: center;') >= 0 &&
            css62.indexOf('.bridge-eq { display: flex; align-items: flex-start;') >= 0);
        ok('副行 X-Y 上移到第一列数字下方做标签；明细不再写投资收益行',
            html62.indexOf('<small class="be-lab be-range" id="bridgeHeroSub"></small>') >= 0 &&
            html62.indexOf('class="bridge-hero-sub"') < 0 &&
            app62.indexOf('投资收益已经在等式里，明细也删掉') >= 0);
        ok('涨跌配色：增加红(--expense-text)、减少绿(--income-text)，不再是旧的 good/bad/flat 三态',
            css62.indexOf('.be-val.be-up { color: var(--expense-text); }') >= 0 &&
            css62.indexOf('.be-val.be-down { color: var(--income-text); }') >= 0 &&
            css62.indexOf('.bridge-hero.good') < 0);
        // 造一增一减两个场景，等式三项的符号/配色类、副行格式必须对上
        const hero62 = ev(`(function(){
            var k=sheetAssetCats()[0].key;
            function bal(id,m,a){return {id:id,member:'本人',accountId:'a',cur:'CNY',cat:k,month:m,amount:a,updatedAt:1};}
            state.balanceOwner='all'; state.balancePeriod='month'; state.balanceYear=2026;
            state.balanceMonth=9; moneyVisible=true;   // 必须指到真有余额的 9 月，且眼睛开着，否则拿不到 delta、数字被打成 ****
            state.accounts=[{id:'a',name:'账户',kind:'asset',bucket:'growth',group:'',cur:'CNY',updatedAt:1}];
            state.returns=[]; state.transactions=[];
            state.balances=[bal('x1','2026-08',100000),bal('x2','2026-09',120000)];
            renderNetBridge();
            function snap(){return {
                v:document.getElementById('bridgeHeroVal').textContent,
                vc:document.getElementById('bridgeHeroVal').className,
                sub:document.getElementById('bridgeHeroSub').textContent,
                rows:document.getElementById('bridgeRows').textContent};}
            var up=snap();
            state.balances=[bal('x1','2026-08',100000),bal('x2','2026-09',80000)];
            renderNetBridge();
            var down=snap();
            return JSON.stringify({up:up,down:down});
        })()`);
        const h62 = JSON.parse(hero62 || '{}');
        ok('增 2 万：正数不带 + 号 + 红色 be-up 类，副行「100000-120000」，明细无期初/期末/投资收益',
            h62.up && h62.up.v === '20000' && h62.up.vc.indexOf('be-up') >= 0 &&
            h62.up.sub === '100000-120000' &&
            h62.up.rows.indexOf('期初净资产') < 0 && h62.up.rows.indexOf('期末净资产') < 0 &&
            h62.up.rows.indexOf('投资收益') < 0, hero62);
        ok('减 2 万：带 − 号 + 绿色 be-down 类，副行「100000-80000」',
            h62.down && h62.down.v === '−20000' && h62.down.vc.indexOf('be-down') >= 0 &&
            h62.down.sub === '100000-80000', hero62);
        ok('明细默认收进折叠：hero 在 details 外、瀑布图在里，展开/收起两态标签都在',
            html62.indexOf('class="bridge-hero" id="bridgeHero"') >= 0 &&
            html62.indexOf('<details class="bridge-detail" id="bridgeDetail" ontoggle="onBridgeDetailToggle()">') >= 0 &&
            html62.indexOf('class="bd-label-closed">展开看明细') >= 0 &&
            html62.indexOf('class="bd-label-open">收起明细') >= 0 &&
            html62.indexOf('id="bridgeChart"') >= 0 &&
            html62.indexOf('id="bridgeHero"') < html62.indexOf('id="bridgeDetail"') &&
            html62.indexOf('id="bridgeDetail"') < html62.indexOf('id="bridgeChart"'));
        ok('折叠态 CSS：箭头翻转、两态标签互斥、隐藏原生三角',
            css62.indexOf('.bridge-detail[open] .bd-caret { transform: rotate(180deg); }') >= 0 &&
            css62.indexOf('.bridge-detail[open] .bd-label-open { display: inline; }') >= 0 &&
            css62.indexOf('.bridge-detail > summary::-webkit-details-marker { display: none; }') >= 0);
        ok('隐藏容器里不画瀑布图：存下数据，展开时才补画（onBridgeDetailToggle）',
            app62.indexOf('lastBridgeData = b;') >= 0 &&
            app62.indexOf('if (!detailOpen) return;') >= 0 &&
            app62.indexOf('function onBridgeDetailToggle()') >= 0 &&
            app62.indexOf('drawBridgeChart(lastBridgeData)') >= 0);
        ok('净资产变动的算法一行没碰：delta / unexplained 口径原样',
            app62.indexOf('const delta = closeT.net - openT.net;') >= 0 &&
            app62.indexOf('const unexplained = delta - saved - profit - fixedMove;') >= 0);
        // 原文案（有口径语义）不能被视觉改动顺手删掉
        ok('「本期储蓄」「数据说明」「统计区间」这些有语义的文案都还在',
            app62.indexOf("isRange ? '本期储蓄（收入−支出）'") >= 0 &&
            app62.indexOf('<b>数据说明</b>：统计区间') >= 0);

        // ---------- 56) v1.41.64：冷启动两页默认「月档 + 上月」----------
        stage = '56';
        ok('冷启动归一：loadState 后把两个档位回月档、年月清空由 prevMonthYM 兜底',
            app62.indexOf("state.balancePeriod = 'month';") >= 0 &&
            app62.indexOf("state.returnPeriod = 'month';") >= 0 &&
            app62.indexOf('state.balanceYear = null; state.balanceMonth = null;') >= 0 &&
            app62.indexOf('state.returnYear = null; state.returnMonth = null;') >= 0);
        ok('四处默认月份兜底统一成上月，不再有 now.getMonth()+1（当月）',
            (app62.match(/state\.balanceYear \|\| _pm\.y/g) || []).length === 2 &&
            app62.indexOf('state.returnYear || _pm.y') >= 0 &&
            app62.indexOf('state.returnMonth || _pm.m') >= 0 &&
            app62.indexOf('state.returnYear || new Date().getFullYear()') < 0);
        ok('实测：三种启动场景（年档 / 全部档 / 当月）冷启动后两页都落到同一个上月',
            (function () {
                const set = s => ev(`(function(){${s}
                    state.balancePeriod='month';state.returnPeriod='month';
                    state.balanceYear=null;state.balanceMonth=null;state.returnYear=null;state.returnMonth=null;
                    renderBalance();renderReturns();
                    return document.getElementById('balanceYmLabel').textContent+'|'+document.getElementById('returnYmLabel').textContent;})()`);
                const pm = ev('prevMonthYM().y+"年"+prevMonthYM().m+"月"');
                const want = pm + '|' + pm;
                return set("state.balancePeriod='year';state.returnPeriod='year';") === want &&
                    set("state.balancePeriod='all';state.returnPeriod='all';") === want &&
                    set("state.balanceYear=2026;state.balanceMonth=11;state.returnYear=2026;state.returnMonth=11;") === want;
            })());

        // ---------- 57) v1.41.65：手机端净资产变动等式一行 + 正数不带 + 号 ----------
        stage = '57';
        ok('正数不带 + 号：signed 里只对负数加「−」，等式中间的 + / − 运算符照旧',
            app62.indexOf("(v < -0.005 ? '−' : '') + formatCurrency(Math.abs(v))") >= 0 &&
            app62.indexOf("(v > 0.005 ? '+' : '')") < 0 &&
            app62.indexOf("po.textContent = b.profit < -0.005 ? '−' : '+';") >= 0);
        ok('手机端（≤640px 且非 Mac 壳）等式强制 nowrap 不折行 + 基础档 nowrap 防断行',
            (css62.match(/\/\* ===== v1\.41\.65/g) || []).length === 1 &&
            css62.indexOf('html:not(.mac-app) .bridge-eq { flex-wrap: nowrap; gap: 5px; overflow-x: auto; scrollbar-width: none; }') >= 0 &&
            css62.indexOf('html:not(.mac-app) .bridge-eq::-webkit-scrollbar { display: none; }') >= 0 &&
            css62.indexOf('html:not(.mac-app) .be-val { font-size: 17px; white-space: nowrap; }') >= 0 &&
            css62.indexOf('html:not(.mac-app) #bridgeHeroVal { font-size: 19px; }') >= 0 &&
            css62.indexOf('html:not(.mac-app) .be-lab { font-size: 10px; white-space: nowrap; }') >= 0 &&
            css62.indexOf('html:not(.mac-app) .be-op { font-size: 15px; padding-top: 2px; }') >= 0);
        ok('v1.41.68：按位数分五档（be-len-a/b/c、be-compact、be-len-d），让每档尽量填满、左右留白均衡；Mac 端不读标记',
            ['be-len-a', 'be-len-b', 'be-len-c', 'be-compact', 'be-len-d'].every(c => app62.indexOf("'" + c + "'") >= 0) &&
            app62.indexOf('eq.classList.remove(') >= 0 &&
            app62.indexOf('formatCurrency(Math.abs(v)).length') >= 0 &&
            app62.indexOf('maxLen <= 5') >= 0 && app62.indexOf('maxLen <= 7') >= 0 &&
            app62.indexOf('maxLen <= 8') >= 0 && app62.indexOf('maxLen <= 10') >= 0 &&
            ['be-len-a .be-val { font-size: 30px; }',
             'be-len-b .be-val { font-size: 23px; }',
             'be-len-c .be-val { font-size: 20px; }',
             'be-compact .be-val { font-size: 17px; }',
             'be-len-d .be-val { font-size: 15px; }'].every(s => css62.indexOf('html:not(.mac-app) .bridge-eq.' + s) >= 0) &&
            (css62.match(/\/\* ===== v1\.41\.65/g) || []).length === 1 &&
            (css62.match(/\/\* ---- 同一版：按数字位数分档/g) || []).length === 1);
        ok('桌面规则原样保留（wrap + 22px/26px），手机块只在 @media 里覆盖，不改全局',
            css62.indexOf('.bridge-eq { display: flex; align-items: flex-start; gap: 10px; flex-wrap: wrap; }') >= 0 &&
            css62.indexOf('.be-val { font-size: 22px;') >= 0 &&
            css62.indexOf('#bridgeHeroVal { font-size: 26px; }') >= 0 &&
            css62.indexOf('@media (max-width: 640px)') >= 0);
        // 运行时：造真正带正数结余/收益的场景，才能验到「三个数值都不带 + 号」
        const eq57 = ev(`(function(){
            var k=sheetAssetCats()[0].key;
            function bal(id,m,a){return {id:id,member:'本人',accountId:'a',cur:'CNY',cat:k,month:m,amount:a,updatedAt:1};}
            state.balanceOwner='all'; state.balancePeriod='month'; state.balanceYear=2026;
            state.balanceMonth=9; moneyVisible=true;
            state.accounts=[{id:'a',name:'账户',kind:'asset',bucket:'growth',group:'',cur:'CNY',updatedAt:1}];
            function snap(){return {
                v:document.getElementById('bridgeHeroVal').textContent,
                sv:document.getElementById('bridgeSavedVal').textContent,
                op:document.getElementById('bridgeProfitOp').textContent,
                pv:document.getElementById('bridgeProfitVal').textContent};}
            // 增：余额 10万→12万，结余 +12000、收益 +8000 → 等式 20000 = 12000 + 8000
            state.transactions=[{id:'t1',date:'2026-09-15',type:'income',amount:12000,member:'本人',updatedAt:1}];
            state.returns=[{id:'r1',month:'2026-09',accountId:'a',amount:8000,member:'本人',updatedAt:1}];
            state.balances=[bal('x1','2026-08',100000),bal('x2','2026-09',120000)];
            renderNetBridge(); var up=snap();
            // 减：结余 -12000（支出）、收益 -8000 → 等式 −20000 = −12000 − 8000
            state.transactions=[{id:'t2',date:'2026-09-15',type:'expense',amount:12000,member:'本人',updatedAt:1}];
            state.returns=[{id:'r2',month:'2026-09',accountId:'a',amount:-8000,member:'本人',updatedAt:1}];
            state.balances=[bal('x1','2026-08',100000),bal('x2','2026-09',80000)];
            renderNetBridge(); var down=snap();
            return JSON.stringify({up:up,down:down});
        })()`);
        const e57 = JSON.parse(eq57 || '{}');
        ok('实测：正数三个数值都不带 + 号（20000 = 12000 + 8000），运算符仍是 +',
            e57.up && e57.up.v === '20000' && e57.up.sv === '12000' &&
            e57.up.op === '+' && e57.up.pv === '8000', eq57);
        ok('实测：负数主数字/结余带 −，收益为负时运算符切 −（−20000 = −12000 − 8000）',
            e57.down && e57.down.v === '−20000' && e57.down.sv === '−12000' &&
            e57.down.op === '−' && e57.down.pv === '8000', eq57);
        // v1.41.66：资产负债 / 投资收益页点「账户」进去，默认直接编辑（不再只读防误触）
        ok('账户管理弹窗默认进编辑模式：refreshAccountsViewMode 固定置 false',
            app62.indexOf('accountsViewMode = false;') >= 0 &&
            app62.indexOf('accountsViewMode = accountsHasData;') < 0);
        ok('v1.41.67：账户弹窗标题栏删掉了「完成/编辑」切换按钮，只留 × 关闭',
            html62.indexOf('id="accEditBtn"') < 0 &&
            html62.indexOf('id="accEditBtnLabel"') < 0 &&
            html62.indexOf('id="accViewTag"') < 0 &&
            html62.indexOf('toggleAccountsViewMode()') < 0 &&
            app62.indexOf('function toggleAccountsViewMode') < 0 &&
            html62.indexOf('onclick="closeAccountsModal()"') >= 0);
        ok('实测：openAccountsModal 后仍是编辑态（不进 acc-viewmode），且没有切换按钮',
            (function () {
                ev(`state.accounts=[{id:'ac1',name:'测试',kind:'asset',group:'现金',color:'#007aff',icon:'fa-wallet',order:1,members:['本人']}];
                    state.balanceMembers=['本人']; openAccountsModal();`);
                const view = ev(`document.getElementById('accountsModal').classList.contains('acc-viewmode')`);
                const btnGone = ev(`!document.getElementById('accEditBtn')`);
                return view === false && btnGone === true;
            })());
        // 分档实测：按最长数字位数落进对应档位 class；闭眼按最短档（be-len-a）
        const compact57 = ev(`(function(){
            var k=sheetAssetCats()[0].key;
            function bal(a){return {id:'b'+Math.random(),member:'本人',accountId:'a',cur:'CNY',cat:k,month:a.m,amount:a.v,updatedAt:1};}
            state.balanceOwner='all';state.balancePeriod='month';state.balanceYear=2026;state.balanceMonth=9;moneyVisible=true;
            state.accounts=[{id:'a',name:'账户',kind:'asset',bucket:'growth',group:'',cur:'CNY',updatedAt:1}];
            state.transactions=[];state.returns=[];
            function cls(){var e=document.querySelector('#bridgeHero .bridge-eq');return ['be-len-a','be-len-b','be-len-c','be-compact','be-len-d'].filter(function(c){return e.classList.contains(c);}).join(',');}
            // 余额差 2 万 → 5 位 → be-len-a
            state.balances=[bal({m:'2026-08',v:100000}),bal({m:'2026-09',v:120000})];
            renderNetBridge(); var d5=cls();
            // 余额差 125 万 → 7 位 → be-len-b
            state.balances=[bal({m:'2026-08',v:3800000}),bal({m:'2026-09',v:5050000})];
            renderNetBridge(); var d7=cls();
            // 余额差 8500 万 → 8 位 → be-len-c
            state.balances=[bal({m:'2026-08',v:10000000}),bal({m:'2026-09',v:95000000})];
            renderNetBridge(); var d8=cls();
            moneyVisible=false; renderNetBridge(); var hidden=cls();
            return JSON.stringify({d5:d5,d7:d7,d8:d8,hidden:hidden});
        })()`);
        const c57 = JSON.parse(compact57 || '{}');
        ok('实测五档：5位→len-a、7位→len-b、8位→len-c、闭眼→len-a（位数越多字号越小填满宽度）',
            c57.d5 === 'be-len-a' && c57.d7 === 'be-len-b' && c57.d8 === 'be-len-c' && c57.hidden === 'be-len-a', compact57);

        // ---------- 58) v1.41.68：口径勾选进同步指纹 + 手机底部导航左右滑切页 ----------
        stage = '58';
        ok('同步指纹纳入 settings（收益页口径勾选变化能被 remotePush 识别并上传）',
            app62.indexOf('JSON.stringify(d.settings || {})') >= 0 &&
            app62.indexOf('收益页「口径」里勾的账户存在 settings.returnAccountIds') >= 0);
        const fp58 = ev(`(function(){
            state.settings.returnAccountMode='manual';
            state.settings.returnAccountIds=['a1'];
            var a=fingerprintOfPayload(buildSyncPayload());
            state.settings.returnAccountIds=['a1','a2'];
            var b=fingerprintOfPayload(buildSyncPayload());
            state.settings.returnAccountIds=['a1','a2'];
            var c=fingerprintOfPayload(buildSyncPayload());
            return {changed:a!==b, stable:b===c};
        })()`);
        ok('实测：多勾一个账户指纹变化（会推上去），重复勾选指纹稳定（不会来回推）',
            !!fp58 && fp58.changed === true && fp58.stable === true, fp58);
        ok('横滑切页绑在内容区 .main-content（不是导航条），图表上不触发；Mac 端不生效',
            app62.indexOf("const content = document.querySelector('.main-content')") >= 0 &&
            app62.indexOf("content.addEventListener('touchstart'") >= 0 &&
            app62.indexOf("content.addEventListener('touchend'") >= 0 &&
            app62.indexOf("e.target.closest('canvas, .chart-container, .chart-card')") >= 0 &&
            app62.indexOf("Math.abs(dx) < 50") >= 0 &&
            css62.indexOf('.chart-card, .chart-container, canvas { touch-action: auto; }') >= 0);
        ok('横滑不碰弹窗：所有 .modal-overlay 都在 </main> 之后，不在手势绑定的 .main-content 内',
            (function () {
                const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
                const mainEnd = html.indexOf('</main>');
                const firstModal = html.indexOf('class="modal-overlay');
                return mainEnd > 0 && firstModal > mainEnd;
            })());
        const swipe58 = ev(`(function(){
            var content=document.querySelector('.main-content');
            if(!content) return {err:'no content'};
            Object.defineProperty(window,'innerWidth',{value:375,configurable:true});
            function swipe(from,x2,dy){
                var s=new window.Event('touchstart',{bubbles:true});
                s.touches=[{clientX:200,clientY:300}];
                from.dispatchEvent(s);
                var e=new window.Event('touchend',{bubbles:true});
                e.changedTouches=[{clientX:x2,clientY:300+(dy||0)}];
                content.dispatchEvent(e);
            }
            switchView('reports'); swipe(content,120); var left=state.currentView;   // 左滑 -80
            switchView('reports'); swipe(content,290); var right=state.currentView;  // 右滑 +90
            switchView('reports'); swipe(content,200,120); var vertical=state.currentView;
            switchView('reports'); swipe(content,230); var tiny=state.currentView;   // +30 < 50
            // 起点在图表卡片上：横滑也不切
            var chart=document.createElement('div'); chart.className='chart-card';
            content.appendChild(chart);
            switchView('reports'); swipe(chart,120); var onChart=state.currentView;
            content.removeChild(chart);
            return {left:left,right:right,vertical:vertical,tiny:tiny,onChart:onChart};
        })()`);
        ok('实测内容区横滑（翻书方向）：左滑切右页、右滑切左页；竖滑/小幅不切；图表上横滑不切',
            !!swipe58 && swipe58.left === 'balance' && swipe58.right === 'transactions' &&
            swipe58.vertical === 'reports' && swipe58.tiny === 'reports' && swipe58.onChart === 'reports', swipe58);
        ok('横滑过渡改成弹窗式缩放淡入（pageSwapIn）：动画结束固化 view-settled，杜绝 fadeIn 重播晃动',
            app62.indexOf("switchView(items[next].dataset.view, dx < 0 ? 'right' : 'left')") >= 0 &&
            app62.indexOf("target.classList.add('page-swap-in')") >= 0 &&
            app62.indexOf("target.addEventListener('animationend', settle)") >= 0 &&
            app62.indexOf('setTimeout(settle, 500)') >= 0 &&
            app62.indexOf("target.classList.add('view-settled')") >= 0 &&
            app62.indexOf("view.classList.remove('active', 'page-swap-in', 'view-settled')") >= 0 &&
            css62.indexOf('@keyframes pageSwapIn') >= 0 &&
            css62.indexOf('.view.page-swap-in { animation: pageSwapIn') >= 0 &&
            css62.indexOf('.view.view-settled { animation: none; }') >= 0 &&
            css62.indexOf('/* ===== v1.41.70 横滑切页过渡') >= 0 &&
            css62.indexOf('pageSlideInRight') < 0);
        ok('切页后回到顶部：switchView 在 renderView 后把 .main-content 的 scrollTop 清零',
            (function () {
                const s = app62.slice(app62.indexOf('function switchView('), app62.indexOf('function renderView('));
                return s.indexOf("document.querySelector('.main-content')") >= 0 &&
                    s.indexOf('scroller.scrollTop = 0') >= 0 &&
                    s.indexOf('renderView(viewName);') < s.indexOf('scroller.scrollTop = 0');
            })());
        ok('实测横滑切页后滚动位置归零',
            (function () {
                const r = ev(`(function(){
                    var c=document.querySelector('.main-content');
                    switchView('reports'); c.scrollTop=800; var before=c.scrollTop;
                    switchView('balance','left');
                    return {before:before, after:c.scrollTop};
                })()`);
                return !!r && r.before > 0 && r.after === 0;
            })());
        ok('长按拖动 bug 修复：startHold 归一到整个 .nav-item（按在图标/文字上也拖整项），被拖项 pointer-events:none',
            app62.indexOf("const el = target.closest ? target.closest('.nav-item') : target;") >= 0 &&
            app62.indexOf("if (!el || el.parentNode !== bar) return;") >= 0 &&
            css62.indexOf('pointer-events: none;   /* 让 elementFromPoint 看穿被拖项') >= 0);

        ok('端到端：Mac 勾选账户 → 同步包 → 手机合并后勾选一致',
            (function () {
                const r = ev(`(function(){
                    try {
                        state.settings.returnAccountMode='manual';
                        state.settings.returnAccountIds=['acct-new'];
                        var payload=buildSyncPayload();
                        state.settings.returnAccountIds=[];
                        iCloudLastSyncTime=0;
                        mergeRemoteData(payload);
                        return {ids:(state.settings.returnAccountIds||[]).join(','),mode:state.settings.returnAccountMode};
                    } catch(err) { return {err:String(err)}; }
                })()`);
                return !!r && r.ids === 'acct-new' && r.mode === 'manual';
            })(), ev(`JSON.stringify({ids:state.settings.returnAccountIds,mode:state.settings.returnAccountMode})`));

        // ---------- 59) v1.41.68：口径面板「记收益」勾选（账户 earnsReturn）是否同步 ----------
        stage = '59';
        ok('「记收益」勾选写在账户上且刷新 updatedAt（账户在指纹 sig 里，改动能被识别）',
            app62.indexOf('a.earnsReturn = !!on;') >= 0 &&
            app62.indexOf('a.updatedAt = Date.now();') >= 0 &&
            app62.indexOf('sig(d.accounts), sig(d.balances)') >= 0);
        const earn59 = ev(`(function(){
            try {
                function acc(withEarn){return {id:'ea',name:'测试',kind:'asset',bucket:'growth',group:'',color:'#007aff',icon:'fa-wallet',order:1,updatedAt:100,members:['本人'],earnsReturn:withEarn};}
                state.accounts=[acc(false)];
                var a=accountById('ea');
                setAccountEarnsReturn(a, true);
                var fBefore=fingerprintOfPayload(buildSyncPayload());
                var fAfter=fingerprintOfPayload(buildSyncPayload());
                var payload=buildSyncPayload();
                // 模拟手机：那笔账户还是没勾
                state.accounts=[acc(false)];
                iCloudLastSyncTime=0;
                mergeRemoteData(payload);
                var got=accountById('ea');
                return {earns:got.earnsReturn, updated:got.updatedAt>100, fpStable:fBefore===fAfter};
            } catch(err) { return {err:String(err)}; }
        })()`);
        ok('端到端：Mac 勾「记收益」→ 同步包 → 手机合并后勾选一致（updatedAt 较新胜）',
            !!earn59 && earn59.earns === true && earn59.updated === true && earn59.fpStable === true, earn59);

        // ---------- 60) v1.41.68：导航栏长按拖动排序，手机/Mac 各自独立 ----------
        stage = '60';
        ok('导航顺序按设备分开存（mobile / desktop 两个 key），不进同步包',
            app62.indexOf("localStorage.getItem('bookkeeping_nav_order_' + (isElectron() ? 'desktop' : 'mobile'))") >= 0 &&
            app62.indexOf("localStorage.setItem(orderKey()") >= 0 &&
            app62.indexOf("'bookkeeping_nav_order_' + (isElectron() ? 'desktop' : 'mobile')") >= 0 &&
            // 顺序 key 绝不能出现在同步载荷里
            app62.indexOf('nav_order_') >= 0 &&
            (function () { const p = ev('buildSyncPayload()'); return p && JSON.stringify(p).indexOf('nav_order') < 0; })());
        ok('applyNavOrder 在 init 冷启动恢复顺序，新增项补到末尾',
            app62.indexOf('function applyNavOrder()') >= 0 &&
            app62.indexOf('applyNavOrder();   // v1.41.68') >= 0 &&
            app62.indexOf('byView.forEach(el => bar.appendChild(el));') >= 0);
        ok('长按 500ms 才进拖动，拖动时吞 click；两端都绑鼠标+触摸',
            app62.indexOf('}, 500);') >= 0 &&
            app62.indexOf("el.classList.add('nav-dragging')") >= 0 &&
            app62.indexOf("bar.addEventListener('mousedown'") >= 0 &&
            app62.indexOf("document.addEventListener('mouseup'") >= 0 &&
            css62.indexOf('.nav-item.nav-dragging') >= 0);
        ok('实测：applyNavOrder 按存档重排 DOM，未列出的新项补末尾',
            (function () {
                const r = ev(`(function(){
                    try {
                        var bar=document.querySelector('.nav-menu');
                        var all=Array.from(bar.querySelectorAll('.nav-item')).map(function(el){return el.dataset.view;});
                        localStorage.setItem('bookkeeping_nav_order_'+(isElectron()?'desktop':'mobile'), JSON.stringify(['settings','transactions']));
                        applyNavOrder();
                        var after=Array.from(bar.querySelectorAll('.nav-item')).map(function(el){return el.dataset.view;});
                        localStorage.removeItem('bookkeeping_nav_order_'+(isElectron()?'desktop':'mobile'));
                        applyNavOrder();
                        return {first:after[0],second:after[1],tail:after[after.length-1],all:all.length};
                    } catch(err){ return {err:String(err)}; }
                })()`);
                return !!r && r.first === 'settings' && r.second === 'transactions' && r.all >= 6;
            })(), ev(`(function(){var b=document.querySelector('.nav-menu');return Array.from(b.querySelectorAll('.nav-item')).map(function(e){return e.dataset.view;}).join(',');})()`));

        console.log('\n=== 结束' + (failures ? '（有 ' + failures + ' 项失败）' : '（全过）') + ' ===');
    } catch (e) {
        console.log('  [FATAL @ ' + stage + '] ' + (e && e.stack || e));
        failures++;
    }
    try { fs.unlinkSync(tmpHtml); } catch (e) {}
    setTimeout(() => { dom.window.close(); process.exit(failures ? 1 : 0); }, 200);
}
