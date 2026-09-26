import Cocoa
import WebKit
import Network
import Foundation
import UniformTypeIdentifiers

// MARK: - 路径常量
let ICLOUD_BASE = ("~/Library/Mobile Documents/com~apple~CloudDocs" as NSString).expandingTildeInPath
let ICLOUD_DIR_NAME = "记账本"
let SYNC_FILENAME = "bookkeeping-sync.json"

func icloudDirURL() -> URL {
    return URL(fileURLWithPath: (ICLOUD_BASE as NSString).appendingPathComponent(ICLOUD_DIR_NAME))
}
func icloudFileURL() -> URL {
    return icloudDirURL().appendingPathComponent(SYNC_FILENAME)
}
func backupsDirURL() -> URL {
    let base = NSSearchPathForDirectoriesInDomains(.applicationSupportDirectory, .userDomainMask, true)[0]
    return URL(fileURLWithPath: (base as NSString).appendingPathComponent("记账本/backups"))
}

// MARK: - 注入到网页的桥接脚本（定义 window.electronAPI）
let BRIDGE_JS = """
(function () {
  function makeNative() {
    var api = {
      isElectron: true,
      _seq: 0,
      _pending: {},
      _call: function (method, args) {
        return new Promise(function (resolve, reject) {
          var id = ++api._seq;
          api._pending[id] = { resolve: resolve, reject: reject };
          window.webkit.messageHandlers.native.postMessage({ id: id, method: method, args: args || [] });
        });
      },
      saveFile: function (opts) { return api._call('saveFile', [opts]); },
      openFile: function (opts) { return api._call('openFile', [opts]); },
      listBackups: function () { return api._call('listBackups', []); },
      openBackupFolder: function () { return api._call('openBackupFolder', []); },
      icloud: {
        isAvailable: function () { return api._call('icloud.isAvailable', []); },
        readData: function () { return api._call('icloud.readData', []); },
        readAll: function () { return api._call('icloud.readAll', []); },
        writeData: function (p, e) { return api._call('icloud.writeData', [p, e]); },
        onFileChange: function (cb) { window.__icloudChangeCb = cb; return api._call('icloud.onFileChange', []); }
      }
    };
    return api;
  }
  window.electronAPI = makeNative();
  window.__resolveNative = function (id, ok, result) {
    var p = window.electronAPI._pending[id];
    if (!p) return;
    delete window.electronAPI._pending[id];
    if (ok) p.resolve(result); else p.reject(new Error(result));
  };
  window.__icloudFileChanged = function (content) {
    if (typeof window.__icloudChangeCb === 'function') window.__icloudChangeCb(content);
  };
  window.__importJSON = function (text) {
    function go() { if (typeof window.applyImportedJSON === 'function') window.applyImportedJSON(text); }
    if (typeof window.applyImportedJSON === 'function') go();
    else setTimeout(go, 600);
  };
})();
"""

