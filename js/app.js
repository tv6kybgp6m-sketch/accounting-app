/* ============================================
   记账本 Bookkeeping - App Logic
   ============================================ */

// ---- On-demand library loading ----
// Chart.js (~200KB) and the Excel lib (~881KB) used to load synchronously in
// <head>, so the phone had to parse and execute ~1MB of JS before painting the
// first screen — that was the white screen. They now load only when needed.
let __chartPromise = null;
function loadChartLib() {
    if (typeof Chart !== 'undefined') return Promise.resolve();
    if (!__chartPromise) {
        __chartPromise = new Promise((resolve, reject) => {
            const el = document.createElement('script');
            el.src = 'vendor/chart.umd.min.js';
            el.onload = () => resolve();
            el.onerror = () => { __chartPromise = null; reject(new Error('chart load failed')); };
            document.head.appendChild(el);
        });
    }
    return __chartPromise;
}

let __xlsxPromise = null;
function loadXlsxLib() {
    if (typeof XLSX !== 'undefined') return Promise.resolve();
    if (!__xlsxPromise) {
        __xlsxPromise = new Promise((resolve, reject) => {
            const el = document.createElement('script');
            el.src = 'js/xlsx.full.min.js';
            el.onload = () => resolve();
            el.onerror = () => { __xlsxPromise = null; reject(new Error('xlsx load failed')); };
            document.head.appendChild(el);
        });
    }
    return __xlsxPromise;
}

// ---- Default Data ----
const DEFAULT_EXPENSE_CATEGORIES = [
    { id: 'e_food', name: '餐饮', icon: 'fa-utensils', color: '#ff6b6b', type: 'expense' },
    { id: 'e_transport', name: '交通', icon: 'fa-car', color: '#4ecdc4', type: 'expense' },
    { id: 'e_renqing', name: '人情', icon: 'fa-hand-holding-heart', color: '#e84393', type: 'expense' },
    { id: 'e_jiayong', name: '家用', icon: 'fa-basket-shopping', color: '#feca57', type: 'expense' },
    { id: 'e_shuma', name: '数码', icon: 'fa-laptop', color: '#55a3ff', type: 'expense' },
    { id: 'e_other', name: '其他', icon: 'fa-ellipsis', color: '#636e72', type: 'expense' },
    { id: 'e_shuidianmei', name: '水电煤', icon: 'fa-bolt', color: '#fdcb6e', type: 'expense' },
    { id: 'e_jiayou', name: '加油', icon: 'fa-gas-pump', color: '#00cec9', type: 'expense' },
    { id: 'e_qingke', name: '请客', icon: 'fa-mug-hot', color: '#d63031', type: 'expense' },
    { id: 'e_xuexi', name: '学习', icon: 'fa-graduation-cap', color: '#6c5ce7', type: 'expense' },
    { id: 'e_entertain', name: '娱乐', icon: 'fa-gamepad', color: '#a29bfe', type: 'expense' },
    { id: 'e_comm', name: '通讯', icon: 'fa-phone', color: '#0984e3', type: 'expense' },
    { id: 'e_laopo', name: '老婆', icon: 'fa-heart', color: '#fd79a8', type: 'expense' },
    { id: 'e_baoxian', name: '保险', icon: 'fa-shield-heart', color: '#26de81', type: 'expense' },
    { id: 'e_baobao', name: '宝宝', icon: 'fa-baby', color: '#ff9ff3', type: 'expense' },
    { id: 'e_fahongbao', name: '发红包', icon: 'fa-gift', color: '#fc5c65', type: 'expense' },
    { id: 'e_fushi', name: '服饰', icon: 'fa-shirt', color: '#ff7a45', type: 'expense' },
    { id: 'e_yiyao', name: '医药', icon: 'fa-briefcase-medical', color: '#e17055', type: 'expense' },
    { id: 'e_housing', name: '住房', icon: 'fa-house', color: '#00b894', type: 'expense' },
    { id: 'e_meifa', name: '美发', icon: 'fa-scissors', color: '#9b59b6', type: 'expense' },
    { id: 'e_kuaidi', name: '快递', icon: 'fa-box', color: '#2d98da', type: 'expense' },
    { id: 'e_zhuangxiu', name: '装修', icon: 'fa-tools', color: '#b33939', type: 'expense' },
    { id: 'e_shoufu', name: '首付', icon: 'fa-building', color: '#84817a', type: 'expense' },
    { id: 'e_fangdai', name: '房贷', icon: 'fa-hand-holding-dollar', color: '#ee5253', type: 'expense' },
    { id: 'e_hunli', name: '婚礼', icon: 'fa-champagne-glasses', color: '#f368e0', type: 'expense' },
];

const DEFAULT_INCOME_CATEGORIES = [
    { id: 'i_ziji', name: '自己', icon: 'fa-user', color: '#00b894', type: 'income' },
    { id: 'i_xinzi', name: '薪资', icon: 'fa-money-bill-wave', color: '#0984e3', type: 'income' },
    { id: 'i_other', name: '其他', icon: 'fa-ellipsis', color: '#636e72', type: 'income' },
    { id: 'i_shouhongbao', name: '收红包', icon: 'fa-envelope-open', color: '#d63031', type: 'income' },
    { id: 'i_cai', name: '采', icon: 'fa-cart-shopping', color: '#feca57', type: 'income' },
    { id: 'i_taoke', name: '淘客', icon: 'fa-tags', color: '#e84393', type: 'income' },
    { id: 'i_zhuan', name: '转', icon: 'fa-right-left', color: '#6c5ce7', type: 'income' },
    { id: 'i_zhuanqian', name: '赚钱', icon: 'fa-coins', color: '#26de81', type: 'income' },
];

// 旧默认分类 → 新分类 的迁移映射（v2）
const CATEGORY_MIGRATION_V2 = {
    e_food: 'e_food', e_transport: 'e_transport', e_shopping: 'e_fushi', e_grocery: 'e_jiayong',
    e_entertain: 'e_entertain', e_housing: 'e_housing', e_medical: 'e_yiyao', e_education: 'e_xuexi',
    e_comm: 'e_comm', e_other: 'e_other',
    i_salary: 'i_xinzi', i_bonus: 'i_zhuanqian', i_invest: 'i_zhuanqian', i_parttime: 'i_zhuanqian',
    i_redpacket: 'i_shouhongbao', i_other: 'i_other',
};

// 资产负债：预设账户（kind 决定计入资产还是负债，group 用于分组统计）
const DEFAULT_ACCOUNTS = [
    { id: 'a_cash',       name: '现金',      kind: 'asset',     group: '流动资金', icon: 'fa-money-bill-wave',      color: '#34c759' , bucket: 'cash' },
    { id: 'a_debit',      name: '储蓄卡',    kind: 'asset',     group: '流动资金', icon: 'fa-building-columns',     color: '#5ac8fa' , bucket: 'cash' },
    { id: 'a_fixed',      name: '定期存款',  kind: 'asset',     group: '储蓄存款', icon: 'fa-vault',                color: '#007aff' , bucket: 'steady' },
    { id: 'a_mmf',        name: '货币基金',  kind: 'asset',     group: '投资理财', icon: 'fa-coins',                color: '#ffcc00' , bucket: 'cash' },
    { id: 'a_stock',      name: '股票基金',  kind: 'asset',     group: '投资理财', icon: 'fa-arrow-trend-up',       color: '#ff9500' , bucket: 'growth' },
    { id: 'a_wealth',     name: '理财产品',  kind: 'asset',     group: '投资理财', icon: 'fa-certificate',          color: '#af52de' , bucket: 'steady' },
    { id: 'a_fund',       name: '公积金',    kind: 'asset',     group: '其他资产', icon: 'fa-house-chimney',        color: '#30b0c7' , bucket: 'growth' },
    { id: 'a_house',      name: '房产',      kind: 'asset',     group: '固定资产', icon: 'fa-house',                color: '#a2845e' , bucket: 'growth' },
    { id: 'a_car',        name: '车辆',      kind: 'asset',     group: '固定资产', icon: 'fa-car-side',             color: '#636e72' , bucket: 'growth' },
    { id: 'a_receivable', name: '应收借款',  kind: 'asset',     group: '其他资产', icon: 'fa-hand-holding-dollar',  color: '#ff2d55' , bucket: 'cash' },
    { id: 'l_credit',     name: '信用卡',    kind: 'liability', group: '消费负债', icon: 'fa-credit-card',          color: '#ff3b30'  },
    { id: 'l_install',    name: '花呗/白条', kind: 'liability', group: '消费负债', icon: 'fa-mobile-screen-button', color: '#ff9500'  },
    { id: 'l_mortgage',   name: '房贷',      kind: 'liability', group: '大额负债', icon: 'fa-house-circle-check',   color: '#5856d6'  },
    { id: 'l_carloan',    name: '车贷',      kind: 'liability', group: '大额负债', icon: 'fa-car-burst',            color: '#f7475a'  },
    { id: 'l_personal',   name: '私人借款',  kind: 'liability', group: '其他负债', icon: 'fa-handshake',            color: '#8e8e93'  },
    { id: 'l_other',      name: '其他负债',  kind: 'liability', group: '其他负债', icon: 'fa-ellipsis',             color: '#aeaeb2'  },
];

// 四笔钱：三个资产桶 + 保险保障清单
const FUND_BUCKETS = [
    { key: 'cash',   name: '活钱管理', color: '#34c759', icon: 'fa-wallet',            hint: '随取随用，一般留 3-6 个月开销' },
    { key: 'steady', name: '稳健理财', color: '#007aff', icon: 'fa-shield-halved',     hint: '低风险、求稳的增值部分' },
    { key: 'growth', name: '长期投资', color: '#ff9500', icon: 'fa-arrow-trend-up',    hint: '拿得住、博长期回报的部分' },
];
const INSURANCE_TYPES = ['社保', '惠民保', '意外险', '医疗险', '重疾险', '财产险', '燃气险', '家庭成员责任险'];
const DEFAULT_INSURANCE_MEMBERS = ['本人'];

const ASSET_GROUPS = ['流动资金', '储蓄存款', '投资理财', '固定资产', '其他资产'];
const LIABILITY_GROUPS = ['消费负债', '大额负债', '其他负债'];
const ACCOUNT_ICON_CHOICES = ['fa-wallet', 'fa-building-columns', 'fa-vault', 'fa-coins', 'fa-arrow-trend-up',
    'fa-certificate', 'fa-house', 'fa-car-side', 'fa-hand-holding-dollar', 'fa-credit-card',
    'fa-mobile-screen-button', 'fa-handshake', 'fa-gem', 'fa-landmark', 'fa-briefcase', 'fa-ellipsis'];

const DEFAULT_PAYMENT_METHODS = ['微信支付', '支付宝', '现金', '银行卡', '信用卡', '其他'];

const ICON_OPTIONS = [
    'fa-utensils', 'fa-car', 'fa-bag-shopping', 'fa-basket-shopping',
    'fa-gamepad', 'fa-house', 'fa-briefcase-medical', 'fa-graduation-cap',
    'fa-mobile-screen', 'fa-ellipsis', 'fa-money-bill-wave', 'fa-gift',
    'fa-chart-line', 'fa-laptop', 'fa-red-envelope', 'fa-plane',
    'fa-film', 'fa-mug-hot', 'fa-shirt', 'fa-dumbbell',
    'fa-paw', 'fa-baby', 'fa-tools', 'fa-credit-card',
    'fa-bus', 'fa-train', 'fa-taxi', 'fa-bicycle',
];

const COLOR_OPTIONS = [
    '#ff6b6b', '#4ecdc4', '#ff9ff3', '#feca57', '#a29bfe',
    '#fd79a8', '#e17055', '#6c5ce7', '#00cec9', '#636e72',
    '#00b894', '#0984e3', '#e84393', '#d63031', '#fdcb6e',
    '#55a3ff', '#ff7a45', '#9b59b6', '#26de81', '#fc5c65',
];

// ---- State ----
let state = {
    transactions: [],
    categories: [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES],
    budgets: [],
    paymentMethods: [...DEFAULT_PAYMENT_METHODS],
    accounts: DEFAULT_ACCOUNTS.map(a => ({ ...a })),
    balances: [],
    returns: [],               // 投资收益：{id, member, accountId, month, amount}
    returnPeriod: 'month',
    returnYear: null,
    returnMonth: null,
    returnChartType: 'bar',
    returnGran: null,
    balancePeriod: 'month',
    balanceYear: null,
    balanceMonth: null,
    balanceMetric: 'asset',
    balanceChartType: 'line',
    balanceGran: null,
    settings: { currency: '¥', theme: 'light', defaultPaymentMethod: '微信支付', defaultView: 'transactions', autoOpenAdd: false },
    currentView: 'transactions',
    transactionFilter: 'all',
    searchQuery: '',
    monthFilter: '',
    reportPeriod: 'month',
    reportYear: null,
    reportMonth: null,
    deleted: { transactions: [], categories: [], budgets: [], paymentMethods: [], accounts: [], balances: [], returns: [], members: [], insuranceMembers: [], insurance: [] },  // soft-delete markers
    pmAddedAt: {},          // payment method name -> when it was added (names are the identity)
    lastExportAt: 0,        // 最近一次导出的时间戳，用于备份提醒
    fundTargets: { cash: 0, steady: 0, growth: 0 },
    insuranceMembers: [...DEFAULT_INSURANCE_MEMBERS],
    insuranceMemberAddedAt: {},  // 保险成员名 -> 添加时间（名字即身份，同家庭成员）
    insurancePolicies: [],   // {id, type, member, covered, amount, premium, createdAt, updatedAt}
    balanceMembers: ['本人'],   // 家庭资产负债表的成员名单
    memberAddedAt: {},        // 成员名 -> 添加时间（名字就是身份，同支付方式的做法）
    balanceOwner: 'all',       // 当前筛选：'all' 或某成员
    reportMetric: 'expense',
    breakdownExpanded: false,
    reportChartType: 'line',
    reportGranularity: null,
    editingTransactionId: null,
    editingCategoryId: null,
    selectedTransactionType: 'expense',
    selectedCategoryType: 'expense',
    selectedCategoryId: null,
    selectedIcon: 'fa-utensils',
    selectedColor: '#ff6b6b',
};

let charts = {};

// ---- Storage ----
const STORAGE_KEY = 'bookkeeping_app_data';

// 每台安装一个唯一 id：iCloud 同步用它区分「我自己写的」和「别的设备写的」。
// 之前用 deviceName === 'Mac' 判断，两台 Mac 会互相把对方的改动当成自己的而丢掉。
const DEVICE_ID = (function () {
    const KEY = STORAGE_KEY + '_device_id';
    try {
        let v = localStorage.getItem(KEY);
        if (!v) { v = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8); localStorage.setItem(KEY, v); }
        return v;
    } catch (e) { return 'dev_transient'; }
})();

// 节流写入：连续改动只在约 400ms 内落盘一次，避免每记一笔都把整本账重新序列化。
// 关页面 / 切后台时强制补写，保证不丢。
let __saveTimer = null;

// 合并远端数据后若本地内容其实没变，就只落盘、不回推 iCloud。
// 否则两台设备会互相触发对方的「远端有更新」，无限来回写。
let __suppressSyncSchedule = false;

function saveState() {
    if (__saveTimer) return;                       // 已排队，等这次窗口结束统一写
    __saveTimer = setTimeout(() => { __saveTimer = null; saveStateNow(); }, 400);
}

function flushState() {
    if (__saveTimer) { clearTimeout(__saveTimer); __saveTimer = null; }
    saveStateNow();
}

// 保存一份生成的文件。桌面版 WKWebView 不认 <a download> 那套（点了没反应），
// 必须交给原生「存储」面板；浏览器里仍用 object URL 下载。
// 返回 true 表示用户取消了保存。
function saveGeneratedFile(blob, filename) {
    if (isElectron() && window.electronAPI && typeof window.electronAPI.saveFile === 'function') {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = String(reader.result).split(',')[1] || '';
                window.electronAPI.saveFile({ name: filename, base64 })
                    .then(saved => resolve(saved === 'cancelled'))
                    .catch(() => { showToast('保存失败', 'error'); resolve(true); });
            };
            reader.onerror = () => { showToast('读取数据失败', 'error'); resolve(true); };
            reader.readAsDataURL(blob);
        });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return Promise.resolve(false);
}

function saveStateNow() {
    const data = {
        transactions: state.transactions,
        categories: state.categories,
        budgets: state.budgets,
        paymentMethods: state.paymentMethods,
        accounts: state.accounts,
        balances: state.balances,
        returns: state.returns,
        fundTargets: state.fundTargets,
        insuranceMembers: state.insuranceMembers,
        insuranceMemberAddedAt: state.insuranceMemberAddedAt,
        insurancePolicies: state.insurancePolicies,
        balanceMembers: state.balanceMembers,
        memberAddedAt: state.memberAddedAt,
        settings: state.settings,
        categoryVersion: state.categoryVersion || 2,
        deleted: state.deleted,
        pmAddedAt: state.pmAddedAt,
        lastExportAt: state.lastExportAt,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // Trigger iCloud sync (debounced)
    if (!__suppressSyncSchedule) {
        scheduleICloudSync();
        scheduleRemoteSync();
    }
}

// ---- Modal stacking ----
// Every overlay used to sit at z-index 1000, so a modal opened from inside another
// modal (报表分析 → 分类明细 → 点某笔记录) ended up painted *behind* its parent.
// Each open now takes the next slot in the stack.
let overlayZ = 1000;

function raiseOverlay(id) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (!el) return;
    overlayZ += 10;
    el.style.zIndex = String(overlayZ);
}

function topmostOverlay() {
    let best = null, bestZ = -1;
    document.querySelectorAll('.modal-overlay, .action-sheet-overlay').forEach(el => {
        if (el.classList.contains('hidden')) return;
        const z = parseInt(getComputedStyle(el).zIndex, 10) || 0;
        if (z > bestZ) { bestZ = z; best = el; }
    });
    return best;
}

function closeTopmostOverlay() {
    const top = topmostOverlay();
    if (!top) return;
    if (top.id === 'categoryTxnModal') closeCategoryTxnModal();
    else if (top.id === 'accountHistoryModal') closeAccountHistoryModal();
    else top.classList.add('hidden');
}

// ---- Soft delete (tombstones) ----
// Deleting a record keeps a marker behind so the removal can travel to other
// devices: a plain union merge could only ever add rows, never remove them.
const TOMBSTONE_TTL_DAYS = 30;

function normalizeTombstones(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const clean = list => Array.isArray(list)
        ? list.filter(x => x && x.id && x.deletedAt).map(x => ({ id: String(x.id), deletedAt: Number(x.deletedAt) }))
        : [];
    return {
        transactions: clean(src.transactions),
        categories: clean(src.categories),
        budgets: clean(src.budgets),
        paymentMethods: clean(src.paymentMethods),
        accounts: clean(src.accounts),
        balances: clean(src.balances),
        returns: clean(src.returns),
        members: clean(src.members),
        insuranceMembers: clean(src.insuranceMembers),
        insurance: clean(src.insurance),
    };
}

function normalizeAddedAtMap(raw) {
    const out = {};
    if (raw && typeof raw === 'object') {
        Object.keys(raw).forEach(k => {
            const v = Number(raw[k]);
            if (k && v > 0) out[k] = v;
        });
    }
    return out;
}

function addTombstone(kind, id) {
    const list = state.deleted[kind];
    const existing = list.find(x => x.id === id);
    if (existing) existing.deletedAt = Date.now();
    else list.push({ id, deletedAt: Date.now() });
}

// Drop markers older than the retention window so the lists cannot grow forever.
function pruneTombstones() {
    const cutoff = Date.now() - TOMBSTONE_TTL_DAYS * 86400000;
    Object.keys(state.deleted).forEach(k => {
        state.deleted[k] = state.deleted[k].filter(x => x.deletedAt > cutoff);
    });
}

// Hide any live row a newer marker covers. A row edited after the deletion wins
// (last write wins), which is what lets an intentional re-add resurrect a record.
function applyTombstones() {
    const drop = (list, marks) => {
        if (!Array.isArray(list)) return list || [];
        if (!marks || !marks.length) return list;
        const byId = new Map(marks.map(m => [m.id, m.deletedAt]));
        return list.filter(item => {
            const at = byId.get(item.id);
            if (at === undefined) return true;
            return (item.updatedAt || item.createdAt || 0) > at;
        });
    };
    state.transactions = drop(state.transactions, state.deleted.transactions);
    state.categories = drop(state.categories, state.deleted.categories);
    state.budgets = drop(state.budgets, state.deleted.budgets);
    state.accounts = drop(state.accounts, state.deleted.accounts);
    state.balances = drop(state.balances, state.deleted.balances);
    state.returns = drop(state.returns, state.deleted.returns);
    state.insurancePolicies = drop(state.insurancePolicies, state.deleted.insurance);

    // 成员名单也是「名字即身份」的纯字符串，所以「什么时候加的」记在 memberAddedAt，
    // 删除标记按名字裁决：删得比加得晚就消失（和支付方式同一套逻辑）。
    const memMarks = new Map(state.deleted.members.map(m => [m.id, m.deletedAt]));
    if (memMarks.size) {
        const keptMembers = state.balanceMembers.filter(name => {
            const at = memMarks.get(name);
            if (at === undefined) return true;
            return (state.memberAddedAt[name] || 0) > at;
        });
        if (keptMembers.length > 0) state.balanceMembers = keptMembers;
    }

    // 保险成员：同家庭成员，按墓碑 vs 添加时间裁决，至少保留一个
    const insMarks = new Map(state.deleted.insuranceMembers.map(m => [m.id, m.deletedAt]));
    if (insMarks.size) {
        const keptIns = state.insuranceMembers.filter(name => {
            const at = insMarks.get(name);
            if (at === undefined) return true;
            return (state.insuranceMemberAddedAt[name] || 0) > at;
        });
        if (keptIns.length > 0) state.insuranceMembers = keptIns;
    }

    // Payment methods are plain strings with no per-row timestamp, so "when was
    // this added" lives in pmAddedAt. Unknown age counts as 0, i.e. a deletion
    // always wins unless the method was demonstrably re-added afterwards.
    const pmMarks = new Map(state.deleted.paymentMethods.map(m => [m.id, m.deletedAt]));
    if (pmMarks.size) {
        const kept = state.paymentMethods.filter(name => {
            const at = pmMarks.get(name);
            if (at === undefined) return true;
            return (state.pmAddedAt[name] || 0) > at;
        });
        // never leave the user without a payment method
        if (kept.length > 0) state.paymentMethods = kept;
    }
}

function mergeTombstoneList(local, remote) {
    const map = new Map((local || []).map(m => [m.id, m]));
    (remote || []).forEach(m => {
        if (!m || !m.id || !m.deletedAt) return;
        const cur = map.get(m.id);
        if (!cur || m.deletedAt > cur.deletedAt) map.set(m.id, m);
    });
    return Array.from(map.values());
}

// ---- iCloud Sync ----
let iCloudSyncTimer = null;
let iCloudSyncEnabled = false;
let iCloudLastSyncTime = null;

function isElectron() {
    return typeof window.electronAPI !== 'undefined' && window.electronAPI.isElectron;
}

function scheduleICloudSync() {
    if (!iCloudSyncEnabled) return;
    if (iCloudSyncTimer) clearTimeout(iCloudSyncTimer);
    iCloudSyncTimer = setTimeout(() => {
        syncToICloud();
    }, 3000);
}

async function initICloudSync() {
    if (!isElectron()) {
        // PWA mode - show manual import/export UI
        updateICloudSyncUI();
        return;
    }

    try {
        const available = await window.electronAPI.icloud.isAvailable();
        if (!available) {
            iCloudSyncEnabled = false;
            updateICloudSyncUI();
            return;
        }

        iCloudSyncEnabled = true;

        // Listen for file changes from other devices
        window.electronAPI.icloud.onFileChange((data) => {
            handleICloudFileChange(data);
        });

        // On startup, pull from iCloud and merge
        const remoteData = await window.electronAPI.icloud.readData();
        if (remoteData && remoteData.data) {
            mergeRemoteData(remoteData);
        }

        // Push current data to iCloud
        await syncToICloud();
        updateICloudSyncUI();
    } catch (e) {
        console.error('iCloud sync init error:', e);
    }
}

// 同步文档的统一结构：iCloud 通道和云同步通道共用，避免两边字段漂移
function buildSyncPayload() {
    return {
        version: 1,
        lastModified: Date.now(),
        deviceName: isElectron() ? ('Mac-' + DEVICE_ID.slice(-4)) : 'iPhone',
        deviceId: DEVICE_ID,
        data: {
            transactions: state.transactions,
            categories: state.categories,
            budgets: state.budgets,
            paymentMethods: state.paymentMethods,
            accounts: state.accounts,
            balances: state.balances,
            returns: state.returns,
            balanceMembers: state.balanceMembers,
            memberAddedAt: state.memberAddedAt,
            fundTargets: state.fundTargets,
            insuranceMembers: state.insuranceMembers,
            insuranceMemberAddedAt: state.insuranceMemberAddedAt,
            insurancePolicies: state.insurancePolicies,
            settings: state.settings,
            deleted: state.deleted,
            pmAddedAt: state.pmAddedAt,
        },
    };
}

async function syncToICloud() {
    if (!iCloudSyncEnabled || !isElectron()) return;

    try {
        await window.electronAPI.icloud.writeData(buildSyncPayload());
        iCloudLastSyncTime = Date.now();
        updateICloudSyncUI();
    } catch (e) {
        console.error('iCloud sync error:', e);
    }
}

function handleICloudFileChange(remoteData) {
    if (!remoteData || !remoteData.data) return;
    // 只忽略「我自己刚写回去的那份」，别的设备（包括另一台 Mac）都要合并
    if (remoteData.deviceId && remoteData.deviceId === DEVICE_ID) return;
    if (!remoteData.deviceId && remoteData.deviceName === 'Mac' && isElectron()) return;

    const changed = mergeRemoteData(remoteData);
    if (!changed) return;                 // 对端只是回写了一份和这里相同的内容
    renderView(state.currentView);
    showToast('已从 iCloud 同步最新数据', 'success');
}

// 内容指纹：只看每行的 id + 时间戳，忽略数组顺序（合并会重建数组，顺序变化不算改动）。
// 用于判断「这次合并到底改没改东西」，没改就不回推 iCloud。
function syncFingerprint() {
    const sig = list => (Array.isArray(list) ? list : [])
        .map(x => `${x.id !== undefined ? x.id : ''}:${x.updatedAt !== undefined ? x.updatedAt : (x.deletedAt || '')}`)
        .sort().join(',');
    const d = state.deleted || {};
    return [
        sig(state.transactions), sig(state.categories), sig(state.budgets),
        sig(state.accounts), sig(state.balances), sig(state.returns),
        sig(state.insurancePolicies),
        (state.paymentMethods || []).slice().sort().join(','),
        (state.balanceMembers || []).slice().sort().join(','),
        (state.insuranceMembers || []).slice().sort().join(','),
        JSON.stringify(state.fundTargets || {}),
        sig(d.transactions), sig(d.balances), sig(d.returns), sig(d.accounts), sig(d.insurance),
    ].join('|');
}

function mergeRemoteData(remoteData) {
    const remote = remoteData.data;
    if (!remote) return false;
    const fingerprintBefore = syncFingerprint();

    // Merge transactions: union by ID, keep latest
    const txnMap = new Map();
    state.transactions.forEach(t => txnMap.set(t.id, t));
    (remote.transactions || []).forEach(t => {
        const existing = txnMap.get(t.id);
        if (!existing) {
            txnMap.set(t.id, t);
        } else {
            const localTime = existing.updatedAt || existing.createdAt || 0;
            const remoteTime = t.updatedAt || t.createdAt || 0;
            if (remoteTime > localTime) {
                txnMap.set(t.id, t);
            }
        }
    });

    // Merge categories: union by ID
    const catMap = new Map();
    state.categories.forEach(c => catMap.set(c.id, c));
    (remote.categories || []).forEach(c => catMap.set(c.id, c));

    // Merge budgets: union by categoryId
    const budMap = new Map();
    state.budgets.forEach(b => budMap.set(b.categoryId, b));
    (remote.budgets || []).forEach(b => budMap.set(b.categoryId, b));

    // Merge accounts: union by ID, newer definition wins
    const accMap = new Map();
    state.accounts.forEach(a => accMap.set(a.id, a));
    (remote.accounts || []).forEach(a => {
        const cur = accMap.get(a.id);
        if (!cur || (a.updatedAt || 0) > (cur.updatedAt || 0)) accMap.set(a.id, a);
    });

    // Merge balance snapshots: id is accountId + month, so re-recording a month updates in place
    const balMap = new Map();
    state.balances.forEach(b => balMap.set(b.id, b));
    (remote.balances || []).forEach(b => {
        const cur = balMap.get(b.id);
        if (!cur || (b.updatedAt || 0) > (cur.updatedAt || 0)) balMap.set(b.id, b);
    });

    // Merge investment returns: id is member + accountId + month
    const retMap = new Map();
    state.returns.forEach(r => retMap.set(r.id, r));
    (remote.returns || []).forEach(r => {
        const cur = retMap.get(r.id);
        if (!cur || (r.updatedAt || 0) > (cur.updatedAt || 0)) retMap.set(r.id, r);
    });

    // Merge payment methods: union by name, remember when each was added
    const pmSet = new Set(state.paymentMethods);
    (remote.paymentMethods || []).forEach(p => pmSet.add(p));
    state.paymentMethods = Array.from(pmSet);
    const remoteAddedAt = normalizeAddedAtMap(remoteData.data.pmAddedAt);
    Object.keys(remoteAddedAt).forEach(k => {
        if (!state.pmAddedAt[k] || remoteAddedAt[k] > state.pmAddedAt[k]) state.pmAddedAt[k] = remoteAddedAt[k];
    });

    // Merge the soft-delete markers, then let them hide any row they cover
    const remoteDeleted = normalizeTombstones(remoteData.data.deleted);
    state.deleted = {
        transactions: mergeTombstoneList(state.deleted.transactions, remoteDeleted.transactions),
        categories: mergeTombstoneList(state.deleted.categories, remoteDeleted.categories),
        budgets: mergeTombstoneList(state.deleted.budgets, remoteDeleted.budgets),
        paymentMethods: mergeTombstoneList(state.deleted.paymentMethods, remoteDeleted.paymentMethods),
        accounts: mergeTombstoneList(state.deleted.accounts, remoteDeleted.accounts),
        balances: mergeTombstoneList(state.deleted.balances, remoteDeleted.balances),
        returns: mergeTombstoneList(state.deleted.returns, remoteDeleted.returns),
        members: mergeTombstoneList(state.deleted.members, remoteDeleted.members),
        insuranceMembers: mergeTombstoneList(state.deleted.insuranceMembers, remoteDeleted.insuranceMembers),
        insurance: mergeTombstoneList(state.deleted.insurance, remoteDeleted.insurance),
    };

    // 保险清单：按 id 取并集，较新的赢；成员取并集；目标金额取较新的一份
    const polMap = new Map();
    state.insurancePolicies.forEach(p => polMap.set(p.id, p));
    (remote.insurancePolicies || []).forEach(p => {
        const cur = polMap.get(p.id);
        if (!cur || (p.updatedAt || 0) > (cur.updatedAt || 0)) polMap.set(p.id, p);
    });
    state.insurancePolicies = Array.from(polMap.values());
    state.insuranceMembers = [...new Set([...(state.insuranceMembers || []), ...(remote.insuranceMembers || [])])];
    const remoteInsAdded = normalizeAddedAtMap(remote.insuranceMemberAddedAt);
    Object.keys(remoteInsAdded).forEach(k => {
        if (!state.insuranceMemberAddedAt[k] || remoteInsAdded[k] > state.insuranceMemberAddedAt[k]) state.insuranceMemberAddedAt[k] = remoteInsAdded[k];
    });
    // 家庭成员名单：并集（余额/收益记录的 id 编码了成员名，名单丢了记录就悬空）
    state.balanceMembers = [...new Set([...(state.balanceMembers || []), ...(remote.balanceMembers || [])])];
    const remoteMemAdded = normalizeAddedAtMap(remote.memberAddedAt);
    Object.keys(remoteMemAdded).forEach(k => {
        if (!state.memberAddedAt[k] || remoteMemAdded[k] > state.memberAddedAt[k]) state.memberAddedAt[k] = remoteMemAdded[k];
    });
    if ((remoteData.lastModified || 0) >= (iCloudLastSyncTime || 0) && remote.fundTargets) {
        state.fundTargets = { ...state.fundTargets, ...remote.fundTargets };
    }

    state.transactions = Array.from(txnMap.values());
    state.categories = Array.from(catMap.values());
    state.budgets = Array.from(budMap.values());
    state.accounts = Array.from(accMap.values());
    state.balances = Array.from(balMap.values());
    state.returns = Array.from(retMap.values());
    pruneTombstones();
    applyTombstones();
    ensureAccountOrder();   // 云端旧副本没有 order 字段，合并后要补齐

    // Settings: prefer remote if newer
    if (remoteData.lastModified > (iCloudLastSyncTime || 0)) {
        state.settings = { ...state.settings, ...remote.settings };
        document.documentElement.setAttribute('data-theme', state.settings.theme);
    }

    const changed = syncFingerprint() !== fingerprintBefore;
    if (changed) {
        saveState();                       // persist + schedule a push of our own
    } else {
        // 内容没变：只落本地，不回推，避免两台设备互相触发、无限写。
        __suppressSyncSchedule = true;
        saveStateNow();
        __suppressSyncSchedule = false;
    }
    iCloudLastSyncTime = Date.now();
    updateICloudSyncUI();
    return changed;
}

