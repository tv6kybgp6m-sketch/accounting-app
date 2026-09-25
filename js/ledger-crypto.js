// ---------------- 账本加密（口令 + 恢复码双钥）----------------
//
// 结构：一把随机主密钥（AES-GCM 256）加密真正的数据；主密钥分别用
// 「口令派生的 KEK」和「恢复码派生的 KEK」包一层（AES-KW）。
// 每个封套自带这份 keyring，所以任何一份密文在任意设备上，只要有口令
// 或恢复码就能解开；本机再把主密钥存进 IndexedDB（非可导出），
// 日常打开就一次都不用输。
// （主密钥必须可导出，WebCrypto 不接受用 wrapKey 包不可导出密钥；
//  它存在 IndexedDB 里，能读到它的代码本来也能调用解密，收益差别不大）
//
// 换口令只重新包一次主密钥，不重新加密数据。
//
// 注意：加密状态记在单独的 localStorage 键里，绝不进同步载荷——
// 否则 A 设备开了加密，设置同步到 B 设备后 B 没有密钥直接卡死。

const CRYPTO_STATE_KEY = 'bookkeeping_app_crypto';
const CRYPTO_DB_NAME = 'bookkeeping-crypto';
const CRYPTO_DB_STORE = 'keys';
const ENC_MAGIC = 'BKE1';
const PBKDF2_PASS_ITER = 310000;      // 口令熵低，多迭代
const PBKDF2_CODE_ITER = 100000;      // 恢复码本身约 100 bit，够用且解锁更快
const REC_ALPHABET = '3456789ABCDEFGHJKLMNPQRSTUVWXYZ';   // 去掉易混的 0O1I

