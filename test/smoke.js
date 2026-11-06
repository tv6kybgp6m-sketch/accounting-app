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

function run() {
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
        // 换个月份 → 那一列照旧显示（收起只对当前月份）
        ev(`paintModalMonth('monthly','2026-08'); renderMonthlyEntry();`);
        ok('换到 8 月：那一列照旧显示（收起只对当月生效）',
            ev(`!!document.querySelector('#monthlyEntryList [data-col-key="gold"]')`));
        ev(`paintModalMonth('monthly','2026-09'); renderMonthlyEntry();`);
        ok('换回 9 月：那列仍然是收起的',
            ev(`!document.querySelector('#monthlyEntryList [data-col-key="gold"]')`));
        ev(`unhideSheetColumn('gold');`);
        ok('展开后列回来了', ev(`!!document.querySelector('#monthlyEntryList [data-col-key="gold"]')`));
        // 账户行同理
        ev(`hideMonthlyAccount('a_plain');`);
        ok('收起的账户在当月不显示',
            ev(`document.querySelectorAll('#monthlyEntryList [data-mw-account="a_plain"]').length === 0`));
        ev(`paintModalMonth('monthly','2026-08'); renderMonthlyEntry();`);
        ok('换到 8 月：那个账户照旧显示',
            ev(`document.querySelectorAll('#monthlyEntryList [data-mw-account="a_plain"]').length >= 1`));
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

        console.log('\n=== 结束' + (failures ? '（有 ' + failures + ' 项失败）' : '（全过）') + ' ===');
    } catch (e) {
        console.log('  [FATAL @ ' + stage + '] ' + (e && e.stack || e));
        failures++;
    }
    try { fs.unlinkSync(tmpHtml); } catch (e) {}
    setTimeout(() => { dom.window.close(); process.exit(failures ? 1 : 0); }, 200);
}