// PWA: Export to iCloud (download JSON)
// 导出一份完整的账本备份（JSON）。桌面版走原生存储面板。
// filename 决定落盘名字：iCloud 通道必须用 Mac 端读取的那个固定名字。
const ICLOUD_SYNC_FILENAME = 'bookkeeping-sync.json';

function exportSyncJSON(filename, toastText) {
    const syncData = buildSyncPayload();
    syncData.deviceName = isElectron() ? 'Mac-backup' : 'browser-backup';
    const blob = new Blob([JSON.stringify(syncData, null, 2)], { type: 'application/json' });
    const stamp = new Date().toISOString().slice(0, 10);
    const name = filename || `记账本-备份-${stamp}.json`;
    return saveGeneratedFile(blob, name).then(cancelled => {
        if (cancelled) return false;
        iCloudLastSyncTime = Date.now();
        updateICloudSyncUI();
        markExported();
        showToast(toastText || '已导出 JSON 备份', 'success');
        return true;
    });
}

// 存到 iCloud Drive 的「记账本」文件夹时请用这个名字，Mac 端按它读取
function exportToICloud() {
    return exportSyncJSON(ICLOUD_SYNC_FILENAME, '已导出，请存入 iCloud 的「记账本」文件夹');
}

// 把一份 JSON 备份合并进当前账本
function applyImportedJSON(text) {
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { showToast('导入失败：不是有效的 JSON', 'error'); return false; }
    if (!parsed || !parsed.data) { showToast('导入失败：文件里没有账本数据', 'error'); return false; }
    mergeRemoteData(parsed);
    applyTheme(state.settings.theme);
    renderView(state.currentView);
    updateSidebarSummary();
    showToast('已导入并合并 JSON 备份', 'success');
    return true;
}

async function importJsonFile() {
    const picked = await pickLocalFile(['json']);
    if (!picked) return;
    applyImportedJSON(base64ToText(picked.base64));
}

// PWA: Import from iCloud (file input)
// 旧入口：隐藏 input 的 onchange 仍可用
function importFromICloud(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { applyImportedJSON(String(e.target.result)); event.target.value = ''; };
    reader.onerror = () => { showToast('读取文件失败', 'error'); event.target.value = ''; };
    reader.readAsText(file);
}

function updateICloudSyncUI() {
    const container = document.getElementById('icloudSyncSection');
    if (!container) return;

    if (isElectron()) {
        if (iCloudSyncEnabled) {
            const timeStr = iCloudLastSyncTime
                ? new Date(iCloudLastSyncTime).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                : '尚未同步';
            container.innerHTML = `
                <div class="icloud-status">
                    <div class="icloud-status-row">
                        <span class="icloud-status-dot active"></span>
                        <span class="icloud-status-text">iCloud 自动同步已启用</span>
                    </div>
                    <div class="icloud-status-info">上次同步: ${timeStr}</div>
                    <button class="secondary-btn" onclick="syncFromICloudNow()">
                        <i class="fa-solid fa-rotate"></i> 立即同步
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="icloud-status">
                    <div class="icloud-status-row">
                        <span class="icloud-status-dot inactive"></span>
                        <span class="icloud-status-text">iCloud Drive 不可用</span>
                    </div>
                    <div class="icloud-status-info">请在系统设置中开启 iCloud Drive</div>
                </div>
            `;
        }
    } else {
        const timeStr = iCloudLastSyncTime
            ? new Date(iCloudLastSyncTime).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
            : '尚未同步';
        container.innerHTML = `
            <div class="icloud-status">
                <div class="settings-row">
                    <div class="settings-label">从 iCloud 导入<div class="settings-sublabel">选择之前导出的同步文件</div></div>
                    <button class="secondary-btn" onclick="importJsonFile()">
                        <i class="fa-solid fa-cloud-arrow-down"></i> 导入
                    </button>
                </div>
                <div class="settings-row">
                    <div class="settings-label">导出到 iCloud<div class="settings-sublabel">存到 iCloud Drive 的「记账本」文件夹，文件名 ${ICLOUD_SYNC_FILENAME}，Mac 端会自动读到</div></div>
                    <button class="secondary-btn" onclick="exportToICloud()">
                        <i class="fa-solid fa-cloud-arrow-up"></i> 导出
                    </button>
                </div>
                <div class="icloud-hint">
                    <i class="fa-solid fa-circle-info"></i>
                    Mac 端自动同步，手机端点「导入」即可获取 Mac 最新数据
                </div>
                <div class="icloud-status-info">上次操作: ${timeStr}</div>
            </div>
        `;
    }
}

async function syncFromICloudNow() {
    if (!isElectron() || !iCloudSyncEnabled) return;
    try {
        const remoteData = await window.electronAPI.icloud.readData();
        if (remoteData && remoteData.data) {
            mergeRemoteData(remoteData);
            renderView(state.currentView);
            showToast('已从 iCloud 同步最新数据', 'success');
        } else {
            showToast('iCloud 中暂无同步数据', 'info');
        }
    } catch (e) {
        showToast('同步失败', 'error');
    }
}

// ==================== 云同步（私密 GitHub Gist）====================
// iPhone 上的 PWA 读不到 iCloud Drive，所以跨平台走一个「设备都拿得到」的中转：
// 一个私密 Gist 存同一份账本 JSON。iPhone / Mac / 浏览器都直接和 api.github.com
// 通信（它开了 CORS），不需要自建服务器；token 只存在各设备本地，不进同步内容。

const GIST_API = 'https://api.github.com';
const GIST_FILENAME = 'bookkeeping-sync.json';
const REMOTE_SYNC_KEY = 'bookkeeping_remote_sync';
const REMOTE_POLL_MS = 60000;
const GIST_SIZE_LIMIT = 900 * 1024;          // GitHub 单文件上限约 1MB，留余量

let remoteSyncCfg = { enabled: false, token: '', gistId: '', lastSyncAt: 0 };
let __remotePushTimer = null;
let __remotePollTimer = null;
let __remoteVisibilityHooked = false;
let __remoteBusy = false;
let __lastPushedFingerprint = null;
let __remoteLastError = '';

function loadRemoteSyncConfig() {
    try {
        const raw = localStorage.getItem(REMOTE_SYNC_KEY);
        if (raw) remoteSyncCfg = Object.assign(remoteSyncCfg, JSON.parse(raw));
    } catch (e) { /* 首次或损坏，用默认值 */ }
    if (typeof remoteSyncCfg.enabled !== 'boolean') remoteSyncCfg.enabled = false;
}

function saveRemoteSyncConfig() {
    try { localStorage.setItem(REMOTE_SYNC_KEY, JSON.stringify(remoteSyncCfg)); } catch (e) {}
}

function remoteSyncReady() {
    return !!(remoteSyncCfg.enabled && remoteSyncCfg.token && remoteSyncCfg.gistId);
}

function remoteErrorText(status) {
    if (status === 401) return 'Token 无效或已过期，请重新填写';
    if (status === 403) return '被 GitHub 拒绝（多为访问频率超限，或 token 缺少 gist 权限）';
    if (status === 404) return '找不到该同步库：Gist ID 不对，或 token 没有 gist 读取权限';
    return '请求失败（HTTP ' + status + '）';
}

async function gistApi(path, method, body) {
    const init = {
        method: method || 'GET',
        cache: 'no-store',
        headers: {
            'Authorization': 'Bearer ' + remoteSyncCfg.token,
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'bookkeeping-app',
        },
    };
    if (body !== undefined) {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
    }
    try {
        const res = await fetch(GIST_API + path, init);
        const scopes = res.headers.get('x-oauth-scopes');
        if (res.status === 204) return { status: 204, body: null, scopes };
        const json = await res.json().catch(() => null);
        return { status: res.status, body: json, scopes };
    } catch (e) {
        return { status: 0, body: null, networkError: true };
    }
}

// 校验 token 是否可用。注意：只缺 gist 权限的 classic token 访问 /gists 依然返回
// 200 + 空列表，光看状态码会误判成功，所以必须看 X-OAuth-Scopes。
async function remoteValidateToken() {
    const r = await gistApi('/gists?per_page=1');
    if (r.networkError) { __remoteLastError = '网络不通，检查是否能访问 api.github.com'; return false; }
    if (r.status === 401 || r.status === 403) { __remoteLastError = remoteErrorText(r.status); return false; }
    if (r.status !== 200) { __remoteLastError = remoteErrorText(r.status); return false; }
    if (typeof r.scopes === 'string' && r.scopes && !/(^|,)\s*gist\s*(,|$)/i.test(r.scopes)) {
        __remoteLastError = '这个 Token 没有 gist 权限（现有权限：' + r.scopes + '）。请在 GitHub 上新建一个只勾选 gist 的 Token';
        return false;
    }
    __remoteLastError = '';
    return true;
}

// 一键新建私密 Gist 作为同步库
async function remoteCreateGist() {
    if (!remoteSyncCfg.token) { showToast('请先填写 Token', 'error'); return false; }
    const r = await gistApi('/gists', 'POST', {
        description: '记账本云同步（自动生成，请勿手动编辑）',
        public: false,
        files: { [GIST_FILENAME]: { content: JSON.stringify(buildSyncPayload()) } },
    });
    if ((r.status === 201 || r.status === 200) && r.body && r.body.id) {
        remoteSyncCfg.gistId = r.body.id;
        remoteSyncCfg.enabled = true;
        remoteSyncCfg.lastSyncAt = Date.now();
        __lastPushedFingerprint = syncFingerprint();
        saveRemoteSyncConfig();
        updateRemoteSyncUI();
        showToast('同步库已创建', 'success');
        return true;
    }
    __remoteLastError = remoteErrorText(r.status);
    updateRemoteSyncUI();
    showToast(__remoteLastError, 'error');
    return false;
}

function gistLedgerFile(gist) {
    const files = (gist && gist.files) || {};
    if (files[GIST_FILENAME]) return files[GIST_FILENAME];
    const first = Object.keys(files)[0];
    return first ? files[first] : null;
}

async function remotePullAndMerge() {
    const r = await gistApi('/gists/' + encodeURIComponent(remoteSyncCfg.gistId));
    if (r.networkError) { __remoteLastError = '网络不通'; return false; }
    if (r.status !== 200) { __remoteLastError = remoteErrorText(r.status); return false; }
    __remoteLastError = '';
    const file = gistLedgerFile(r.body);
    if (!file || !file.content) return false;            // 空库，稍后把本地推上去
    let remoteData = null;
    try { remoteData = JSON.parse(file.content); } catch (e) { __remoteLastError = '云端内容不是有效 JSON'; return false; }
    if (!remoteData || !remoteData.data) return false;
    const changed = mergeRemoteData(remoteData);
    if (changed) {
        renderView(state.currentView);
        updateSidebarSummary();
    }
    __lastPushedFingerprint = syncFingerprint();          // 拉下来的状态即视为已同步基线
    return true;
}

async function remotePush() {
    const payload = buildSyncPayload();
    const text = JSON.stringify(payload);
    if (text.length > GIST_SIZE_LIMIT) {
        __remoteLastError = '账本太大（超过 ' + Math.round(GIST_SIZE_LIMIT / 1024) + 'KB），Gist 放不下，请先清理或导出备份';
        return false;
    }
    const r = await gistApi('/gists/' + encodeURIComponent(remoteSyncCfg.gistId), 'PATCH', {
        files: { [GIST_FILENAME]: { content: text } },
    });
    if (r.networkError) { __remoteLastError = '网络不通'; return false; }
    if (r.status !== 200) { __remoteLastError = remoteErrorText(r.status); return false; }
    __remoteLastError = '';
    __lastPushedFingerprint = syncFingerprint();
    remoteSyncCfg.lastSyncAt = Date.now();
    saveRemoteSyncConfig();
    return true;
}

// 一次完整同步：先拉后推。串行加锁，避免定时器叠起来。
async function remoteSyncCycle(reason) {
    if (!remoteSyncReady() || __remoteBusy) return false;
    __remoteBusy = true;
    try {
        const pulled = await remotePullAndMerge();
        if (!pulled && __remoteLastError) return false;
        const ok = await remotePush();
        if (ok && reason === 'manual') showToast('已同步到云端', 'success');
        return ok;
    } finally {
        __remoteBusy = false;
        updateRemoteSyncUI();
    }
}

// 本地数据有改动后延迟推送（复用 saveState 的调用点）
function scheduleRemoteSync() {
    if (!remoteSyncReady()) return;
    if (__remotePushTimer) clearTimeout(__remotePushTimer);
    __remotePushTimer = setTimeout(() => {
        __remotePushTimer = null;
        if (syncFingerprint() === __lastPushedFingerprint) return;   // 内容没变就别白传一次
        remoteSyncCycle('auto');
    }, 6000);
}

function startRemotePolling() {
    if (__remotePollTimer) clearInterval(__remotePollTimer);
    __remotePollTimer = setInterval(() => {
        if (!remoteSyncReady()) return;
        if (document.visibilityState && document.visibilityState !== 'visible') return;  // 后台不打扰
        remoteSyncCycle('poll');
    }, REMOTE_POLL_MS);

    if (!__remoteVisibilityHooked) {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && remoteSyncReady()) remoteSyncCycle('foreground');
        });
        __remoteVisibilityHooked = true;
    }
}

async function remoteManualSync() {
    if (!remoteSyncReady()) { showToast('请先开启云同步并填好 Token / 同步库', 'error'); return; }
    showToast('正在同步…', 'info');
    await remoteSyncCycle('manual');
}

async function remoteToggleEnabled(on) {
    remoteSyncCfg.enabled = !!on;
    saveRemoteSyncConfig();
    if (on && remoteSyncCfg.token && !remoteSyncCfg.gistId) {
        const ok = await remoteValidateToken();
        if (!ok) showToast(__remoteLastError, 'error');
    }
    if (on) remoteSyncCycle('enable');
    updateRemoteSyncUI();
}

function remoteSaveToken(value) {
    remoteSyncCfg.token = (value || '').trim();
    saveRemoteSyncConfig();
    updateRemoteSyncUI();
}

function remoteSaveGistId(value) {
    // 允许直接粘 Gist 链接，自动抽出 id
    const m = (value || '').trim().match(/([0-9a-f]{20,})/i);
    remoteSyncCfg.gistId = m ? m[1] : (value || '').trim();
    saveRemoteSyncConfig();
    updateRemoteSyncUI();
}

async function remoteTestConnection() {
    showToast('正在校验…', 'info');
    const ok = await remoteValidateToken();
    if (ok) {
        if (!remoteSyncCfg.gistId) {
            showToast('Token 可用，点「新建同步库」即可开始', 'success');
        } else {
            const done = await remoteSyncCycle('manual');
            showToast(done ? '连接正常，已同步' : (__remoteLastError || '同步未完成'), done ? 'success' : 'error');
        }
    } else {
        showToast(__remoteLastError || 'Token 校验失败', 'error');
    }
    updateRemoteSyncUI();
}

function updateRemoteSyncUI() {
    const box = document.getElementById('remoteSyncSection');
    if (!box) return;
    const esc = (s) => String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const on = !!remoteSyncCfg.enabled;
    const ready = remoteSyncReady();
    let statusLine;
    if (!on) statusLine = '未开启';
    else if (!remoteSyncCfg.token) statusLine = '需要填写 Token';
    else if (!remoteSyncCfg.gistId) statusLine = 'Token 已填，点「新建同步库」开始';
    else if (__remoteLastError) statusLine = '⚠ ' + __remoteLastError;
    else statusLine = remoteSyncCfg.lastSyncAt
        ? '上次同步 ' + new Date(remoteSyncCfg.lastSyncAt).toLocaleString('zh-CN', { hour12: false })
        : '已就绪，尚未同步';

    box.innerHTML = `
        <div class="settings-row">
            <div class="settings-label">开启云同步<div class="settings-sublabel">iPhone / Mac / 电脑浏览器共用同一本账</div></div>
            <label class="ios-toggle">
                <input type="checkbox" id="remoteSyncToggle" ${on ? 'checked' : ''}>
                <span class="ios-toggle-slider"></span>
            </label>
        </div>
        <div class="settings-row settings-row-stack">
            <div class="settings-label">GitHub Token<div class="settings-sublabel">只需要 gist 权限；只存在这台设备上，不会上传</div></div>
            <div class="rs-inline">
                <input type="password" class="text-input" id="remoteSyncToken" placeholder="github_pat_… 或 ghp_…"
                       autocomplete="off" spellcheck="false" value="${esc(remoteSyncCfg.token)}">
                <button class="secondary-btn" id="remoteSyncTestBtn"><i class="fa-solid fa-plug"></i> 校验</button>
            </div>
        </div>
        <div class="settings-row settings-row-stack">
            <div class="settings-label">同步库<div class="settings-sublabel">私密 Gist 的 ID，多台设备填同一个即可</div></div>
            <div class="rs-inline">
                <input type="text" class="text-input" id="remoteSyncGist" placeholder="留空则点右边新建"
                       autocomplete="off" spellcheck="false" value="${esc(remoteSyncCfg.gistId)}">
                <button class="secondary-btn" id="remoteSyncCreateBtn"><i class="fa-solid fa-wand-magic-sparkles"></i> 新建同步库</button>
            </div>
        </div>
        <div class="settings-row">
            <div class="settings-label">状态<div class="settings-sublabel">${statusLine}</div></div>
            <button class="secondary-btn" id="remoteSyncNowBtn" ${ready ? '' : 'disabled'}>
                <i class="fa-solid fa-rotate"></i> 立即同步
            </button>
        </div>`;

    const toggle = document.getElementById('remoteSyncToggle');
    if (toggle) toggle.addEventListener('change', e => remoteToggleEnabled(e.target.checked));
    const token = document.getElementById('remoteSyncToken');
    if (token) token.addEventListener('change', e => remoteSaveToken(e.target.value));
    const gist = document.getElementById('remoteSyncGist');
    if (gist) gist.addEventListener('change', e => remoteSaveGistId(e.target.value));
    const testBtn = document.getElementById('remoteSyncTestBtn');
    if (testBtn) testBtn.addEventListener('click', () => { remoteSaveToken((token && token.value) || ''); remoteTestConnection(); });
    const createBtn = document.getElementById('remoteSyncCreateBtn');
    if (createBtn) createBtn.addEventListener('click', async () => {
        remoteSaveToken((token && token.value) || '');
        remoteSaveGistId((gist && gist.value) || '');
        if (!remoteSyncCfg.token) { showToast('请先填写 Token', 'error'); return; }
        if (remoteSyncCfg.gistId) { remoteSyncCfg.enabled = true; saveRemoteSyncConfig(); await remoteSyncCycle('manual'); return; }
        await remoteCreateGist();
    });
    const nowBtn = document.getElementById('remoteSyncNowBtn');
    if (nowBtn) nowBtn.addEventListener('click', remoteManualSync);
}


function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        try {
            const data = JSON.parse(raw);
            state.transactions = data.transactions || [];
            state.categories = data.categories || [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES];
            state.budgets = data.budgets || [];
            state.paymentMethods = (data.paymentMethods && data.paymentMethods.length > 0)
                ? data.paymentMethods
                : [...DEFAULT_PAYMENT_METHODS];
            state.accounts = Array.isArray(data.accounts) && data.accounts.length > 0
                ? data.accounts
                : DEFAULT_ACCOUNTS.map(a => ({ ...a }));
            ensureAccountOrder();
            state.balances = Array.isArray(data.balances) ? data.balances : [];
            state.returns = Array.isArray(data.returns) ? data.returns : [];
            state.fundTargets = { cash: 0, steady: 0, growth: 0, ...(data.fundTargets || {}) };
            state.insuranceMembers = Array.isArray(data.insuranceMembers) && data.insuranceMembers.length ? data.insuranceMembers : [...DEFAULT_INSURANCE_MEMBERS];
            state.insuranceMemberAddedAt = normalizeAddedAtMap(data.insuranceMemberAddedAt);
            state.insurancePolicies = Array.isArray(data.insurancePolicies) ? data.insurancePolicies : [];
            state.balanceMembers = Array.isArray(data.balanceMembers) && data.balanceMembers.length ? data.balanceMembers : ['本人'];
            state.memberAddedAt = normalizeAddedAtMap(data.memberAddedAt);
            state.settings = { ...{ currency: '¥', theme: 'light', defaultPaymentMethod: '微信支付', defaultView: 'transactions', autoOpenAdd: false }, ...data.settings };
            state.deleted = normalizeTombstones(data.deleted);
            state.pmAddedAt = normalizeAddedAtMap(data.pmAddedAt);
            state.lastExportAt = Number(data.lastExportAt) || 0;
            // 仪表盘页面已移除：旧设置迁移到交易记录
            if (state.settings.defaultView === 'dashboard') state.settings.defaultView = 'transactions';

            // 家庭资产负债表 v2 迁移：账户类型全家共用，成员维度落到余额记录上。
            // 旧记录没有 member 字段、id 为 accountId__month，回填为首要成员并改用新 id 格式。
            (function migrateBalancesToMember() {
                const primary = state.balanceMembers[0] || '本人';
                const seen = new Set();
                state.balances.forEach(b => {
                    if (b.owner !== undefined) delete b.owner;
                    if (!b.member) b.member = primary;
                    const newId = `${b.member}__${b.accountId}__${b.month}`;
                    if (b.id !== newId) b.id = newId;
                    if (seen.has(b.id)) { b.__dup = true; } else { seen.add(b.id); }
                });
                state.balances = state.balances.filter(b => !b.__dup);
                state.accounts.forEach(a => { if (a.owner !== undefined) delete a.owner; });
            })();

            // 分类体系 v2 迁移：替换旧默认分类为新的，交易/预算的旧分类ID同步映射
            if (!data.categoryVersion || data.categoryVersion < 2) {
                const customCats = state.categories.filter(c => c.id.startsWith('c_'));
                state.categories = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES, ...customCats];
                state.transactions.forEach(t => {
                    if (CATEGORY_MIGRATION_V2[t.categoryId]) t.categoryId = CATEGORY_MIGRATION_V2[t.categoryId];
                });
                state.budgets.forEach(b => {
                    if (CATEGORY_MIGRATION_V2[b.categoryId]) b.categoryId = CATEGORY_MIGRATION_V2[b.categoryId];
                });
                state.categoryVersion = 2;
            }
        } catch (e) {
            console.error('Failed to load state:', e);
        }
    }
}

// ---- Utils ----
// 全站统一金额格式：不带货币符号、不带千位分隔符、去掉多余小数尾零
// （例：2850000.55 -> "2850000.55"，-31.10 -> "-31.1"，400 -> "400"）
function formatCurrency(amount) {
    const sign = amount < 0 ? '-' : '';
    const abs = Math.abs(amount);
    const str = abs.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
    return sign + str;
}

function formatDate(dateStr) {
    const d = parseLocalDate(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dOnly = new Date(d);
    dOnly.setHours(0, 0, 0, 0);

    if (dOnly.getTime() === today.getTime()) return '今天';
    if (dOnly.getTime() === yesterday.getTime()) return '昨天';

    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${year}年${month}月${day}日`;
}

// Short form used on narrow screens where the full date squeezes the row
function formatDateShort(dateStr) {
    const d = parseLocalDate(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dOnly = new Date(d); dOnly.setHours(0, 0, 0, 0);
    if (dOnly.getTime() === today.getTime()) return '今天';
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (dOnly.getTime() === yesterday.getTime()) return '昨天';
    if (d.getFullYear() !== today.getFullYear()) return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatDateFull(dateStr) {
    const d = parseLocalDate(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayStr() {
    return formatDateFull(new Date().toISOString());
}

function nowTimeStr() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getMonthKey(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(monthKey) {
    const [y, m] = monthKey.split('-');
    return `${y}年${parseInt(m)}月`;
}

function getCurrentMonthKey() {
    return getMonthKey(new Date().toISOString());
}

function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
}

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getCategoryById(id) {
    return state.categories.find(c => c.id === id);
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const iconMap = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
    toast.innerHTML = `<i class="fa-solid ${iconMap[type] || iconMap.success}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ---- Navigation ----
function switchView(viewName) {
    state.currentView = viewName;
    document.body.classList.toggle('show-txn-fab', viewName === 'transactions');
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewName);
    });
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(`view-${viewName}`).classList.add('active');

    // Render the view
    renderView(viewName);
}

function renderView(viewName) {
    switch (viewName) {
        case 'transactions': renderTransactions(); break;
        case 'reports': renderReports(); break;
        case 'budget': renderBudget(); break;
        case 'balance': renderBalance(); break;
        case 'funds': renderFourFunds(); break;
        case 'returns': renderReturns(); break;
        case 'categories': renderCategories(); break;
        case 'settings': renderSettings(); break;
    }
    // Sidebar month summary always reflects current month regardless of active view
    updateSidebarSummary();
}

// ---- Sidebar summary (desktop sidebar month card) ----
function updateSidebarSummary() {
    const si = document.getElementById('sidebarIncome');
    if (!si) return;
    const monthKey = getCurrentMonthKey();
    const monthTxns = state.transactions.filter(t => getMonthKey(t.date) === monthKey);
    const income = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;

    si.textContent = formatCurrency(income);
    document.getElementById('sidebarExpense').textContent = formatCurrency(expense);
    document.getElementById('sidebarBalance').textContent = formatCurrency(balance);
    document.getElementById('sidebarMonth').textContent = getMonthLabel(monthKey);
}

function renderTrendChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    const labels = [];
    const incomeData = [];
    const expenseData = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        labels.push(`${d.getMonth() + 1}月`);
        const txns = state.transactions.filter(t => getMonthKey(t.date) === mk);
        incomeData.push(txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
        expenseData.push(txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
    }

    if (charts.trend) charts.trend.destroy();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#98989d' : '#6e6e73';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

    charts.trend = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: '收入',
                    data: incomeData,
                    backgroundColor: '#34c759',
                    borderRadius: 6,
                    barPercentage: 0.6,
                    categoryPercentage: 0.7,
                },
                {
                    label: '支出',
                    data: expenseData,
                    backgroundColor: '#ff3b30',
                    borderRadius: 6,
                    barPercentage: 0.6,
                    categoryPercentage: 0.7,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: textColor, font: { size: 12, family: '-apple-system' }, usePointStyle: true, pointStyle: 'circle', padding: 12 },
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
                    },
                },
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { size: 11 }, callback: (v) => state.settings.currency + v },
                },
            },
        },
    });
}

function renderCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    const monthKey = getCurrentMonthKey();
    const monthExpenses = state.transactions.filter(t => t.type === 'expense' && getMonthKey(t.date) === monthKey);

    const catTotals = {};
    monthExpenses.forEach(t => {
        catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
    });

    const entries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const labels = entries.map(([id]) => getCategoryById(id)?.name || '未知');
    const data = entries.map(([, v]) => v);
    const colors = entries.map(([id]) => getCategoryById(id)?.color || '#636e72');

    if (charts.category) charts.category.destroy();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#98989d' : '#6e6e73';

    if (data.length === 0) {
        charts.category = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: ['暂无数据'], datasets: [{ data: [1], backgroundColor: ['#e0e0e0'], borderWidth: 0 }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
            },
        });
        return;
    }

    charts.category = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: textColor, font: { size: 11, family: '-apple-system' }, usePointStyle: true, pointStyle: 'circle', padding: 8, boxWidth: 8 },
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const total = data.reduce((s, v) => s + v, 0);
                            const pct = ((ctx.raw / total) * 100).toFixed(1);
                            return `${ctx.label}: ${formatCurrency(ctx.raw)} (${pct}%)`;
                        },
                    },
                },
            },
        },
    });
}