const LedgerCrypto = (() => {
    let cachedKey = null;             // 解锁后的主密钥（内存）
    let dbPromise = null;

    // ---- 小工具 ----
    const te = new TextEncoder();
    const td = new TextDecoder();
    const b64 = (buf) => {
        const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
        let bin = '';
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
            bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return btoa(bin);
    };
    const unb64 = (str) => {
        const bin = atob(str);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    };
    const available = () => !!(window.crypto && window.crypto.subtle && window.crypto.getRandomValues);

    // ---- IndexedDB：只存主密钥 ----
    function openDb() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(CRYPTO_DB_NAME, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(CRYPTO_DB_STORE)) db.createObjectStore(CRYPTO_DB_STORE);
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        return dbPromise;
    }
    function idbPut(value, key) {
        return openDb().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(CRYPTO_DB_STORE, 'readwrite');
            tx.objectStore(CRYPTO_DB_STORE).put(value, key || 'master');
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        }));
    }
    function idbGet(key) {
        return openDb().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(CRYPTO_DB_STORE, 'readonly');
            const req = tx.objectStore(CRYPTO_DB_STORE).get(key || 'master');
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        }));
    }
    function idbDel(key) {
        return openDb().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(CRYPTO_DB_STORE, 'readwrite');
            tx.objectStore(CRYPTO_DB_STORE).delete(key || 'master');
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        }));
    }

    // ---- 本机加密开关状态 ----
    function readState() {
        try {
            const raw = localStorage.getItem(CRYPTO_STATE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }
    function writeState(s) {
        try { localStorage.setItem(CRYPTO_STATE_KEY, JSON.stringify(s)); return true; }
        catch (e) { return false; }
    }
    function clearState() { try { localStorage.removeItem(CRYPTO_STATE_KEY); } catch (e) { /* 清不掉就算了 */ } }

    // ---- 密钥派生与包裹 ----
    async function deriveKek(secret, saltB64, iterations) {
        const base = await crypto.subtle.importKey('raw', te.encode(normalizeSecret(secret)), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: unb64(saltB64), iterations, hash: 'SHA-256' },
            base,
            { name: 'AES-KW', length: 256 },
            false,
            ['wrapKey', 'unwrapKey'],
        );
    }
    // 复制粘贴常混进零宽字符和方向控制符，会让"看着一样"的口令解不开；
    // 但中间的空格要保留 —— 用户看到的口令就是真正用的口令
    function normalizeSecret(secret) {
        return String(secret == null ? '' : secret)
            .replace(/[\u200b-\u200f\u202a-\u202e\uFEFF]/g, '')
            .replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
    }
    async function wrapMaster(masterKey, secret, iterations) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const kek = await deriveKek(secret, b64(salt), iterations);
        const wrapped = await crypto.subtle.wrapKey('raw', masterKey, kek, 'AES-KW');
        return { alg: 'AES-KW', kdf: 'PBKDF2-SHA256', iterations, salt: b64(salt), data: b64(wrapped) };
    }
    async function unwrapMaster(wrap, secret) {
        const kek = await deriveKek(secret, wrap.salt, wrap.iterations);
        return crypto.subtle.unwrapKey('raw', unb64(wrap.data), kek, 'AES-KW',
            { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    }

    // ---- 恢复码 ----
    function makeRecoveryCode() {
        const n = 20;
        const rnd = crypto.getRandomValues(new Uint8Array(n));
        let s = '';
        for (let i = 0; i < n; i++) s += REC_ALPHABET[rnd[i] % REC_ALPHABET.length];
        return s;
    }
    function formatRecoveryCode(code) {
        return String(code || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase().replace(/(.{4})(?=.)/g, '$1 ');
    }
    // 用户手抄回来时可能带空格、大小写不一一
    function normalizeRecoveryCode(code) {
        return String(code || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    }

    // ---- 对外状态 ----
    function isSupported() { return available(); }
    function isEnabled() {
        const s = readState();
        return !!(s && s.on && s.keyring);
    }
    function isUnlocked() { return !!cachedKey; }
    function hint() {
        const s = readState();
        return (s && s.keyring && s.keyring.hint) || '';
    }
    function keyring() {
        const s = readState();
        return (s && s.keyring) || null;
    }
    async function hasLocalKey() {
        if (cachedKey) return true;
        try { const k = await idbGet('master'); if (k && k.type) { cachedKey = k; return true; } } catch (e) { /* 打不开就当没有 */ }
        return false;
    }
    async function lock() { cachedKey = null; }
    // 只忘掉本机密钥、保留加密设置：下次要口令或恢复码才能解锁
    async function forgetLocalKey() {
        cachedKey = null;
        try { await idbDel('master'); } catch (e) { /* 删不掉也只是占地方 */ }
        return true;
    }

    // ---- 开通 / 解锁 ----
    async function setup(passphrase) {
        if (!available()) throw new Error('这个浏览器不支持加密（需要 HTTPS 环境下的 WebCrypto）');
        const p = String(passphrase || '');
        if (p.length < 8) throw new Error('口令至少 8 位');
        if (cachedKey === null) { /* 正常路径 */ }
        const masterKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
        const code = makeRecoveryCode();
        const passWrap = await wrapMaster(masterKey, p, PBKDF2_PASS_ITER);
        const codeWrap = await wrapMaster(masterKey, code, PBKDF2_CODE_ITER);
        const kr = {
            v: 1, alg: 'AES-GCM',
            pass: passWrap,
            recovery: codeWrap,
            hint: p.slice(0, 2) + '***',
            createdAt: new Date().toISOString(),
        };
        await idbPut(masterKey, 'master');
        cachedKey = masterKey;
        const st = { on: true, keyring: kr };
        if (!writeState(st)) throw new Error('本机存储写入失败，加密未能开启');
        return { recoveryCode: code, keyring: kr };
    }

    // 用口令或恢复码解出主密钥；成功后缓存到本机
    async function unlock(secret, kr) {
        const kring = kr || keyring();
        if (!kring) throw new Error('本机没有加密信息');
        const code = normalizeRecoveryCode(secret);
        const isCode = code.length === 20 && /^[0-9A-Z]+$/.test(code);
        // 恢复码显示成 4 位一组，用户照抄会带空格，这里统一成无空格形式再去派生
        const tries = isCode
            ? [[kring.recovery, code], [kring.pass, normalizeSecret(secret)]]
            : [[kring.pass, normalizeSecret(secret)]];
        for (const pair of tries) {
            const wrap = pair[0];
            if (!wrap) continue;
            try {
                const k = await unwrapMaster(wrap, pair[1]);
                cachedKey = k;
                try { await idbPut(k, 'master'); } catch (e) { /* 存不下也能用，只是下次还要输 */ }
                return true;
            } catch (e) { /* 换下一个 */ }
        }
        throw new Error('口令或恢复码不正确');
    }

    // ---- 加解密 ----
    async function encryptString(text, kr) {
        const kring = kr || keyring();
        if (!kring) throw new Error('还没开启加密');
        let key = cachedKey;
        if (!key) { const k = await idbGet('master'); if (!k) throw new Error('需要口令或恢复码才能加密'); key = k; cachedKey = k; }
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(text));
        return { enc: ENC_MAGIC, v: 1, iv: b64(iv), data: b64(ct), keyring: { v: kring.v, alg: 'AES-GCM', pass: kring.pass, recovery: kring.recovery, hint: kring.hint } };
    }

    // 封套 → 明文。优先用本机主密钥；密钥不对时用口令重新解并覆盖本机缓存
    async function decryptEnvelope(env, secret) {
        if (!env || env.enc !== ENC_MAGIC) throw new Error('不是加密文件');
        const kr = env.keyring || keyring();
        if (!kr) throw new Error('缺少密钥信息');
        const doDecrypt = async (k) => td.decode(
            await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, k, unb64(env.data)));
        let key = cachedKey;
        if (!key) {
            const stored = await idbGet('master');
            if (stored) key = cachedKey = stored;
        }
        if (!key) {
            if (!secret) throw new Error('NEED_SECRET');
            await unlock(secret, kr);
            return await doDecrypt(cachedKey);
        }
        try {
            return await doDecrypt(key);
        } catch (e) {
            // 本机有密钥但开不了这份数据 —— 多半是两台设备各自点了"开启加密"，
            // 于是有两把随机主密钥，同一个口令也互相打不开。
            // 要用口令重新解出真正的主密钥并覆盖本机缓存，而不是报"需要口令"就完事。
            if (!secret) throw new Error('WRONG_KEY');
            await unlock(secret, kr);
            return await doDecrypt(cachedKey);
        }
    }

    function looksEncrypted(obj) { return !!(obj && typeof obj === 'object' && obj.enc === ENC_MAGIC); }

    // ---- 换口令 / 换恢复码：只重包主密钥，不动数据 ----
    async function changePassphrase(currentSecret, newPassphrase) {
        const kr = keyring();
        if (!kr) throw new Error('还没开启加密');
        let key = cachedKey;
        if (!key) {
            if (!currentSecret) throw new Error('NEED_SECRET');
            await unlock(currentSecret, kr);
            key = cachedKey;
        }
        if (String(newPassphrase || '').length < 8) throw new Error('新口令至少 8 位');
        kr.pass = await wrapMaster(key, newPassphrase, PBKDF2_PASS_ITER);
        kr.hint = String(newPassphrase).slice(0, 2) + '***';
        const st = readState(); st.keyring = kr; st.updatedAt = new Date().toISOString();
        writeState(st);
        return true;
    }
    async function rotateRecoveryCode(currentSecret) {
        const kr = keyring();
        if (!kr) throw new Error('还没开启加密');
        let key = cachedKey;
        if (!key) {
            if (!currentSecret) throw new Error('NEED_SECRET');
            await unlock(currentSecret, kr);
            key = cachedKey;
        }
        const code = makeRecoveryCode();
        kr.recovery = await wrapMaster(key, code, PBKDF2_CODE_ITER);
        const st = readState(); st.keyring = kr; st.updatedAt = new Date().toISOString();
        writeState(st);
        return code;
    }

    // ---- 关闭：调用方负责先把数据退回明文 ----
    async function disable() {
        cachedKey = null;
        try { await idbDel('master'); } catch (e) { /* 删不掉也只是占地方 */ }
        clearState();
        return true;
    }

    return {
        available, isSupported, isEnabled, isUnlocked, hasLocalKey, lock, forgetLocalKey,
        setup, unlock, encryptString, decryptEnvelope, looksEncrypted,
        changePassphrase, rotateRecoveryCode, disable,
        makeRecoveryCode, formatRecoveryCode, normalizeRecoveryCode,
        hint, keyring, readState,
        ITER_PASS: PBKDF2_PASS_ITER, ITER_CODE: PBKDF2_CODE_ITER, MAGIC: ENC_MAGIC,
    };
})();
