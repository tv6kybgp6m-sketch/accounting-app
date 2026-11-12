// ---------------- 账本加密（口令 + 恢复码双钥）----------------
//
// 结构：一把随机主密钥（AES-GCM 256）加密真正的数据；主密钥分别用
// 「口令派生的 KEK」和「恢复码派生的 KEK」包一层（AES-KW）。
// 每个封套自带这份 keyring，所以任何一份密文在任意设备上，只要有口令
// 或恢复码就能解开；本机再把主密钥的**原始字节**存进 IndexedDB 做缓存，
// 下次打开可以少输一次（v1.41.11 起启动门禁每次都会问口令，缓存只是备用）。
// ⚠️ 千万别把 CryptoKey 对象直接存进去：WebKit 会拿系统钥匙串包它，每次都弹窗。
//
// 换口令只重新包一次主密钥，不重新加密数据。
//
// 注意：加密状态记在单独的 localStorage 键里，绝不进同步载荷——
// 否则 A 设备开了加密，设置同步到 B 设备后 B 没有密钥直接卡死。

const CRYPTO_STATE_KEY = 'bookkeeping_app_crypto';
const CRYPTO_DB_NAME = 'bookkeeping-crypto';
const CRYPTO_DB_STORE = 'keys';
const ENC_MAGIC = 'BKE1';
// v1.41.11：本机缓存的主钥匙改存「普通字节」，键名也换一个新的。
// 以前直接把 CryptoKey 对象存进 IndexedDB（键 'master'），WebKit 在 macOS / iOS 上
// 会用系统钥匙串里一把叫「<App名> WebCrypto Master Key」的钥匙把它包起来，
// 于是每次读写都弹「想要使用你储存在钥匙串中的机密信息」要登录密码。
// 存 ArrayBuffer 就只是普通数据，WebKit 不会再去找钥匙串。
// ⚠️ 旧的 'master' 记录永远不要读（一读就会再弹窗），也不要去删它，留着不碍事。
const CRYPTO_MASTER_RAW_KEY = 'master-raw';
// v1.41.25：把「见过的钥匙说明」留在本机。两台设备各自 setup 过会有两把主钥匙，
// 旧版还会写出「数据用 A 加密、说明却指向 B」的错位封套 —— 只认封套里那份说明
// 就永远解不开。多留几份候选，重启之后也照样能解开历史封套。
const CRYPTO_KNOWN_KEYRINGS_KEY = 'bookkeeping_app_crypto_keyrings';
const MAX_KNOWN_KEYRINGS = 6;
const PBKDF2_PASS_ITER = 310000;      // 口令熵低，多迭代
const PBKDF2_CODE_ITER = 100000;      // 恢复码本身约 100 bit，够用且解锁更快
const REC_ALPHABET = '3456789ABCDEFGHJKLMNPQRSTUVWXYZ';   // 去掉易混的 0O1I