// MARK: - AppDelegate
class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var webView: WKWebView!
    var server: MiniHTTPServer!
    var pendingImportPath: String?
    var icloudSource: DispatchSourceFileSystemObject?
    var lastIcloudContent: String?
    var snapshotTimer: Timer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let bundle = Bundle.main
        let resourcesURL = bundle.resourceURL!
        try? FileManager.default.createDirectory(at: backupsDirURL(), withIntermediateDirectories: true)

        // 本地服务器（localhost 源，localStorage 才能持久化）
        server = MiniHTTPServer(root: resourcesURL)
        let port: UInt16
        do { port = try server.start() } catch { port = 0 }
        guard port > 0 else { fatalError("无法启动本地服务器") }

        let config = WKWebViewConfiguration()
        let uc = WKUserContentController()
        config.userContentController = uc
        if #available(macOS 11.3, *) {
            config.preferences.isTextInteractionEnabled = true
        }
        // 这里原来用 KVC 设了 allowFileAccessFromFileURLs / allowUniversalAccessFromFileURLs。
        // 那两个是 WebKit 的私有设置，既是私有 API，又会在新系统上把主线程卡死；
        // 而且页面现在走 http://127.0.0.1（正常 http 源）加载，本来就不需要 file:// 的放行。
        uc.add(self, name: "native")
        uc.addUserScript(WKUserScript(source: BRIDGE_JS, injectionTime: .atDocumentStart, forMainFrameOnly: false))

        let rect = NSRect(x: 0, y: 0, width: 1180, height: 820)
        webView = WKWebView(frame: rect, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.customUserAgent = "BookkeepingMacApp/1.38.2"

        window = NSWindow(contentRect: rect, styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "记账本 Bookkeeping"
        window.contentView = webView
        window.center()
        window.makeKeyAndOrderFront(nil)

        let startURL = URL(string: "http://127.0.0.1:\(port)/index.html")!
        webView.load(URLRequest(url: startURL))

        if let p = pendingImportPath { pendingImportPath = nil; importFile(at: p) }
        startICloudWatcher()
        snapshotTimer = Timer.scheduledTimer(withTimeInterval: 600, repeats: true) { [weak self] _ in self?.snapshot() }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if let p = pendingImportPath { pendingImportPath = nil; importFile(at: p) }
    }

    // MARK: 文件关联（双击 .json 导入）
    func application(_ sender: NSApplication, openFile filename: String) -> Bool {
        importFile(at: filename); return true
    }
    func application(_ app: NSApplication, open urls: [URL]) {
        for u in urls where u.isFileURL { importFile(at: u.path) }
    }

    func importFile(at path: String) {
        guard FileManager.default.fileExists(atPath: path) else { return }
        if webView == nil { pendingImportPath = path; return }
        do {
            let content = try String(contentsOfFile: path, encoding: .utf8)
            // 文件正文是一段 JSON 文本，这里要的是"把它当成字符串字面量"内联进 JS，
            // 所以必须走 jsonLiteral（裸字符串直接喂 JSONSerialization 会抛异常崩掉进程）。
            let literal = jsonLiteral(content)
            webView.evaluateJavaScript("window.__importJSON(\(literal));", completionHandler: nil)
        } catch {
            let lit = jsonLiteral("读取文件失败：\(error.localizedDescription)")
            webView.evaluateJavaScript("window.__importJSON(\(lit));", completionHandler: nil)
        }
    }

    // MARK: 原生消息桥
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let dict = message.body as? [String: Any],
              let id = dict["id"] as? Int,
              let method = dict["method"] as? String else { return }
        let args = dict["args"] as? [Any] ?? []
        DispatchQueue.main.async { self.handle(method: method, args: args, id: id) }
    }

    // 把任意值收敛成"一定能被 JSON 序列化"的形式。
    // ⚠️ JSONSerialization 遇到裸字符串 / 裸 Bool / NSNull 这类非容器顶层值会抛 ObjC 异常，
    // 而 try? 只抓 Swift 错误、抓不住异常 —— 异常会一路冒泡到顶层把进程 abort。
    // 网页启动后第一次调 icloud.isAvailable()（返回裸 true）就会踩到，
    // 表现成"图标一闪、窗口永远不出现"，所以这里一律带 .fragmentsAllowed 并降级未知类型。
    func jsonLiteral(_ value: Any) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: jsonSafeValue(value), options: [.fragmentsAllowed]),
              let str = String(data: data, encoding: .utf8) else { return "null" }
        return str
    }

    func jsonSafeValue(_ v: Any) -> Any {
        switch v {
        case let s as String: return s
        case let b as Bool: return b
        case let n as NSNumber: return n
        case is NSNull: return NSNull()
        case let a as [Any]: return a.map { jsonSafeValue($0) }
        case let d as [String: Any]:
            var out: [String: Any] = [:]
            for (k, val) in d { out[k] = jsonSafeValue(val) }
            return out
        default:
            if JSONSerialization.isValidJSONObject(v) { return v }
            return String(describing: v)
        }
    }

    func respond(id: Int, ok: Bool, result: Any) {
        let json = jsonLiteral(result)
        let js = "window.__resolveNative(\(id), \(ok ? "true" : "false"), \(json));"
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    func handle(method: String, args: [Any], id: Int) {
        switch method {
        case "saveFile":
            saveFile(args: args, id: id)
        case "openFile":
            openFile(args: args, id: id)
        case "listBackups":
            listBackups(id: id)
        case "openBackupFolder":
            openBackupFolder(id: id)
        case "icloud.isAvailable":
            respond(id: id, ok: true, result: icloudAvailable())
        case "icloud.readData":
            respond(id: id, ok: true, result: readICloud() ?? NSNull())
        case "icloud.readAll":
            respond(id: id, ok: true, result: readICloudAll())
        case "icloud.writeData":
            writeICloud(args: args, id: id)
        case "icloud.onFileChange":
            respond(id: id, ok: true, result: "ok")
        default:
            respond(id: id, ok: false, result: "未知方法：\(method)")
        }
    }

    // MARK: 具体能力
    func saveFile(args: [Any], id: Int) {
        let opts = args.first as? [String: Any] ?? [:]
        let name = (opts["name"] as? String) ?? "导出.json"
        let base64 = opts["base64"] as? String ?? ""
        let panel = NSSavePanel()
        panel.nameFieldStringValue = name
        panel.allowedContentTypes = [.json]
        if panel.runModal() == .OK, let url = panel.url, let data = Data(base64Encoded: base64) {
            try? data.write(to: url)
            respond(id: id, ok: true, result: url.path)
        } else {
            respond(id: id, ok: true, result: "cancelled")
        }
    }

    func openFile(args: [Any], id: Int) {
        let opts = args.first as? [String: Any] ?? [:]
        let exts = (opts["extensions"] as? [String]) ?? ["json"]
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = exts.compactMap { UTType(filenameExtension: $0) }
        if panel.runModal() == .OK, let url = panel.url {
            if let data = try? Data(contentsOf: url),
               let encoded = data.base64EncodedString().data(using: .utf8),
               let b64Str = String(data: encoded, encoding: .utf8) {
                respond(id: id, ok: true, result: ["name": url.lastPathComponent, "base64": b64Str, "cancelled": false])
                return
            }
        }
        respond(id: id, ok: true, result: ["cancelled": true])
    }

    func listBackups(id: Int) {
        let dir = backupsDirURL()
        var snaps: [[String: Any]] = []
        if let files = try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: [.contentModificationDateKey, .fileSizeKey]) {
            for f in files where f.pathExtension.lowercased() == "json" {
                let rv = try? f.resourceValues(forKeys: [.contentModificationDateKey, .fileSizeKey])
                snaps.append([
                    "name": f.lastPathComponent,
                    "date": (rv?.contentModificationDate ?? Date()).ISO8601Format(),
                    "bytes": rv?.fileSize ?? 0
                ])
            }
        }
        snaps.sort { (($0["date"] as? String) ?? "") > (($1["date"] as? String) ?? "") }
        respond(id: id, ok: true, result: ["snapshots": snaps])
    }

    func openBackupFolder(id: Int) {
        NSWorkspace.shared.open(backupsDirURL())
        respond(id: id, ok: true, result: "ok")
    }

    func icloudAvailable() -> Bool {
        let base = URL(fileURLWithPath: ICLOUD_BASE)
        return FileManager.default.fileExists(atPath: base.path)
    }

    // 原始文本（用于变更检测与快照）
    func readICloudString() -> String? {
        let url = icloudFileURL()
        return try? String(contentsOf: url, encoding: .utf8)
    }

    // 返回已解析的对象——网页的 looksEncrypted(obj) 要求传对象而非字符串
    func readICloud() -> Any? {
        guard let str = readICloudString(),
              let data = str.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) else { return nil }
        return obj
    }

    // 同步文件夹里**全部**账本（已解析对象，按修改时间从旧到新）。
    // 网页的 mergeAllCloud() 会逐份合并；只挑"最新那一份"的老做法会被自己每次保存
    // 刷新的时间戳压住，手机导出的那份（以及 iOS 生成的"副本"）就永远合不进来。
    // 解析失败的文件直接跳过，不因为一个坏文件把整批同步拖垮。
    func readICloudAll() -> [Any] {
        let dir = icloudDirURL()
        guard let files = try? FileManager.default.contentsOfDirectory(
            at: dir, includingPropertiesForKeys: [.contentModificationDateKey]) else { return [] }
        let mtime: (URL) -> Date = { url in
            (try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
        }
        let jsons = files
            .filter { $0.pathExtension.lowercased() == "json" }
            .sorted { mtime($0) < mtime($1) }
        var out: [Any] = []
        for f in jsons {
            guard let str = try? String(contentsOf: f, encoding: .utf8),
                  let data = str.data(using: .utf8),
                  let obj = try? JSONSerialization.jsonObject(with: data) else { continue }
            out.append(obj)
        }
        return out
    }

    func writeICloud(args: [Any], id: Int) {
        // payload / envelope 由网页算好，envelope 优先（加密态）
        let payload = args.first
        let envelope = args.count > 1 ? args[1] : nil
        let chosen = (envelope is NSNull || envelope == nil) ? payload : envelope
        guard let obj = chosen else { respond(id: id, ok: false, result: "没有可写内容"); return }
        do {
            let data: Data
            if let str = obj as? String {
                data = Data(str.utf8)
            } else {
                data = try JSONSerialization.data(withJSONObject: jsonSafeValue(obj), options: [.prettyPrinted, .fragmentsAllowed])
            }
            try FileManager.default.createDirectory(at: icloudDirURL(), withIntermediateDirectories: true)
            try data.write(to: icloudFileURL(), options: [.atomic])
            lastIcloudContent = String(data: data, encoding: .utf8)
            respond(id: id, ok: true, result: "ok")
        } catch {
            respond(id: id, ok: false, result: error.localizedDescription)
        }
    }

    // MARK: iCloud 文件监听（来自 iPhone / 另一台 Mac 的改动）
    func startICloudWatcher() {
        let dir = icloudDirURL()
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let fd = dir.path.withCString { open($0, O_EVTONLY) }
        guard fd >= 0 else { return }
        lastIcloudContent = readICloudString()
        let src = DispatchSource.makeFileSystemObjectSource(fileDescriptor: fd, eventMask: .all, queue: .global())
        src.setEventHandler { [weak self] in self?.checkICloudChange() }
        src.setCancelHandler { close(fd) }
        src.resume()
        icloudSource = src
    }

    func checkICloudChange() {
        guard let str = readICloudString() else { return }
        if str != lastIcloudContent {
            lastIcloudContent = str
            // 传解析后的对象给网页（与 readData 一致，resolveCloudPayload 需要对象）
            guard let data = str.data(using: .utf8),
                  let obj = try? JSONSerialization.jsonObject(with: data) else { return }
            let literal = jsonLiteral(obj)
            DispatchQueue.main.async { [weak self] in
                self?.webView?.evaluateJavaScript("window.__icloudFileChanged(\(literal));", completionHandler: nil)
            }
        }
    }

    // MARK: 每 10 分钟留一份本地快照
    func snapshot() {
        guard let content = readICloudString(), let data = content.data(using: .utf8) else { return }
        let fmt = ISO8601DateFormatter()
        let name = "bookkeeping-\(fmt.string(from: Date())).json"
        let dest = backupsDirURL().appendingPathComponent(name)
        try? data.write(to: dest, options: [.atomic])
    }

    func applicationWillTerminate(_ notification: Notification) {
        icloudSource?.cancel()
        snapshotTimer?.invalidate()
    }
}

// MARK: - 入口
@main
struct BookkeepingApp {
    static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.regular)
        let delegate = AppDelegate()
        app.delegate = delegate
        app.activate(ignoringOtherApps: true)
        app.run()
    }
}