// ---- Transactions ----
function transactionItemHTML(t) {
    const cat = getCategoryById(t.categoryId);
    const icon = cat?.icon || 'fa-ellipsis';
    const color = cat?.color || '#636e72';
    const name = cat?.name || '未知';
    const sign = t.type === 'income' ? '+' : '-';
    const payment = t.paymentMethod || '现金';
    const paymentIcon = paymentIconFor(payment);
    // 没填备注就留空，不再重复显示分类名
    const noteHtml = t.note ? `<span class="txn-note-text">${escapeHtml(t.note)}</span> ` : '';

    return `
        <div class="transaction-item" onclick="editTransaction('${t.id}')">
            <div class="transaction-icon" style="background:${color}22;color:${color}">
                <i class="fa-solid ${icon}"></i>
            </div>
            <div class="transaction-info">
                <div class="transaction-category">${name}</div>
                <div class="transaction-note">${noteHtml}<span class="txn-payment"><i class="${paymentIcon}"></i> ${payment}</span></div>
            </div>
            <div class="transaction-amount ${t.type}">${sign}${formatCurrency(t.amount)}</div>
        </div>
    `;
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 表头用的日期：今天 / 昨天 / 8月24日 / 2025年8月24日
function formatDayHeader(dateStr) {
    const d = parseLocalDate(dateStr);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const only = new Date(d); only.setHours(0, 0, 0, 0);
    const yest = new Date(today); yest.setDate(yest.getDate() - 1);
    if (only.getTime() === today.getTime()) return '今天';
    if (only.getTime() === yest.getTime()) return '昨天';
    if (d.getFullYear() === today.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`;
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

const txnDayKey = t => String(t.date).slice(0, 10);

// 按天分组的时间线：同一天只显示一个日期表头 + 当日小计
function transactionGroupsHTML(txns) {
    const groups = [];
    txns.forEach(t => {
        const key = txnDayKey(t);
        const last = groups[groups.length - 1];
        if (last && last.key === key) last.rows.push(t);
        else groups.push({ key, date: t.date, rows: [t] });
    });
    return groups.map(g => {
        const inc = g.rows.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const exp = g.rows.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const sum = [
            inc ? `<span class="tds income">+${formatCurrency(inc)}</span>` : '',
            exp ? `<span class="tds expense">-${formatCurrency(exp)}</span>` : '',
        ].join('');
        return `
        <div class="txn-group">
            <div class="txn-day">
                <span class="txn-day-date">${formatDayHeader(g.date)}</span>
                <span class="txn-day-sum">${sum}</span>
            </div>
            <div class="transaction-list">${g.rows.map(t => transactionItemHTML(t)).join('')}</div>
        </div>`;
    }).join('');
}

function renderTransactions() {
    updateMonthFilter();
    updateTransactionMonthSummary();

    let filtered = [...state.transactions];

    // Filter by type
    if (state.transactionFilter !== 'all') {
        filtered = filtered.filter(t => t.type === state.transactionFilter);
    }

    // Filter by month
    if (state.monthFilter) {
        filtered = filtered.filter(t => getMonthKey(t.date) === state.monthFilter);
    }

    // Filter by search
    if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        filtered = filtered.filter(t => {
            const cat = getCategoryById(t.categoryId);
            return (t.note && t.note.toLowerCase().includes(q)) || (cat && cat.name.toLowerCase().includes(q));
        });
    }

    // Sort by date desc
    filtered.sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date) || b.createdAt - a.createdAt);

    const container = document.getElementById('allTransactions');
    const empty = document.getElementById('emptyTransactions');

    if (filtered.length === 0) {
        txnRenderList = [];
        txnRenderedTo = 0;
        container.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');
    // Render in day-sized chunks instead of the whole history at once. With many
    // records, one giant innerHTML was what made switching to this view stall.
    txnRenderList = filtered;
    txnRenderedTo = 0;
    container.innerHTML = '';
    // start from the top so a lingering bottom scroll position doesn't
    // immediately cascade-load several chunks
    const scroller = document.querySelector('.main-content');
    if (scroller) scroller.scrollTop = 0;
    appendTxnChunk();
}

// ---- Transactions infinite render ----
let txnRenderList = [];
let txnRenderedTo = 0;
const TXN_CHUNK = 60;

function appendTxnChunk() {
    if (txnRenderedTo >= txnRenderList.length) return;
    const target = Math.min(txnRenderList.length, txnRenderedTo + TXN_CHUNK);
    let end = txnRenderedTo;
    // grow whole day-groups at a time so a day is never split across chunks
    while (end < txnRenderList.length && end < target) {
        const k = txnDayKey(txnRenderList[end]);
        while (end < txnRenderList.length && txnDayKey(txnRenderList[end]) === k) end++;
    }
    const chunk = txnRenderList.slice(txnRenderedTo, end);
    txnRenderedTo = end;
    document.getElementById('allTransactions').insertAdjacentHTML('beforeend', transactionGroupsHTML(chunk));
}

function initTxnInfiniteScroll() {
    const scroller = document.querySelector('.main-content');
    if (!scroller) return;
    scroller.addEventListener('scroll', () => {
        if (state.currentView !== 'transactions') return;
        if (txnRenderedTo >= txnRenderList.length) return;
        if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 400) appendTxnChunk();
    }, { passive: true });
}

function updateMonthFilter() {
    const select = document.getElementById('monthFilter');
    const months = [...new Set(state.transactions.map(t => getMonthKey(t.date)))].sort().reverse();
    const current = state.monthFilter;

    select.innerHTML = '<option value="">所有月份</option>' +
        months.map(m => `<option value="${m}" ${m === current ? 'selected' : ''}>${getMonthLabel(m)}</option>`).join('');
}

// Top-of-page month summary (income / expense / balance for current month)
function updateTransactionMonthSummary() {
    const card = document.getElementById('txnMonthSummary');
    if (!card) return;
    const monthKey = getCurrentMonthKey();
    const monthTxns = state.transactions.filter(t => getMonthKey(t.date) === monthKey);
    const income = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;

    document.getElementById('tmsIncome').textContent = formatCurrency(income);
    document.getElementById('tmsExpense').textContent = formatCurrency(expense);
    document.getElementById('tmsBalance').textContent = formatCurrency(balance);
}

// ---- Transaction Modal ----
function openTransactionModal(id) {
    const modal = document.getElementById('transactionModal');
    const title = document.getElementById('transactionModalTitle');

    if (id) {
        state.editingTransactionId = id;
        const t = state.transactions.find(x => x.id === id);
        if (!t) return;
        title.textContent = '编辑交易';
        state.selectedTransactionType = t.type;
        state.selectedCategoryId = t.categoryId;
        setCalcValue(String(t.amount));
        document.getElementById('dateInput').value = t.date;
        document.getElementById('timeInput').value = t.time || nowTimeStr();
        document.getElementById('noteInput').value = t.note || '';
        renderPaymentOptions(t.paymentMethod);
    } else {
        state.editingTransactionId = null;
        title.textContent = '记一笔';
        state.selectedTransactionType = 'expense';
        state.selectedCategoryId = null;
        resetCalc();
        document.getElementById('dateInput').value = todayStr();
        document.getElementById('timeInput').value = nowTimeStr();
        document.getElementById('noteInput').value = '';
        renderPaymentOptions();
    }

    // Show delete button only when editing
    document.getElementById('deleteTxnBtn').style.display = id ? '' : 'none';

    // Update type toggle
    document.querySelectorAll('#transactionModal .type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === state.selectedTransactionType);
    });

    // Update currency symbol
    document.getElementById('modalCurrency').textContent = state.settings.currency;

    // Render category picker
    renderCategoryPicker();

    modal.classList.remove('hidden');
    raiseOverlay(modal);
    // Amount is now entered via the custom number pad below; no system keyboard needed
}

function closeTransactionModal() {
    document.getElementById('transactionModal').classList.add('hidden');
    state.editingTransactionId = null;
    state.selectedCategoryId = null;
}

// ---- Custom Calculator-style Number Pad ----
// State for the in-modal calculator: tracks the running expression so + / - can chain
const calc = {
    expr: '',      // running expression text, e.g. "10+20-5"
    justOp: false, // true if the last input was an operator (so the next digit starts fresh)
};

function resetCalc() {
    calc.expr = '';
    calc.justOp = false;
    renderCalc();
}

function setCalcValue(amount) {
    // Used when editing an existing transaction: prefill with the stored amount
    calc.expr = String(amount);
    calc.justOp = false;
    renderCalc();
}

function renderCalc() {
    const display = document.getElementById('amountInput');
    const exprEl = document.getElementById('amountExpression');
    const hidden = document.getElementById('amountValue');
    if (!display) return;

    // Compute the value that should appear in the big display
    let shown;
    if (!calc.expr) {
        shown = '';
    } else {
        // If the last char is an operator, evaluate so far to show running result
        const last = calc.expr[calc.expr.length - 1];
        if (last === '+' || last === '-') {
            shown = String(safeEval(calc.expr.slice(0, -1)));
        } else {
            shown = String(safeEval(calc.expr));
            // safeEval("12.") 得到 12，结尾的小数点会被"吃掉"，用户看不出自己按没按到。
            // 单段数字（没参与加减）时把小数点原样补回显示。
            if (last === '.' && !/[+\-]/.test(calc.expr) && !isNaN(parseFloat(shown))) {
                shown += '.';
            }
        }
    }
    display.value = shown;

    // Expression line shows the full expression (e.g. "10+20-5 = 25")
    const evaluated = (() => {
        if (!calc.expr) return '';
        const last = calc.expr[calc.expr.length - 1];
        // 运算符后、或小数刚点了一半时不显示结果，避免出现 "12. = 12" 这种怪东西
        if (last === '+' || last === '-' || last === '.') return '';
        const v = safeEval(calc.expr);
        if (isNaN(v) || !isFinite(v)) return '';
        return calc.expr + ' = ' + formatNum(v);
    })();
    exprEl.textContent = evaluated;

    // Hidden field stores the final numeric value used by saveTransaction()
    const finalVal = shown && !isNaN(parseFloat(shown)) ? parseFloat(shown) : 0;
    hidden.value = finalVal;
}

function safeEval(expr) {
    // Only allow digits, decimal points, and + / - operators
    if (!/^[\d+\-.\s]+$/.test(expr)) return NaN;
    try {
        // eslint-disable-next-line no-new-func
        return Function('"use strict"; return (' + expr + ')')();
    } catch (e) {
        return NaN;
    }
}

function formatNum(n) {
    // Trim trailing zeros for a clean display (e.g. 25 not 25.0)
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(2).replace(/\.?0+$/, '');
}

function numpadPress(key) {
    if (key === '.') {
        // Add decimal only if the current number segment doesn't already have one
        const seg = currentSegment();
        if (seg.includes('.')) return;
        if (calc.justOp || !calc.expr) {
            // 空表达式或刚按完运算符：新数从 "0." 开始（原来这里会拼空串，点被吞掉）
            calc.expr += '0.';
            calc.justOp = false;
        } else {
            calc.expr += '.';
        }
    } else if (key === '+' || key === '-') {
        if (!calc.expr) return; // need a number first
        const last = calc.expr[calc.expr.length - 1];
        if (last === '+' || last === '-') {
            // Replace the previous operator
            calc.expr = calc.expr.slice(0, -1) + key;
        } else {
            calc.expr += key;
        }
        calc.justOp = true;
    } else {
        // Digit
        if (calc.justOp) {
            // Start a new number after an operator
            calc.expr += key;
            calc.justOp = false;
        } else {
            // Avoid leading zeros (except "0.")
            const seg = currentSegment();
            if (seg === '0') {
                calc.expr = calc.expr.slice(0, -1) + key;
            } else {
                calc.expr += key;
            }
        }
    }
    renderCalc();
}

function currentSegment() {
    // The numeric segment after the last operator
    const m = calc.expr.match(/[+\-](?!.*[+\-])$/);
    return m ? calc.expr.slice(m.index + 1) : calc.expr;
}

function numpadBack() {
    if (!calc.expr) return;
    const last = calc.expr[calc.expr.length - 1];
    calc.expr = calc.expr.slice(0, -1);
    // After a backspace the user is in the middle of a number, not after an operator
    calc.justOp = (last === '+' || last === '-');
    renderCalc();
}

function numpadClear() {
    resetCalc();
}

function numpadQuickSave() {
    // Save the current transaction and immediately prepare for the next entry
    saveTransaction({ reopen: true });
}

function renderPaymentOptions(selected) {
    const sel = document.getElementById('paymentInput');
    const methods = state.paymentMethods;
    // Default: user setting (微信支付), fallback to first method
    const target = selected || state.settings.defaultPaymentMethod || '微信支付';
    const value = methods.includes(target) ? target : methods[0];
    sel.innerHTML = methods.map(p => `<option value="${p}" ${p === value ? 'selected' : ''}>${p}</option>`).join('');
}

function paymentIconFor(name) {
    return {
        '现金': 'fa-solid fa-money-bill-wave',
        '微信支付': 'fa-brands fa-weixin',
        '支付宝': 'fa-brands fa-alipay',
        '银行卡': 'fa-solid fa-building-columns',
        '信用卡': 'fa-solid fa-credit-card',
    }[name] || 'fa-solid fa-coins';
}

function renderPaymentMethodsManage() {
    const container = document.getElementById('paymentMethodsList');
    if (!container) return;
    container.innerHTML = state.paymentMethods.map(p => {
        const count = state.transactions.filter(t => (t.paymentMethod || '现金') === p).length;
        const isDefault = p === (state.settings.defaultPaymentMethod || '微信支付');
        return `
            <div class="pm-chip ${isDefault ? 'pm-chip-default' : ''}" onclick="setDefaultPaymentMethod('${p}')">
                <i class="${paymentIconFor(p)}"></i>
                <span>${p}</span>
                ${isDefault ? '<span class="pm-default-tag">默认</span>' : ''}
                <button class="pm-chip-delete" onclick="event.stopPropagation(); deletePaymentMethod('${p}')" title="删除">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;
    }).join('');
}

function setDefaultPaymentMethod(name) {
    state.settings.defaultPaymentMethod = name;
    saveState();
    renderPaymentMethodsManage();
    showToast(`默认支付方式已设为「${name}」`, 'success');
}

function addPaymentMethod() {
    const input = document.getElementById('newPaymentInput');
    const name = input.value.trim();
    if (!name) { showToast('请输入支付方式名称', 'error'); return; }
    if (state.paymentMethods.includes(name)) { showToast('该支付方式已存在', 'error'); return; }
    state.paymentMethods.push(name);
    state.pmAddedAt[name] = Date.now();
    saveState();
    input.value = '';
    renderPaymentMethodsManage();
    showToast('支付方式已添加', 'success');
}

function deletePaymentMethod(name) {
    if (state.paymentMethods.length <= 1) {
        showToast('至少保留一种支付方式', 'error');
        return;
    }
    const count = state.transactions.filter(t => (t.paymentMethod || '现金') === name).length;
    if (count > 0) {
        showToast(`该支付方式有 ${count} 笔交易记录，无法删除`, 'error');
        return;
    }
    addTombstone('paymentMethods', name);
    state.paymentMethods = state.paymentMethods.filter(p => p !== name);
    if ((state.settings.defaultPaymentMethod || '微信支付') === name) {
        state.settings.defaultPaymentMethod = state.paymentMethods[0];
    }
    saveState();
    renderPaymentMethodsManage();
    showToast('支付方式已删除', 'success');
}

function renderCategoryPicker() {
    const container = document.getElementById('categoryPicker');
    const cats = state.categories.filter(c => c.type === state.selectedTransactionType);

    container.innerHTML = cats.map(c => `
        <div class="cat-pick-item ${c.id === state.selectedCategoryId ? 'selected' : ''}"
             onclick="selectCategory('${c.id}')">
            <div class="cat-pick-icon" style="background:${c.color}22;color:${c.color}">
                <i class="fa-solid ${c.icon}"></i>
            </div>
            <div class="cat-pick-name">${c.name}</div>
        </div>
    `).join('');

    // Auto-select first if none selected
    if (!state.selectedCategoryId && cats.length > 0) {
        state.selectedCategoryId = cats[0].id;
        renderCategoryPicker();
        return;
    }
    lockPickerHeight(container);
}

// 电脑端：收入分类比支出少很多，宫格高度按两类中较多的一方锁定，
// 切换支出/收入时弹窗尺寸保持不变。手机端不处理。
function lockPickerHeight(container) {
    if (!window.matchMedia('(min-width: 641px)').matches) {
        container.style.minHeight = '';
        return;
    }
    const item = container.querySelector('.cat-pick-item');
    if (!item) { container.style.minHeight = ''; return; }
    const style = getComputedStyle(container);
    const cols = Math.max(1, (style.gridTemplateColumns || '').split(' ').filter(Boolean).length);
    const maxCount = Math.max(
        state.categories.filter(c => c.type === 'expense').length,
        state.categories.filter(c => c.type === 'income').length
    );
    const rowH = item.getBoundingClientRect().height;
    const gap = parseFloat(style.rowGap) || 0;
    const rows = Math.max(1, Math.ceil(maxCount / cols));
    container.style.minHeight = (rows * rowH + (rows - 1) * gap) + 'px';
}

function selectCategory(id) {
    state.selectedCategoryId = id;
    renderCategoryPicker();
}

function saveTransaction(opts = {}) {
    // Read the evaluated amount from the hidden field managed by the custom numpad
    const amount = parseFloat(document.getElementById('amountValue').value);
    const date = document.getElementById('dateInput').value;
    const note = document.getElementById('noteInput').value.trim();
    const paymentMethod = document.getElementById('paymentInput').value;

    if (!amount || amount <= 0) {
        showToast('请输入有效金额', 'error');
        return;
    }
    if (!date) {
        showToast('请选择日期', 'error');
        return;
    }
    if (!state.selectedCategoryId) {
        showToast('请选择分类', 'error');
        return;
    }

    if (state.editingTransactionId) {
        const t = state.transactions.find(x => x.id === state.editingTransactionId);
        if (t) {
            t.type = state.selectedTransactionType;
            t.amount = amount;
            t.categoryId = state.selectedCategoryId;
            t.date = date;
            t.time = document.getElementById('timeInput').value || nowTimeStr();
            t.note = note;
            t.paymentMethod = paymentMethod;
            t.updatedAt = Date.now();
        }
        showToast('交易已更新', 'success');
    } else {
        state.transactions.push({
            id: uid(),
            type: state.selectedTransactionType,
            amount,
            categoryId: state.selectedCategoryId,
            date,
            time: document.getElementById('timeInput').value || nowTimeStr(),
            note,
            paymentMethod,
            createdAt: Date.now(),
        });
        showToast(opts.reopen ? '已保存，继续记下一笔' : '交易已添加', 'success');
    }

    saveState();

    if (opts.reopen) {
        // Quick-save mode: keep modal open, reset the calculator and note for the next entry
        resetCalc();
        document.getElementById('noteInput').value = '';
        document.getElementById('timeInput').value = nowTimeStr();
        // Re-render to update the list behind the modal
        renderView(state.currentView);
    } else {
        closeTransactionModal();
        renderView(state.currentView);
    }
    refreshCategoryLedger();
}

function editTransaction(id) {
    openTransactionModal(id);
}

function deleteTransaction(id) {
    addTombstone('transactions', id);
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveState();
    showToast('交易已删除', 'success');
    renderView(state.currentView);
    refreshCategoryLedger();
}

function deleteTransactionFromModal() {
    if (!state.editingTransactionId) return;
    if (!confirm('确定要删除这条交易记录吗？删除后无法恢复。')) return;
    const id = state.editingTransactionId;
    closeTransactionModal();
    deleteTransaction(id);
}

// ---- Reports ----
function renderReportSelectors() {
    const yearWrap = document.getElementById('reportYearWrap');
    const monthWrap = document.getElementById('reportMonthWrap');
    const yearSelect = document.getElementById('reportYearSelect');
    const monthSelect = document.getElementById('reportMonthSelect');
    const now = new Date();

    // Collect all years from transactions + current year
    const years = [...new Set(state.transactions.map(t => parseLocalDate(t.date).getFullYear()))];
    years.push(now.getFullYear());
    const uniqueYears = [...new Set(years)].sort((a, b) => b - a);

    // Keep the selected year valid for the available data
    let currentYear = state.reportYear || now.getFullYear();
    if (!uniqueYears.includes(currentYear)) currentYear = uniqueYears[0];
    state.reportYear = currentYear;

    yearSelect.innerHTML = uniqueYears.map(y =>
        `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}年</option>`
    ).join('');

    const period = state.reportPeriod;
    yearWrap.classList.toggle('hidden', period === 'all');
    monthWrap.classList.toggle('hidden', period !== 'month');

    if (period === 'month') {
        const currentMonth = state.reportMonth || (now.getMonth() + 1);
        monthSelect.innerHTML = Array.from({ length: 12 }, (_, i) => i + 1).map(m =>
            `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${m}月</option>`
        ).join('');
    }
}

// ---- Reports: period helpers ----
function getReportRange() {
    const now = new Date();
    const period = state.reportPeriod;
    const selYear = state.reportYear || now.getFullYear();
    const selMonth = state.reportMonth || (now.getMonth() + 1);
    let start, end, label;

    if (period === 'all') {
        start = null;
        end = null;
        label = '全部时间';
    } else if (period === 'year') {
        start = new Date(selYear, 0, 1);
        end = new Date(selYear, 11, 31, 23, 59, 59);
        label = `${selYear}年`;
    } else {
        start = new Date(selYear, selMonth - 1, 1);
        end = new Date(selYear, selMonth, 0, 23, 59, 59);
        label = `${selYear}年${selMonth}月`;
    }
    return { period, selYear, selMonth, start, end, label };
}

// Stored dates are "YYYY-MM-DD..." strings; new Date() would read them as UTC
// midnight and shift the calendar day in non-UTC timezones. Build a local date.
function parseLocalDate(dateStr) {
    const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return new Date(dateStr);
    return new Date(y, m - 1, d, 12, 0, 0);
}

function inRange(dateStr, range) {
    if (!range.start) return true;
    const days = parseLocalDate(dateStr);
    return days >= range.start && days <= range.end;
}

function getReportFiltered() {
    const range = getReportRange();
    return { range, txns: state.transactions.filter(t => inRange(t.date, range)) };
}

// getDaysInMonth() takes a 0-indexed month; reports carry 1-indexed months
function monthDays(year, month1) {
    return getDaysInMonth(year, month1 + 1);
}

// Number of days covered by the current report period (for daily average)
function getReportDays(txns, range) {
    const now = new Date();
    if (range.period === 'all') {
        if (txns.length === 0) return 1;
        const times = txns.map(t => parseLocalDate(t.date).getTime());
        const first = new Date(Math.min(...times));
        first.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Math.max(1, Math.floor((today - first) / 86400000) + 1);
    }
    if (range.period === 'year') {
        if (range.selYear === now.getFullYear()) {
            return Math.floor((now - new Date(range.selYear, 0, 1)) / 86400000) + 1;
        }
        return ((range.selYear % 4 === 0 && range.selYear % 100 !== 0) || range.selYear % 400 === 0) ? 366 : 365;
    }
    if (range.selYear === now.getFullYear() && range.selMonth === now.getMonth() + 1) {
        return now.getDate();
    }
    return monthDays(range.selYear, range.selMonth);
}

const METRIC_META = {
    income:  { name: '收入', color: '#34c759', light: 'rgba(52, 199, 89, 0.14)' },
    expense: { name: '支出', color: '#ff3b30', light: 'rgba(255, 59, 48, 0.14)' },
    balance: { name: '结余', color: '#007aff', light: 'rgba(0, 122, 255, 0.14)' },
};

function renderReports() {
    renderReportSelectors();

    const { range, txns } = getReportFiltered();
    const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;
    const dailyAvg = expense / getReportDays(txns, range);

    document.getElementById('reportIncome').textContent = formatCurrency(income);
    document.getElementById('reportExpense').textContent = formatCurrency(expense);
    document.getElementById('reportBalance').textContent = formatCurrency(balance);
    document.getElementById('reportDailyAvg').textContent = formatCurrency(dailyAvg);

    renderDrillChart();
    renderBillStats();
}

