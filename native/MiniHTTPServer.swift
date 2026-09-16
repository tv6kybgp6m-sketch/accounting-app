import Foundation
import Darwin

// MARK: - 极简本地 HTTP 服务器（BSD socket，显式绑定 127.0.0.1 IPv4，确保 WKWebView 能稳定加载）
final class MiniHTTPServer {
    let root: URL
    var port: UInt16 = 0
    private var listenSock: Int32 = -1
    private var acceptSource: DispatchSourceRead?
    let mime: [String: String] = [
        "html":"text/html; charset=utf-8", "htm":"text/html; charset=utf-8",
        "js":"application/javascript; charset=utf-8", "mjs":"application/javascript; charset=utf-8",
        "css":"text/css; charset=utf-8", "json":"application/json; charset=utf-8",
        "png":"image/png", "jpg":"image/jpeg", "jpeg":"image/jpeg", "gif":"image/gif",
        "svg":"image/svg+xml", "ico":"image/x-icon", "woff":"font/woff",
        "woff2":"font/woff2", "ttf":"font/ttf", "map":"application/json",
        "txt":"text/plain; charset=utf-8"
    ]
    init(root: URL) { self.root = root }

    func start() throws -> UInt16 {
        var addr = sockaddr_in()
        addr.sin_family = sa_family_t(AF_INET)
        addr.sin_port = 0 // 系统分配空闲端口
        addr.sin_addr.s_addr = inet_addr("127.0.0.1")
        let sock = socket(AF_INET, SOCK_STREAM, 0)
        guard sock >= 0 else { throw NSError(domain: "MiniHTTP", code: 1, userInfo: [NSLocalizedDescriptionKey: "socket() 失败"]) }
        var yes: Int32 = 1
        setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, &yes, socklen_t(MemoryLayout.size(ofValue: yes)))
        var bound = addr
        let bindOK = withUnsafePointer(to: &bound) { ptr in
            ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { p in
                bind(sock, p, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        guard bindOK == 0 else { close(sock); throw NSError(domain: "MiniHTTP", code: 2, userInfo: [NSLocalizedDescriptionKey: "bind(127.0.0.1) 失败"]) }
        listen(sock, 32)
        var got = sockaddr_in()
        var len = socklen_t(MemoryLayout<sockaddr_in>.size)
        let nameOK = withUnsafeMutablePointer(to: &got) { ptr in
            ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { p in
                getsockname(sock, p, &len)
            }
        }
        guard nameOK == 0 else { close(sock); throw NSError(domain: "MiniHTTP", code: 3, userInfo: [NSLocalizedDescriptionKey: "getsockname 失败"]) }
        port = UInt16(bigEndian: got.sin_port)
        listenSock = sock

        let src = DispatchSource.makeReadSource(fileDescriptor: sock, queue: .global())
        src.setEventHandler { [weak self] in self?.acceptLoop(sock: sock) }
        src.resume()
        acceptSource = src
        fputs("MiniHTTP listening on 127.0.0.1:\(port)\n", stderr)
        return port
    }

    private func acceptLoop(sock: Int32) {
        while true {
            var clientAddr = sockaddr_in()
            var addrLen = socklen_t(MemoryLayout<sockaddr_in>.size)
            let client = withUnsafeMutablePointer(to: &clientAddr) { ptr in
                ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { p in
                    accept(sock, p, &addrLen)
                }
            }
            guard client >= 0 else { break }
            DispatchQueue.global().async { [weak self] in self?.handleClient(fd: client) }
        }
    }

    private func handleClient(fd: Int32) {
        defer { close(fd) }
        var buffer = [UInt8](repeating: 0, count: 16384)
        let n = read(fd, &buffer, buffer.count)
        guard n > 0 else { return }
        let req = String(bytes: buffer[0..<Int(n)], encoding: .utf8) ?? ""
        let firstLine = req.split(separator: "\n").first ?? ""
        var path = String(firstLine.split(separator: " ").dropFirst().first ?? "/")
        if path.isEmpty || path == "/" { path = "/index.html" }
        if let q = path.firstIndex(of: "?") { path = String(path[..<q]) }
        let clean = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let fullPath = (root.path as NSString).appendingPathComponent(clean)
        let fileURL = URL(fileURLWithPath: fullPath)
        let ext = fileURL.pathExtension.lowercased()
        let mime = self.mime[ext] ?? "application/octet-stream"

        let isDir = (try? fileURL.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory == true
        if !isDir, FileManager.default.fileExists(atPath: fullPath),
           fullPath.hasPrefix(root.path + "/") || fullPath == root.path,
           let body = try? Data(contentsOf: fileURL) {
            let header = "HTTP/1.1 200 OK\r\nContent-Type: \(mime)\r\nContent-Length: \(body.count)\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n"
            var resp = Data(header.utf8)
            resp.append(body)
            _ = resp.withUnsafeBytes { write(fd, $0.bindMemory(to: Int8.self).baseAddress, resp.count) }
        } else {
            let msg = "404 Not Found"
            let header = "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: \(msg.utf8.count)\r\nConnection: close\r\n\r\n"
            var resp = Data(header.utf8)
            resp.append(Data(msg.utf8))
            _ = resp.withUnsafeBytes { write(fd, $0.bindMemory(to: Int8.self).baseAddress, resp.count) }
        }
    }
}