const LedgerCrypto = (() => {
    let cachedKey = null;             // 解锁后的主密钥（内存）
    // v1.41.25：这把主钥匙是从哪份 keyring 解出来的。加密时必须把「同一份」
    // keyring 写进封套，否则数据用 A 加密、说明指向 B，谁都解不开。
    let cachedKeyring = null;
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
            tx.objectStore(CRYPTO_DB_STORE).put(value, key || CRYPTO_MASTER_RAW_KEY);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        }));
    }
    function idbGet(key) {
        return openDb().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(CRYPTO_DB_STORE, 'readonly');
            const req = tx.objectStore(CRYPTO_DB_STORE).get(key || CRYPTO_MASTER_RAW_KEY);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        }));
    }
    function idbDel(key) {
        return openDb().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(CRYPTO_DB_STORE, 'readwrite');
            tx.objectStore(CRYPTO_DB_STORE).delete(key || CRYPTO_MASTER_RAW_KEY);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        }));
    }

    // v1.41.11：把主钥匙导成 32 字节原生存，读回来再 import 成 CryptoKey。
    // 存的是普通 ArrayBuffer，不是 CryptoKey 对象 —— 这是「不再弹钥匙串」的关键。
    // 存不下 / 读不回都只返回失败，绝不抛到业务层（钥匙本来就能用口令重算）。
    async function saveMaster(k) {
        try {
            const raw = await crypto.subtle.exportKey('raw', k);
            await idbPut(raw, CRYPTO_MASTER_RAW_KEY);
            return true;
        } catch (e) { return false; }
    }
    async function loadMaster() {
        try {
            const raw = await idbGet(CRYPTO_MASTER_RAW_KEY);
            if (!raw) return null;
            return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
        } catch (e) { return null; }
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

    // ---- v1.41.25：见过的 keyring（只存钥匙说明，不含任何账本数据）----
    // keyring 里本来就只有「被口令/恢复码包住的主钥匙」，和 CRYPTO_STATE_KEY
    // 是同一类信息，多存几份不扩大泄露面；不进同步载荷。
    function readKnownKeyrings() {
        try {
            const arr = JSON.parse(localStorage.getItem(CRYPTO_KNOWN_KEYRINGS_KEY) || '[]');
            return Array.isArray(arr) ? arr.filter(k => k && k.pass && k.pass.data) : [];
        } catch (e) { return []; }
    }
    function rememberKeyring(kr) {
        if (!kr || !kr.pass || !kr.pass.data) return;
        const list = readKnownKeyrings();
        if (list.some(k => k.pass.data === kr.pass.data)) return;
        const next = [kr].concat(list).slice(0, MAX_KNOWN_KEYRINGS);
        try { localStorage.setItem(CRYPTO_KNOWN_KEYRINGS_KEY, JSON.stringify(next)); } catch (e) {}
    }

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
        const k = await loadMaster();          // 只读 master-raw，绝不碰旧的 'master'
        if (k) { cachedKey = k; cachedKeyring = keyring(); return true; }
        return false;
    }
    async function lock() { cachedKey = null; cachedKeyring = null; }
    // 只忘掉本机密钥、保留加密设置：下次要口令或恢复码才能解锁
    async function forgetLocalKey() {
        cachedKey = null; cachedKeyring = null;
        try { await idbDel(CRYPTO_MASTER_RAW_KEY); } catch (e) { /* 删不掉也只是占地方 */ }
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
        await saveMaster(masterKey);
        cachedKey = masterKey;
        cachedKeyring = kr;
        rememberKeyring(kr);
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
                cachedKeyring = kring;         // v1.41.25：记住这把钥匙对应哪份说明
                rememberKeyring(kring);
                await saveMaster(k);           // 存不下也能用，只是下次还要输
                return true;
            } catch (e) { /* 换下一个 */ }
        }
        throw new Error('口令或恢复码不正确');
    }

    // ---- 加解密 ----
    // v1.41.25：封套里的 keyring 必须和真正用来加密的那把主钥匙配套。
    // 以前固定写「本机 keyring」，但 decryptEnvelope 解开别台设备的封套时会把
    // 内存里的主钥匙换成对方那把 —— 下一次推送就写成 data=A、keyring=B 的坏封套，
    // 之后无论输多少次口令都只能得到 B，永远解不开（iOS 报 OperationError）。
    async function encryptString(text, kr) {
        const kring = kr || cachedKeyring || keyring();
        if (!kring) throw new Error('还没开启加密');
        let key = cachedKey;
        if (!key) {
            const k = await loadMaster();
            if (!k) throw new Error('需要口令或恢复码才能加密');
            key = k; cachedKey = k; cachedKeyring = kring;
        }
        rememberKeyring(kring);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(text));
        return { enc: ENC_MAGIC, v: 1, iv: b64(iv), data: b64(ct),
            keyring: { v: kring.v, alg: 'AES-GCM', pass: kring.pass, recovery: kring.recovery, hint: kring.hint },
            // 随封套带上见过的其它钥匙说明：本机 localStorage 被清过也还有候选可用。
            // 里面只有被口令/恢复码包住的主钥匙，不含任何账本内容。
            knownKeyrings: readKnownKeyrings().slice(0, MAX_KNOWN_KEYRINGS) };
    }

    // 封套 → 明文。先用本机缓存钥匙；不行就用口令把「封套说明 + 本机说明 +
    // 见过的说明」逐个解开去试 —— 历史错位封套靠这一步才能救回来。
    async function decryptEnvelope(env, secret) {
        if (!env || env.enc !== ENC_MAGIC) throw new Error('不是加密文件');
        const doDecrypt = async (k) => td.decode(
            await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, k, unb64(env.data)));

        let key = cachedKey;
        if (!key) {
            const stored = await loadMaster();
            if (stored) { key = cachedKey = stored; cachedKeyring = keyring(); }
        }
        if (key) {
            try {
                const plain = await doDecrypt(key);
                rememberKeyring(env.keyring);
                return plain;
            } catch (e) { /* 换下面的候选钥匙 */ }
        }
        if (!secret) throw new Error(key ? 'WRONG_KEY' : 'NEED_SECRET');

        const candidates = [];
        const push = (k) => {
            if (k && k.pass && k.pass.data && !candidates.some(x => x.pass.data === k.pass.data)) candidates.push(k);
        };
        push(env.keyring); push(keyring()); readKnownKeyrings().forEach(push);
        if (Array.isArray(env.knownKeyrings)) env.knownKeyrings.forEach(push);
        let unwrapped = false, lastErr = null;
        for (const kr of candidates) {
            try { await unlock(secret, kr); }
            catch (e) { lastErr = e; continue; }
            unwrapped = true;
            try { return await doDecrypt(cachedKey); }
            catch (e) { lastErr = e; }
        }
        // 一份说明都解不开 = 口令真的不对；解开过却都解不出数据 = 钥匙对不上
        if (!unwrapped && lastErr) throw lastErr;
        throw new Error('WRONG_KEY');
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
        cachedKeyring = kr; rememberKeyring(kr);
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
        cachedKeyring = kr; rememberKeyring(kr);
        return code;
    }

    // ---- 关闭：调用方负责先把数据退回明文 ----
    async function disable() {
        cachedKey = null; cachedKeyring = null;
        try { await idbDel(CRYPTO_MASTER_RAW_KEY); } catch (e) { /* 删不掉也只是占地方 */ }
        try { localStorage.removeItem(CRYPTO_KNOWN_KEYRINGS_KEY); } catch (e) {}
        clearState();
        return true;
    }

    return {
        available, isSupported, isEnabled, isUnlocked, hasLocalKey, lock, forgetLocalKey,
        setup, unlock, encryptString, decryptEnvelope, looksEncrypted,
        changePassphrase, rotateRecoveryCode, disable,
        makeRecoveryCode, formatRecoveryCode, normalizeRecoveryCode,
        hint, keyring, readState, readKnownKeyrings,
        ITER_PASS: PBKDF2_PASS_ITER, ITER_CODE: PBKDF2_CODE_ITER, MAGIC: ENC_MAGIC,
    };
})();