// ---- Reports: 账单统计 ----
// 月报 → 日均 + 每天；年报/总 → 月均 + 每月。日期一律从新到旧排。
function renderBillStats() {
    const body = document.getElementById('billStatsBody');
    if (!body) return;
    const { range, txns } = getReportFiltered();
    const subtitle = document.getElementById('billStatsSubtitle');
    subtitle.textContent = range.label;

    if (txns.length === 0) {
        body.innerHTML = `<tr><td colspan="3" class="bs-empty">${range.label}暂无账单记录</td></tr>`;
        return;
    }

    const byDay = range.period === 'month';
    const buckets = new Map();
    txns.forEach(t => {
        const d = parseLocalDate(t.date);
        const key = byDay ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` : `${d.getFullYear()}-${d.getMonth() + 1}`;
        if (!buckets.has(key)) buckets.set(key, { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), rows: [] });
        buckets.get(key).rows.push(t);
    });
    const list = [...buckets.values()].sort((a, b) => b.y - a.y || b.m - a.m || b.d - a.d);

    const sumOf = rows => {
        const exp = rows.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const inc = rows.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        return { inc, exp, net: inc - exp };
    };
    const total = sumOf(txns);
    const periods = byDay ? getReportDays(txns, range) : list.length;
    const avgLabel = byDay ? '日均' : '月均';
    const dayLabel = b => byDay ? `${b.m}月${b.d}日` : (range.period === 'year' ? `${b.m}月` : `${b.y}年${b.m}月`);
    const money = (v, cls) => `<span class="bs-num${v < 0 ? ' neg' : ''}${cls ? ' ' + cls : ''}">${formatCurrency(v)}</span>`;

    // 合计行紧跟表头，其后是日均/月均行
    const rows = [`
        <tr class="bs-total">
            <td class="bs-label">合计</td>
            <td>${money(total.inc, 'income')}</td>
            <td>${money(total.exp, 'expense')}</td>
            <td>${money(total.net)}</td>
        </tr>`, `
        <tr class="bs-avg">
            <td class="bs-label">${avgLabel}</td>
            <td>${money(periods ? total.inc / periods : 0)}</td>
            <td>${money(periods ? total.exp / periods : 0)}</td>
            <td>${money(periods ? total.net / periods : 0)}</td>
        </tr>`];

    list.forEach(b => {
        const st = sumOf(b.rows);
        rows.push(`
        <tr class="bs-row" onclick="openBillStatsLedger(${b.y}, ${b.m}, ${byDay ? b.d : 'null'}, '${dayLabel(b)}')">
            <td class="bs-label">${dayLabel(b)}</td>
            <td>${money(st.inc)}</td>
            <td>${money(st.exp)}</td>
            <td>${money(st.net)}</td>
        </tr>`);
    });
    body.innerHTML = rows.join('');
}

function openBillStatsLedger(y, m, d, label) {
    const { range } = getReportFiltered();
    const hit = state.transactions.filter(t => {
        if (!inRange(t.date, range)) return false;
        const dt = parseLocalDate(t.date);
        if (dt.getFullYear() !== y || dt.getMonth() + 1 !== m) return false;
        return d === null || dt.getDate() === d;
    });
    openLedger({ title: label, subtitle: `账单明细 · ${range.label}`, ids: [], txns: hit, bucket: null, ignoreMetric: true });
}

// ---- Reports: drill-down ----
const GRANULARITY_LABELS = { day: '按日', month: '按月', year: '按年' };
let drillRenderToken = 0;
let catLedgerTxns = [];
let catLedgerIds = [];
let catLedgerBucket = null;   // set when the ledger came from a trend point
let catLedgerIgnoreMetric = false;  // 账单统计的弹窗固定收支都显示

function defaultGranularity(period) {
    return period === 'all' ? 'year' : (period === 'year' ? 'month' : 'day');
}

function activeGranularity() {
    return state.reportGranularity || defaultGranularity(state.reportPeriod);
}

function granularityValue(d, gran) {
    if (gran === 'year') return d.getFullYear();
    if (gran === 'month') return d.getFullYear() * 100 + d.getMonth();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function granularityLabel(v, gran) {
    if (gran === 'year') return `${v}年`;
    if (gran === 'month') return `${Math.floor(v / 100)}年${(v % 100) + 1}月`;
    return `${Math.floor((v % 10000) / 100)}月${v % 100}日`;
}

// Time buckets for the trend chart. A fixed calendar frame is used for the
// month/year periods so empty days and months still show up.
function buildBuckets(txns, range, gran) {
    let values = [];
    if (gran === 'day' && range.period === 'month') {
        const days = getDaysInMonth(range.selYear, range.selMonth);
        for (let d = 1; d <= days; d++) values.push(range.selYear * 10000 + range.selMonth * 100 + d);
    } else if (gran === 'month' && range.period === 'year') {
        for (let m = 0; m < 12; m++) values.push(range.selYear * 100 + m);
    } else if (gran === 'year' && range.period === 'year') {
        values = [range.selYear];
    } else {
        values = [...new Set(txns.map(t => granularityValue(parseLocalDate(t.date), gran)))].sort((a, b) => a - b);
    }
    const map = new Map(values.map(v => [v, []]));
    txns.forEach(t => {
        const bucket = map.get(granularityValue(parseLocalDate(t.date), gran));
        if (bucket) bucket.push(t);
    });
    return values.map(v => ({ value: v, label: granularityLabel(v, gran), txns: map.get(v) || [] }));
}

function bucketTotal(txns, metric) {
    const inc = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return metric === 'income' ? inc : (metric === 'expense' ? exp : inc - exp);
}

// Category totals for the selected metric, plus the net/gross sums they add up to
function categoryTotals(txns, metric) {
    const type = metric === 'balance' ? null : metric;
    const totals = {};
    txns.forEach(t => {
        if (type && t.type !== type) return;
        const signed = (metric === 'balance' && t.type === 'expense') ? -t.amount : t.amount;
        totals[t.categoryId] = (totals[t.categoryId] || 0) + signed;
    });
    const entries = Object.entries(totals).map(([id, amount]) => ({ id, amount, signed: Math.abs(amount) }));
    const sums = {
        net: entries.reduce((s, e) => s + e.amount, 0),
        gross: entries.reduce((s, e) => s + e.signed, 0),
    };
    entries.sort((a, b) => b.signed - a.signed);
    return { entries, sums };
}

function updateReportToggleStates() {
    // 资产负债页复用了同样的类名，这里必须限定在 #view-reports 内
    document.querySelectorAll('#view-reports .report-card.clickable').forEach(card => {
        card.classList.toggle('active', card.dataset.metric === state.reportMetric);
    });
    document.querySelectorAll('#view-reports .chart-type-toggle .type-ico-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.chart === state.reportChartType);
    });
    document.querySelectorAll('#view-reports .gran-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.gran === activeGranularity());
    });
    const granWrap = document.getElementById('drillGranularity');
    if (granWrap) granWrap.classList.toggle('hidden', state.reportChartType === 'pie');
}

function setReportMetric(metric) {
    if (!METRIC_META[metric] || state.reportMetric === metric) return;
    state.reportMetric = metric;
    state.breakdownExpanded = false;
    renderDrillChart();
}

function setReportChartType(type) {
    if (state.reportChartType === type) return;
    state.reportChartType = type;
    renderDrillChart();
}

function setReportGranularity(gran) {
    if (state.reportGranularity === gran) return;
    state.reportGranularity = gran;
    renderDrillChart();
}

function showDrillEmpty(message) {
    const empty = document.getElementById('drillChartEmpty');
    const canvasWrap = document.getElementById('drillChart').parentElement;
    empty.textContent = message;
    empty.classList.remove('hidden');
    canvasWrap.classList.add('hidden');
    if (charts.drill) { charts.drill.destroy(); charts.drill = null; }
    updateReportToggleStates();
}

function hideDrillEmpty() {
    document.getElementById('drillChartEmpty').classList.add('hidden');
    document.getElementById('drillChart').parentElement.classList.remove('hidden');
}

function drillTitles(metric, chartType, gran, range) {
    const meta = METRIC_META[metric];
    document.getElementById('drillChartTitle').textContent =
        chartType === 'pie' ? `${meta.name}构成占比` : `${meta.name}走势`;
    const parts = [range.label];
    if (chartType !== 'pie') parts.push(GRANULARITY_LABELS[gran]);
    parts.push('点击图表可查看明细');
    document.getElementById('drillChartSubtitle').textContent = parts.join(' · ');
}

function renderDrillChart() {
    const { range, txns } = getReportFiltered();
    const metric = state.reportMetric;
    const chartType = state.reportChartType;
    const gran = activeGranularity();
    const total = bucketTotal(txns, metric);

    drillTitles(metric, chartType, gran, range);
    updateReportToggleStates();
    renderBreakdownList();

    if (total === 0) {
        showDrillEmpty(`${range.label}暂无${METRIC_META[metric].name}记录`);
        return;
    }
    hideDrillEmpty();

    // Wait a frame so the canvas has a laid-out size (the view may have just become visible)
    const token = ++drillRenderToken;
    requestAnimationFrame(() => {
        if (token !== drillRenderToken) return;
        const ctx = document.getElementById('drillChart');
        if (!ctx) return;
        if (chartType === 'pie') renderDrillPie(ctx, txns, metric);
        else renderDrillTrend(ctx, txns, range, gran, metric, chartType);
    });
}

function chartPalette() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
        isDark,
        text: isDark ? '#98989d' : '#6e6e73',
        grid: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    };
}

function openBucketLedger(bucketIndex) {
    const { range, txns } = getReportFiltered();
    const bucket = buildBuckets(txns, range, activeGranularity())[bucketIndex];
    if (!bucket) return;
    const metric = state.reportMetric;
    const scoped = metric === 'balance' ? bucket.txns : bucket.txns.filter(t => t.type === metric);
    openLedger({
        title: bucket.label,
        subtitle: `${METRIC_META[metric].name}明细 · ${range.label}`,
        ids: [],
        bucket: bucket.value,
        txns: scoped,
    });
}

function renderDrillTrend(ctx, txns, range, gran, metric, chartType) {
    if (typeof Chart === 'undefined') { loadChartLib().then(() => renderDrillTrend(ctx, txns, range, gran, metric, chartType)).catch(() => {}); return; }
    if (charts.drill) { charts.drill.destroy(); charts.drill = null; }
    const legendBox = document.getElementById('pieLegend');
    if (legendBox) { legendBox.innerHTML = ''; legendBox.classList.add('hidden'); }
    const buckets = buildBuckets(txns, range, gran);
    const values = buckets.map(b => Math.round(bucketTotal(b.txns, metric) * 100) / 100);
    const palette = chartPalette();
    const meta = METRIC_META[metric];
    const accent = chartType === 'bar'
        ? values.map(v => (metric === 'balance' && v < 0) ? '#ff3b30' : meta.color)
        : meta.color;

    charts.drill = new Chart(ctx, {
        type: chartType,
        data: {
            labels: buckets.map(b => b.label),
            datasets: [{
                label: meta.name,
                data: values,
                borderColor: meta.color,
                backgroundColor: chartType === 'line' ? meta.light : accent,
                borderWidth: chartType === 'line' ? 2 : 0,
                fill: chartType === 'line',
                tension: 0.35,
                pointRadius: buckets.length > 20 ? 0 : 3,
                pointHoverRadius: 6,
                pointBackgroundColor: meta.color,
                borderRadius: 5,
                maxBarThickness: 44,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (evt, elements) => {
                if (elements && elements.length) openBucketLedger(elements[0].index);
            },
            onHover: (evt, elements) => {
                const target = evt.native && evt.native.target;
                if (target) target.style.cursor = (elements && elements.length) ? 'pointer' : 'default';
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (c) => `${meta.name}: ${formatCurrency(c.raw)}` } },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: palette.text,
                        font: { size: 10, family: '-apple-system' },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: gran === 'day' ? 12 : 14,
                    },
                },
                y: {
                    grid: { color: palette.grid },
                    ticks: { color: palette.text, font: { size: 10 }, callback: (v) => state.settings.currency + v },
                },
            },
        },
    });
}

// Draws "分类名 12.3%" beside each slice with a leader line (no extra plugin needed)
const pieLabelPlugin = {
    id: 'qwenPieLabels',
    afterDatasetsDraw(chart) {
        const arcs = chart.getDatasetMeta(0).data;
        if (!arcs.length) return;
        const cx = arcs[0].x;
        const cy = arcs[0].y;
        const r = arcs[0].outerRadius || 0;
        if (!r) return;

        const ctx = chart.ctx;
        const data = chart.data.datasets[0].data;
        const total = data.reduce((s, v) => s + Math.abs(v), 0);
        if (!total) return;
        const compact = chart.width < 520;

        ctx.save();
        ctx.font = `500 ${compact ? 10 : 11}px -apple-system, "PingFang SC", sans-serif`;
        ctx.textBaseline = 'middle';

        const sides = { right: [], left: [] };
        let drawn = 0;
        arcs.forEach((arc, i) => {
            const pct = (Math.abs(data[i]) / total) * 100;
            const mid = (arc.startAngle + arc.endAngle) / 2;
            const pctText = pct < 0.1 ? '不足0.1%' : `${pct.toFixed(1)}%`;
            sides[Math.cos(mid) < 0 ? 'left' : 'right'].push({
                color: arc.options.backgroundColor,
                mid,
                y: cy + Math.sin(mid) * r,
                full: `${chart.data.labels[i]} ${pctText}`,
                short: pctText,
                text: '',
            });
        });

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#d1d1d6' : '#3a3a3c';
        const halo = isDark ? 'rgba(44,44,46,0.85)' : 'rgba(255,255,255,0.85)';

        ['right', 'left'].forEach(side => {
            const sign = side === 'right' ? 1 : -1;
            const items = sides[side];
            if (!items.length) return;
            const measure = t => ctx.measureText(t).width;
            const widestFull = items.reduce((w, it) => Math.max(w, measure(it.full)), 0);
            // narrow screens fall back to percentage-only labels so nothing is clipped
            const useFull = chart.width / 2 - widestFull - 22 >= r * 0.75;
            items.forEach(it => { it.text = useFull ? it.full : it.short; });
            const textW = items.reduce((w, it) => Math.max(w, measure(it.text)), 0);
            const labelR = Math.min(r + (compact ? 12 : 24), chart.width / 2 - textW - 20);
            if (labelR <= r * 0.7) return;
            const anchorX = cx + sign * (labelR + 10);
            // every slice gets a label, so the column is evenly spaced and the gap
            // shrinks to whatever the canvas height allows before lines are drawn
            const n = items.length;
            const gap = Math.max(10, Math.min(compact ? 14 : 16, (chart.height - 16) / n));
            const span = (n - 1) * gap;
            let startY = Math.max(8, Math.min(cy - span / 2, chart.height - 8 - span));
            items.sort((a, b) => a.y - b.y); // follow slice order top-to-bottom to avoid crossing lines
            items.forEach((it, i) => { it.y = startY + i * gap; });
            drawn += n;
            items.forEach(it => {
                const y = it.y;
                ctx.strokeStyle = it.color;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(it.mid) * r, cy + Math.sin(it.mid) * r);
                ctx.lineTo(cx + sign * (labelR + 2), y);
                ctx.lineTo(anchorX - sign * 4, y);
                ctx.stroke();
                ctx.fillStyle = it.color;
                ctx.fillRect(sign > 0 ? anchorX : anchorX - 6, y - 3, 6, 6);
                ctx.textAlign = sign > 0 ? 'left' : 'right';
                const textX = sign > 0 ? anchorX + 10 : anchorX - 10;
                ctx.lineJoin = 'round';
                ctx.lineWidth = 4;
                ctx.strokeStyle = halo;
                ctx.strokeText(it.text, textX, y);
                ctx.fillStyle = textColor;
                ctx.fillText(it.text, textX, y);
            });
        });
        chart.$pieLabelCount = drawn;
        ctx.restore();
    },
};

const doughnutTotalPlugin = {
    id: 'qwenDoughnutTotal',
    afterDraw(chart) {
        const area = chart.chartArea;
        if (!area) return;
        const cx = (area.left + area.right) / 2;
        const cy = (area.top + area.bottom) / 2;
        const r = Math.min(area.right - area.left, area.bottom - area.top) / 2;
        if (!r) return;
        const text = chart.$centerText || {};
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const { ctx } = chart;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isDark ? '#98989d' : '#8e8e93';
        ctx.font = '500 11px -apple-system, "PingFang SC", sans-serif';
        ctx.fillText(text.label || '', cx, cy - r * 0.24);
        ctx.fillStyle = isDark ? '#f5f5f7' : '#1d1d1f';
        ctx.font = `700 ${Math.max(12, Math.min(19, r * 0.28))}px -apple-system, "PingFang SC", sans-serif`;
        ctx.fillText(text.value || '', cx, cy + r * 0.1);
        ctx.restore();
    },
};

// Keep the top slices and merge the tail; 25 leaves room for a long tail of
// small categories while the adaptive label column still fits the canvas.
const PIE_MAX_SLICES = 25;
const PIE_OTHERS_COLOR = '#b2b2b7';

function topPieEntries(entries) {
    if (entries.length <= PIE_MAX_SLICES) return entries.map(e => ({ ...e, ids: [e.id] }));
    const top = entries.slice(0, PIE_MAX_SLICES).map(e => ({ ...e, ids: [e.id] }));
    const rest = entries.slice(PIE_MAX_SLICES);
    top.push({
        id: '__others__',
        ids: rest.map(e => e.id),
        name: `其余 ${rest.length} 项`,
        amount: rest.reduce((s, e) => s + e.amount, 0),
        signed: rest.reduce((s, e) => s + e.signed, 0),
    });
    return top;
}

function renderDrillPie(ctx, txns, metric) {
    if (typeof Chart === 'undefined') { loadChartLib().then(() => renderDrillPie(ctx, txns, metric)).catch(() => {}); return; }
    if (charts.drill) { charts.drill.destroy(); charts.drill = null; }
    const { entries: allEntries, sums } = categoryTotals(txns, metric);
    const entries = topPieEntries(allEntries);
    const labels = entries.map(e => e.name || getCategoryById(e.id)?.name || '未知分类');
    const data = entries.map(e => e.signed);
    const colors = entries.map(e => e.id === '__others__' ? PIE_OTHERS_COLOR : (getCategoryById(e.id)?.color || '#8e8e8e'));
    const gross = sums.gross;

    // leave room beside the ring for the leader-line labels on phones
    const narrow = (ctx.parentElement ? ctx.parentElement.clientWidth : 999) < 520;
    charts.drill = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 10, radius: narrow ? '78%' : '100%' }]},
        plugins: [pieLabelPlugin, doughnutTotalPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '52%',
            layout: { padding: { left: 28, right: 28, top: 10, bottom: 10 } },
            onClick: (evt, elements) => {
                if (!elements || !elements.length) return;
                const entry = entries[elements[0].index];
                if (entry) openLedgerForEntries(entry);
            },
            onHover: (evt, elements) => {
                const target = evt.native && evt.native.target;
                if (target) target.style.cursor = (elements && elements.length) ? 'pointer' : 'default';
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (c) => {
                            const pct = gross ? ((c.raw / gross) * 100).toFixed(1) : '0.0';
                            const value = metric === 'balance' ? entries[c.dataIndex].amount : c.raw;
                            return `${c.label}: ${formatCurrency(value)} (${pct}%)`;
                        },
                    },
                },
            },
        },
    });
    charts.drill.$centerText = { label: `${METRIC_META[metric].name}合计`, value: formatCurrency(sums.net) };
    renderPieLegend(entries, gross, metric);
}

// Colour-key list under the doughnut: the canvas labels drop to percent-only on
// narrow screens, so the category names live here instead
function renderPieLegend(entries, gross, metric) {
    const box = document.getElementById('pieLegend');
    if (!box) return;
    if (!entries || entries.length === 0 || gross <= 0) {
        box.innerHTML = '';
        pieLegendEntries = [];
        box.classList.add('hidden');
        return;
    }
    pieLegendEntries = entries;
    box.innerHTML = entries.map((e, i) => {
        const cat = e.id === '__others__' ? null : getCategoryById(e.id);
        const color = e.id === '__others__' ? PIE_OTHERS_COLOR : (cat?.color || '#8e8e8e');
        const name = cat?.name || e.name || '未知分类';
        const pct = ((e.signed / gross) * 100).toFixed(1);
        return `<div class="pie-legend-item" onclick="openPieLegendEntry(${i})">
            <span class="pl-dot" style="background:${color}"></span>
            <span class="pl-name">${name}</span>
            <span class="pl-pct">${pct}%</span>
        </div>`;
    }).join('');
    box.classList.remove('hidden');
}

let pieLegendEntries = [];

function openPieLegendEntry(i) {
    const entry = pieLegendEntries[i];
    if (entry) openLedgerForEntries(entry);
}

function renderBreakdownList() {
    const container = document.getElementById('drillBreakdownList');
    if (!container) return;
    const { range, txns } = getReportFiltered();
    const metric = state.reportMetric;
    const hint = document.getElementById('drillBreakdownHint');
    document.getElementById('drillBreakdownTitle').textContent = `${METRIC_META[metric].name}分类明细`;

    const { entries, sums } = categoryTotals(txns, metric);
    if (entries.length === 0) {
        hint.textContent = '点击分类查看每笔流水';
        container.innerHTML = `<div class="breakdown-empty">${range.label}暂无${METRIC_META[metric].name}记录</div>`;
        return;
    }
    // 结余按净额的占比展示，收入/支出按流水总额的占比展示
    const denominator = metric === 'balance' ? sums.net : sums.gross;
    hint.textContent = metric === 'balance' ? '占比 = 该分类净额 ÷ 净结余' : '点击分类查看每笔流水';
    const top = entries[0].signed || 1;
    // 默认只列前 10 个分类，其余折叠，点「展开」看全部
    const COLLAPSED = 10;
    const shown = state.breakdownExpanded ? entries : entries.slice(0, COLLAPSED);
    const hiddenCount = entries.length - shown.length;
    const rows = shown.map((e, i) => {
        const cat = getCategoryById(e.id);
        const color = cat?.color || '#8e8e8e';
        const pct = denominator ? ((metric === 'balance' ? e.amount : e.signed) / denominator) * 100 : 0;
        const sign = metric === 'balance' && e.amount < 0 ? '-' : '';
        return `
            <div class="breakdown-item" onclick="openLedgerForCategory('${e.id}')">
                <div class="breakdown-icon" style="background:${color}22;color:${color}">
                    <i class="fa-solid ${cat?.icon || 'fa-ellipsis'}"></i>
                </div>
                <div class="breakdown-main">
                    <div class="breakdown-head">
                        <span class="breakdown-name">${cat?.name || '未知分类'}<span class="breakdown-rank">${i + 1}</span></span>
                        <span class="breakdown-amount">${sign}${formatCurrency(Math.abs(e.amount))}<em>${pct.toFixed(1)}%</em></span>
                    </div>
                    <div class="breakdown-bar"><div class="breakdown-fill" style="width:${Math.max(3, (e.signed / top) * 100)}%;background:${color}"></div></div>
                </div>
                <i class="fa-solid fa-chevron-right breakdown-arrow"></i>
            </div>`;
    }).join('');
    let toggle = '';
    if (entries.length > COLLAPSED) {
        toggle = state.breakdownExpanded
            ? `<button class="breakdown-toggle" onclick="toggleBreakdown()"><i class="fa-solid fa-chevron-up"></i> 收起</button>`
            : `<button class="breakdown-toggle" onclick="toggleBreakdown()"><i class="fa-solid fa-chevron-down"></i> 展开其余 ${hiddenCount} 个分类</button>`;
    }
    container.innerHTML = rows + toggle;
}

function toggleBreakdown() {
    state.breakdownExpanded = !state.breakdownExpanded;
    renderBreakdownList();
}

// ---- Reports: ledger modal (category / trend bucket) ----
function openLedgerForCategory(categoryId) {
    openLedgerForEntries({ id: categoryId, ids: [categoryId] });
}

function openLedgerForEntries(entry) {
    const { range, txns } = getReportFiltered();
    const metric = state.reportMetric;
    const ids = entry.ids || [entry.id];
    const cat = ids.length === 1 ? getCategoryById(ids[0]) : null;
    openLedger({
        title: cat?.name || entry.name || '其他分类',
        subtitle: `${range.label} · ${METRIC_META[metric].name}`,
        ids,
        txns: ledgerScope(txns, ids, metric),
    });
}

function ledgerScope(txns, ids, metric) {
    const set = new Set(ids || []);
    return txns.filter(t => {
        if (set.size && !set.has(t.categoryId)) return false;
        return metric === 'balance' || t.type === metric;
    });
}

function openLedger({ title, subtitle, ids, txns, bucket = null, ignoreMetric = false }) {
    catLedgerTxns = txns;
    catLedgerIds = ids || [];
    catLedgerBucket = bucket;
    catLedgerIgnoreMetric = ignoreMetric;
    const single = catLedgerIds.length === 1 ? getCategoryById(catLedgerIds[0]) : null;
    const color = single?.color || 'var(--accent)';
    const iconEl = document.getElementById('catTxnIcon');
    iconEl.style.background = single ? `${color}22` : 'var(--accent-light)';
    iconEl.style.color = color;
    iconEl.innerHTML = `<i class="fa-solid ${single?.icon || 'fa-list-ul'}"></i>`;
    document.getElementById('catTxnTitle').textContent = title;
    document.getElementById('catTxnSubtitle').textContent = subtitle;
    renderCategoryLedger();
    document.getElementById('categoryTxnModal').classList.remove('hidden');
    raiseOverlay('categoryTxnModal');
}

function renderCategoryLedger() {
    const list = document.getElementById('catTxnList');
    const empty = document.getElementById('catTxnEmpty');
    const sorted = [...catLedgerTxns].sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date) || b.createdAt - a.createdAt);
    const income = sorted.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = sorted.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const summary = document.getElementById('catTxnSummary');

    if (sorted.length === 0) {
        list.innerHTML = '';
        summary.innerHTML = '<span class="cat-txn-summary-item">暂无记录</span>';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');
    const parts = [`<span class="cat-txn-summary-item">共 <b>${sorted.length}</b> 笔</span>`];
    const single = catLedgerIds.length === 1 ? getCategoryById(catLedgerIds[0]) : null;
    if (single) {
        parts.push(`<span class="cat-txn-summary-item ${single.type}">${single.type === 'income' ? '收入' : '支出'}合计 <b>${formatCurrency(single.type === 'income' ? income : expense)}</b></span>`);
    } else {
        parts.push(`<span class="cat-txn-summary-item income">收入 <b>${formatCurrency(income)}</b></span>`,
            `<span class="cat-txn-summary-item expense">支出 <b>${formatCurrency(expense)}</b></span>`);
    }
    summary.innerHTML = parts.join('');
    list.innerHTML = transactionGroupsHTML(sorted);
}

function closeCategoryTxnModal() {
    document.getElementById('categoryTxnModal').classList.add('hidden');
    catLedgerTxns = [];
    catLedgerIds = [];
    catLedgerBucket = null;
}

// Keep an open ledger in sync after add / edit / delete
function refreshCategoryLedger() {
    const modal = document.getElementById('categoryTxnModal');
    if (modal.classList.contains('hidden')) return;
    const { txns } = getReportFiltered();
    if (catLedgerBucket !== null) {
        const gran = activeGranularity();
        const inBucket = t => granularityValue(parseLocalDate(t.date), gran) === catLedgerBucket;
        catLedgerTxns = txns.filter(t => inBucket(t) && (state.reportMetric === 'balance' || t.type === state.reportMetric));
    } else {
        catLedgerTxns = ledgerScope(txns, catLedgerIds, catLedgerIgnoreMetric ? 'balance' : state.reportMetric);
    }
    renderCategoryLedger();
}

function initReportDrillListeners() {
    document.querySelectorAll('#view-reports .report-card.clickable').forEach(card => {
        card.addEventListener('click', () => setReportMetric(card.dataset.metric));
    });
    document.querySelectorAll('#view-reports .chart-type-toggle .type-ico-btn').forEach(btn => {
        btn.addEventListener('click', () => setReportChartType(btn.dataset.chart));
    });
    document.querySelectorAll('#view-reports .gran-btn').forEach(btn => {
        btn.addEventListener('click', () => setReportGranularity(btn.dataset.gran));
    });
}

// ---- Budget ----
function renderBudget() {
    const monthKey = getCurrentMonthKey();
    const monthExpenses = state.transactions.filter(t => t.type === 'expense' && getMonthKey(t.date) === monthKey);

    const totalBudget = state.budgets.reduce((s, b) => s + b.amount, 0);
    const totalSpent = state.budgets.reduce((s, b) => {
        const spent = monthExpenses.filter(t => t.categoryId === b.categoryId).reduce((s2, t) => s2 + t.amount, 0);
        return s + Math.min(spent, b.amount);
    }, 0);

    document.getElementById('totalBudget').textContent = formatCurrency(totalBudget);
    document.getElementById('totalSpent').textContent = formatCurrency(totalSpent);

    const totalPct = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
    const fillEl = document.getElementById('totalProgress');
    fillEl.style.width = totalPct + '%';
    fillEl.style.background = totalPct > 90 ? '#ff3b30' : totalPct > 70 ? '#ff9500' : '#007aff';

    const container = document.getElementById('budgetList');
    const empty = document.getElementById('emptyBudget');

    if (state.budgets.length === 0) {
        container.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    container.innerHTML = state.budgets.map(b => {
        const cat = getCategoryById(b.categoryId);
        const spent = monthExpenses.filter(t => t.categoryId === b.categoryId).reduce((s, t) => s + t.amount, 0);
        const pct = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
        const overflow = pct > 100;
        const barColor = overflow ? '#ff3b30' : pct > 80 ? '#ff9500' : cat?.color || '#007aff';
        const barWidth = Math.min(pct, 100);

        return `
            <div class="budget-item">
                <div class="budget-item-icon" style="background:${cat?.color || '#636e72'}22;color:${cat?.color || '#636e72'}">
                    <i class="fa-solid ${cat?.icon || 'fa-wallet'}"></i>
                </div>
                <div class="budget-item-info">
                    <div class="budget-item-name">${cat?.name || '未知'}</div>
                    <div class="budget-item-detail">${formatCurrency(spent)} / ${formatCurrency(b.amount)}</div>
                    <div class="budget-item-bar">
                        <div class="budget-item-fill" style="width:${barWidth}%;background:${barColor}"></div>
                    </div>
                </div>
                <div class="budget-item-actions">
                    <span class="budget-item-percent" style="color:${overflow ? '#ff3b30' : 'var(--text-primary)'}">${pct}%</span>
                    <button class="budget-delete" onclick="deleteBudget('${b.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

function openBudgetModal() {
    const select = document.getElementById('budgetCategorySelect');
    const expenseCats = state.categories.filter(c => c.type === 'expense');
    select.innerHTML = expenseCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    document.getElementById('budgetAmountInput').value = '';
    document.getElementById('budgetModal').classList.remove('hidden');
    raiseOverlay('budgetModal');
}

function closeBudgetModal() {
    document.getElementById('budgetModal').classList.add('hidden');
}

function saveBudget() {
    const categoryId = document.getElementById('budgetCategorySelect').value;
    const amount = parseFloat(document.getElementById('budgetAmountInput').value);

    if (!categoryId) { showToast('请选择分类', 'error'); return; }
    if (!amount || amount <= 0) { showToast('请输入有效金额', 'error'); return; }

    const existing = state.budgets.find(b => b.categoryId === categoryId);
    if (existing) {
        existing.amount = amount;
    } else {
        state.budgets.push({ id: uid(), categoryId, amount });
    }

    saveState();
    closeBudgetModal();
    renderBudget();
    showToast('预算已设置', 'success');
}

function deleteBudget(id) {
    addTombstone('budgets', id);
    state.budgets = state.budgets.filter(b => b.id !== id);
    saveState();
    renderBudget();
    showToast('预算已删除', 'success');
}

// ---- Categories ----
function renderCategories() {
    const expenseContainer = document.getElementById('expenseCategories');
    const incomeContainer = document.getElementById('incomeCategories');

    const expenseCats = state.categories.filter(c => c.type === 'expense');
    const incomeCats = state.categories.filter(c => c.type === 'income');

    const catCardHTML = (c) => {
        const count = state.transactions.filter(t => t.categoryId === c.id).length;
        return `
            <div class="category-card" data-id="${c.id}" data-type="${c.type}">
                <div class="category-card-icon" style="background:${c.color}22;color:${c.color}">
                    <i class="fa-solid ${c.icon}"></i>
                </div>
                <div>
                    <div class="category-card-name">${c.name}</div>
                    <div class="category-card-count">${count} 笔交易</div>
                </div>
            </div>
        `;
    };

    expenseContainer.innerHTML = expenseCats.map(catCardHTML).join('');
    incomeContainer.innerHTML = incomeCats.map(catCardHTML).join('');
    renderPaymentMethodsManage();
}

function openCategoryModal(id) {
    const modal = document.getElementById('categoryModal');
    const title = document.getElementById('categoryModalTitle');

    if (id) {
        state.editingCategoryId = id;
        const c = state.categories.find(x => x.id === id);
        if (!c) return;
        title.textContent = '编辑分类';
        state.selectedCategoryType = c.type;
        state.selectedIcon = c.icon;
        state.selectedColor = c.color;
        document.getElementById('catNameInput').value = c.name;
    } else {
        state.editingCategoryId = null;
        title.textContent = '新建分类';
        state.selectedCategoryType = 'expense';
        state.selectedIcon = 'fa-utensils';
        state.selectedColor = '#ff6b6b';
        document.getElementById('catNameInput').value = '';
    }

    document.querySelectorAll('#categoryModal .type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.catType === state.selectedCategoryType);
    });

    renderIconPicker();
    renderColorPicker();
    modal.classList.remove('hidden');
    raiseOverlay(modal);
}

function closeCategoryModal() {
    document.getElementById('categoryModal').classList.add('hidden');
    state.editingCategoryId = null;
}

function renderIconPicker() {
    const container = document.getElementById('iconPicker');
    container.innerHTML = ICON_OPTIONS.map(icon => `
        <div class="icon-pick-item ${icon === state.selectedIcon ? 'selected' : ''}"
             onclick="selectIcon('${icon}')">
            <i class="fa-solid ${icon}"></i>
        </div>
    `).join('');
}

function renderColorPicker() {
    const container = document.getElementById('colorPicker');
    container.innerHTML = COLOR_OPTIONS.map(color => `
        <div class="color-pick-item ${color === state.selectedColor ? 'selected' : ''}"
             style="background:${color}"
             onclick="selectColor('${color}')"></div>
    `).join('');
}

function selectIcon(icon) {
    state.selectedIcon = icon;
    renderIconPicker();
}

function selectColor(color) {
    state.selectedColor = color;
    renderColorPicker();
}

function saveCategory() {
    const name = document.getElementById('catNameInput').value.trim();
    if (!name) { showToast('请输入分类名称', 'error'); return; }

    if (state.editingCategoryId) {
        const c = state.categories.find(x => x.id === state.editingCategoryId);
        if (c) {
            c.name = name;
            c.icon = state.selectedIcon;
            c.color = state.selectedColor;
            c.type = state.selectedCategoryType;
        }
        showToast('分类已更新', 'success');
    } else {
        state.categories.push({
            id: 'c_' + uid(),
            name,
            icon: state.selectedIcon,
            color: state.selectedColor,
            type: state.selectedCategoryType,
        });
        showToast('分类已创建', 'success');
    }

    saveState();
    closeCategoryModal();
    renderCategories();
}

function moveCategory(id, direction) {
    const idx = state.categories.findIndex(c => c.id === id);
    if (idx === -1) return;
    const cat = state.categories[idx];

    // Find adjacent category of the same type
    let targetIdx = -1;
    if (direction === 'up') {
        for (let i = idx - 1; i >= 0; i--) {
            if (state.categories[i].type === cat.type) { targetIdx = i; break; }
        }
    } else {
        for (let i = idx + 1; i < state.categories.length; i++) {
            if (state.categories[i].type === cat.type) { targetIdx = i; break; }
        }
    }
    if (targetIdx === -1) return; // already at boundary

    // Swap positions
    [state.categories[idx], state.categories[targetIdx]] = [state.categories[targetIdx], state.categories[idx]];
    saveState();
    renderCategories();
}

function deleteCategory(id) {
    const cat = state.categories.find(c => c.id === id);
    if (!cat) return;
    const count = state.transactions.filter(t => t.categoryId === id).length;
    if (count > 0) {
        showToast(`该分类下有 ${count} 笔交易，无法删除`, 'error');
        return;
    }
    const sameTypeCount = state.categories.filter(c => c.type === cat.type).length;
    if (sameTypeCount <= 1) {
        showToast(cat.type === 'income' ? '至少保留一个收入分类' : '至少保留一个支出分类', 'error');
        return;
    }
    if (!confirm(`确定删除分类「${cat.name}」吗？`)) return;
    addTombstone('categories', id);
    state.budgets.filter(b => b.categoryId === id).forEach(b => addTombstone('budgets', b.id));
    state.categories = state.categories.filter(c => c.id !== id);
    state.budgets = state.budgets.filter(b => b.categoryId !== id);
    saveState();
    renderCategories();
    showToast('分类已删除', 'success');
}

// ---- Category action sheet (tap) & drag-to-reorder (long press) ----
let catSheetId = null;
let catDrag = null;          // active drag session
let catPress = null;         // pending long press
let catSuppressClick = false;

function openCatActionSheet(id) {
    const c = state.categories.find(x => x.id === id);
    if (!c) return;
    catSheetId = id;
    const icon = document.getElementById('catSheetIcon');
    icon.style.background = c.color + '22';
    icon.style.color = c.color;
    icon.innerHTML = `<i class="fa-solid ${c.icon}"></i>`;
    document.getElementById('catSheetTitle').textContent = c.name;
    document.getElementById('catActionSheet').classList.remove('hidden');
    raiseOverlay('catActionSheet');
}

function closeCatActionSheet() {
    document.getElementById('catActionSheet').classList.add('hidden');
    catSheetId = null;
}

function catSheetEdit() {
    const id = catSheetId;
    closeCatActionSheet();
    if (id) openCategoryModal(id);
}

function catSheetMove(direction) {
    const id = catSheetId;
    closeCatActionSheet();
    if (id) moveCategory(id, direction);
}

function catSheetDelete() {
    const id = catSheetId;
    closeCatActionSheet();
    if (id) deleteCategory(id);
}

function catCardFromEvent(e) {
    let el = e.target;
    while (el && el !== document) {
        if (el.classList && el.classList.contains('category-card') && el.dataset && el.dataset.id) return el;
        el = el.parentElement;
    }
    return null;
}

function onCatListClick(e) {
    if (catSuppressClick) { catSuppressClick = false; return; }
    const card = catCardFromEvent(e);
    if (card) openCatActionSheet(card.dataset.id);
}

// Long press = 450ms hold without moving
const CAT_PRESS_MS = 450;
const CAT_MOVE_TOLERANCE = 10;

function onCatTouchStart(e) {
    if (catDrag) return;
    const card = catCardFromEvent(e);
    if (!card) return;
    const t = e.touches[0];
    catPress = { card, x: t.clientX, y: t.clientY, timer: null };
    catPress.timer = setTimeout(() => startCatDrag(t.clientX, t.clientY), CAT_PRESS_MS);
}

function onCatTouchMove(e) {
    if (catDrag) {
        e.preventDefault();
        const t = e.touches[0];
        moveCatDrag(t.clientX, t.clientY);
        return;
    }
    if (!catPress) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - catPress.x) > CAT_MOVE_TOLERANCE ||
        Math.abs(t.clientY - catPress.y) > CAT_MOVE_TOLERANCE) {
        clearTimeout(catPress.timer);
        catPress = null;
    }
}

function onCatTouchEnd() {
    if (catDrag) { endCatDrag(); return; }
    if (catPress) { clearTimeout(catPress.timer); catPress = null; }
}

function onCatMouseDown(e) {
    if (catDrag || e.button !== 0) return;
    const card = catCardFromEvent(e);
    if (!card) return;
    catPress = { card, x: e.clientX, y: e.clientY, timer: null };
    catPress.timer = setTimeout(() => startCatDrag(e.clientX, e.clientY), CAT_PRESS_MS);
}

function onCatMouseMove(e) {
    if (catDrag) { moveCatDrag(e.clientX, e.clientY); return; }
    if (!catPress) return;
    if (Math.abs(e.clientX - catPress.x) > 5 || Math.abs(e.clientY - catPress.y) > 5) {
        clearTimeout(catPress.timer);
        catPress = null;
    }
}

function onCatMouseUp() {
    if (catDrag) { endCatDrag(); return; }
    if (catPress) { clearTimeout(catPress.timer); catPress = null; }
}

function startCatDrag(clientX, clientY) {
    if (!catPress) return;
    const card = catPress.card;
    catPress = null;
    const list = card.parentElement;
    if (!list) return;
    const rect = card.getBoundingClientRect();

    // Floating clone that follows the finger / cursor
    const ghost = card.cloneNode(true);
    ghost.classList.add('cat-drag-ghost');
    ghost.style.width = rect.width + 'px';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    document.body.appendChild(ghost);

    // Placeholder marks the drop slot in the list
    const placeholder = document.createElement('div');
    placeholder.className = 'cat-drag-placeholder';
    placeholder.style.height = rect.height + 'px';
    list.insertBefore(placeholder, card);
    card.style.display = 'none';

    catDrag = {
        id: card.dataset.id,
        type: card.dataset.type,
        list,
        ghost,
        placeholder,
        offX: clientX - rect.left,
        offY: clientY - rect.top
    };
    document.body.classList.add('cat-dragging');
    try { if (navigator.vibrate) navigator.vibrate(15); } catch (err) { /* ignore */ }
}

function moveCatDrag(x, y) {
    if (!catDrag) return;
    catDrag.ghost.style.left = (x - catDrag.offX) + 'px';
    catDrag.ghost.style.top = (y - catDrag.offY) + 'px';

    // Move placeholder to the slot under the finger (same list only)
    const cards = Array.from(catDrag.list.querySelectorAll('.category-card'))
        .filter(el => el.dataset.id !== catDrag.id);
    for (const el of cards) {
        const r = el.getBoundingClientRect();
        if (y < r.top + r.height / 2) {
            catDrag.list.insertBefore(catDrag.placeholder, el);
            return;
        }
    }
    catDrag.list.appendChild(catDrag.placeholder);
}

function endCatDrag() {
    if (!catDrag) return;
    const { id, type, list, ghost, placeholder } = catDrag;

    // Which card comes right after the drop slot? (skip the hidden source card)
    let nextEl = placeholder.nextElementSibling;
    if (nextEl && nextEl.dataset && nextEl.dataset.id === id) nextEl = nextEl.nextElementSibling;
    const nextId = (nextEl && nextEl.dataset && nextEl.dataset.id) ? nextEl.dataset.id : null;

    ghost.remove();
    placeholder.remove();
    document.body.classList.remove('cat-dragging');

    // Rebuild the order of this type's categories
    const ids = state.categories.filter(c => c.type === type).map(c => c.id);
    const newIds = ids.filter(i => i !== id);
    let insertAt = newIds.length;
    if (nextId) {
        const idx = newIds.indexOf(nextId);
        if (idx !== -1) insertAt = idx;
    }
    newIds.splice(insertAt, 0, id);

    const byId = {};
    state.categories.forEach(c => { byId[c.id] = c; });
    let k = 0;
    state.categories = state.categories.map(c => c.type === type ? byId[newIds[k++]] : c);

    catDrag = null;
    catSuppressClick = true; // swallow the click that follows pointerup
    saveState();
    renderCategories();
    showToast('分类顺序已更新', 'success');
}

