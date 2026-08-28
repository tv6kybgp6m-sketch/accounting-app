/* ============================================
   记账本 Bookkeeping - App Logic
   ============================================ */

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
    settings: { currency: '¥', theme: 'light', defaultPaymentMethod: '微信支付', defaultView: 'transactions', autoOpenAdd: false },
    currentView: 'transactions',
    transactionFilter: 'all',
    searchQuery: '',
    monthFilter: '',
    reportPeriod: 'month',
    reportYear: null,
    reportMonth: null,
    reportDetailType: null,
    reportDetailChartType: 'line',
    reportDetailExpandedCat: null,
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

function saveState() {
    const data = {
        transactions: state.transactions,
        categories: state.categories,
        budgets: state.budgets,
        paymentMethods: state.paymentMethods,
        settings: state.settings,
        categoryVersion: state.categoryVersion || 2,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // Trigger iCloud sync (debounced)
    scheduleICloudSync();
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

async function syncToICloud() {
    if (!iCloudSyncEnabled || !isElectron()) return;

    try {
        const syncData = {
            version: 1,
            lastModified: Date.now(),
            deviceName: 'Mac',
            data: {
                transactions: state.transactions,
                categories: state.categories,
                budgets: state.budgets,
                paymentMethods: state.paymentMethods,
                settings: state.settings,
            },
        };
        await window.electronAPI.icloud.writeData(syncData);
        iCloudLastSyncTime = Date.now();
        updateICloudSyncUI();
    } catch (e) {
        console.error('iCloud sync error:', e);
    }
}

function handleICloudFileChange(remoteData) {
    if (!remoteData || !remoteData.data) return;
    // Don't process our own writes
    if (remoteData.deviceName === 'Mac') return;

    mergeRemoteData(remoteData);
    renderView(state.currentView);
    showToast('已从 iCloud 同步最新数据', 'success');
}

function mergeRemoteData(remoteData) {
    const remote = remoteData.data;
    if (!remote) return;

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

    // Merge payment methods: union by name
    const pmSet = new Set(state.paymentMethods);
    (remote.paymentMethods || []).forEach(p => pmSet.add(p));
    state.paymentMethods = Array.from(pmSet);

    state.transactions = Array.from(txnMap.values());
    state.categories = Array.from(catMap.values());
    state.budgets = Array.from(budMap.values());

    // Settings: prefer remote if newer
    if (remoteData.lastModified > (iCloudLastSyncTime || 0)) {
        state.settings = { ...state.settings, ...remote.settings };
        document.documentElement.setAttribute('data-theme', state.settings.theme);
    }

    saveState(); // Save merged data locally
    iCloudLastSyncTime = Date.now();
    updateICloudSyncUI();
}

// PWA: Export to iCloud (download JSON)
function exportToICloud() {
    const syncData = {
        version: 1,
        lastModified: Date.now(),
        deviceName: 'iPhone',
        data: {
            transactions: state.transactions,
            categories: state.categories,
            budgets: state.budgets,
            paymentMethods: state.paymentMethods,
            settings: state.settings,
        },
    };
    const blob = new Blob([JSON.stringify(syncData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accounting-sync.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    iCloudLastSyncTime = Date.now();
    updateICloudSyncUI();
    showToast('已导出同步文件，请保存到 iCloud Drive', 'success');
}

// PWA: Import from iCloud (file input)
function importFromICloud(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const remoteData = JSON.parse(e.target.result);
            if (remoteData.data) {
                mergeRemoteData(remoteData);
                renderView(state.currentView);
                showToast('已从 iCloud 导入并合并数据', 'success');
            } else {
                showToast('文件格式不正确', 'error');
            }
        } catch (err) {
            showToast('导入失败，文件格式错误', 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
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
                    <div class="settings-label">从 iCloud 导入<div class="settings-sublabel">从 iCloud Drive 选择同步文件</div></div>
                    <button class="secondary-btn" onclick="document.getElementById('icloudImportFile').click()">
                        <i class="fa-solid fa-cloud-arrow-down"></i> 导入
                    </button>
                    <input type="file" id="icloudImportFile" accept=".json" style="display:none" onchange="importFromICloud(event)">
                </div>
                <div class="settings-row">
                    <div class="settings-label">导出到 iCloud<div class="settings-sublabel">保存到 iCloud Drive 供其他设备同步</div></div>
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
            state.settings = { ...{ currency: '¥', theme: 'light', defaultPaymentMethod: '微信支付', defaultView: 'transactions', autoOpenAdd: false }, ...data.settings };
            // 仪表盘页面已移除：旧设置迁移到交易记录
            if (state.settings.defaultView === 'dashboard') state.settings.defaultView = 'transactions';

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
function formatCurrency(amount) {
    const sym = state.settings.currency || '¥';
    const sign = amount < 0 ? '-' : '';
    const abs = Math.abs(amount);
    return sign + sym + abs.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
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

function formatDateFull(dateStr) {
    const d = new Date(dateStr);
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
    const noteText = t.note ? t.note : name;
    const payment = t.paymentMethod || '现金';
    const paymentIcon = paymentIconFor(payment);

    return `
        <div class="transaction-item" onclick="editTransaction('${t.id}')">
            <div class="transaction-icon" style="background:${color}22;color:${color}">
                <i class="fa-solid ${icon}"></i>
            </div>
            <div class="transaction-info">
                <div class="transaction-category">${name}</div>
                <div class="transaction-note">${noteText} <span class="txn-payment"><i class="${paymentIcon}"></i> ${payment}</span></div>
            </div>
            <div class="transaction-date">${formatDate(t.date)}</div>
            <div class="transaction-amount ${t.type}">${sign}${formatCurrency(t.amount)}</div>
        </div>
    `;
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
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date) || b.createdAt - a.createdAt);

    const container = document.getElementById('allTransactions');
    const empty = document.getElementById('emptyTransactions');

    if (filtered.length === 0) {
        container.innerHTML = '';
        empty.classList.remove('hidden');
    } else {
        empty.classList.add('hidden');
        container.innerHTML = filtered.map(t => transactionItemHTML(t)).join('');
    }
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
        }
    }
    display.value = shown;

    // Expression line shows the full expression (e.g. "10+20-5 = 25")
    const evaluated = (() => {
        if (!calc.expr) return '';
        const last = calc.expr[calc.expr.length - 1];
        if (last === '+' || last === '-') return '';
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
            calc.expr += (calc.expr && calc.justOp ? '' : '0.');
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
    }
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
}

function editTransaction(id) {
    openTransactionModal(id);
}

function deleteTransaction(id) {
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveState();
    showToast('交易已删除', 'success');
    renderView(state.currentView);
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
    const yearSelect = document.getElementById('reportYearSelect');
    const monthSelect = document.getElementById('reportMonthSelect');
    const now = new Date();

    // Collect all years from transactions + current year
    const years = [...new Set(state.transactions.map(t => new Date(t.date).getFullYear()))];
    years.push(now.getFullYear());
    const uniqueYears = [...new Set(years)].sort((a, b) => b - a);

    const currentYear = state.reportYear || now.getFullYear();
    yearSelect.innerHTML = uniqueYears.map(y =>
        `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}年</option>`
    ).join('');

    // Show/hide selectors based on period
    if (state.reportPeriod === 'all') {
        yearSelect.style.display = 'none';
        monthSelect.style.display = 'none';
    } else if (state.reportPeriod === 'month') {
        yearSelect.style.display = '';
        monthSelect.style.display = '';
        const currentMonth = state.reportMonth || (now.getMonth() + 1);
        monthSelect.innerHTML = Array.from({length: 12}, (_, i) => i + 1).map(m =>
            `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${m}月</option>`
        ).join('');
    } else {
        yearSelect.style.display = '';
        monthSelect.style.display = 'none';
    }
}

function renderReports() {
    renderReportSelectors();

    const isYear = state.reportPeriod === 'year';
    const isAll = state.reportPeriod === 'all';
    const now = new Date();
    const selYear = state.reportYear || now.getFullYear();
    const selMonth = state.reportMonth || (now.getMonth() + 1);
    let filtered;

    if (isAll) {
        filtered = state.transactions.slice();
    } else if (isYear) {
        filtered = state.transactions.filter(t => new Date(t.date).getFullYear() === selYear);
    } else {
        const mk = `${selYear}-${String(selMonth).padStart(2, '0')}`;
        filtered = state.transactions.filter(t => getMonthKey(t.date) === mk);
    }

    const income = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;

    // Calculate days for daily average
    let days;
    if (isAll) {
        if (filtered.length === 0) {
            days = 1;
        } else {
            const dates = filtered.map(t => new Date(t.date).getTime()).sort((a, b) => a - b);
            const first = new Date(dates[0]); first.setHours(0, 0, 0, 0);
            const today = new Date(); today.setHours(0, 0, 0, 0);
            days = Math.max(1, Math.floor((today - first) / 86400000) + 1);
        }
    } else if (isYear) {
        if (selYear === now.getFullYear()) {
            const start = new Date(selYear, 0, 1);
            days = Math.floor((now - start) / 86400000) + 1;
        } else {
            days = 365;
        }
    } else {
        if (selYear === now.getFullYear() && selMonth === now.getMonth() + 1) {
            days = now.getDate();
        } else {
            days = getDaysInMonth(selYear, selMonth);
        }
    }
    const dailyAvg = expense / days;

    document.getElementById('reportIncome').textContent = formatCurrency(income);
    document.getElementById('reportExpense').textContent = formatCurrency(expense);
    document.getElementById('reportBalance').textContent = formatCurrency(balance);
    document.getElementById('reportDailyAvg').textContent = formatCurrency(dailyAvg);

    if (isAll) {
        document.getElementById('dailyChartSubtitle').textContent = '全部年份';
        document.getElementById('monthlyChartTitle').textContent = '年度收支对比';
        document.getElementById('monthlyChartSubtitle').textContent = '全部年份';
    } else if (isYear) {
        document.getElementById('dailyChartSubtitle').textContent = `${selYear}年`;
        document.getElementById('monthlyChartTitle').textContent = '月度收支对比';
        document.getElementById('monthlyChartSubtitle').textContent = `${selYear}年`;
    } else {
        const mk = `${selYear}-${String(selMonth).padStart(2, '0')}`;
        document.getElementById('dailyChartSubtitle').textContent = getMonthLabel(mk);
        document.getElementById('monthlyChartTitle').textContent = '每日收支对比';
        document.getElementById('monthlyChartSubtitle').textContent = getMonthLabel(mk);
    }

    renderMonthlyChart(filtered, isYear, isAll, selYear, selMonth);
    renderCategoryRank(filtered);
    renderDailyChart(filtered, isYear, isAll, selYear, selMonth);
}

function renderMonthlyChart(filtered, isYear, isAll, selYear, selMonth) {
    const ctx = document.getElementById('monthlyChart');
    if (!ctx) return;

    const labels = [];
    const incomeData = [];
    const expenseData = [];

    if (isAll) {
        // All-time report: bars per year
        const years = [...new Set(filtered.map(t => new Date(t.date).getFullYear()))].sort();
        for (const y of years) {
            labels.push(`${y}年`);
            const txns = filtered.filter(t => new Date(t.date).getFullYear() === y);
            incomeData.push(txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
            expenseData.push(txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
        }
    } else if (isYear) {
        // Yearly report: bars for Jan ~ Dec of the selected year
        for (let m = 0; m < 12; m++) {
            labels.push(`${m + 1}月`);
            const txns = filtered.filter(t => new Date(t.date).getMonth() === m);
            incomeData.push(txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
            expenseData.push(txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
        }
    } else {
        // Monthly report: bars for day 1 ~ end of the selected month
        const daysInMonth = getDaysInMonth(selYear, selMonth);
        for (let d = 1; d <= daysInMonth; d++) {
            labels.push(`${d}日`);
            const txns = filtered.filter(t => new Date(t.date).getDate() === d);
            incomeData.push(txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
            expenseData.push(txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
        }
    }

    if (charts.monthly) charts.monthly.destroy();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#98989d' : '#6e6e73';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

    charts.monthly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: '收入', data: incomeData, backgroundColor: '#34c759', borderRadius: 4, barPercentage: 0.5, categoryPercentage: 0.8 },
                { label: '支出', data: expenseData, backgroundColor: '#ff3b30', borderRadius: 4, barPercentage: 0.5, categoryPercentage: 0.8 },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: textColor, font: { size: 12, family: '-apple-system' }, usePointStyle: true, pointStyle: 'circle', padding: 12 } },
                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}` } },
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: textColor, font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: isAll ? 20 : (isYear ? 12 : 16) } },
                y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 }, callback: (v) => state.settings.currency + v } },
            },
        },
    });
}

function renderCategoryRank(filtered) {
    const container = document.getElementById('categoryRankList');
    const expenses = filtered.filter(t => t.type === 'expense');

    const catTotals = {};
    expenses.forEach(t => {
        catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
    });

    const entries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const totalExpense = entries.reduce((s, [, v]) => s + v, 0);
    const maxVal = entries.length > 0 ? entries[0][1] : 1;

    // Render pie chart
    renderCategoryRankChart(entries);

    if (entries.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-tertiary);font-size:13px;">暂无支出数据</div>';
        return;
    }

    container.innerHTML = entries.map(([id, val]) => {
        const cat = getCategoryById(id);
        const pct = Math.round((val / maxVal) * 100);
        const sharePct = totalExpense > 0 ? ((val / totalExpense) * 100).toFixed(1) : '0';
        return `
            <div class="category-rank-item">
                <div class="category-rank-header">
                    <span class="category-rank-name">
                        <i class="fa-solid ${cat?.icon || 'fa-ellipsis'}" style="color:${cat?.color || '#636e72'}"></i>
                        ${cat?.name || '未知'}
                    </span>
                    <span class="category-rank-amount">${formatCurrency(val)} <span style="color:var(--text-tertiary);font-size:11px;font-weight:400">(${sharePct}%)</span></span>
                </div>
                <div class="category-rank-bar">
                    <div class="category-rank-fill" style="width:${pct}%;background:${cat?.color || '#636e72'}"></div>
                </div>
            </div>
        `;
    }).join('');
}

function renderCategoryRankChart(entries) {
    const ctx = document.getElementById('rankPieChart');
    if (!ctx) return;

    const labels = entries.map(([id]) => getCategoryById(id)?.name || '未知');
    const data = entries.map(([, v]) => v);
    const colors = entries.map(([id]) => getCategoryById(id)?.color || '#636e72');

    if (charts.rankPie) charts.rankPie.destroy();

    if (data.length === 0) {
        charts.rankPie = new Chart(ctx, {
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

    charts.rankPie = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '55%',
            plugins: {
                legend: { display: false },
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

function renderDailyChart(filtered, isYear, isAll, selYear, selMonth) {
    const ctx = document.getElementById('dailyChart');
    if (!ctx) return;

    let labels, dailyExpenses;

    if (isAll) {
        const years = [...new Set(filtered.map(t => new Date(t.date).getFullYear()))].sort();
        labels = years.map(y => `${y}年`);
        dailyExpenses = years.map(y =>
            filtered.filter(t => t.type === 'expense' && new Date(t.date).getFullYear() === y).reduce((s, t) => s + t.amount, 0)
        );
    } else if (isYear) {
        labels = [];
        dailyExpenses = [];
        for (let m = 0; m < 12; m++) {
            labels.push(`${m + 1}月`);
            const monthExp = filtered.filter(t => t.type === 'expense' && new Date(t.date).getMonth() === m).reduce((s, t) => s + t.amount, 0);
            dailyExpenses.push(monthExp);
        }
    } else {
        const daysInMonth = getDaysInMonth(selYear, selMonth);
        labels = [];
        dailyExpenses = [];
        for (let d = 1; d <= daysInMonth; d++) {
            labels.push(d);
            const dayExp = filtered.filter(t => t.type === 'expense' && new Date(t.date).getDate() === d).reduce((s, t) => s + t.amount, 0);
            dailyExpenses.push(dayExp);
        }
    }

    if (charts.daily) charts.daily.destroy();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#98989d' : '#6e6e73';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

    charts.daily = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: '支出',
                data: dailyExpenses,
                borderColor: '#ff3b30',
                backgroundColor: 'rgba(255,59,48,0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: (isYear || isAll) ? 4 : 0,
                pointHoverRadius: 6,
                borderWidth: 2,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => `支出: ${formatCurrency(ctx.raw)}` } },
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: textColor, font: { size: 10 }, maxTicksLimit: isAll ? 20 : (isYear ? 12 : 10) } },
                y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 }, callback: (v) => state.settings.currency + v } },
            },
        },
    });
}

// ---- Report Detail Modal ----
function getReportFilteredTransactions() {
    const isYear = state.reportPeriod === 'year';
    const isAll = state.reportPeriod === 'all';
    const now = new Date();
    const selYear = state.reportYear || now.getFullYear();
    const selMonth = state.reportMonth || (now.getMonth() + 1);

    if (isAll) return state.transactions.slice();
    if (isYear) return state.transactions.filter(t => new Date(t.date).getFullYear() === selYear);
    const mk = `${selYear}-${String(selMonth).padStart(2, '0')}`;
    return state.transactions.filter(t => getMonthKey(t.date) === mk);
}

function openReportDetail(type) {
    state.reportDetailType = type;
    state.reportDetailChartType = 'line';
    state.reportDetailExpandedCat = null;

    const titles = { income: '收入明细', expense: '支出明细', balance: '结余明细' };
    document.getElementById('reportDetailTitle').textContent = titles[type] || '明细';

    // Reset chart type tabs
    document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.chart-type-btn[data-chart-type="line"]').classList.add('active');

    document.getElementById('reportDetailModal').classList.remove('hidden');
    renderReportDetail();
}

function closeReportDetail() {
    document.getElementById('reportDetailModal').classList.add('hidden');
    if (charts.reportDetail) { charts.reportDetail.destroy(); charts.reportDetail = null; }
    state.reportDetailType = null;
    state.reportDetailExpandedCat = null;
}

function switchReportDetailChart(chartType) {
    state.reportDetailChartType = chartType;
    document.querySelectorAll('.chart-type-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.chartType === chartType);
    });
    renderReportDetailChart();
}

function renderReportDetail() {
    renderReportDetailChart();
    renderReportDetailCategories();
}

function renderReportDetailChart() {
    const ctx = document.getElementById('reportDetailChart');
    if (!ctx) return;
    const type = state.reportDetailType;
    if (!type) return;

    const filtered = getReportFilteredTransactions();
    const isAll = state.reportPeriod === 'all';
    const isYear = state.reportPeriod === 'year';
    const now = new Date();
    const selYear = state.reportYear || now.getFullYear();
    const selMonth = state.reportMonth || (now.getMonth() + 1);

    if (charts.reportDetail) charts.reportDetail.destroy();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#98989d' : '#6e6e73';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

    const chartType = state.reportDetailChartType;

    // Helper: filter transactions for this detail type
    const getTypedTxns = (t) => {
        if (type === 'income') return t.type === 'income';
        if (type === 'expense') return t.type === 'expense';
        return true; // balance: all
    };

    if (chartType === 'pie') {
        // Pie chart: by category
        const typedTxns = filtered.filter(getTypedTxns);
        const catTotals = {};
        typedTxns.forEach(t => {
            const key = t.categoryId || 'unknown';
            catTotals[key] = (catTotals[key] || 0) + (type === 'balance' ? (t.type === 'income' ? t.amount : -t.amount) : t.amount);
        });
        const entries = Object.entries(catTotals)
            .filter(([, v]) => Math.abs(v) > 0.01)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

        if (entries.length === 0) {
            charts.reportDetail = new Chart(ctx, {
                type: 'doughnut',
                data: { labels: ['暂无数据'], datasets: [{ data: [1], backgroundColor: ['#e0e0e0'], borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false }, datalabels: { display: false } } },
            });
            return;
        }

        const labels = entries.map(([id]) => getCategoryById(id)?.name || '未知');
        const data = entries.map(([, v]) => Math.abs(v));
        const colors = entries.map(([id]) => getCategoryById(id)?.color || '#636e72');
        const total = data.reduce((s, v) => s + v, 0);

        // Register datalabels plugin
        if (window.ChartDataLabels) Chart.register(window.ChartDataLabels);

        charts.reportDetail = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: isDark ? '#1c1c1e' : '#fff', hoverOffset: 8 }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '42%',
                plugins: {
                    legend: {
                        display: true,
                        position: 'right',
                        labels: { color: textColor, font: { size: 11, family: '-apple-system' }, usePointStyle: true, pointStyle: 'circle', padding: 8, boxWidth: 10 },
                    },
                    tooltip: {
                        callbacks: {
                            label: (c) => {
                                const pct = ((c.raw / total) * 100).toFixed(1);
                                return `${c.label}: ${formatCurrency(c.raw)} (${pct}%)`;
                            },
                        },
                    },
                    datalabels: {
                        color: '#fff',
                        font: { size: 11, weight: 'bold', family: '-apple-system' },
                        formatter: (value, context) => {
                            const pct = ((value / total) * 100).toFixed(0);
                            const label = context.chart.data.labels[context.dataIndex];
                            if (pct < 5) return ''; // Hide small slices
                            return label.length > 4 ? label.slice(0, 3) + '..' : label + '\n' + pct + '%';
                        },
                        textAlign: 'center',
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                    },
                },
            },
        });
    } else if (chartType === 'bar') {
        // Bar chart: by category
        const typedTxns = filtered.filter(getTypedTxns);
        const catTotals = {};
        typedTxns.forEach(t => {
            const key = t.categoryId || 'unknown';
            const val = type === 'balance' ? (t.type === 'income' ? t.amount : -t.amount) : t.amount;
            catTotals[key] = (catTotals[key] || 0) + val;
        });
        const entries = Object.entries(catTotals)
            .filter(([, v]) => Math.abs(v) > 0.01)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

        const labels = entries.map(([id]) => getCategoryById(id)?.name || '未知');
        const data = entries.map(([, v]) => v);
        const colors = entries.map(([id]) => {
            const cat = getCategoryById(id);
            if (type === 'balance') return v >= 0 ? (cat?.color || '#34c759') : '#ff3b30';
            return cat?.color || '#636e72';
        });

        charts.reportDetail = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets: [{ label: titles[type] || '金额', data, backgroundColor: colors, borderRadius: 6, barPercentage: 0.6 }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (c) => formatCurrency(c.raw) } },
                    datalabels: { display: false },
                },
                scales: {
                    x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 }, callback: (v) => state.settings.currency + Math.abs(v) } },
                    y: { grid: { display: false }, ticks: { color: textColor, font: { size: 11 } } },
                },
            },
        });
    } else {
        // Line chart: trend over time
        let labels, dataValues;
        const lineColor = type === 'income' ? '#34c759' : type === 'expense' ? '#ff3b30' : '#007aff';
        const fillColor = type === 'income' ? 'rgba(52,199,89,0.1)' : type === 'expense' ? 'rgba(255,59,48,0.1)' : 'rgba(0,122,255,0.1)';

        if (isAll) {
            const years = [...new Set(filtered.map(t => new Date(t.date).getFullYear()))].sort();
            labels = years.map(y => `${y}年`);
            dataValues = years.map(y => {
                const txns = filtered.filter(t => new Date(t.date).getFullYear() === y && getTypedTxns(t));
                return txns.reduce((s, t) => s + (type === 'balance' ? (t.type === 'income' ? t.amount : -t.amount) : t.amount), 0);
            });
        } else if (isYear) {
            labels = [];
            dataValues = [];
            for (let m = 0; m < 12; m++) {
                labels.push(`${m + 1}月`);
                const txns = filtered.filter(t => new Date(t.date).getMonth() === m && getTypedTxns(t));
                dataValues.push(txns.reduce((s, t) => s + (type === 'balance' ? (t.type === 'income' ? t.amount : -t.amount) : t.amount), 0));
            }
        } else {
            const daysInMonth = getDaysInMonth(selYear, selMonth);
            labels = [];
            dataValues = [];
            for (let d = 1; d <= daysInMonth; d++) {
                labels.push(d);
                const txns = filtered.filter(t => new Date(t.date).getDate() === d && getTypedTxns(t));
                dataValues.push(txns.reduce((s, t) => s + (type === 'balance' ? (t.type === 'income' ? t.amount : -t.amount) : t.amount), 0));
            }
        }

        charts.reportDetail = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: titles[type] || '金额',
                    data: dataValues,
                    borderColor: lineColor,
                    backgroundColor: fillColor,
                    fill: true,
                    tension: 0.3,
                    pointRadius: (isYear || isAll) ? 3 : 0,
                    pointHoverRadius: 6,
                    borderWidth: 2,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (c) => formatCurrency(c.raw) } },
                    datalabels: { display: false },
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: textColor, font: { size: 10 }, maxTicksLimit: isAll ? 20 : (isYear ? 12 : 10) } },
                    y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 }, callback: (v) => state.settings.currency + v } },
                },
            },
        });
    }
}

const titles = { income: '收入', expense: '支出', balance: '结余' };

function renderReportDetailCategories() {
    const container = document.getElementById('reportDetailCategories');
    const type = state.reportDetailType;
    if (!type) return;

    const filtered = getReportFilteredTransactions();
    const typedTxns = filtered.filter(t => {
        if (type === 'income') return t.type === 'income';
        if (type === 'expense') return t.type === 'expense';
        return true;
    });

    const catTotals = {};
    const catTxns = {};
    typedTxns.forEach(t => {
        const key = t.categoryId || 'unknown';
        const val = type === 'balance' ? (t.type === 'income' ? t.amount : -t.amount) : t.amount;
        catTotals[key] = (catTotals[key] || 0) + val;
        if (!catTxns[key]) catTxns[key] = [];
        catTxns[key].push(t);
    });

    const entries = Object.entries(catTotals)
        .filter(([, v]) => Math.abs(v) > 0.01)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

    if (entries.length === 0) {
        container.innerHTML = '<div class="rdc-empty">暂无数据</div>';
        return;
    }

    const totalAbs = entries.reduce((s, [, v]) => s + Math.abs(v), 0);
    const expandedCat = state.reportDetailExpandedCat;

    container.innerHTML = entries.map(([catId, val]) => {
        const cat = getCategoryById(catId);
        const absVal = Math.abs(val);
        const pct = totalAbs > 0 ? ((absVal / totalAbs) * 100).toFixed(1) : '0';
        const isExpanded = expandedCat === catId;
        const isIncome = val >= 0;
        const valColor = type === 'balance' ? (isIncome ? 'var(--income)' : 'var(--expense)') : (type === 'income' ? 'var(--income)' : 'var(--expense)');
        const iconName = cat?.icon || 'fa-ellipsis';
        const iconColor = cat?.color || '#636e72';

        let txnsHtml = '';
        if (isExpanded && catTxns[catId]) {
            const sortedTxns = catTxns[catId].sort((a, b) => new Date(b.date) - new Date(a.date) || (b.time || '').localeCompare(a.time || ''));
            txnsHtml = sortedTxns.map(t => `
                <div class="rdc-txn">
                    <div class="rdc-txn-info">
                        <span class="rdc-txn-note">${t.note || cat?.name || ''}</span>
                        <span class="rdc-txn-date">${formatDate(t.date)} ${t.time || ''}</span>
                    </div>
                    <span class="rdc-txn-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount).replace(/^[¥-]+/, '¥')}</span>
                </div>
            `).join('');
        }

        return `
            <div class="rdc-item ${isExpanded ? 'expanded' : ''}" onclick="toggleReportDetailCategory('${catId}')">
                <div class="rdc-header">
                    <div class="rdc-icon" style="background:${iconColor}">
                        <i class="fa-solid ${iconName}"></i>
                    </div>
                    <span class="rdc-name">${cat?.name || '未知'}</span>
                    <span class="rdc-amount" style="color:${valColor}">${val < 0 ? '-' : ''}${formatCurrency(absVal)}</span>
                    <span class="rdc-pct">${pct}%</span>
                    <i class="fa-solid fa-chevron-right rdc-chevron"></i>
                </div>
                <div class="rdc-transactions">${txnsHtml}</div>
            </div>
        `;
    }).join('');
}

function toggleReportDetailCategory(catId) {
    state.reportDetailExpandedCat = state.reportDetailExpandedCat === catId ? null : catId;
    renderReportDetailCategories();
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
        showToast('Excel 库未加载，请刷新页面重试', 'error');
        console.error('XLSX library not loaded');
        return;
    }

    try {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Transactions
        const txnData = state.transactions.map(t => {
            const cat = getCategoryById(t.categoryId);
            return {
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
        ws1['!cols'] = [{wch:14},{wch:10},{wch:8},{wch:12},{wch:14},{wch:12},{wch:24}];
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

        // Use XLSX.write to generate binary, then download via Blob
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `记账本-${formatDateFull(new Date().toISOString())}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 500);

        showToast('数据已导出为 Excel (.xlsx)', 'success');
    } catch (err) {
        console.error('Export error:', err);
        showToast('导出失败: ' + err.message, 'error');
    }
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

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (typeof XLSX === 'undefined') {
        showToast('Excel 库未加载，请刷新页面重试', 'error');
        event.target.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const wb = XLSX.read(data, { type: 'array', cellDates: true });

            // Parse categories first (transactions reference them)
            const ws2 = wb.Sheets['分类'];
            if (ws2) {
                const catRows = XLSX.utils.sheet_to_json(ws2);
                state.categories = catRows.map(row => ({
                    id: row['ID'] || ('c_' + uid()),
                    name: row['名称'] || '未知',
                    type: row['类型'] === '收入' ? 'income' : 'expense',
                    icon: row['图标'] || 'fa-ellipsis',
                    color: row['颜色'] || '#636e72',
                }));
            }

            // Parse transactions
            const ws1 = wb.Sheets['交易记录'];
            if (ws1) {
                const txnRows = XLSX.utils.sheet_to_json(ws1);
                state.transactions = txnRows.map(row => {
                    const catName = row['分类'];
                    const cat = state.categories.find(c => c.name === catName);
                    const typeStr = row['类型'];
                    return {
                        id: uid(),
                        type: typeStr === '收入' ? 'income' : 'expense',
                        amount: parseFloat(row['金额']) || 0,
                        categoryId: cat?.id || (typeStr === '收入' ? 'i_other' : 'e_other'),
                        date: normalizeImportDate(row['日期']),
                        time: row['时间'] || '',
                        note: row['备注'] || '',
                        paymentMethod: row['支付方式'] || '现金',
                        createdAt: Date.now(),
                    };
                });
                // Auto-register unknown payment methods from imported data
                txnRows.forEach(row => {
                    const pm = (row['支付方式'] || '').trim();
                    if (pm && !state.paymentMethods.includes(pm)) {
                        state.paymentMethods.push(pm);
                    }
                });
            }

            // Parse budgets
            const ws3 = wb.Sheets['预算'];
            if (ws3) {
                const budRows = XLSX.utils.sheet_to_json(ws3);
                state.budgets = budRows.map(row => {
                    const catName = row['分类'];
                    const cat = state.categories.find(c => c.name === catName);
                    return {
                        id: uid(),
                        categoryId: cat?.id || 'e_other',
                        amount: parseFloat(row['预算金额']) || 0,
                    };
                });
            }

            saveState();
            applyTheme(state.settings.theme);
            renderView(state.currentView);
            showToast('Excel 数据已导入', 'success');
        } catch (err) {
            console.error('Import error:', err);
            showToast('导入失败，文件格式错误', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
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

    state.transactions = samples;
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
    state.transactions = [];
    state.budgets = [];
    state.categories = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES];
    saveState();
    renderView(state.currentView);
    showToast('所有数据已清空', 'success');
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
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderReports();
        });
    });

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
        });
    });

    // Modal overlay click to close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.add('hidden');
                if (overlay.id === 'reportDetailModal' && charts.reportDetail) {
                    charts.reportDetail.destroy();
                    charts.reportDetail = null;
                }
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
        // Escape: Close modals
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
        }
        // Enter in note input: Save (works since amount input is now readonly)
        if (e.key === 'Enter' && document.activeElement?.id === 'noteInput') {
            saveTransaction();
        }
        // Numeric / operator keys when the transaction modal is open
        if (!document.getElementById('transactionModal').classList.contains('hidden')) {
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
function init() {
    loadState();
    document.documentElement.setAttribute('data-theme', state.settings.theme);
    initEventListeners();
    initCategoryInteractions();
    switchView(state.settings.defaultView || 'transactions');

    // Auto-load sample data on first visit
    if (state.transactions.length === 0 && !localStorage.getItem(STORAGE_KEY + '_visited')) {
        localStorage.setItem(STORAGE_KEY + '_visited', '1');
        loadSampleData();
    }

    // Auto-open transaction modal on launch if enabled
    if (state.settings.autoOpenAdd) {
        setTimeout(() => openTransactionModal(), 300);
    }

    // Initialize iCloud sync
    setTimeout(() => initICloudSync(), 500);
}

document.addEventListener('DOMContentLoaded', init);