function initCategoryInteractions() {
    ['expenseCategories', 'incomeCategories'].forEach(listId => {
        const list = document.getElementById(listId);
        if (!list) return;
        list.addEventListener('click', onCatListClick);
        list.addEventListener('touchstart', onCatTouchStart, { passive: true });
        list.addEventListener('touchmove', onCatTouchMove, { passive: false });
        list.addEventListener('touchend', onCatTouchEnd);
        list.addEventListener('touchcancel', onCatTouchEnd);
        list.addEventListener('mousedown', onCatMouseDown);
    });
    document.addEventListener('mousemove', onCatMouseMove);
    document.addEventListener('mouseup', onCatMouseUp);
}

// ---- Settings ----
// 备份提醒：超过 30 天没导出过就在设置页顶部提示；数据为空时不打扰
const BACKUP_REMIND_DAYS = 30;

function markExported() {
    state.lastExportAt = Date.now();
    saveState();
    renderBackupBanner();
}

function renderBackupBanner() {
    const banner = document.getElementById('backupBanner');
    if (!banner) return;
    const hasData = state.transactions.length > 0 || state.balances.length > 0 || state.returns.length > 0;
    if (!hasData) { banner.classList.add('hidden'); banner.innerHTML = ''; return; }
    const days = state.lastExportAt ? Math.floor((Date.now() - state.lastExportAt) / 86400000) : null;
    if (days !== null && days < BACKUP_REMIND_DAYS) { banner.classList.add('hidden'); banner.innerHTML = ''; return; }
    banner.classList.remove('hidden');
    banner.innerHTML = `
        <div class="bb-text">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>${days === null ? '你还没有导出过备份' : `已经 ${days} 天没有备份了`}。数据只存在这台设备的浏览器里，清缓存或换设备会丢失，建议定期导出一份。</span>
        </div>
        <button class="secondary-btn" onclick="document.getElementById('dataMgmtSection').scrollIntoView({behavior:'smooth'})"><i class="fa-solid fa-download"></i> 去备份</button>`;
}

function renderSettings() {
    document.getElementById('currencySelect').value = state.settings.currency;
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === state.settings.theme);
    });
    const dvSelect = document.getElementById('defaultViewSelect');
    if (dvSelect) dvSelect.value = state.settings.defaultView || 'transactions';
    const autoToggle = document.getElementById('autoOpenAddToggle');
    if (autoToggle) autoToggle.checked = !!state.settings.autoOpenAdd;
    updateICloudSyncUI();
    updateRemoteSyncUI();
    renderBackupBanner();
}

function applyTheme(theme) {
    state.settings.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    saveState();
    // Re-render charts with new colors
    if (state.currentView === 'reports') renderReports();
}

function setDefaultView(view) {
    state.settings.defaultView = view;
    saveState();
    showToast('已设置默认打开页面', 'success');
}

function setAutoOpenAdd(enabled) {
    state.settings.autoOpenAdd = enabled;
    saveState();
    showToast(enabled ? '已开启启动自动弹出记一笔' : '已关闭启动自动弹出', 'success');
}

// ---- Data Export/Import (Excel) ----
function exportData() {
    if (typeof XLSX === 'undefined') {
        showToast('正在加载 Excel 组件…', 'info');
        loadXlsxLib().then(() => exportData()).catch(() => showToast('Excel 组件加载失败', 'error'));
        return;
    }

    try {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Transactions
        // 带 ID 列，这样同一份表再导回去是按记录匹配而不是重复插入
        const txnData = state.transactions.map(t => {
            const cat = getCategoryById(t.categoryId);
            return {
                'ID': t.id,
                '日期': t.date,
                '时间': t.time || '',
                '类型': t.type === 'income' ? '收入' : '支出',
                '分类': cat?.name || '未知',
                '金额': t.amount,
                '支付方式': t.paymentMethod || '现金',
                '备注': t.note || '',
            };
        });
        const ws1 = XLSX.utils.json_to_sheet(txnData);
        ws1['!cols'] = [{wch:22},{wch:14},{wch:10},{wch:8},{wch:12},{wch:14},{wch:12},{wch:24}];
        XLSX.utils.book_append_sheet(wb, ws1, '交易记录');

        // Sheet 2: Categories
        const catData = state.categories.map(c => ({
            'ID': c.id,
            '名称': c.name,
            '类型': c.type === 'income' ? '收入' : '支出',
            '图标': c.icon,
            '颜色': c.color,
        }));
        const ws2 = XLSX.utils.json_to_sheet(catData);
        ws2['!cols'] = [{wch:20},{wch:14},{wch:8},{wch:20},{wch:14}];
        XLSX.utils.book_append_sheet(wb, ws2, '分类');

        // Sheet 3: Budgets
        const budData = state.budgets.map(b => {
            const cat = getCategoryById(b.categoryId);
            return {
                '分类': cat?.name || '未知',
                '预算金额': b.amount,
            };
        });
        const ws3 = XLSX.utils.json_to_sheet(budData);
        ws3['!cols'] = [{wch:20},{wch:14}];
        XLSX.utils.book_append_sheet(wb, ws3, '预算');

        // ---- 资产负债 / 四笔钱 / 投资收益 ----
        // 空数据也要保留表头，否则导出的表看起来像缺页
        const addSheet = (name, rows, headers, widths) => {
            const data = rows.length ? rows : [headers.reduce((o, h) => { o[h] = ''; return o; }, {})];
            const ws = XLSX.utils.json_to_sheet(data);
            ws['!cols'] = widths;
            XLSX.utils.book_append_sheet(wb, ws, name);
        };
        const kindName = k => (k === 'liability' ? '负债' : '资产');
        const bucketName = b => (FUND_BUCKETS.find(x => x.key === b)?.name) || '未归类';
        const round2 = v => Math.round((Number(v) || 0) * 100) / 100;

        addSheet('账户', state.accounts.map(a => ({
            '名称': a.name, '类型': kindName(a.kind), '分组': a.group || '', '四笔钱归类': a.kind === 'asset' ? bucketName(a.bucket) : '—',
        })), ['名称', '类型', '分组', '四笔钱归类'], [{wch:18},{wch:8},{wch:14},{wch:14}]);

        addSheet('余额明细', state.balances.map(b => {
            const a = accountById(b.accountId);
            return { '成员': b.member || '本人', '账户': a?.name || b.accountId, '类型': kindName(a?.kind), '月份': b.month, '金额': round2(b.amount) };
        }).sort((x, y) => x['月份'].localeCompare(y['月份']) || x['成员'].localeCompare(y['成员'])),
            ['成员', '账户', '类型', '月份', '金额'], [{wch:10},{wch:18},{wch:8},{wch:10},{wch:14}]);

        addSheet('资产负债汇总', balanceMonths().map(m => {
            const t = totalsFromMap(balancesAtMonth(m, 'all'));
            return { '月份': m, '总资产': round2(t.asset), '总负债': round2(t.liability), '净资产': round2(t.net), '负债率': (t.ratio * 100).toFixed(1) + '%' };
        }), ['月份', '总资产', '总负债', '净资产', '负债率'], [{wch:10},{wch:14},{wch:14},{wch:14},{wch:10}]);

        addSheet('投资收益明细', state.returns.map(r => {
            const a = accountById(r.accountId);
            return { '成员': r.member || '本人', '账户': a?.name || r.accountId, '月份': r.month, '收益': round2(r.amount) };
        }).sort((x, y) => x['月份'].localeCompare(y['月份']) || x['成员'].localeCompare(y['成员'])),
            ['成员', '账户', '月份', '收益'], [{wch:10},{wch:18},{wch:10},{wch:14}]);

        let __cum = 0;
        addSheet('投资收益汇总', returnMonths().map(m => {
            const v = returnSummary([m], 'all').total;
            __cum += v;
            return { '月份': m, '本期收益': round2(v), '累计收益': round2(__cum) };
        }), ['月份', '本期收益', '累计收益'], [{wch:10},{wch:14},{wch:14}]);

        const fundActual = fundActualByBucketFor('all');
        addSheet('四笔钱', FUND_BUCKETS.map(bk => {
            const tgt = state.fundTargets[bk.key] || 0;
            const act = fundActual[bk.key] || 0;
            return { '资金桶': bk.name, '目标金额': round2(tgt), '当前实际': round2(act), '差额': round2(act - tgt), '说明': bk.hint };
        }), ['资金桶', '目标金额', '当前实际', '差额', '说明'], [{wch:12},{wch:14},{wch:14},{wch:14},{wch:34}]);

        addSheet('保险清单', state.insurancePolicies.map(p => ({
            '成员': p.member || '本人', '险种': p.type, '是否已配置': p.covered ? '已配置' : '未配置',
            '保额': round2(p.amount), '年保费': round2(p.premium),
        })), ['成员', '险种', '是否已配置', '保额', '年保费'], [{wch:10},{wch:14},{wch:12},{wch:14},{wch:12}]);

        // Use XLSX.write to generate binary, then hand it to the save path
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        return saveGeneratedFile(blob, `记账本-${formatDateFull(new Date().toISOString())}.xlsx`)
            .then(cancelled => {
                if (cancelled) return;
                markExported();
                showToast('数据已导出为 Excel (.xlsx)', 'success');
            });
    } catch (err) {
        console.error('Export error:', err);
        showToast('导出失败: ' + err.message, 'error');
    }
}

// 表格里的月份可能是 "2026-09" / "2026/9" / "2026年09月" / Date / Excel 序列号
function normalizeImportMonth(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'string') {
        const m = v.trim().match(/^(\d{4})[-/年.]\s*(\d{1,2})/);
        if (m) {
            const mm = Number(m[2]);
            if (mm >= 1 && mm <= 12) return `${m[1]}-${String(mm).padStart(2, '0')}`;
        }
        return null;
    }
    if (v instanceof Date && !isNaN(v.getTime())) {
        return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}`;
    }
    if (typeof v === 'number' && isFinite(v) && v > 20000 && v < 80000) {
        const d = new Date(Math.round((v - 25569) * 86400000));
        if (!isNaN(d.getTime())) return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    return null;
}

function normalizeImportDate(v) {
    if (v == null || v === '') return todayStr();
    if (v instanceof Date && !isNaN(v.getTime())) {
        return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
    }
    if (typeof v === 'number' && isFinite(v)) {
        // Excel serial date: days since 1899-12-30
        const ms = Math.round((v - 25569) * 86400000);
        const d = new Date(ms);
        if (!isNaN(d.getTime()) && v > 20000 && v < 80000) {
            return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        }
        return todayStr();
    }
    const s = String(v).trim();
    // 2017-01-05 / 2017/1/5 / 2017.01.05 / 2017年1月5日
    const m = s.match(/^(\d{4})[-\/.年]\s*(\d{1,2})[-\/.月]\s*(\d{1,2})日?$/);
    if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return todayStr();
}

// ---- 选文件：桌面版走原生面板，浏览器走临时 input ----
function base64ToUint8(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

function base64ToText(b64) {
    try { return new TextDecoder('utf-8').decode(base64ToUint8(b64)); }
    catch (e) { return atob(b64); }
}

// 返回 {name, base64}；取消返回 null
function pickLocalFile(extensions) {
    const exts = extensions || [];
    if (isElectron() && window.electronAPI && typeof window.electronAPI.openFile === 'function') {
        return window.electronAPI.openFile({ extensions: exts })
            .then(r => (r && !r.cancelled && r.base64) ? { name: r.name, base64: r.base64 } : null)
            .catch(() => null);
    }
    return new Promise(resolve => {
        const inp = document.createElement('input');
        inp.type = 'file';
        // 故意不设 accept：iOS 上 accept=".json" 会让「文件」选择器直接是空的
        // （iOS 只列出它认识的文档类型）。读进来之后我们会再校验内容。
        inp.style.display = 'none';
        document.body.appendChild(inp);
        let settled = false;
        const done = v => { if (settled) return; settled = true; inp.remove(); resolve(v); };
        inp.addEventListener('change', () => {
            const f = inp.files && inp.files[0];
            if (!f) { done(null); return; }
            const fr = new FileReader();
            fr.onload = () => done({ name: f.name, base64: String(fr.result).split(',')[1] || '' });
            fr.onerror = () => done(null);
            fr.readAsDataURL(f);
        });
        // 浏览器点「取消」不会触发任何事件，超时兜底避免调用方永远挂着
        setTimeout(() => done(null), 300000);
        inp.click();
    });
}

// 把一本工作簿解析进 state（与文件从哪来无关）
function applyWorkbook(wb) {
            let txnAdded = 0, txnUpdated = 0;
            // 分类：按 ID 或名称 upsert，绝不删除本地已有分类
            const ws2 = wb.Sheets['分类'];
            if (ws2) {
                const catRows = XLSX.utils.sheet_to_json(ws2);
                catRows.forEach(row => {
                    const name = row['名称'] || '未知';
                    const type = row['类型'] === '收入' ? 'income' : 'expense';
                    const sheetId = String(row['ID'] || '').trim();
                    const found = (sheetId && state.categories.find(c => c.id === sheetId))
                        || state.categories.find(c => c.name === name && c.type === type);
                    if (found) {
                        found.icon = row['图标'] || found.icon;
                        found.color = row['颜色'] || found.color;
                        found.updatedAt = Date.now();
                    } else {
                        state.categories.push({
                            id: sheetId || ('c_' + uid()), name, type,
                            icon: row['图标'] || 'fa-ellipsis', color: row['颜色'] || '#636e72',
                            createdAt: Date.now(), updatedAt: Date.now(),
                        });
                    }
                });
            }

            // 交易：优先按表里的 ID 匹配，没有 ID 就用自然键，命中就地更新，否则新增。
            // （以前是整表替换 + 每行重新 uid()，同一份文件导两次数据直接翻倍）
            const ws1 = wb.Sheets['交易记录'];
            if (ws1) {
                const txnRows = XLSX.utils.sheet_to_json(ws1);
                const keyOf = t => `${t.date}|${t.time || ''}|${t.type}|${t.categoryId}|${t.amount}|${t.paymentMethod || ''}|${t.note || ''}`;
                const byId = new Map(state.transactions.map(t => [t.id, t]));
                const byKey = new Map(state.transactions.map(t => [keyOf(t), t]));
                txnAdded = 0; txnUpdated = 0;
                txnRows.forEach(row => {
                    const catName = row['分类'];
                    const cat = state.categories.find(c => c.name === catName);
                    const type = row['类型'] === '收入' ? 'income' : 'expense';
                    const rec = {
                        type,
                        amount: parseFloat(row['金额']) || 0,
                        categoryId: cat?.id || (type === 'income' ? 'i_other' : 'e_other'),
                        date: normalizeImportDate(row['日期']),
                        time: row['时间'] || '',
                        note: row['备注'] || '',
                        paymentMethod: row['支付方式'] || '现金',
                    };
                    const sheetId = String(row['ID'] || '').trim();
                    const existing = (sheetId && byId.get(sheetId)) || byKey.get(keyOf(rec));
                    if (existing) {
                        Object.assign(existing, rec);
                        existing.updatedAt = Date.now();
                        txnUpdated++;
                    } else {
                        const t = Object.assign({ id: sheetId || uid(), createdAt: Date.now(), updatedAt: Date.now() }, rec);
                        state.transactions.push(t);
                        byId.set(t.id, t); byKey.set(keyOf(t), t);
                        txnAdded++;
                    }
                });
                // Auto-register unknown payment methods from imported data
                txnRows.forEach(row => {
                    const pm = (row['支付方式'] || '').trim();
                    if (pm && !state.paymentMethods.includes(pm)) {
                        state.paymentMethods.push(pm);
                        state.pmAddedAt[pm] = Date.now();
                    }
                });
            }

            // 预算：一个分类一条，按 categoryId upsert
            const ws3 = wb.Sheets['预算'];
            if (ws3) {
                const budRows = XLSX.utils.sheet_to_json(ws3);
                budRows.forEach(row => {
                    const cat = state.categories.find(c => c.name === row['分类']);
                    const categoryId = cat?.id || 'e_other';
                    const amount = parseFloat(row['预算金额']) || 0;
                    const existing = state.budgets.find(b => b.categoryId === categoryId);
                    if (existing) { existing.amount = amount; }
                    else { state.budgets.push({ id: uid(), categoryId, amount }); }
                });
            }

            // 余额 / 收益：按「成员 + 账户名 + 月份」回写。账户名对不上的跳过并计数。
            const kindFromText = t => (t === '负债' ? 'liability' : (t === '资产' ? 'asset' : null));
            const accountByName = (name, kind) =>
                state.accounts.find(a => a.name === name && a.kind === kind) ||
                state.accounts.find(a => a.name === name);
            let unmatched = 0;

            const readRows = (sheetName, apply) => {
                const ws = wb.Sheets[sheetName];
                if (!ws) return;
                XLSX.utils.sheet_to_json(ws).forEach(r => apply(r));
            };

            readRows('余额明细', row => {
                const month = normalizeImportMonth(row['月份']);
                const amount = parseFloat(row['金额']);
                const acc = accountByName(String(row['账户'] || '').trim(), kindFromText(row['类型']));
                if (!month || !acc || !isFinite(amount)) { if (row['账户']) unmatched++; return; }
                const member = String(row['成员'] || '本人').trim() || '本人';
                if (!state.balanceMembers.includes(member)) state.balanceMembers.push(member);
                const id = `${member}__${acc.id}__${month}`;
                const existing = state.balances.find(b => b.id === id);
                if (existing) { existing.amount = amount; existing.updatedAt = Date.now(); }
                else state.balances.push({ id, member, accountId: acc.id, month, amount, createdAt: Date.now(), updatedAt: Date.now() });
            });

            readRows('投资收益明细', row => {
                const month = normalizeImportMonth(row['月份']);
                const amount = parseFloat(row['收益']);
                const acc = accountByName(String(row['账户'] || '').trim(), 'asset');
                if (!month || !acc || !isFinite(amount)) { if (row['账户']) unmatched++; return; }
                const member = String(row['成员'] || '本人').trim() || '本人';
                if (!state.balanceMembers.includes(member)) state.balanceMembers.push(member);
                const id = `${member}__${acc.id}__${month}`;
                const existing = state.returns.find(r => r.id === id);
                if (existing) { existing.amount = amount; existing.updatedAt = Date.now(); }
                else state.returns.push({ id, member, accountId: acc.id, month, amount, createdAt: Date.now(), updatedAt: Date.now() });
            });

    saveState();
    applyTheme(state.settings.theme);
    renderView(state.currentView);
    return { unmatched, txnAdded, txnUpdated };
}

async function importExcelFile() {
    if (typeof XLSX === 'undefined') {
        showToast('正在加载 Excel 组件…', 'info');
        try { await loadXlsxLib(); }
        catch (e) { showToast('Excel 组件加载失败', 'error'); return; }
    }
    const picked = await pickLocalFile(['xlsx', 'xls']);
    if (!picked) return;
    try {
        const wb = XLSX.read(base64ToUint8(picked.base64), { type: 'array', cellDates: true });
        const res = applyWorkbook(wb) || {};
        const summary = `新增 ${res.txnAdded || 0} 笔、更新 ${res.txnUpdated || 0} 笔`;
        showToast(res.unmatched ? `${summary}，${res.unmatched} 行账户名没对上已跳过` : summary,
            res.unmatched ? 'error' : 'success');
    } catch (err) {
        console.error('Import error:', err);
        showToast('导入失败，文件不是有效的 Excel', 'error');
    }
}

// 旧入口：隐藏 input 的 onchange 仍可用
function importData(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const finish = () => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
                const res = applyWorkbook(wb) || {};
                showToast(res.unmatched ? `${res.unmatched} 行账户名没对上已跳过` : 'Excel 数据已导入',
                    res.unmatched ? 'error' : 'success');
            } catch (err) {
                console.error('Import error:', err);
                showToast('导入失败，文件格式错误', 'error');
            }
            event.target.value = '';
        };
        reader.readAsArrayBuffer(file);
    };
    if (typeof XLSX === 'undefined') {
        showToast('正在加载 Excel 组件…', 'info');
        loadXlsxLib().then(() => importData(event)).catch(() => { showToast('Excel 组件加载失败', 'error'); event.target.value = ''; });
        return;
    }
    finish();
}

function loadSampleData() {
    const now = new Date();
    const samples = [];
    const expenseCats = DEFAULT_EXPENSE_CATEGORIES;
    const incomeCats = DEFAULT_INCOME_CATEGORIES;

    // Generate 3 months of data
    for (let m = 2; m >= 0; m--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
        const daysInMonth = getDaysInMonth(monthDate.getFullYear(), monthDate.getMonth() + 1);
        const maxDay = m === 0 ? now.getDate() : daysInMonth;

        // Monthly salary
        if (m < 2) {
            samples.push({
                id: uid(), type: 'income', amount: 12000 + Math.floor(Math.random() * 2000),
                categoryId: 'i_xinzi', date: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-01`,
                note: '月度工资', createdAt: Date.now() - m * 1000000,
            });
        }

        // Random expenses
        for (let d = 1; d <= maxDay; d++) {
            const numTxns = Math.floor(Math.random() * 4);
            for (let i = 0; i < numTxns; i++) {
                const cat = expenseCats[Math.floor(Math.random() * expenseCats.length)];
                let amount;
                if (cat.id === 'e_housing') amount = 3000 + Math.random() * 500;
                else if (cat.id === 'e_food') amount = 15 + Math.random() * 80;
                else if (cat.id === 'e_transport') amount = 5 + Math.random() * 50;
                else if (cat.id === 'e_shopping') amount = 50 + Math.random() * 300;
                else amount = 10 + Math.random() * 100;

                samples.push({
                    id: uid(), type: 'expense', amount: Math.round(amount * 100) / 100,
                    categoryId: cat.id,
                    date: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
                    note: '', createdAt: Date.now() - m * 1000000 + d * 1000 + i,
                });
            }
        }

        // Occasional income
        if (m === 0 && Math.random() > 0.5) {
            samples.push({
                id: uid(), type: 'income', amount: 500 + Math.floor(Math.random() * 1000),
                categoryId: 'i_zhuanqian', date: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}-15`,
                note: '项目奖金', createdAt: Date.now() - 500000,
            });
        }
    }

    // 资产负债示例：最近 6 个月，每月给主要账户记一次余额
    const balSeed = {
        a_debit:    [18200, 19650, 21300, 20450, 23800, 25600],
        a_cash:     [1200, 980, 1500, 1100, 1350, 1600],
        a_fixed:    [80000, 80000, 90000, 90000, 90000, 100000],
        a_mmf:      [12500, 13200, 12800, 14100, 15600, 16200],
        a_stock:    [45800, 42300, 47600, 51200, 48900, 55400],
        a_wealth:   [50000, 50000, 60000, 60000, 60000, 60000],
        a_fund:     [36800, 37600, 38400, 39200, 40100, 41000],
        a_house:    [2850000, 2850000, 2850000, 2850000, 2850000, 2850000],
        a_car:      [180000, 176000, 172000, 168000, 164000, 160000],
        l_credit:   [4200, 6800, 3100, 5400, 2900, 7300],
        l_install:  [880, 1450, 620, 2100, 980, 1650],
        l_mortgage: [1620000, 1611000, 1602000, 1593000, 1584000, 1575000],
    };
    const balMonths = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        balMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    // 家庭演示：账户类型共用，成员维度落在余额上。房贷/车/房归「家人」，其余归「本人」。
    if (!Array.isArray(state.balanceMembers) || !state.balanceMembers.length) state.balanceMembers = ['本人'];
    if (!state.balanceMembers.includes('家人')) state.balanceMembers.push('家人');
    const memberForAccount = (accountId) => (['a_house', 'a_car', 'l_mortgage'].includes(accountId) ? '家人' : '本人');
    state.balances = [];
    Object.entries(balSeed).forEach(([accountId, series]) => {
        if (!state.accounts.some(a => a.id === accountId)) return;
        const member = memberForAccount(accountId);
        balMonths.forEach((month, idx) => {
            state.balances.push({
                id: `${member}__${accountId}__${month}`, member, accountId, month, amount: series[idx],
                createdAt: Date.now(), updatedAt: Date.now(),
            });
        });
    });

    state.transactions = samples;

    // 投资收益示例：与余额同样的 6 个月，含亏损月份
    const retSeed = {
        a_stock:  [1200, -800, 2400, 3100, -1500, 2600],
        a_wealth: [320, 310, 340, 300, 350, 330],
        a_fixed:  [160, 160, 180, 180, 180, 200],
        a_mmf:    [45, 52, 48, 60, 55, 66],
    };
    state.returns = [];
    Object.entries(retSeed).forEach(([accountId, series]) => {
        if (!state.accounts.some(a => a.id === accountId)) return;
        const member = memberForAccount(accountId);
        balMonths.forEach((month, idx) => {
            state.returns.push({
                id: `${member}__${accountId}__${month}`, member, accountId, month, amount: series[idx],
                createdAt: Date.now(), updatedAt: Date.now(),
            });
        });
    });

    state.budgets = [
        { id: uid(), categoryId: 'e_food', amount: 2000 },
        { id: uid(), categoryId: 'e_transport', amount: 500 },
        { id: uid(), categoryId: 'e_shopping', amount: 1500 },
        { id: uid(), categoryId: 'e_entertain', amount: 800 },
    ];
    saveState();
    renderView(state.currentView);
    showToast('示例数据已加载', 'success');
}

function clearAllData() {
    if (!confirm('确定要清空所有数据吗？此操作不可恢复。')) return;

    // 先给每条记录打删除标记，「清空」才能真的同步到别的设备。
    // 之前这里把 state.deleted 直接清空，结果另一台设备一合并就把旧账全灌回来。
    state.transactions.forEach(t => addTombstone('transactions', t.id));
    state.budgets.forEach(b => addTombstone('budgets', b.id));
    state.balances.forEach(b => addTombstone('balances', b.id));
    state.returns.forEach(r => addTombstone('returns', r.id));
    state.insurancePolicies.forEach(p => addTombstone('insurance', p.id));

    // 内置账户/分类清完会立刻恢复默认，所以不给它们打墓碑（否则会被自己的墓碑吃掉）；
    // 只标记用户自己加的那些。
    const defaultAccountIds = new Set(DEFAULT_ACCOUNTS.map(a => a.id));
    const defaultCatIds = new Set([...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES].map(c => c.id));
    const defaultPm = new Set(DEFAULT_PAYMENT_METHODS);
    state.accounts.filter(a => !defaultAccountIds.has(a.id)).forEach(a => addTombstone('accounts', a.id));
    state.categories.filter(c => !defaultCatIds.has(c.id)).forEach(c => addTombstone('categories', c.id));
    state.paymentMethods.filter(p => !defaultPm.has(p)).forEach(p => addTombstone('paymentMethods', p));

    state.transactions = [];
    state.budgets = [];
    state.balances = [];
    state.returns = [];
    state.accounts = DEFAULT_ACCOUNTS.map(a => ({ ...a }));
    state.fundTargets = { cash: 0, steady: 0, growth: 0 };
    state.balanceMembers.filter(m => m !== '本人').forEach(m => addTombstone('members', m));
    state.balanceMembers = ['本人'];
    state.memberAddedAt = { '本人': Date.now() };
    state.balanceOwner = 'all';
    state.insuranceMembers.filter(m => m !== '本人').forEach(m => addTombstone('insuranceMembers', m));
    state.insuranceMembers = [...DEFAULT_INSURANCE_MEMBERS];
    state.insuranceMemberAddedAt = { '本人': Date.now() };
    state.insurancePolicies = [];
    state.categories = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES];
    state.paymentMethods = [...DEFAULT_PAYMENT_METHODS];
    // 故意不重置 state.deleted：这些墓碑就是「清空」本身
    state.pmAddedAt = {};
    saveState();
    renderView(state.currentView);
    refreshAccountLists();
    showToast('所有数据已清空', 'success');
}

// ==================== 资产负债 ====================
const BAL_METRICS = {
    asset:     { name: '资产', color: '#34c759', light: 'rgba(52, 199, 89, 0.14)' },
    liability: { name: '负债', color: '#ff3b30', light: 'rgba(255, 59, 48, 0.14)' },
    net:       { name: '净资产', color: '#007aff', light: 'rgba(0, 122, 255, 0.14)' },
};
let balanceRenderToken = 0;

function accountById(id) { return state.accounts.find(a => a.id === id); }

// 账户类型是全家共用的清单；成员维度作用在"余额记录"上，不是账户上
function balAccounts() { return state.accounts; }
function balanceMonths() { return [...new Set(state.balances.map(b => b.month))].sort(); }
function balanceYears() { return [...new Set(balanceMonths().map(m => m.slice(0, 4)))].sort(); }

// 只取「这个月本身」记过的账户。余额是快照不是流水，缺月不能拿上期顶替
function balancesAtMonth(month, member = state.balanceOwner) {
    const map = {};
    if (!month) return map;
    state.balances
        .filter(b => b.month === month && (member === 'all' || b.member === member))
        .forEach(b => { map[b.accountId] = (map[b.accountId] || 0) + (Number(b.amount) || 0); });
    return map;
}

function monthHasRecords(month) {
    return !!month && state.balances.some(b => b.month === month);
}

// 仅用于「沿用上期」按钮的预填，属于用户主动操作，不参与统计
function carriedBalances(month, member = state.balanceOwner) {
    const map = {};
    const members = member === 'all' ? [...new Set(state.balances.map(b => b.member))] : [member];
    members.forEach(mem => {
        state.accounts.forEach(a => {
            const hist = state.balances
                .filter(b => b.accountId === a.id && b.member === mem && b.month <= month)
                .sort((x, y) => x.month.localeCompare(y.month));
            if (hist.length) map[a.id] = (map[a.id] || 0) + (Number(hist[hist.length - 1].amount) || 0);
        });
    });
    return map;
}

function totalsFromMap(map) {
    let asset = 0, liability = 0;
    balAccounts().forEach(a => {
        const v = map[a.id];
        if (v === undefined || v === null) return;
        if (a.kind === 'asset') asset += v; else liability += v;
    });
    return { asset, liability, net: asset - liability, ratio: asset > 0 ? liability / asset : 0 };
}

// 解析当前期间：返回要展示的余额月份
function balancePeriodInfo() {
    const now = new Date();
    const months = balanceMonths();
    const years = balanceYears();
    const period = state.balancePeriod;
    const selYear = state.balanceYear || now.getFullYear();
    const selMonth = state.balanceMonth || (now.getMonth() + 1);

    if (period === 'all') {
        const month = months[months.length - 1] || null;
        return { period, title: '最新一期', month, exact: !!month };
    }
    if (period === 'year') {
        const month = months.filter(m => m.slice(0, 4) === String(selYear)).pop() || null;
        return { period, title: `${selYear}年`, month, exact: !!month };
    }
    const key = `${selYear}-${String(selMonth).padStart(2, '0')}`;
    return { period, title: `${selYear}年${selMonth}月`, month: key, exact: months.includes(key), selYear, selMonth };
}

function renderBalanceSelectors() {
    const yearWrap = document.getElementById('balanceYearWrap');
    const monthWrap = document.getElementById('balanceMonthWrap');
    const yearSelect = document.getElementById('balanceYearSelect');
    const monthSelect = document.getElementById('balanceMonthSelect');
    const now = new Date();

    // 默认看「有记录的最新月份」，不是今天。
    // 导入一份旧账本时如果停在当前月，页面会全是 0，看起来像什么都没导进来。
    // 用户手动选过之后（balanceYear/Month 非 null）就以他的选择为准。
    if (state.balanceYear == null || state.balanceMonth == null) {
        const all = balanceMonths();
        const latest = all[all.length - 1];
        if (latest) {
            if (state.balanceYear == null) state.balanceYear = Number(latest.slice(0, 4));
            if (state.balanceMonth == null) state.balanceMonth = Number(latest.slice(5, 7));
        }
    }

    const years = balanceYears().map(Number);
    years.push(now.getFullYear());
    const uniq = [...new Set(years)].sort((a, b) => b - a);
    let cur = state.balanceYear || now.getFullYear();
    if (!uniq.includes(cur)) cur = uniq[0];
    state.balanceYear = cur;
    yearSelect.innerHTML = uniq.map(y => `<option value="${y}" ${y === cur ? 'selected' : ''}>${y}年</option>`).join('');

    yearWrap.classList.toggle('hidden', state.balancePeriod === 'all');
    monthWrap.classList.toggle('hidden', state.balancePeriod !== 'month');
    if (state.balancePeriod === 'month') {
        const cm = state.balanceMonth || (now.getMonth() + 1);
        monthSelect.innerHTML = Array.from({ length: 12 }, (_, i) => i + 1)
            .map(m => `<option value="${m}" ${m === cm ? 'selected' : ''}>${m}月</option>`).join('');
    }
}

function updateBalanceToggleStates() {
    document.querySelectorAll('#view-balance .report-card.clickable').forEach(card => {
        card.classList.toggle('active', card.dataset.balMetric === state.balanceMetric);
    });
    document.querySelectorAll('#view-balance [data-bal-chart]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.balChart === state.balanceChartType);
    });
    document.querySelectorAll('#view-balance [data-bal-gran]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.balGran === balanceActiveGran());
    });
    const gran = document.getElementById('balGranularity');
    if (gran) gran.classList.toggle('hidden', state.balanceChartType === 'pie');
}

function balanceActiveGran() {
    return state.balanceGran || (state.balancePeriod === 'year' ? 'month' : 'month');
}

function setBalanceMetric(metric) {
    if (state.balanceMetric === metric) return;
    state.balanceMetric = metric;
    renderBalanceChart();
    renderBalanceBreakdown();
}

// 资产负债统计：只在年报 / 总 两个视图出现，逐月一行，日期从新到旧
function renderBalanceStats() {
    const card = document.getElementById('balanceStatsCard');
    const body = document.getElementById('balanceStatsBody');
    if (!card || !body) return;
    if (state.balancePeriod === 'month') {
        card.classList.add('hidden');
        body.innerHTML = '';
        return;
    }
    card.classList.remove('hidden');

    const all = balanceMonths();
    const months = state.balancePeriod === 'year'
        ? all.filter(m => m.slice(0, 4) === String(state.balanceYear || new Date().getFullYear()))
        : all;
    document.getElementById('balanceStatsSubtitle').textContent =
        state.balancePeriod === 'year' ? `${state.balanceYear}年 · 逐月` : '全部月份 · 逐月';

    if (months.length === 0) {
        body.innerHTML = '<tr><td colspan="4" class="bs-empty">该范围还没有余额记录</td></tr>';
        return;
    }
    // 紧凑金额：去掉 ¥ 和千位分隔符，去掉多余的小数尾零，保证窄屏放得下
    const bsMoney = (v, cls) => {
        const sign = v < 0 ? '-' : '';
        const abs = Math.abs(v);
        let str = abs.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
        return `<span class="bs-num${v < 0 ? ' neg' : ''}${cls ? ' ' + cls : ''}">${sign}${str}</span>`;
    };
    body.innerHTML = months.slice().reverse().map(m => {
        const t = totalsFromMap(balancesAtMonth(m));
        const [y, mm] = m.split('-');
        const dateLabel = state.balancePeriod === 'year' ? `${Number(mm)}月` : `${y}.${Number(mm)}`;
        return `
        <tr class="bs-row" onclick="openAccountHistoryForPeriod('${m}', '${y}年${Number(mm)}月')">
            <td class="bs-label">${dateLabel}</td>
            <td>${bsMoney(t.asset, 'income')}</td>
            <td>${bsMoney(t.liability, 'expense')}</td>
            <td>${bsMoney(t.net)}</td>
        </tr>`;
    }).join('');
}

function setBalanceChartType(type) {
    if (state.balanceChartType === type) return;
    state.balanceChartType = type;
    renderBalanceChart();
}

function setBalanceGran(gran) {
    if (state.balanceGran === gran) return;
    state.balanceGran = gran;
    renderBalanceChart();
}

function balanceShowEmpty(message) {
    const empty = document.getElementById('balanceChartEmpty');
    empty.textContent = message;
    empty.classList.remove('hidden');
    document.getElementById('balanceChart').parentElement.classList.add('hidden');
    if (charts.balance) { charts.balance.destroy(); charts.balance = null; }
    updateBalanceToggleStates();
}

function balanceHideEmpty() {
    document.getElementById('balanceChartEmpty').classList.add('hidden');
    document.getElementById('balanceChart').parentElement.classList.remove('hidden');
}

function renderBalance() {
    renderBalanceSelectors();

    const info = balancePeriodInfo();
    const recorded = monthHasRecords(info.month);
    const map = recorded ? balancesAtMonth(info.month) : {};
    const t = totalsFromMap(map);

    document.getElementById('balTotalAsset').textContent = formatCurrency(t.asset);
    document.getElementById('balTotalLiability').textContent = formatCurrency(t.liability);
    document.getElementById('balNetWorth').textContent = formatCurrency(t.net);
    document.getElementById('balRatio').textContent = (t.ratio * 100).toFixed(1) + '%';
    const asOf = document.getElementById('balAsOf');
    asOf.textContent = !info.month
        ? '尚无记录'
        : (recorded ? `截至 ${info.month.replace('-', '年')}月` : '该期未记录');

    renderBalanceChart();
    renderBalanceBreakdown();
    renderBalanceStats();
    renderBalanceMemberBar();
    renderFamilySummary();
}

function balanceTrendMonths() {
    const all = balanceMonths();
    if (!all.length) return [];
    const info = balancePeriodInfo();
    if (balanceActiveGran() === 'year') {
        // 按年 = 该年最后一个有记录的月份，即年末值
        return balanceYears().map(y => ({
            key: all.filter(m => m.slice(0, 4) === y).pop(),
            label: `${y}年`,
        }));
    }
    if (state.balancePeriod === 'year') {
        const y = String(state.balanceYear || new Date().getFullYear());
        return Array.from({ length: 12 }, (_, i) => {
            const m = `${y}-${String(i + 1).padStart(2, '0')}`;
            return { key: m, label: `${i + 1}月` };
        });
    }
    const end = info.month || all[all.length - 1];
    return all.filter(m => m <= end).map(m => {
        const [y, mm] = m.split('-');
        return { key: m, label: `${y.slice(2)}年${Number(mm)}月` };
    });
}

function renderBalanceChart() {
    const info = balancePeriodInfo();
    const metric = state.balanceMetric;
    const meta = BAL_METRICS[metric];
    const chartType = state.balanceChartType;

    document.getElementById('balChartTitle').textContent =
        chartType === 'pie' ? `${meta.name}构成占比` : `${meta.name}走势`;
    const subtitle = document.getElementById('balChartSubtitle');
    const parts = [!info.month ? '尚无数据'
        : (monthHasRecords(info.month) ? `${info.month.replace('-', '年')}月记录` : `${info.month.replace('-', '年')}月未记录`)];
    if (chartType !== 'pie') parts.push(balanceActiveGran() === 'year' ? '按年' : '按月');
    parts.push('点击图表可查看该期明细');
    subtitle.textContent = parts.join(' · ');

    updateBalanceToggleStates();

    if (!info.month) {
        balanceShowEmpty('还没有记录过余额，点右上角「记余额」建立第一期');
        return;
    }
    balanceHideEmpty();

    const token = ++balanceRenderToken;
    requestAnimationFrame(() => {
        if (token !== balanceRenderToken) return;
        const ctx = document.getElementById('balanceChart');
        if (!ctx) return;
        if (chartType === 'pie') renderBalancePie(ctx, info);
        else renderBalanceTrend(ctx, chartType, meta, metric);
    });
}

function balanceSeriesValue(map, metric) {
    const t = totalsFromMap(map);
    return metric === 'asset' ? t.asset : (metric === 'liability' ? t.liability : t.net);
}

// 某个月的净资产/总资产/总负债；该月没记录就返回 null（图表上留空，不走平线）
function balanceValueAt(month, metric) {
    if (!monthHasRecords(month)) return null;
    const v = balanceSeriesValue(balancesAtMonth(month), metric);
    return Math.round(v * 100) / 100;
}

function renderBalanceTrend(ctx, chartType, meta, metric) {
    if (typeof Chart === 'undefined') { loadChartLib().then(() => renderBalanceTrend(ctx, chartType, meta, metric)).catch(() => {}); return; }
    if (charts.balance) { charts.balance.destroy(); charts.balance = null; }
    const buckets = balanceTrendMonths();
    const values = buckets.map(b => balanceValueAt(b.key, metric));
    const palette = chartPalette();
    const accent = chartType === 'bar'
        ? values.map(v => (metric === 'net' && v < 0) ? '#ff3b30' : meta.color)
        : meta.color;

    charts.balance = new Chart(ctx, {
        type: chartType,
        data: {
            labels: buckets.map(b => b.label),
            datasets: [{
                label: meta.name,
                data: values,
                borderColor: meta.color,
                backgroundColor: chartType === 'line' ? meta.light : accent,
                borderWidth: chartType === 'line' ? 2 : 0,
                fill: chartType === 'line',
                spanGaps: true,
                tension: 0.3,
                pointRadius: buckets.length > 24 ? 0 : 3,
                pointHoverRadius: 6,
                pointBackgroundColor: meta.color,
                borderRadius: 5,
                maxBarThickness: 40,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (evt, elements) => {
                if (!elements || !elements.length) return;
                const b = balanceTrendMonths()[elements[0].index];
                if (b) openAccountHistoryForPeriod(b.key, b.label);
            },
            onHover: (evt, elements) => {
                const target = evt.native && evt.native.target;
                if (target) target.style.cursor = (elements && elements.length) ? 'pointer' : 'default';
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (c) => `${meta.name}: ${formatCurrency(c.raw)}` } },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: palette.text, font: { size: 10, family: '-apple-system' }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
                },
                y: {
                    grid: { color: palette.grid },
                    ticks: { color: palette.text, font: { size: 10 }, callback: (v) => state.settings.currency + (Math.abs(v) >= 10000 ? (v / 10000).toFixed(0) + '万' : v) },
                },
            },
        },
    });
}

// 构成：资产/负债按账户，净资产按各账户净贡献
function balancePieEntries(info, metric) {
    const map = balancesAtMonth(info.month);
    const rows = [];
    balAccounts().forEach(a => {
        const v = map[a.id];
        if (v === undefined || v === null || v === 0) return;
        if (metric === 'asset' && a.kind !== 'asset') return;
        if (metric === 'liability' && a.kind !== 'liability') return;
        const amount = metric === 'net' ? (a.kind === 'asset' ? v : -v) : v;
        rows.push({ id: a.id, amount, signed: Math.abs(amount) });
    });
    rows.sort((x, y) => y.signed - x.signed);
    return rows;
}

function renderBalancePie(ctx, info) {
    if (typeof Chart === 'undefined') { loadChartLib().then(() => renderBalancePie(ctx, info)).catch(() => {}); return; }
    if (charts.balance) { charts.balance.destroy(); charts.balance = null; }
    const metric = state.balanceMetric;
    const entries = topPieEntries(balancePieEntries(info, metric));
    const gross = entries.reduce((s, e) => s + e.signed, 0);
    const net = entries.reduce((s, e) => s + e.amount, 0);
    if (!entries.length || gross <= 0) {
        balanceShowEmpty(`该期没有可统计的${BAL_METRICS[metric].name}数据`);
        return;
    }
    balanceHideEmpty();
    const labels = entries.map(e => e.name || accountById(e.id)?.name || '未知');
    const colors = entries.map(e => e.id === '__others__' ? PIE_OTHERS_COLOR : (accountById(e.id)?.color || '#8e8e8e'));

    charts.balance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: entries.map(e => e.signed), backgroundColor: colors, borderWidth: 0, hoverOffset: 10, radius: (ctx.parentElement ? ctx.parentElement.clientWidth : 999) < 520 ? '68%' : '100%' }] },
        plugins: [pieLabelPlugin, doughnutTotalPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '52%',
            layout: { padding: { left: 28, right: 28, top: 10, bottom: 10 } },
            onClick: (evt, elements) => {
                if (!elements || !elements.length) return;
                const e = entries[elements[0].index];
                if (e) openAccountHistoryForAccount(e.ids && e.ids.length === 1 ? e.ids[0] : null, e.name);
            },
            onHover: (evt, elements) => {
                const target = evt.native && evt.native.target;
                if (target) target.style.cursor = (elements && elements.length) ? 'pointer' : 'default';
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (c) => {
                            const pct = gross ? ((c.raw / gross) * 100).toFixed(1) : '0.0';
                            return `${c.label}: ${formatCurrency(c.raw)} (${pct}%)`;
                        },
                    },
                },
            },
        },
    });
    charts.balance.$centerText = { label: `${BAL_METRICS[metric].name}合计`, value: formatCurrency(net) };
}

function renderBalanceBreakdown() {
    const container = document.getElementById('balBreakdownList');
    if (!container) return;
    const info = balancePeriodInfo();
    const metric = state.balanceMetric;
    const meta = BAL_METRICS[metric];
    document.getElementById('balBreakdownTitle').textContent = `${meta.name}账户明细`;

    // 列出该维度下的全部账户；当月没记过的显示「—」，不补数也不累加
    const accounts = balAccounts().filter(a =>
        metric === 'net' ? true : a.kind === (metric === 'asset' ? 'asset' : 'liability'));
    if (!accounts.length) {
        container.innerHTML = '<div class="breakdown-empty">还没有账户，点右上角「账户」添加</div>';
        return;
    }
    const map = monthHasRecords(info.month) ? balancesAtMonth(info.month) : {};
    const rows = accounts.map(a => {
        const raw = map[a.id];
        const amount = raw === undefined ? null
            : (metric === 'net' && a.kind === 'liability' ? -raw : raw);
        return { a, amount, signed: amount === null ? -1 : Math.abs(amount) };
    });
    rows.sort((x, y) => y.signed - x.signed);
    const total = rows.reduce((sum, r) => sum + (r.signed > 0 ? r.signed : 0), 0);
    const top = rows.length && rows[0].signed > 0 ? rows[0].signed : 1;

    container.innerHTML = rows.map((r, i) => {
        const a = r.a;
        const color = a.color || '#8e8e8e';
        const has = r.amount !== null;
        const pct = has && total ? (r.signed / total) * 100 : 0;
        const sign = metric === 'net' && r.amount < 0 ? '-' : '';
        return `
            <div class="breakdown-item${has ? '' : ' bd-empty-row'}" onclick="openAccountHistoryForAccount('${a.id}')">
                <div class="breakdown-icon" style="background:${color}22;color:${color}">
                    <i class="fa-solid ${a.icon || 'fa-ellipsis'}"></i>
                </div>
                <div class="breakdown-main">
                    <div class="breakdown-head">
                        <span class="breakdown-name">${a.name}${has ? `<span class="breakdown-rank">${i + 1}</span>` : ''}</span>
                        <span class="breakdown-amount">${has ? `${sign}${formatCurrency(Math.abs(r.amount))}<em>${pct.toFixed(1)}%</em>` : '<span class="bd-no">未记录</span>'}</span>
                    </div>
                    <div class="breakdown-bar"><div class="breakdown-fill" style="width:${has ? Math.max(3, (r.signed / top) * 100) : 0}%;background:${color}"></div></div>
                </div>
                <span class="bal-group-tag">${a.group || ''}</span>
                <i class="fa-solid fa-chevron-right breakdown-arrow"></i>
            </div>`;
    }).join('');
}

// ---------------- 账户历史弹窗 ----------------
let historyAccountId = null;

function openAccountHistoryForAccount(accountId, fallbackName) {
    if (!accountId) { openAccountHistoryForPeriod(balancePeriodInfo().month, '其余账户'); return; }
    historyAccountId = accountId;
    const a = accountById(accountId);
    const iconEl = document.getElementById('acctHistIcon');
    const color = a?.color || 'var(--accent)';
    iconEl.style.background = a ? `${color}22` : 'var(--accent-light)';
    iconEl.style.color = color;
    iconEl.innerHTML = `<i class="fa-solid ${a?.icon || 'fa-building-columns'}"></i>`;
    document.getElementById('acctHistTitle').textContent = a?.name || fallbackName || '账户历史';
    document.getElementById('acctHistSub').textContent = a
        ? `${a.kind === 'asset' ? '资产' : '负债'} · ${a.group}` : '';
    const del = document.getElementById('acctHistDelete');
    del.style.display = a ? 'flex' : 'none';
    del.onclick = () => deleteAccountFromHistory(accountId);
    renderAccountHistory();
    document.getElementById('accountHistoryModal').classList.remove('hidden');
    raiseOverlay('accountHistoryModal');
}

function openAccountHistoryForPeriod(month, label) {
    if (!month) return;
    historyAccountId = null;
    const map = balancesAtMonth(month);
    const t = totalsFromMap(map);
    const iconEl = document.getElementById('acctHistIcon');
    iconEl.style.background = 'var(--accent-light)';
    iconEl.style.color = 'var(--accent)';
    iconEl.innerHTML = '<i class="fa-solid fa-calendar-day"></i>';
    document.getElementById('acctHistTitle').textContent = label || month;
    document.getElementById('acctHistSub').textContent = `${month.replace('-', '年')}月余额`;
    const del = document.getElementById('acctHistDelete');
    del.style.display = 'none';
    const rows = balAccounts().filter(a => map[a.id] !== undefined).sort((x, y) => map[y.id] - map[x.id]);
    document.getElementById('acctHistSummary').innerHTML = `
        <span class="cat-txn-summary-item income">资产 <b>${formatCurrency(t.asset)}</b></span>
        <span class="cat-txn-summary-item expense">负债 <b>${formatCurrency(t.liability)}</b></span>
        <span class="cat-txn-summary-item">净资产 <b>${formatCurrency(t.net)}</b></span>`;
    document.getElementById('acctHistList').innerHTML = rows.length
        ? rows.map(a => `
            <div class="breakdown-item" onclick="closeAccountHistoryModal();openAccountHistoryForAccount('${a.id}')">
                <div class="breakdown-icon" style="background:${a.color}22;color:${a.color}"><i class="fa-solid ${a.icon}"></i></div>
                <div class="breakdown-main">
                    <div class="breakdown-head">
                        <span class="breakdown-name">${a.name}</span>
                        <span class="breakdown-amount">${a.kind === 'liability' ? '-' : ''}${formatCurrency(map[a.id])}</span>
                    </div>
                </div>
                <span class="bal-group-tag">${a.group}</span>
            </div>`).join('')
        : '<div class="breakdown-empty">该期没有余额记录</div>';
    document.getElementById('accountHistoryModal').classList.remove('hidden');
    raiseOverlay('accountHistoryModal');
}

function renderAccountHistory() {
    const a = accountById(historyAccountId);
    if (!a) return;
    const all = state.balanceOwner === 'all';
    const scoped = state.balances.filter(b => b.accountId === historyAccountId && (all || b.member === state.balanceOwner));
    // 按月份聚合（'all' 时同月多成员合并），用于期数/最新/环比
    const byMonth = {};
    scoped.forEach(b => { byMonth[b.month] = (byMonth[b.month] || 0) + (Number(b.amount) || 0); });
    const monthKeys = Object.keys(byMonth).sort((x, y) => y.localeCompare(x));
    const hist = scoped.slice().sort((x, y) => y.month.localeCompare(x.month) || String(x.member).localeCompare(String(y.member)));
    const latest = monthKeys.length ? byMonth[monthKeys[0]] : undefined;
    const prev = monthKeys.length > 1 ? byMonth[monthKeys[1]] : undefined;
    const delta = (latest !== undefined && prev !== undefined) ? latest - prev : 0;
    document.getElementById('acctHistSummary').innerHTML = `
        <span class="cat-txn-summary-item">共 <b>${monthKeys.length}</b> 期</span>
        <span class="cat-txn-summary-item">最新 <b>${latest !== undefined ? formatCurrency(latest) : '—'}</b></span>
        ${prev !== undefined ? `<span class="cat-txn-summary-item ${delta >= 0 ? 'income' : 'expense'}">环比 <b>${delta >= 0 ? '+' : ''}${formatCurrency(delta)}</b></span>` : ''}`;
    document.getElementById('acctHistList').innerHTML = hist.length
        ? hist.map(b => `
            <div class="bal-history-row">
                <span class="bh-month">${b.month.replace('-', '年')}月${all ? `<span class="bh-member">${_esc(b.member || '')}</span>` : ''}</span>
                <span class="bh-amount">${formatCurrency(b.amount)}</span>
                <button class="bh-delete" onclick="deleteBalanceSnapshot('${b.id}')" title="删除这一期"><i class="fa-solid fa-xmark"></i></button>
            </div>`).join('')
        : '<div class="breakdown-empty">该账户还没有记录过余额</div>';
}

function deleteBalanceSnapshot(id) {
    if (!confirm('删除这一期的余额记录？')) return;
    addTombstone('balances', id);
    state.balances = state.balances.filter(b => b.id !== id);
    saveState();
    renderAccountHistory();
    renderBalance();
    showToast('已删除该期余额', 'success');
}

function deleteAccountFromHistory(accountId) {
    const a = accountById(accountId);
    if (!a) return;
    if (!confirm(`确定删除账户「${a.name}」吗？其余额记录也会一并删除。`)) return;
    removeAccount(accountId);
    closeAccountHistoryModal();
    showToast('账户已删除', 'success');
}

function removeAccount(accountId) {
    addTombstone('accounts', accountId);
    state.balances.filter(b => b.accountId === accountId).forEach(b => addTombstone('balances', b.id));
    state.returns.filter(r => r.accountId === accountId).forEach(r => addTombstone('returns', r.id));
    state.accounts = state.accounts.filter(a => a.id !== accountId);
    state.balances = state.balances.filter(b => b.accountId !== accountId);
    state.returns = state.returns.filter(r => r.accountId !== accountId);
    saveState();
    renderView(state.currentView);
    refreshAccountLists();
    refreshAccountsModalIfOpen();
}

function closeAccountHistoryModal() {
    document.getElementById('accountHistoryModal').classList.add('hidden');
    historyAccountId = null;
}

// ---------------- 记余额弹窗 ----------------
function openBalanceModal(month) {
    const info = balancePeriodInfo();
    const input = document.getElementById('balanceMonthInput');
    input.value = month || info.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const ms = document.getElementById('balanceMemberSelect');
    if (ms) ms.value = state.balanceOwner !== 'all' ? state.balanceOwner : (state.balanceMembers[0] || '本人');
    renderBalanceEntry();
    document.getElementById('balanceModal').classList.remove('hidden');
    raiseOverlay('balanceModal');
}

function closeBalanceModal() {
    document.getElementById('balanceModal').classList.add('hidden');
}

function renderBalanceEntry() {
    const month = document.getElementById('balanceMonthInput').value;
    const ms = document.getElementById('balanceMemberSelect');
    if (ms) {
        const want = ms.value || state.balanceMembers[0] || '本人';
        ms.innerHTML = state.balanceMembers.map(m => `<option ${m === want ? 'selected' : ''}>${m}</option>`).join('');
    }
    const member = ms ? ms.value : (state.balanceMembers[0] || '本人');
    document.getElementById('balanceModalSub').textContent = month ? `${member} · ${month.replace('-', '年')}月底各账户余额` : '请先选择月份';
    const existing = balancesAtMonth(month, member);
    const list = document.getElementById('balanceEntryList');
    if (!state.accounts.length) {
        list.innerHTML = '<div class="breakdown-empty">还没有账户，先到「账户」里添加</div>';
        return;
    }
    ensureAccountOrder();
    const rowHTML = a => `
        <div class="bal-entry-row">
            <div class="breakdown-icon" style="background:${a.color}22;color:${a.color}"><i class="fa-solid ${a.icon}"></i></div>
            <div class="be-name">${_esc(a.name)}<span class="be-kind ${a.kind}">${_esc(a.group || '')}</span></div>
            <div class="be-input">
                <span class="currency-symbol">${state.settings.currency}</span>
                <input type="number" step="0.01" min="0" class="text-input be-field" data-account="${a.id}"
                       value="${existing[a.id] !== undefined ? existing[a.id] : ''}" placeholder="0">
            </div>
        </div>`;
    const beSections = [['asset', '资产'], ['liability', '负债']];
    list.innerHTML = beSections.map(([kind, label]) => {
        const rows = accountsSortedByKind(kind);
        if (!rows.length) return '';
        return `<div class="be-section-title ${kind}">${label}账户（${rows.length}）</div>` + rows.map(rowHTML).join('');
    }).join('');
}

function previousMonthOf(month) {
    if (!month) return null;
    const [y, m] = month.split('-').map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function copyLastMonthBalances() {
    const month = document.getElementById('balanceMonthInput').value;
    const prev = previousMonthOf(month);
    if (!prev) { showToast('没有更早的记录可沿用', 'error'); return; }
    const member = (document.getElementById('balanceMemberSelect') || {}).value || state.balanceMembers[0] || '本人';
    const src = carriedBalances(prev, member);
    document.querySelectorAll('#balanceEntryList .be-field').forEach(inp => {
        const v = src[inp.dataset.account];
        if (v !== undefined && !inp.value) inp.value = v;
    });
    showToast(`已沿用 ${prev.replace('-', '年')}月的余额`, 'success');
}

function clearBalanceInputs() {
    document.querySelectorAll('#balanceEntryList .be-field').forEach(inp => { inp.value = ''; });
}

function saveBalances() {
    const month = document.getElementById('balanceMonthInput').value;
    if (!month) { showToast('请选择月份', 'error'); return; }
    const member = (document.getElementById('balanceMemberSelect') || {}).value || state.balanceMembers[0] || '本人';
    let saved = 0;
    document.querySelectorAll('#balanceEntryList .be-field').forEach(inp => {
        const raw = inp.value.trim();
        if (raw === '') return;
        const amount = parseFloat(raw);
        if (!isFinite(amount) || amount < 0) return;
        const accountId = inp.dataset.account;
        const id = `${member}__${accountId}__${month}`;
        const existing = state.balances.find(b => b.id === id);
        if (existing) {
            existing.amount = amount;
            existing.updatedAt = Date.now();
        } else {
            state.balances.push({ id, member, accountId, month, amount, createdAt: Date.now(), updatedAt: Date.now() });
        }
        saved += 1;
    });
    if (!saved) { showToast('没有需要保存的金额', 'error'); return; }
    saveState();
    closeBalanceModal();
    state.balancePeriod = 'month';
    const [y, m] = month.split('-').map(Number);
    state.balanceYear = y;
    state.balanceMonth = m;
    document.querySelectorAll('[data-bal-period]').forEach(b => b.classList.toggle('active', b.dataset.balPeriod === 'month'));
    renderBalance();
    showToast(`已保存 ${saved} 个账户的余额`, 'success');
}

// ---------------- 账户管理弹窗 ----------------
function openAccountsModal() {
    const sel = document.getElementById('newAccountGroup');
    sel.innerHTML = (kind => (kind === 'asset' ? ASSET_GROUPS : LIABILITY_GROUPS).map(g => `<option>${g}</option>`).join(''))(document.getElementById('newAccountKind').value);
    renderAccountManageList();
    document.getElementById('accountsModal').classList.remove('hidden');
    raiseOverlay('accountsModal');
}

function closeAccountsModal() { document.getElementById('accountsModal').classList.add('hidden'); }

function renderAccountManageList() {
    ensureAccountOrder();
    const box = document.getElementById('accountManageList');
    if (!box) return;
    const memberChips = state.balanceMembers.map(m =>
        `<span class="fam-chip">${_esc(m)}<i class="fa-solid fa-pen" data-act="rename" data-member="${_esc(m)}"></i><i class="fa-solid fa-xmark" data-act="del" data-member="${_esc(m)}"></i></span>`).join('');
    const sections = [['asset', '资产账户'], ['liability', '负债账户']];
    box.innerHTML = `
        <div class="account-section-title">家庭成员</div>
        <div class="fam-chips">${memberChips}<button class="fam-add" data-add="1"><i class="fa-solid fa-plus"></i> 添加</button></div>
        <div class="account-hint">账户类型全家共用；记录余额时再选择是本人的还是家人的。</div>
    ` + sections.map(([kind, label]) => {
        const rows = accountsSortedByKind(kind);
        return `
            <div class="account-section-title">${label}（${rows.length}）<span class="acct-order-hint">↑↓ 可调顺序</span></div>
            ${rows.map((a, i) => `
                <div class="account-row">
                    <div class="breakdown-icon" style="background:${a.color}22;color:${a.color}"><i class="fa-solid ${a.icon}"></i></div>
                    <div class="ar-name" onclick="renameAccount('${a.id}')">${_esc(a.name)}<span class="be-kind ${a.kind}">${_esc(a.group || '')}</span></div>
                    <select class="acct-kind-select" data-kind-account="${a.id}" title="账户类型">
                        <option value="asset" ${a.kind === 'asset' ? 'selected' : ''}>资产</option>
                        <option value="liability" ${a.kind === 'liability' ? 'selected' : ''}>负债</option>
                    </select>
                    <select class="acct-group-select" data-group-account="${a.id}" title="账户分类">
                        ${groupsForKind(a.kind).map(g => `<option value="${g}" ${a.group === g ? 'selected' : ''}>${g}</option>`).join('')}
                    </select>
                    <span class="acct-move-group">
                        <button class="acct-move" data-move-account="${a.id}" data-dir="-1" ${i === 0 ? 'disabled' : ''} title="上移"><i class="fa-solid fa-arrow-up"></i></button>
                        <button class="acct-move" data-move-account="${a.id}" data-dir="1" ${i === rows.length - 1 ? 'disabled' : ''} title="下移"><i class="fa-solid fa-arrow-down"></i></button>
                    </span>
                    <button class="bh-delete" onclick="deleteAccountFromList('${a.id}')" title="删除"><i class="fa-solid fa-trash"></i></button>
                </div>`).join('') || '<div class="breakdown-empty">暂无账户</div>'}`;
    }).join('');

    if (!box.$acctWired) {
        box.$acctWired = true;
        box.addEventListener('change', e => {
            const kindSel = e.target.closest ? e.target.closest('[data-kind-account]') : null;
            if (kindSel) { changeAccountType(kindSel.dataset.kindAccount, kindSel.value); return; }
            const grpSel = e.target.closest ? e.target.closest('[data-group-account]') : null;
            if (grpSel) changeAccountGroup(grpSel.dataset.groupAccount, grpSel.value);
        });
        box.addEventListener('click', e => {
            const btn = e.target.closest ? e.target.closest('[data-move-account]') : null;
            if (!btn || btn.disabled) return;
            moveAccount(btn.dataset.moveAccount, Number(btn.dataset.dir));
        });
    }

    if (!box.$memberWired) {
        box.$memberWired = true;
        box.addEventListener('click', e => {
            const el = e.target.closest ? e.target.closest('[data-act],[data-add]') : null;
            if (!el) return;
            if (el.dataset.add) { addBalanceMember(); return; }
            const name = el.dataset.member;
            if (name === undefined) return;
            if (el.dataset.act === 'rename') renameBalanceMember(name);
            else if (el.dataset.act === 'del') deleteBalanceMember(name);
        });
    }
}

function addAccount() {
    const name = document.getElementById('newAccountName').value.trim();
    const kind = document.getElementById('newAccountKind').value;
    const group = document.getElementById('newAccountGroup').value;
    if (!name) { showToast('请输入账户名称', 'error'); return; }
    if (state.accounts.some(a => a.name === name)) { showToast('已有同名账户', 'error'); return; }
    const palette = ['#007aff', '#34c759', '#ff9500', '#af52de', '#5ac8fa', '#ff3b30', '#a2845e', '#30b0c7'];
    state.accounts.push({
        id: 'acc_' + uid(),
        name, kind, group,
        icon: kind === 'asset' ? 'fa-wallet' : 'fa-credit-card',
        color: palette[state.accounts.length % palette.length],
        order: state.accounts.reduce((m, a) => Math.max(m, a.order || 0), 0) + 1,
        createdAt: Date.now(), updatedAt: Date.now(),
    });
    document.getElementById('newAccountName').value = '';
    saveState();
    renderAccountManageList();
    refreshAccountLists();
    refreshAccountsModalIfOpen();
    showToast('账户已添加', 'success');
}

function renameAccount(id) {
    const a = accountById(id);
    if (!a) return;
    const name = prompt('账户名称', a.name);
    if (!name || !name.trim() || name.trim() === a.name) return;
    a.name = name.trim();
    a.updatedAt = Date.now();
    saveState();
    renderAccountManageList();
    refreshAccountsModalIfOpen();
    renderBalance();
    showToast('已重命名', 'success');
}

function deleteAccountFromList(id) {
    const a = accountById(id);
    if (!a) return;
    const count = state.balances.filter(b => b.accountId === id).length;
    if (!confirm(`确定删除「${a.name}」吗？${count ? `它的 ${count} 期余额记录也会一并删除。` : ''}`)) return;
    removeAccount(id);
    showToast('账户已删除', 'success');
}

function refreshAccountLists() {
    if (state.currentView === 'balance') renderBalance();
    if (state.currentView === 'returns') renderReturns();
    // 记收益弹窗开着时，新增/删除账户要立刻反映到列表里
    const retModal = document.getElementById('returnModal');
    if (retModal && !retModal.classList.contains('hidden')) renderReturnEntry();
}

function initBalanceListeners() {
    document.querySelectorAll('[data-bal-period]').forEach(btn => {
        btn.addEventListener('click', () => {
            state.balancePeriod = btn.dataset.balPeriod;
            state.balanceGran = null;
            document.querySelectorAll('[data-bal-period]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderBalance();
        });
    });
    document.querySelectorAll('#view-balance [data-bal-chart]').forEach(btn => {
        btn.addEventListener('click', () => setBalanceChartType(btn.dataset.balChart));
    });
    document.querySelectorAll('#view-balance [data-bal-gran]').forEach(btn => {
        btn.addEventListener('click', () => setBalanceGran(btn.dataset.balGran));
    });
    document.querySelectorAll('#view-balance .report-card.clickable').forEach(card => {
        card.addEventListener('click', () => setBalanceMetric(card.dataset.balMetric));
    });
    document.getElementById('balanceYearSelect').addEventListener('change', e => {
        state.balanceYear = parseInt(e.target.value);
        renderBalance();
    });
    document.getElementById('balanceMonthSelect').addEventListener('change', e => {
        state.balanceMonth = parseInt(e.target.value);
        renderBalance();
    });
    document.getElementById('balanceMonthInput').addEventListener('change', renderBalanceEntry);
    const balMemberSel = document.getElementById('balanceMemberSelect');
    if (balMemberSel) balMemberSel.addEventListener('change', renderBalanceEntry);
    document.getElementById('newAccountKind').addEventListener('change', () => {
        const kind = document.getElementById('newAccountKind').value;
        document.getElementById('newAccountGroup').innerHTML =
            (kind === 'asset' ? ASSET_GROUPS : LIABILITY_GROUPS).map(g => `<option>${g}</option>`).join('');
    });
}

// 账户排序：order 决定「账户管理」里的显示顺序（新增的排最后）
function ensureAccountOrder() {
    let max = 0, changed = false;
    state.accounts.forEach(a => { if (typeof a.order === 'number' && a.order > max) max = a.order; });
    state.accounts.forEach(a => {
        if (typeof a.order !== 'number') {
            max += 1; a.order = max;
            // 时间戳必须一起刷：合并按 updatedAt 取新，否则这份 order 会被云端旧副本盖掉
            a.updatedAt = Date.now();
            changed = true;
        }
    });
    // 去重：两台设备各自分配过同号，合并后会出现并列。并列时排序退化到按名字，
    // 交换两个同号也等于没交换 —— 这就是"有时能调、有时调不动"的原因。
    const seen = new Set();
    let dup = false;
    state.accounts.forEach(a => { if (seen.has(a.order)) dup = true; else seen.add(a.order); });
    if (dup) {
        state.accounts.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.name).localeCompare(String(b.name)))
            .forEach((a, i) => {
                const v = i + 1;
                if (a.order !== v) { a.order = v; a.updatedAt = Date.now(); changed = true; }
            });
    }
    return changed;
}

// 某类型下可选的分类
function groupsForKind(kind) { return kind === 'liability' ? LIABILITY_GROUPS : ASSET_GROUPS; }

// 修改账户的具体分类（流动资金 / 储蓄存款 / 投资理财 …）
function changeAccountGroup(id, group) {
    const a = accountById(id);
    if (!a || a.group === group) return;
    if (!groupsForKind(a.kind).includes(group)) { showToast('该分类不适用于此账户类型', 'error'); return; }
    a.group = group;
    a.updatedAt = Date.now();
    saveState();
    renderAccountManageList();
    refreshAccountLists();
    refreshAccountsModalIfOpen();
    showToast(`「${a.name}」已归到${group}`, 'success');
}

// 账户管理弹窗开着时，任何改动都要立刻重画列表
// （以前 removeAccount 只刷新了页面主体，弹窗里的行还留在原地）
function refreshAccountsModalIfOpen() {
    const m = document.getElementById('accountsModal');
    if (m && !m.classList.contains('hidden')) renderAccountManageList();
}

// 按当前排序取出同类型的账户列表
function accountsSortedByKind(kind) {
    return state.accounts
        .filter(a => a.kind === kind)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.name).localeCompare(String(b.name)));
}

// 上移 / 下移：与相邻的同类型账户交换 order，并更新时间戳让它同步出去
function moveAccount(id, dir) {
    ensureAccountOrder();
    const siblings = accountsSortedByKind(accountById(id)?.kind);
    const idx = siblings.findIndex(a => a.id === id);
    const other = siblings[idx + dir];
    if (!other) return;
    const a = accountById(id), b = other;
    const tmp = a.order; a.order = b.order; b.order = tmp;
    a.updatedAt = b.updatedAt = Date.now();
    saveState();
    renderAccountManageList();
    refreshAccountsModalIfOpen();
    showToast('已调整顺序', 'success');
}

// 修改账户类型：资产 <-> 负债（余额/收益记录不动，统计口径自动变）
function changeAccountType(id, kind) {
    const a = accountById(id);
    if (!a || a.kind === kind) return;
    a.kind = kind;
    // 原来挂在资产下的分类（如"流动资金"）对负债不成立，落到该类型的第一个分类
    if (!groupsForKind(kind).includes(a.group)) a.group = groupsForKind(kind)[0];
    a.updatedAt = Date.now();
    saveState();
    renderAccountManageList();
    refreshAccountLists();
    refreshAccountsModalIfOpen();
    showToast(`「${a.name}」已改为${kind === 'asset' ? '资产' : '负债'}账户`, 'success');
}

// ==================== 四笔钱 ====================
// 三个资产桶（活钱/稳健/长期）按最新一期余额汇总，保险保障是配置清单，不占资产比例。

let fundEditMember = null;   // 保险清单当前编辑的成员

function fundLatestMonth() {
    const m = balanceMonths();
    return m[m.length - 1] || null;
}

function fundActualByBucket() {
    const month = fundLatestMonth();
    const map = month ? balancesAtMonth(month) : {};
    const out = { cash: 0, steady: 0, growth: 0, unassigned: 0 };
    state.accounts.filter(a => a.kind === 'asset').forEach(a => {
        const v = map[a.id] || 0;
        if (a.bucket && out[a.bucket] !== undefined) out[a.bucket] += v;
        else out.unassigned += v;
    });
    return out;
}

// 按指定成员口径算三桶实际金额。页面跟随当前筛选，导出固定用家庭口径。
function fundActualByBucketFor(member) {
    const month = fundLatestMonth();
    const map = month ? balancesAtMonth(month, member) : {};
    const out = { cash: 0, steady: 0, growth: 0 };
    state.accounts.filter(a => a.kind === 'asset').forEach(a => {
        if (map[a.id] === undefined || out[a.bucket] === undefined) return;
        out[a.bucket] += map[a.id];
    });
    return out;
}

function fundTotalAssets() {
    const b = fundActualByBucket();
    return b.cash + b.steady + b.growth + b.unassigned;
}

function fundLiabilities() {
    const month = fundLatestMonth();
    const map = month ? balancesAtMonth(month) : {};
    return state.accounts.filter(a => a.kind === 'liability').reduce((s, a) => s + (map[a.id] || 0), 0);
}

// 某类型（可含成员）是否已配置
function insPolicy(type, member) {
    return state.insurancePolicies.find(p => p.type === type && p.member === member);
}
function insTypeCovered(type) {
    return state.insurancePolicies.some(p => p.type === type && p.covered);
}
function insTypeAmount(type) {
    return state.insurancePolicies.filter(p => p.type === type && p.covered)
        .reduce((s, p) => s + (Number(p.amount) || 0), 0);
}
function insCoveredCount() {
    return INSURANCE_TYPES.filter(insTypeCovered).length;
}
function insTotalAmount() {
    return INSURANCE_TYPES.reduce((s, t) => s + insTypeAmount(t), 0);
}
function insTotalPremium() {
    return state.insurancePolicies.filter(p => p.covered).reduce((s, p) => s + (Number(p.premium) || 0), 0);
}

function renderFourFunds() {
    if (!document.getElementById('view-funds')) return;
    if (!fundEditMember || !state.insuranceMembers.includes(fundEditMember)) {
        fundEditMember = state.insuranceMembers[0] || '本人';
    }
    renderFundQuadrant();
    renderFundCards();
    renderFundDonut();
    renderInsuranceSection();
    renderFundDebt();
    renderFundUnassigned();
}

// ---- 顶部 2×2 象限 ----
function renderFundQuadrant() {
    const box = document.getElementById('fundQuadrant');
    if (!box) return;
    const actual = fundActualByBucket();
    const total = fundTotalAssets();
    const cells = FUND_BUCKETS.map(bk => {
        const act = actual[bk.key] || 0;
        const tgt = state.fundTargets[bk.key] || 0;
        const pct = tgt > 0 ? Math.min(act / tgt, 1) : (act > 0 ? 1 : 0);
        const share = total > 0 ? Math.round(act / total * 100) : 0;
        return `
        <div class="fq-cell" style="--fq-color:${bk.color}">
            <div class="fq-fill" style="width:${(pct * 100).toFixed(0)}%"></div>
            <div class="fq-name"><i class="fa-solid ${bk.icon}"></i> ${bk.name}</div>
            <div class="fq-act">${formatCurrency(act)}</div>
            <div class="fq-meta">目标 ${formatCurrency(tgt)} · 占 ${share}%</div>
        </div>`;
    });
    const insDone = insCoveredCount();
    cells.push(`
        <div class="fq-cell fq-ins" style="--fq-color:#af52de">
            <div class="fq-fill" style="width:${(insDone / INSURANCE_TYPES.length * 100).toFixed(0)}%"></div>
            <div class="fq-name"><i class="fa-solid fa-umbrella"></i> 保险保障</div>
            <div class="fq-act">${insDone}/${INSURANCE_TYPES.length} 已配</div>
            <div class="fq-meta">总保额 ${formatCurrency(insTotalAmount())}</div>
        </div>`);
    box.innerHTML = cells.join('');
}

// ---- 三张资产桶卡片（实际/目标/进度 + 目标编辑）----
function renderFundCards() {
    const box = document.getElementById('fundCards');
    if (!box) return;
    const actual = fundActualByBucket();
    const total = fundTotalAssets();
    box.innerHTML = FUND_BUCKETS.map(bk => {
        const act = actual[bk.key] || 0;
        const tgt = state.fundTargets[bk.key] || 0;
        const pct = tgt > 0 ? (act / tgt * 100) : 0;
        const gap = act - tgt;
        const share = total > 0 ? (act / total * 100) : 0;
        const sharePct = total > 0 ? (act / total * 100).toFixed(1) : '0.0';
        return `
        <div class="fund-card">
            <div class="fc-head">
                <span class="fc-title"><i class="fa-solid ${bk.icon}" style="color:${bk.color}"></i> ${bk.name}</span>
                <span class="fc-hint">${bk.hint}</span>
            </div>
            <div class="fc-nums">
                <div class="fc-act" style="color:${bk.color}">${formatCurrency(act)}</div>
                <div class="fc-share">占资产 ${sharePct}%</div>
            </div>
            <div class="fc-bar"><div class="fc-bar-fill" style="width:${Math.min(pct, 100).toFixed(0)}%;background:${bk.color}"></div></div>
            <div class="fc-target">
                <span>目标</span>
                <span class="fc-cur">${state.settings.currency}</span>
                <input type="number" class="fc-amt" data-bucket="${bk.key}" value="${tgt || ''}" placeholder="0" inputmode="decimal">
                <span class="fc-pctsep">或</span>
                <input type="number" class="fc-pct" data-bucket="${bk.key}" value="${total > 0 ? (tgt / total * 100).toFixed(0) : ''}" placeholder="%" inputmode="numeric">
                <span>%</span>
            </div>
            <div class="fc-gap ${gap < 0 ? 'under' : 'ok'}">${tgt > 0 ? (gap < 0 ? `还差 ${formatCurrency(-gap)}` : `已达标，超出 ${formatCurrency(gap)}`) : '未设目标'}</div>
        </div>`;
    }).join('');
    box.querySelectorAll('.fc-amt').forEach(inp => inp.addEventListener('change', () => setFundTarget(inp.dataset.bucket, parseFloat(inp.value) || 0, 'amount')));
    box.querySelectorAll('.fc-pct').forEach(inp => inp.addEventListener('change', () => setFundTargetPct(inp.dataset.bucket, parseFloat(inp.value) || 0)));
}

function setFundTarget(key, amount) {
    state.fundTargets[key] = Math.max(0, amount || 0);
    saveState();
    renderFourFunds();
}
function setFundTargetPct(key, pct) {
    const total = fundTotalAssets();
    state.fundTargets[key] = Math.max(0, Math.round(total * (pct || 0) / 100 * 100) / 100);
    saveState();
    renderFourFunds();
}

// ---- 三桶实际配比环形图 ----
let fundChart = null;
function renderFundDonut() {
    const canvas = document.getElementById('fundDonut');
    if (!canvas) return;
    const draw = () => {
        const actual = fundActualByBucket();
        const labels = FUND_BUCKETS.map(b => b.name).concat(actual.unassigned > 0 ? ['未分配'] : []);
        const data = FUND_BUCKETS.map(b => Math.round((actual[b.key] || 0) * 100) / 100)
            .concat(actual.unassigned > 0 ? [Math.round(actual.unassigned * 100) / 100] : []);
        const colors = FUND_BUCKETS.map(b => b.color).concat(actual.unassigned > 0 ? ['#c7c7cc'] : []);
        if (typeof Chart === 'undefined') { loadChartLib().then(draw).catch(() => {}); return; }
        if (fundChart) fundChart.destroy();
        const empty = document.getElementById('fundDonutEmpty');
        const total = data.reduce((s, v) => s + v, 0);
        if (total <= 0) { if (empty) empty.classList.remove('hidden'); if (canvas) canvas.parentElement.classList.add('hidden'); fundChart = null; return; }
        if (empty) empty.classList.add('hidden');
        if (canvas) canvas.parentElement.classList.remove('hidden');
        fundChart = new Chart(canvas, {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 8, radius: (canvas.parentElement.clientWidth < 520) ? '72%' : '100%' }] },
            plugins: [pieLabelPlugin, doughnutTotalPlugin],
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '55%',
                layout: { padding: { left: 24, right: 24, top: 8, bottom: 8 } },
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.label}: ${formatCurrency(c.raw)}` } } },
            },
        });
        fundChart.$centerText = { label: '总资产', value: formatCurrency(total) };
    };
    draw();
}

// ---- 负债单独一行 ----
function renderFundDebt() {
    const el = document.getElementById('fundDebtRow');
    if (!el) return;
    const liab = fundLiabilities();
    const assets = fundTotalAssets();
    const ratio = assets > 0 ? (liab / assets * 100).toFixed(1) : '0.0';
    el.innerHTML = `<span class="fd-label"><i class="fa-solid fa-credit-card"></i> 负债（不计入四笔钱）</span>
        <span class="fd-val">总负债 ${formatCurrency(liab)} · 负债率 ${ratio}%</span>`;
}

// ---- 未分配账户提示 ----
function renderFundUnassigned() {
    const el = document.getElementById('fundUnassignedRow');
    if (!el) return;
    const un = state.accounts.filter(a => a.kind === 'asset' && !a.bucket);
    if (!un.length) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = `<span class="fu-text"><i class="fa-solid fa-circle-exclamation"></i> 有 ${un.length} 个资产账户未归类：${un.map(a => a.name).join('、')}</span>
        <button class="secondary-btn" onclick="openFundAccounts()">去归类</button>`;
}

// ---- 保险保障：成员 + 8 险种清单 ----
function renderInsuranceSection() {
    const membersBox = document.getElementById('insMembers');
    const listBox = document.getElementById('insList');
    if (!membersBox || !listBox) return;
    membersBox.innerHTML = state.insuranceMembers.map(m =>
        `<span class="ins-member-wrap"><button class="ins-member ${m === fundEditMember ? 'active' : ''}" data-insmember="${_esc(m)}">${_esc(m)}</button>` +
        `<i class="fa-solid fa-pen" data-insact="rename" data-insmember="${_esc(m)}" title="改名"></i>` +
        `<i class="fa-solid fa-xmark" data-insact="del" data-insmember="${_esc(m)}" title="删除"></i></span>`
    ).join('') + `<button class="ins-member ins-add" data-insadd="1"><i class="fa-solid fa-plus"></i> 成员</button>`;

    if (!membersBox.$wired) {
        membersBox.$wired = true;
        membersBox.addEventListener('click', e => {
            const el = e.target.closest ? e.target.closest('[data-insmember],[data-insadd]') : null;
            if (!el) return;
            if (el.dataset.insadd) { addInsMember(); return; }
            const name = el.dataset.insmember;
            if (name === undefined) return;
            if (el.tagName === 'BUTTON') { setInsMember(name); return; }
            if (el.dataset.insact === 'rename') renameInsuranceMember(name);
            else if (el.dataset.insact === 'del') deleteInsuranceMember(name);
        });
    }

    listBox.innerHTML = INSURANCE_TYPES.map(type => {
        const p = insPolicy(type, fundEditMember);
        const covered = !!(p && p.covered);
        return `
        <div class="ins-row ${covered ? 'on' : ''}">
            <label class="ins-check">
                <input type="checkbox" data-type="${type}" ${covered ? 'checked' : ''}>
                <span class="ins-box"><i class="fa-solid fa-check"></i></span>
            </label>
            <span class="ins-type">${type}</span>
            <span class="ins-field"><em>保额</em><input type="number" class="ins-amt" data-type="${type}" value="${p && p.amount ? p.amount : ''}" placeholder="0" inputmode="decimal"></span>
            <span class="ins-field"><em>年保费</em><input type="number" class="ins-prem" data-type="${type}" value="${p && p.premium ? p.premium : ''}" placeholder="0" inputmode="decimal"></span>
        </div>`;
    }).join('');

    listBox.querySelectorAll('.ins-check input').forEach(cb => cb.addEventListener('change', () => upsertIns(cb.dataset.type, { covered: cb.checked })));
    listBox.querySelectorAll('.ins-amt').forEach(inp => inp.addEventListener('change', () => upsertIns(inp.dataset.type, { amount: parseFloat(inp.value) || 0 })));
    listBox.querySelectorAll('.ins-prem').forEach(inp => inp.addEventListener('change', () => upsertIns(inp.dataset.type, { premium: parseFloat(inp.value) || 0 })));
}

function setInsMember(m) { fundEditMember = m; renderInsuranceSection(); }

// 保险成员改名：名单 + 该成员名下的保单都要跟着改（保单 id 是 险种__成员）
function renameInsuranceMember(old) {
    const name = prompt('修改保险成员姓名', old);
    if (!name || !name.trim() || name.trim() === old) return;
    const n = name.trim();
    if (state.insuranceMembers.includes(n)) { showToast('已有同名成员', 'error'); return; }
    state.insuranceMembers = state.insuranceMembers.map(m => m === old ? n : m);
    state.insurancePolicies.forEach(p => {
        if (p.member !== old) return;
        p.member = n;
        p.id = `${p.type}__${n}`;
        p.updatedAt = Date.now();
    });
    if (fundEditMember === old) fundEditMember = n;
    state.insuranceMemberAddedAt[n] = Date.now();
    addTombstone('insuranceMembers', old);   // 不留墓碑的话，并集合并会把旧名留在别的设备
    delete state.insuranceMemberAddedAt[old];
    saveState();
    renderFourFunds();
}

function deleteInsuranceMember(name) {
    if (state.insuranceMembers.length <= 1) { showToast('至少保留一个成员', 'error'); return; }
    const fallback = state.insuranceMembers.find(m => m !== name);
    const mine = state.insurancePolicies.filter(p => p.member === name).length;
    if (!confirm(`删除保险成员「${name}」？${mine ? `TA 的 ${mine} 份保单会并入「${fallback}」。` : ''}`)) return;
    state.insurancePolicies.forEach(p => {
        if (p.member !== name) return;
        p.member = fallback;
        p.id = `${p.type}__${fallback}`;
        p.updatedAt = Date.now();
    });
    state.insuranceMembers = state.insuranceMembers.filter(m => m !== name);
    addTombstone('insuranceMembers', name);
    delete state.insuranceMemberAddedAt[name];
    if (fundEditMember === name) fundEditMember = fallback;
    saveState();
    renderFourFunds();
}

function addInsMember() {
    const name = prompt('成员姓名（如：配偶、父亲、儿子）');
    if (!name || !name.trim()) return;
    const n = name.trim();
    if (state.insuranceMembers.includes(n)) { showToast('已有该成员', 'error'); return; }
    state.insuranceMembers.push(n);
    state.insuranceMemberAddedAt[n] = Date.now();
    const oldMark = state.deleted.insuranceMembers.find(m => m.id === n);
    if (oldMark) oldMark.deletedAt = Math.min(oldMark.deletedAt, state.insuranceMemberAddedAt[n] - 1);
    fundEditMember = n;
    saveState();
    renderFourFunds();
}

function upsertIns(type, patch) {
    const member = fundEditMember;
    let p = insPolicy(type, member);
    if (!p) {
        p = { id: `${type}__${member}`, type, member, covered: false, amount: 0, premium: 0, createdAt: Date.now(), updatedAt: Date.now() };
        state.insurancePolicies.push(p);
    }
    Object.assign(p, patch, { updatedAt: Date.now() });
    saveState();
    renderFundQuadrant();
    renderInsuranceSection();
}

// ---- 账户归类管理 ----
function openFundAccounts() {
    renderFundAccountPicker();
    document.getElementById('fundAccountsModal').classList.remove('hidden');
    raiseOverlay('fundAccountsModal');
}
function closeFundAccountsModal() { document.getElementById('fundAccountsModal').classList.add('hidden'); }

function renderFundAccountPicker() {
    const box = document.getElementById('fundAccountList');
    if (!box) return;
    box.innerHTML = state.accounts.filter(a => a.kind === 'asset').map(a => `
        <div class="facct-row">
            <span class="facct-name"><i class="fa-solid ${a.icon}" style="color:${a.color}"></i> ${a.name}</span>
            <select class="facct-select" data-account="${a.id}">
                <option value="" ${!a.bucket ? 'selected' : ''}>未分配</option>
                ${FUND_BUCKETS.map(b => `<option value="${b.key}" ${a.bucket === b.key ? 'selected' : ''}>${b.name}</option>`).join('')}
            </select>
        </div>`).join('');
    box.querySelectorAll('.facct-select').forEach(sel => sel.addEventListener('change', () => {
        const a = accountById(sel.dataset.account);
        if (a) { a.bucket = sel.value; a.updatedAt = Date.now(); saveState(); renderFourFunds(); renderFundAccountPicker(); }
    }));
}

function initFundListeners() {
    const btn = document.getElementById('fundAccountsBtn');
    if (btn) btn.addEventListener('click', openFundAccounts);
}

// ==================== 家庭资产负债表：成员切换 + 汇总 + 归属 ====================
function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function memberBarHTML() {
    // 成员名只作为属性值输出（_esc 已转义 & < > "），不再塞进 onclick 的 JS 字符串里。
    // 属性里的 HTML 实体解码不会破坏引号边界，所以改名成 `');…` 也无法逃逸。
    let html = `<button class="bm-chip ${state.balanceOwner === 'all' ? 'active' : ''}" data-owner="all">全部</button>`;
    html += state.balanceMembers.map(m =>
        `<button class="bm-chip ${state.balanceOwner === m ? 'active' : ''}" data-owner="${_esc(m)}">${_esc(m)}</button>`).join('');
    html += `<button class="bm-chip bm-add" data-add="1"><i class="fa-solid fa-user-plus"></i> 成员</button>`;
    return html;
}

function renderBalanceMemberBar() {
    ['balMemberBar', 'retMemberBar'].forEach(id => {
        const bar = document.getElementById(id);
        if (!bar) return;
        bar.innerHTML = memberBarHTML();
        if (bar.$wired) return;                 // 监听挂在容器上，重渲染不需要重复加
        bar.$wired = true;
        bar.addEventListener('click', e => {
            const chip = e.target.closest ? e.target.closest('.bm-chip') : null;
            if (!chip) return;
            if (chip.dataset.add) { addBalanceMember(); return; }
            if (chip.dataset.owner !== undefined) setBalanceOwner(chip.dataset.owner);
        });
    });
}

function renderFamilyBars() {
    renderBalance();
    renderReturns();
}

function setBalanceOwner(m) {
    state.balanceOwner = m;
    renderBalance();
    renderReturns();
}

function addBalanceMember() {
    const name = prompt('新成员姓名');
    if (!name || !name.trim()) return;
    const n = name.trim();
    if (state.balanceMembers.includes(n)) { showToast('已有该成员', 'error'); return; }
    state.balanceMembers.push(n);
    state.memberAddedAt[n] = Date.now();
    // 同名成员被删过又加回来：加的时间必须晚于删除标记，否则会被自己的墓碑吃掉
    const memMark = state.deleted.members.find(m => m.id === n);
    if (memMark) memMark.deletedAt = Math.min(memMark.deletedAt, state.memberAddedAt[n] - 1);
    saveState();
    renderFamilyBars();
    refreshAccountsModalIfOpen();
}

function _rebalanceId(member, accountId, month) { return `${member}__${accountId}__${month}`; }

function renameBalanceMember(old) {
    const name = prompt('修改成员姓名', old);
    if (!name || !name.trim() || name.trim() === old) return;
    const n = name.trim();
    if (state.balanceMembers.includes(n)) { showToast('已有同名成员', 'error'); return; }
    state.balanceMembers = state.balanceMembers.map(m => m === old ? n : m);
    addTombstone('members', old);            // 改名 = 删旧名 + 加新名，否则旧名会被并集留在别的设备
    state.memberAddedAt[n] = Date.now();
    state.balances.forEach(b => {
        if (b.member !== old) return;
        b.member = n;
        b.id = _rebalanceId(n, b.accountId, b.month);
        b.updatedAt = Date.now();
    });
    state.returns.forEach(r => {
        if (r.member !== old) return;
        r.member = n;
        r.id = _rebalanceId(n, r.accountId, r.month);
        r.updatedAt = Date.now();
    });
    if (state.balanceOwner === old) state.balanceOwner = n;
    saveState();
    renderFamilyBars();
    renderAccountManageList();
    refreshAccountsModalIfOpen();
}

// 把 from 成员的记录并入 to 成员：同账户同月已存在则金额相加，否则直接改归属
function _mergeMemberRows(list, from, to) {
    const byId = {};
    list.forEach(r => { byId[r.id] = r; });
    const dropIds = [];
    list.forEach(r => {
        if (r.member !== from) return;
        const targetId = _rebalanceId(to, r.accountId, r.month);
        const tgt = byId[targetId];
        if (tgt && tgt !== r) {
            tgt.amount = (Number(tgt.amount) || 0) + (Number(r.amount) || 0);
            tgt.updatedAt = Date.now();
            dropIds.push(r.id);
        } else {
            r.member = to;
            r.id = targetId;
            r.updatedAt = Date.now();
            byId[targetId] = r;
        }
    });
    return list.filter(r => dropIds.indexOf(r.id) < 0);
}

function deleteBalanceMember(name) {
    if (state.balanceMembers.length <= 1) { showToast('至少保留一个成员', 'error'); return; }
    const fallback = state.balanceMembers.find(m => m !== name);
    const mineBal = state.balances.filter(b => b.member === name).length;
    const mineRet = state.returns.filter(r => r.member === name).length;
    const total = mineBal + mineRet;
    if (!confirm(`删除成员「${name}」？${total ? `TA 的 ${total} 条记录（余额 ${mineBal} / 收益 ${mineRet}）会并入「${fallback}」。` : ''}`)) return;
    state.balances = _mergeMemberRows(state.balances, name, fallback);
    state.returns = _mergeMemberRows(state.returns, name, fallback);
    state.balanceMembers = state.balanceMembers.filter(m => m !== name);
    addTombstone('members', name);          // 关键：不写墓碑的话，并集合并会把它带回来
    delete state.memberAddedAt[name];
    if (state.balanceOwner === name) state.balanceOwner = 'all';
    saveState();
    renderFamilyBars();
    renderAccountManageList();
    refreshAccountsModalIfOpen();
}

function renderFamilySummary() {
    const body = document.getElementById('familySummaryBody');
    if (!body) return;
    const months = balanceMonths();
    const month = months[months.length - 1] || null;
    const sub = document.getElementById('familySummarySubtitle');
    if (sub) sub.textContent = month ? `截至 ${month.replace('-', '年')}月` : '';
    // 每个成员各记自己的余额，账户类型全家共用：按成员汇总其名下余额
    const kindById = {};
    state.accounts.forEach(acc => { kindById[acc.id] = acc.kind; });
    const rows = state.balanceMembers.map(mem => {
        let a = 0, l = 0;
        const mmap = balancesAtMonth(month, mem);
        Object.keys(mmap).forEach(accId => {
            const v = mmap[accId];
            if (v === undefined) return;
            if (kindById[accId] === 'liability') l += v; else a += v;
        });
        return { mem, a, l, net: a - l };
    });

    const tA = rows.reduce((s, r) => s + r.a, 0), tL = rows.reduce((s, r) => s + r.l, 0);
    const money = (v, cls) => `<span class="bs-num${v < 0 ? ' neg' : ''}${cls ? ' ' + cls : ''}">${formatCurrency(v)}</span>`;
    body.innerHTML = rows.map(r => `
        <tr>
            <td class="bs-label">${_esc(r.mem)}</td>
            <td>${money(r.a, 'income')}</td>
            <td>${money(r.l, 'expense')}</td>
            <td>${money(r.net)}</td>
        </tr>`).join('') + `
        <tr class="bs-total">
            <td class="bs-label">家庭合计</td>
            <td>${money(tA)}</td>
            <td>${money(tL)}</td>
            <td>${money(tA - tL)}</td>
        </tr>`;
}

// ==================== 投资收益 ====================
// 与资产负债同一套成员维度：账户全家共用，收益记录落在「成员 + 账户 + 月份」上。
let returnRenderToken = 0;
let returnHistoryAccountId = null;

function returnMonths() { return [...new Set(state.returns.map(r => r.month))].sort(); }
function returnYears() { return [...new Set(returnMonths().map(m => m.slice(0, 4)))].sort(); }

// 某月各账户收益（按当前成员筛选；'all' = 全家相加）
function returnsAtMonth(month, member = state.balanceOwner) {
    const map = {};
    if (!month) return map;
    state.returns
        .filter(r => r.month === month && (member === 'all' || r.member === member))
        .forEach(r => { map[r.accountId] = (map[r.accountId] || 0) + (Number(r.amount) || 0); });
    return map;
}

function returnMonthHasRecords(month) {
    return !!month && state.returns.some(r => r.month === month);
}

// 只列用户真正持有的资产账户（记过余额/收益），但用户自己新建的账户一律列出——
// 否则刚加的账户还没有任何记录，出现在弹窗里的话会像是没生效。
function returnCandidateAccounts() {
    const defaultIds = new Set(DEFAULT_ACCOUNTS.map(a => a.id));
    const held = new Set();
    state.balances.forEach(b => held.add(b.accountId));
    state.returns.forEach(r => held.add(r.accountId));
    const assets = state.accounts.filter(a => a.kind === 'asset');
    const picked = assets.filter(a => held.has(a.id) || !defaultIds.has(a.id));
    return picked.length ? picked : assets;
}

// 一段月份的合计 + 分账户明细
function returnSummary(months, member = state.balanceOwner) {
    const byAccount = {};
    let total = 0;
    (months || []).forEach(m => {
        const map = returnsAtMonth(m, member);
        Object.keys(map).forEach(id => {
            byAccount[id] = (byAccount[id] || 0) + map[id];
            total += map[id];
        });
    });
    return { total, byAccount };
}

function returnPeriodInfo() {
    const now = new Date();
    const months = returnMonths();
    const years = returnYears();
    const period = state.returnPeriod;
    const selYear = state.returnYear || now.getFullYear();
    const selMonth = state.returnMonth || (now.getMonth() + 1);

    if (period === 'all') {
        return { period, title: '全部', months, month: months[months.length - 1] || null, year: years[years.length - 1] || null };
    }
    if (period === 'year') {
        return { period, title: `${selYear}年`, months: months.filter(m => m.slice(0, 4) === String(selYear)), year: selYear };
    }
    const key = `${selYear}-${String(selMonth).padStart(2, '0')}`;
    return { period, title: `${selYear}年${selMonth}月`, months: months.filter(m => m === key), month: key, selYear, selMonth };
}

function renderReturnSelectors() {
    const years = returnYears();
    const now = new Date();
    if (!years.length) return;
    if (!state.returnYear || !years.includes(String(state.returnYear))) state.returnYear = years[years.length - 1];

    const ySel = document.getElementById('returnYearSelect');
    if (ySel) {
        ySel.innerHTML = years.map(y => `<option value="${y}" ${String(state.returnYear) === y ? 'selected' : ''}>${y}年</option>`).join('');
    }
    const mSel = document.getElementById('returnMonthSelect');
    if (mSel) {
        const months = returnMonths().filter(m => m.slice(0, 4) === String(state.returnYear));
        const opts = months.length ? months : [`${state.returnYear}-${String(now.getMonth() + 1).padStart(2, '0')}`];
        const cur = state.returnMonth || Number((opts[opts.length - 1] || '').slice(5, 7)) || (now.getMonth() + 1);
        mSel.innerHTML = opts.map(m => {
            const mm = Number(m.slice(5, 7));
            return `<option value="${mm}" ${mm === cur ? 'selected' : ''}>${mm}月</option>`;
        }).join('');
        state.returnMonth = cur;
    }
    const yWrap = document.getElementById('returnYearWrap');
    const mWrap = document.getElementById('returnMonthWrap');
    const showYear = state.returnPeriod !== 'all';
    if (yWrap) yWrap.classList.toggle('hidden', !showYear);
    if (mWrap) mWrap.classList.toggle('hidden', state.returnPeriod !== 'month');
}

function renderReturnMemberBar() {
    const bar = document.getElementById('retMemberBar');
    if (bar) bar.innerHTML = memberBarHTML();
}

function setReturnChartType(t) {
    state.returnChartType = t;
    document.querySelectorAll('#view-returns [data-ret-chart]').forEach(b =>
        b.classList.toggle('active', b.dataset.retChart === t));
    renderReturnChart();
}

function activeReturnGran() {
    if (state.returnGran) return state.returnGran;
    return state.returnPeriod === 'year' || state.returnPeriod === 'all' ? 'year' : 'month';
}

function setReturnGran(g) {
    state.returnGran = g;
    document.querySelectorAll('#view-returns [data-ret-gran]').forEach(b =>
        b.classList.toggle('active', b.dataset.retGran === g));
    renderReturnChart();
}

function returnTrendBuckets() {
    const all = returnMonths();
    if (!all.length) return [];
    if (activeReturnGran() === 'year') {
        return returnYears().map(y => ({ key: y, label: `${y}年`, months: all.filter(m => m.slice(0, 4) === y) }));
    }
    return all.map(m => ({ key: m, label: m.replace('-', '年') + '月', months: [m] }));
}

function renderReturns() {
    if (!document.getElementById('view-returns')) return;
    renderReturnSelectors();

    const info = returnPeriodInfo();
    const cur = returnSummary(info.months);
    const total = returnSummary(returnMonths()).total;
    const years = returnYears();
    const yearMonths = info.year ? returnMonths().filter(m => m.slice(0, 4) === String(info.year)) : [];
    const yearTotal = info.year ? returnSummary(yearMonths).total : 0;

    // 上期：月报=上一月，年报=上一年，总=最后一期的上一月
    let prevMonths = [], prevLabel = '';
    if (info.period === 'month' && info.month) {
        const p = previousMonthOf(info.month);
        prevMonths = p ? [p] : [];
        prevLabel = p ? p.replace('-', '年') + '月' : '';
    } else if (info.period === 'year' && info.year) {
        const py = String(Number(info.year) - 1);
        prevMonths = returnMonths().filter(m => m.slice(0, 4) === py);
        prevLabel = `${py}年`;
    }

    const setText = (id, v) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = formatCurrency(v);
        el.classList.toggle('income', v > 0);
        el.classList.toggle('expense', v < 0);
    };
    const label = document.getElementById('retPeriodLabel');
    const monthsWithData = returnMonths().length;
    let periodValue = cur.total;
    if (info.period === 'all') {
        if (label) label.textContent = '月均收益';
        periodValue = monthsWithData ? Math.round((total / monthsWithData) * 100) / 100 : 0;
    } else {
        if (label) label.textContent = info.period === 'year' ? '本年收益' : '本月收益';
    }
    setText('retPeriodAmount', periodValue);
    setText('retTotalAmount', total);
    setText('retYearAmount', info.period === 'year' ? cur.total : yearTotal);

    const hint = document.getElementById('retPeriodHint');
    if (hint) {
        if (info.period === 'all') hint.textContent = monthsWithData ? `按 ${monthsWithData} 个月平均` : '';
        else hint.textContent = info.months.length ? info.title : '该期未记录';
    }
    const prevEl = document.getElementById('retPrevAmount');
    if (prevEl) {
        if (prevMonths.length) {
            const pv = returnSummary(prevMonths).total;
            prevEl.textContent = formatCurrency(pv);
            prevEl.classList.toggle('income', pv > 0);
            prevEl.classList.toggle('expense', pv < 0);
        } else {
            prevEl.textContent = '—';
            prevEl.classList.remove('income', 'expense');
        }
    }
    const momEl = document.getElementById('retMomHint');
    if (momEl) {
        if (prevMonths.length) {
            const diff = cur.total - returnSummary(prevMonths).total;
            momEl.textContent = `${prevLabel} 环比 ${diff >= 0 ? '+' : ''}${formatCurrency(diff)}`;
        } else {
            momEl.textContent = '没有上一期数据';
        }
    }
    const monthsHint = document.getElementById('retMonthsHint');
    if (monthsHint) monthsHint.textContent = returnMonths().length ? `共 ${returnMonths().length} 个月有记录` : '';

    renderReturnChart();
    renderReturnBreakdown(info);
    renderReturnMonthly();
    renderReturnMemberBar();
    updateReturnToggleStates();
}

function updateReturnToggleStates() {
    document.querySelectorAll('#view-returns [data-ret-chart]').forEach(b =>
        b.classList.toggle('active', b.dataset.retChart === state.returnChartType));
    document.querySelectorAll('#view-returns [data-ret-gran]').forEach(b =>
        b.classList.toggle('active', b.dataset.retGran === activeReturnGran()));
}

function returnShowEmpty(msg) {
    const empty = document.getElementById('returnChartEmpty');
    const canvas = document.getElementById('returnChart');
    if (empty) { empty.textContent = msg; empty.classList.remove('hidden'); }
    if (canvas) canvas.parentElement.classList.add('hidden');
    if (charts.returns) { charts.returns.destroy(); charts.returns = null; }
}

function returnHideEmpty() {
    const empty = document.getElementById('returnChartEmpty');
    const canvas = document.getElementById('returnChart');
    if (empty) empty.classList.add('hidden');
    if (canvas) canvas.parentElement.classList.remove('hidden');
}

function renderReturnChart() {
    const info = returnPeriodInfo();
    const title = document.getElementById('retChartTitle');
    const sub = document.getElementById('retChartSubtitle');
    const chartType = state.returnChartType;
    const gran = activeReturnGran();
    if (title) title.textContent = chartType === 'pie' ? '账户收益构成' : (gran === 'year' ? '年度收益' : '月度收益');
    if (sub) sub.textContent = state.balanceOwner === 'all' ? '全家合计' : state.balanceOwner;

    if (!returnMonths().length) {
        returnShowEmpty('还没有记录过收益，点右上角「记收益」开始');
        return;
    }
    const token = ++returnRenderToken;
    requestAnimationFrame(() => {
        if (token !== returnRenderToken) return;
        const ctx = document.getElementById('returnChart');
        if (!ctx) return;
        if (chartType === 'pie') renderReturnPie(ctx, info);
        else renderReturnTrend(ctx, chartType);
    });
}

function renderReturnTrend(ctx, chartType) {
    if (typeof Chart === 'undefined') { loadChartLib().then(() => renderReturnTrend(ctx, chartType)).catch(() => {}); return; }
    if (charts.returns) { charts.returns.destroy(); charts.returns = null; }
    const buckets = returnTrendBuckets();
    const values = buckets.map(b => Math.round(returnSummary(b.months).total * 100) / 100);
    const palette = chartPalette();
    if (!buckets.length) { returnShowEmpty('该期间没有收益记录'); return; }
    returnHideEmpty();
    const accent = values.map(v => v < 0 ? '#ff3b30' : '#34c759');

    charts.returns = new Chart(ctx, {
        type: chartType,
        data: {
            labels: buckets.map(b => b.label),
            datasets: [{
                label: '收益',
                data: values,
                borderColor: '#34c759',
                backgroundColor: chartType === 'line' ? 'rgba(52,199,89,0.12)' : accent,
                borderWidth: chartType === 'line' ? 2 : 0,
                fill: chartType === 'line',
                tension: 0.3,
                pointRadius: buckets.length > 24 ? 0 : 3,
                pointHoverRadius: 6,
                pointBackgroundColor: '#34c759',
                borderRadius: 5,
                maxBarThickness: 40,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (evt, elements) => {
                if (!elements || !elements.length) return;
                const b = returnTrendBuckets()[elements[0].index];
                if (b) openReturnDetailForPeriod(b.months, b.label);
            },
            onHover: (evt, elements) => {
                const target = evt.native && evt.native.target;
                if (target) target.style.cursor = (elements && elements.length) ? 'pointer' : 'default';
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (c) => `收益: ${formatCurrency(c.raw)}` } },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: palette.text, font: { size: 10, family: '-apple-system' }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
                },
                y: {
                    grid: { color: palette.grid },
                    ticks: { color: palette.text, font: { size: 10 }, callback: (v) => (Math.abs(v) >= 10000 ? (v / 10000).toFixed(1) + '万' : v) },
                },
            },
        },
    });
}

function renderReturnPie(ctx, info) {
    if (typeof Chart === 'undefined') { loadChartLib().then(() => renderReturnPie(ctx, info)).catch(() => {}); return; }
    if (charts.returns) { charts.returns.destroy(); charts.returns = null; }
    const { byAccount } = returnSummary(info.months);
    const rows = returnCandidateAccounts().map(a => ({
        id: a.id, name: a.name, color: a.color, amount: byAccount[a.id] || 0,
    })).filter(r => r.amount !== 0).map(r => ({ ...r, signed: Math.abs(r.amount) }));
    if (!rows.length) { returnShowEmpty('该期没有可统计的收益数据'); return; }
    rows.sort((x, y) => y.signed - x.signed);
    const entries = topPieEntries(rows);
    const gross = entries.reduce((s, e) => s + e.signed, 0);
    const net = entries.reduce((s, e) => s + e.amount, 0);
    returnHideEmpty();

    charts.returns = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: entries.map(e => e.name || accountById(e.id)?.name || '未知'),
            datasets: [{
                data: entries.map(e => e.signed),
                backgroundColor: entries.map(e => e.id === '__others__' ? PIE_OTHERS_COLOR : (e.amount < 0 ? '#ff3b30' : (e.color || '#34c759'))),
                borderWidth: 0, hoverOffset: 10,
                radius: (ctx.parentElement ? ctx.parentElement.clientWidth : 999) < 520 ? '68%' : '100%',
            }],
        },
        plugins: [pieLabelPlugin, doughnutTotalPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '52%',
            layout: { padding: { left: 28, right: 28, top: 10, bottom: 10 } },
            onClick: (evt, elements) => {
                if (!elements || !elements.length) return;
                const e = entries[elements[0].index];
                if (e) openReturnHistoryForAccount(e.ids && e.ids.length === 1 ? e.ids[0] : null, e.name);
            },
            onHover: (evt, elements) => {
                const target = evt.native && evt.native.target;
                if (target) target.style.cursor = (elements && elements.length) ? 'pointer' : 'default';
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (c) => {
                            const e = entries[c.dataIndex];
                            const pct = gross ? ((c.raw / gross) * 100).toFixed(1) : '0.0';
                            return `${c.label}: ${formatCurrency(e ? e.amount : c.raw)} (${pct}%)`;
                        },
                    },
                },
            },
        },
    });
    charts.returns.$centerText = { label: '本期净收益', value: formatCurrency(net) };
}

function renderReturnBreakdown(info) {
    const container = document.getElementById('retBreakdownList');
    if (!container) return;
    const title = document.getElementById('retBreakdownTitle');
    if (title) title.textContent = `账户收益排行 · ${info.title}`;
    const { byAccount } = returnSummary(info.months);
    const rows = returnCandidateAccounts().map(a => ({
        id: a.id, name: a.name, color: a.color, icon: a.icon, amount: byAccount[a.id] || 0,
    })).filter(r => r.amount !== 0).sort((x, y) => Math.abs(y.amount) - Math.abs(x.amount));
    const total = rows.reduce((s, r) => s + r.amount, 0);
    if (!rows.length) {
        container.innerHTML = '<div class="breakdown-empty">该期还没有收益记录</div>';
        return;
    }
    container.innerHTML = rows.map(r => {
        const pct = total ? Math.abs(r.amount / total) * 100 : 0;
        return `
        <div class="breakdown-item" onclick="openReturnHistoryForAccount('${r.id}')">
            <div class="breakdown-icon" style="background:${r.color}22;color:${r.color}"><i class="fa-solid ${r.icon}"></i></div>
            <div class="breakdown-main">
                <div class="breakdown-head">
                    <span class="breakdown-name">${r.name}</span>
                    <span class="breakdown-amount ${r.amount >= 0 ? 'income' : 'expense'}">${formatCurrency(r.amount)}</span>
                </div>
                <div class="breakdown-bar"><div class="breakdown-bar-fill" style="width:${Math.min(pct, 100).toFixed(1)}%;background:${r.amount < 0 ? '#ff3b30' : r.color}"></div></div>
            </div>
        </div>`;
    }).join('');
}

function renderReturnMonthly() {
    const body = document.getElementById('retMonthlyBody');
    if (!body) return;
    const months = returnMonths().slice().reverse();   // 最新在前
    if (!months.length) {
        body.innerHTML = '<tr><td colspan="4" class="breakdown-empty">还没有收益记录，点右上角「记收益」添加</td></tr>';
        return;
    }
    // 累计要按时间正序累加
    const asc = returnMonths();
    const running = {};
    let acc = 0;
    asc.forEach(m => { acc += returnSummary([m]).total; running[m] = acc; });

    const money = (v, cls) => `<span class="bs-num${v < 0 ? ' neg' : ''}${cls ? ' ' + cls : ''}">${formatCurrency(v)}</span>`;
    let html = months.map((m, i) => {
        const cur = returnSummary([m]).total;
        const prevMonth = previousMonthOf(m);
        const prev = prevMonth && returnMonthHasRecords(prevMonth) ? returnSummary([prevMonth]).total : null;
        const delta = prev === null ? null : cur - prev;
        return `
        <tr class="bs-row" onclick="openReturnDetailForMonth('${m}')">
            <td class="bs-label">${m.replace('-', '年')}月</td>
            <td>${money(cur, cur >= 0 ? 'income' : 'expense')}</td>
            <td>${money(running[m])}</td>
            <td>${delta === null ? '<span class="bs-num">—</span>' : money(delta, delta >= 0 ? 'income' : 'expense')}</td>
        </tr>`;
    }).join('');
    const totalAll = returnSummary(asc).total;
    html += `
        <tr class="bs-total">
            <td class="bs-label">合计</td>
            <td>${money(totalAll, totalAll >= 0 ? 'income' : 'expense')}</td>
            <td>${money(totalAll)}</td>
            <td><span class="bs-num">—</span></td>
        </tr>`;
    body.innerHTML = html;
}

// ---- 某期各账户明细（复用账户历史弹窗的 DOM）----
function openReturnDetailForPeriod(months, label) {
    if (!months || !months.length) return;
    returnHistoryAccountId = null;
    const { byAccount } = returnSummary(months);
    const rows = returnCandidateAccounts().map(a => ({
        id: a.id, name: a.name, color: a.color, icon: a.icon, amount: byAccount[a.id] || 0,
    })).filter(r => r.amount !== 0).sort((x, y) => Math.abs(y.amount) - Math.abs(x.amount));
    const total = rows.reduce((s, r) => s + r.amount, 0);

    const iconEl = document.getElementById('acctHistIcon');
    if (iconEl) {
        iconEl.style.background = 'var(--accent-light)';
        iconEl.style.color = 'var(--accent)';
        iconEl.innerHTML = '<i class="fa-solid fa-arrow-trend-up"></i>';
    }
    const t = document.getElementById('acctHistTitle');
    if (t) t.textContent = `${label} 收益明细`;
    const s = document.getElementById('acctHistSub');
    if (s) s.textContent = state.balanceOwner === 'all' ? '全家合计' : state.balanceOwner;
    const del = document.getElementById('acctHistDelete');
    if (del) del.style.display = 'none';
    const sum = document.getElementById('acctHistSummary');
    if (sum) sum.innerHTML = `<span class="cat-txn-summary-item ${total >= 0 ? 'income' : 'expense'}">净收益 <b>${formatCurrency(total)}</b></span>
        <span class="cat-txn-summary-item">涉及 <b>${rows.length}</b> 个账户</span>`;
    const list = document.getElementById('acctHistList');
    if (list) list.innerHTML = rows.length ? rows.map(r => `
        <div class="breakdown-item" onclick="closeAccountHistoryModal();openReturnHistoryForAccount('${r.id}')">
            <div class="breakdown-icon" style="background:${r.color}22;color:${r.color}"><i class="fa-solid ${r.icon}"></i></div>
            <div class="breakdown-main">
                <div class="breakdown-head">
                    <span class="breakdown-name">${r.name}</span>
                    <span class="breakdown-amount ${r.amount >= 0 ? 'income' : 'expense'}">${formatCurrency(r.amount)}</span>
                </div>
            </div>
        </div>`).join('') : '<div class="breakdown-empty">该期没有收益记录</div>';
    const modal = document.getElementById('accountHistoryModal');
    if (modal) { modal.classList.remove('hidden'); raiseOverlay('accountHistoryModal'); }
}

function openReturnDetailForMonth(month) {
    openReturnDetailForPeriod([month], month.replace('-', '年') + '月');
}

// ---- 单账户收益历史 ----
function openReturnHistoryForAccount(accountId, label) {
    if (!accountId) return;
    const a = accountById(accountId);
    if (!a) return;
    returnHistoryAccountId = accountId;
    historyAccountId = null;
    const iconEl = document.getElementById('acctHistIcon');
    if (iconEl) {
        iconEl.style.background = `${a.color}22`;
        iconEl.style.color = a.color;
        iconEl.innerHTML = `<i class="fa-solid ${a.icon}"></i>`;
    }
    const t = document.getElementById('acctHistTitle');
    if (t) t.textContent = label || a.name;
    const s = document.getElementById('acctHistSub');
    if (s) s.textContent = '收益历史';
    const del = document.getElementById('acctHistDelete');
    if (del) del.style.display = 'none';
    renderReturnAccountHistory();
    const modal = document.getElementById('accountHistoryModal');
    if (modal) { modal.classList.remove('hidden'); raiseOverlay('accountHistoryModal'); }
}

function renderReturnAccountHistory() {
    const rows = state.returns
        .filter(r => r.accountId === returnHistoryAccountId && (state.balanceOwner === 'all' || r.member === state.balanceOwner))
        .slice()
        .sort((x, y) => y.month.localeCompare(x.month) || String(x.member).localeCompare(String(y.member)));
    const all = state.returns.filter(r => r.accountId === returnHistoryAccountId);
    const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const sum = document.getElementById('acctHistSummary');
    if (sum) sum.innerHTML = `
        <span class="cat-txn-summary-item">共 <b>${[...new Set(rows.map(r => r.month))].length}</b> 期</span>
        <span class="cat-txn-summary-item ${total >= 0 ? 'income' : 'expense'}">累计 <b>${formatCurrency(total)}</b></span>
        <span class="cat-txn-summary-item">最新 <b>${rows.length ? formatCurrency(rows[0].amount) : '—'}</b></span>`;
    const list = document.getElementById('acctHistList');
    if (list) list.innerHTML = rows.length ? rows.map(r => `
        <div class="bal-history-row">
            <span class="bh-month">${r.month.replace('-', '年')}月${state.balanceOwner === 'all' ? `<span class="bh-member">${_esc(r.member || '')}</span>` : ''}</span>
            <span class="bh-amount ${r.amount >= 0 ? 'income' : 'expense'}">${formatCurrency(r.amount)}</span>
            <button class="bh-delete" onclick="deleteReturnSnapshot('${r.id}')" title="删除这一期"><i class="fa-solid fa-xmark"></i></button>
        </div>`).join('') : '<div class="breakdown-empty">该账户还没有记录过收益</div>';
}

function deleteReturnSnapshot(id) {
    if (!confirm('删除这一期的收益记录？')) return;
    addTombstone('returns', id);
    state.returns = state.returns.filter(r => r.id !== id);
    saveState();
    renderReturnAccountHistory();
    renderReturns();
    showToast('已删除该期收益', 'success');
}

// ---------------- 记收益弹窗 ----------------
function openReturnModal(month) {
    const info = returnPeriodInfo();
    const input = document.getElementById('returnMonthInput');
    if (input) input.value = month || info.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const ms = document.getElementById('returnMemberSelect');
    if (ms) ms.value = state.balanceOwner !== 'all' ? state.balanceOwner : (state.balanceMembers[0] || '本人');
    renderReturnEntry();
    const modal = document.getElementById('returnModal');
    if (modal) { modal.classList.remove('hidden'); raiseOverlay('returnModal'); }
}

function closeReturnModal() {
    const modal = document.getElementById('returnModal');
    if (modal) modal.classList.add('hidden');
}

function renderReturnEntry() {
    const monthInput = document.getElementById('returnMonthInput');
    if (!monthInput) return;
    const month = monthInput.value;
    const ms = document.getElementById('returnMemberSelect');
    if (ms) {
        const want = ms.value || state.balanceMembers[0] || '本人';
        ms.innerHTML = state.balanceMembers.map(m => `<option ${m === want ? 'selected' : ''}>${m}</option>`).join('');
    }
    const member = ms ? ms.value : (state.balanceMembers[0] || '本人');
    const sub = document.getElementById('returnModalSub');
    if (sub) sub.textContent = month ? `${member} · ${month.replace('-', '年')}月各账户收益` : '请先选择月份';
    const list = document.getElementById('returnEntryList');
    if (!list) return;
    const accounts = returnCandidateAccounts();
    if (!accounts.length) {
        list.innerHTML = '<div class="breakdown-empty">还没有资产账户，先到「资产负债」里添加</div>';
        return;
    }
    const existing = returnsAtMonth(month, member);
    list.innerHTML = accounts.map(a => `
        <div class="bal-entry-row">
            <div class="breakdown-icon" style="background:${a.color}22;color:${a.color}"><i class="fa-solid ${a.icon}"></i></div>
            <div class="be-name">${a.name}<span class="be-kind asset">${a.group || '资产'}</span></div>
            <div class="be-input">
                <span class="currency-symbol">${state.settings.currency}</span>
                <input type="number" step="0.01" class="text-input be-field" data-account="${a.id}"
                       value="${existing[a.id] !== undefined ? existing[a.id] : ''}" placeholder="0">
            </div>
        </div>`).join('');
}

function clearReturnInputs() {
    document.querySelectorAll('#returnEntryList .be-field').forEach(inp => { inp.value = ''; });
}

function saveReturns() {
    const monthInput = document.getElementById('returnMonthInput');
    const month = monthInput ? monthInput.value : '';
    if (!month) { showToast('请选择月份', 'error'); return; }
    const ms = document.getElementById('returnMemberSelect');
    const member = (ms && ms.value) || state.balanceMembers[0] || '本人';
    let saved = 0;
    document.querySelectorAll('#returnEntryList .be-field').forEach(inp => {
        const raw = String(inp.value).trim();
        if (raw === '') return;
        const amount = parseFloat(raw);
        if (!isFinite(amount)) return;
        const accountId = inp.dataset.account;
        const id = _rebalanceId(member, accountId, month);
        const existing = state.returns.find(r => r.id === id);
        if (existing) {
            if (existing.amount === amount) return;
            existing.amount = amount;
            existing.updatedAt = Date.now();
        } else {
            state.returns.push({ id, member, accountId, month, amount, createdAt: Date.now(), updatedAt: Date.now() });
        }
        saved += 1;
    });
    if (!saved) { showToast('没有需要保存的收益', 'error'); return; }
    flushState();
    closeReturnModal();
    state.returnPeriod = 'month';
    const [y, m] = month.split('-').map(Number);
    state.returnYear = y;
    state.returnMonth = m;
    state.returnGran = null;
    document.querySelectorAll('[data-ret-period]').forEach(b => b.classList.toggle('active', b.dataset.retPeriod === 'month'));
    renderReturns();
    showToast(`已保存 ${saved} 个账户的收益`, 'success');
}

function initReturnListeners() {
    document.querySelectorAll('[data-ret-period]').forEach(btn => {
        btn.addEventListener('click', () => {
            state.returnPeriod = btn.dataset.retPeriod;
            state.returnGran = null;
            document.querySelectorAll('[data-ret-period]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderReturns();
        });
    });
    document.querySelectorAll('#view-returns [data-ret-chart]').forEach(btn => {
        btn.addEventListener('click', () => setReturnChartType(btn.dataset.retChart));
    });
    document.querySelectorAll('#view-returns [data-ret-gran]').forEach(btn => {
        btn.addEventListener('click', () => setReturnGran(btn.dataset.retGran));
    });
    const ySel = document.getElementById('returnYearSelect');
    if (ySel) ySel.addEventListener('change', e => { state.returnYear = parseInt(e.target.value); state.returnMonth = null; renderReturns(); });
    const mSel = document.getElementById('returnMonthSelect');
    if (mSel) mSel.addEventListener('change', e => { state.returnMonth = parseInt(e.target.value); renderReturns(); });
    const rMonthInput = document.getElementById('returnMonthInput');
    if (rMonthInput) rMonthInput.addEventListener('change', renderReturnEntry);
    const rMemberSel = document.getElementById('returnMemberSelect');
    if (rMemberSel) rMemberSel.addEventListener('change', renderReturnEntry);
}

// ---- Event Listeners ----
function initEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            switchView(item.dataset.view);
        });
    });

    // Link buttons
    document.querySelectorAll('[data-goto]').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.goto));
    });

    // Transaction type toggle
    document.querySelectorAll('#transactionModal .type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.selectedTransactionType = btn.dataset.type;
            state.selectedCategoryId = null;
            document.querySelectorAll('#transactionModal .type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderCategoryPicker();
        });
    });

    // Category type toggle
    document.querySelectorAll('#categoryModal .type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.selectedCategoryType = btn.dataset.catType;
            document.querySelectorAll('#categoryModal .type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            state.transactionFilter = tab.dataset.filter;
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderTransactions();
        });
    });

    // Search
    document.getElementById('searchInput').addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderTransactions();
    });

    // Month filter
    document.getElementById('monthFilter').addEventListener('change', (e) => {
        state.monthFilter = e.target.value;
        renderTransactions();
    });

    // Report period
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.reportPeriod = btn.dataset.period;
            state.reportGranularity = null; // fall back to the period's natural granularity
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderReports();
        });
    });

    // Transactions list: lazy chunked rendering
    initTxnInfiniteScroll();

    // Report drill-down (metric cards / chart type / granularity)
    initReportDrillListeners();

    // Balance sheet view
    initBalanceListeners();

    // 四笔钱
    initFundListeners();

    // 投资收益
    initReturnListeners();

    // Report year/month selectors
    document.getElementById('reportYearSelect').addEventListener('change', (e) => {
        state.reportYear = parseInt(e.target.value);
        renderReports();
    });

    document.getElementById('reportMonthSelect').addEventListener('change', (e) => {
        state.reportMonth = parseInt(e.target.value);
        renderReports();
    });

    // Currency
    document.getElementById('currencySelect').addEventListener('change', (e) => {
        state.settings.currency = e.target.value;
        saveState();
        renderView(state.currentView);
        showToast('货币已更新', 'success');
    });

    // Theme
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyTheme(btn.dataset.theme);
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (state.currentView === 'reports') renderReports();
        });
    });

    // Modal overlay click to close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                if (overlay.id === 'categoryTxnModal') closeCategoryTxnModal();
                else overlay.classList.add('hidden');
            }
        });
    });

    // Custom number pad: numbers, decimal, operators, backspace
    document.querySelectorAll('.numpad-num, .numpad-op').forEach(btn => {
        btn.addEventListener('click', () => numpadPress(btn.dataset.key));
    });
    document.getElementById('numpadBack').addEventListener('click', numpadBack);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Cmd+N / Ctrl+N: Quick add (jumps to transactions view)
        if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
            e.preventDefault();
            switchView('transactions');
            openTransactionModal();
        }
        // Escape: close only the overlay on top, so a drill-down list stays open behind it
        if (e.key === 'Escape') {
            closeTopmostOverlay();
        }
        // Enter in note input: Save (works since amount input is now readonly)
        if (e.key === 'Enter' && document.activeElement?.id === 'noteInput') {
            saveTransaction();
        }
        // Numeric / operator keys when the transaction modal is open.
        // Skipped while the caret sits in an editable field, so typing a note or a
        // date goes to that field instead of the calculator (and Enter doesn't double-save).
        const ae = document.activeElement;
        const typingInField = !!(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT') && !ae.readOnly);
        if (!typingInField && !document.getElementById('transactionModal').classList.contains('hidden')) {
            if (/^[0-9.+\-]$/.test(e.key)) {
                e.preventDefault();
                numpadPress(e.key);
            } else if (e.key === 'Backspace') {
                e.preventDefault();
                numpadBack();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                saveTransaction();
            }
        }
    });

    // Traffic lights (just for fun)
    document.querySelector('.traffic-light-red').addEventListener('click', () => {
        showToast('记账本保持运行中', 'info');
    });
    document.querySelector('.traffic-light-yellow').addEventListener('click', () => {
        showToast('最小化功能暂未启用', 'info');
    });
    document.querySelector('.traffic-light-green').addEventListener('click', () => {
        showToast('记账本已就绪', 'info');
    });
}

// ---- Init ----
async function init() {
    loadRemoteSyncConfig();
    loadState();
    pruneTombstones();
    applyTombstones();
    document.documentElement.setAttribute('data-theme', state.settings.theme);
    initEventListeners();
    initCategoryInteractions();
    switchView(state.settings.defaultView || 'transactions');

    // 桌面版：先把 iCloud 上的账本拉下来合并，再决定要不要塞示例数据，
    // 否则新机器上示例数据会和真实数据混在一起。
    if (isElectron()) {
        await initICloudSync();
        renderView(state.currentView);
        updateSidebarSummary();
    }

    // 关页面 / 切到后台时把待写入的数据立刻落盘
    window.addEventListener('pagehide', () => { if (__saveTimer) flushState(); });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && __saveTimer) flushState();
    });

    // Auto-load sample data on first visit
    const hasAnything = state.transactions.length > 0 || state.balances.length > 0 || state.returns.length > 0;
    if (!hasAnything && !localStorage.getItem(STORAGE_KEY + '_visited')) {
        localStorage.setItem(STORAGE_KEY + '_visited', '1');
        loadSampleData();
    }

    // Auto-open transaction modal on launch if enabled
    if (state.settings.autoOpenAdd) {
        setTimeout(() => openTransactionModal(), 300);
    }

    // Warm up Chart.js in the background once the first screen is on screen
    setTimeout(() => { if (typeof Chart === 'undefined') loadChartLib().catch(() => {}); }, 1200);

    // Initialize iCloud sync (web/PWA has no native bridge, this just renders the manual UI)
    if (!isElectron()) setTimeout(() => initICloudSync(), 500);

    // 云同步（Gist）：iPhone / Mac / 浏览器共用同一本账
    startRemotePolling();                       // 未配置时内部直接跳过
    if (remoteSyncReady()) setTimeout(() => remoteSyncCycle('startup'), 1200);
}

document.addEventListener('DOMContentLoaded', init);
