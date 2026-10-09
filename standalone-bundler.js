const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');

const CACHE_ZIP_PATH = path.join('/tmp', 'web-dashers-standalone.zip');
const CACHE_HTML_PATH = path.join('/tmp', 'web-dashers-standalone.html');

let zipPromise = null;
let htmlPromise = null;

const MIME_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.json': 'application/json',
  '.fnt': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8'
};

const GAME_SCRIPTS = [
  'assets/scripts/game/allObjects.js',
  'assets/scripts/game/allLevels.js',
  'assets/scripts/libs/phaser.min.js',
  'assets/scripts/libs/pako.min.js',
  'assets/scripts/utils/cache-manager.js',
  'assets/scripts/api/GDapiWrapper.js',
  'assets/scripts/utils/api-config.js',
  'assets/scripts/api/account-api.js',
  'assets/scripts/utils/config.js',
  'assets/scripts/core/triggers.js',
  'assets/scripts/core/level.js',
  'assets/scripts/core/player.js',
  'assets/scripts/core/audio.js',
  'assets/scripts/core/loading-screen.js',
  'assets/scripts/core/level-editor.js',
  'assets/scripts/core/game-scene.js',
  'assets/scripts/utils/performance-optimizer.js',
  'assets/scripts/utils/graphics-manager.js',
  'assets/scripts/core/main.js'
];

function walkDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      walkDir(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function generateStandaloneZip() {
  if (zipPromise) return zipPromise;

  zipPromise = new Promise((resolve, reject) => {
    if (fs.existsSync(CACHE_ZIP_PATH)) {
      try {
        const stats = fs.statSync(CACHE_ZIP_PATH);
        if (stats.size > 10 * 1024 * 1024) {
          return resolve(CACHE_ZIP_PATH);
        }
      } catch (_) {}
    }

    const output = fs.createWriteStream(CACHE_ZIP_PATH);
    const archive = new ZipArchive({ zlib: { level: 4 } });

    output.on('close', () => {
      console.log(`[Standalone] ZIP built successfully: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
      resolve(CACHE_ZIP_PATH);
    });

    archive.on('error', (err) => {
      zipPromise = null;
      reject(err);
    });

    archive.pipe(output);

    if (fs.existsSync('index.html')) {
      archive.file('index.html', { name: 'index.html' });
    }
    if (fs.existsSync('assets')) {
      archive.directory('assets/', 'assets');
    }

    const localServerScript = `const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.fnt': 'text/plain',
  '.txt': 'text/plain',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(__dirname, reqPath.replace(/^\\/+/, ''));
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('File not found: ' + reqPath);
    }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('====================================================');
  console.log(' Web Dashers Offline Server Started!');
  console.log(' Open your browser and go to: http://localhost:' + PORT);
  console.log(' Press Ctrl+C in this window to stop.');
  console.log('====================================================');
});
`;
    archive.append(localServerScript, { name: 'serve.js' });

    const winBat = `@echo off
echo Starting Web Dashers offline server...
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  start "" http://localhost:3000
  node serve.js
) else (
  echo Node.js not detected. Opening index.html directly...
  start index.html
)
pause
`;
    archive.append(winBat, { name: 'start-windows.bat' });

    const unixSh = `#!/bin/sh
echo "Starting Web Dashers offline server..."
if command -v node >/dev/null 2>&1; then
  (sleep 1 && (xdg-open http://localhost:3000 || open http://localhost:3000)) &
  node serve.js
elif command -v python3 >/dev/null 2>&1; then
  (sleep 1 && (xdg-open http://localhost:3000 || open http://localhost:3000)) &
  python3 -m http.server 3000
else
  open index.html || xdg-open index.html
fi
`;
    archive.append(unixSh, { name: 'start-mac-linux.sh', mode: 0o755 });

    const readme = `Web Dashers - Standalone Offline Edition
========================================

How to Play:
Option 1 (Recommended): Run 'start-windows.bat' (Windows) or 'sh start-mac-linux.sh' (Mac/Linux).
Option 2: Open terminal in this folder and run: node serve.js
Option 3: Direct browser launch by opening index.html.

Enjoy playing Geometry Dash in your browser offline!
`;
    archive.append(readme, { name: 'README.txt' });

    archive.finalize();
  });

  return zipPromise;
}

function generateStandaloneHtml(force = false) {
  if (htmlPromise && !force) return htmlPromise;

  htmlPromise = (async () => {
    // Check if cached HTML exists and is newer than all source scripts
    if (!force && fs.existsSync(CACHE_HTML_PATH)) {
      try {
        const stats = fs.statSync(CACHE_HTML_PATH);
        if (stats.size > 20 * 1024 * 1024) {
          let isStale = false;
          for (const s of GAME_SCRIPTS) {
            if (fs.existsSync(s) && fs.statSync(s).mtimeMs > stats.mtimeMs) {
              isStale = true;
              break;
            }
          }
          if (!isStale) {
            return CACHE_HTML_PATH;
          }
        }
      } catch (_) {}
    }

    console.log('[Standalone] Building single-file HTML bundle...');
    const startTime = Date.now();

    // 1. Scan and embed all assets
    const allAssetFiles = walkDir('assets');
    const vfs = {};

    for (const filePath of allAssetFiles) {
      // Normalize key (forward slashes, without leading slash)
      const normKey = filePath.replace(/\\/g, '/');
      const ext = path.extname(filePath).toLowerCase();

      // Don't duplicate game scripts in VFS since they are inlined into <script> tags
      if (normKey.startsWith('assets/scripts/')) continue;
      if (ext === '.py') continue;

      const mime = MIME_MAP[ext] || 'application/octet-stream';
      const isText = ext === '.fnt' || ext === '.txt' || ext === '.json' || ext === '.css';

      if (isText) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          vfs[normKey] = content;
        } catch (err) {
          console.warn(`[Standalone] Failed to read text file ${normKey}:`, err);
        }
      } else {
        try {
          const buf = fs.readFileSync(filePath);
          vfs[normKey] = `data:${mime};base64,${buf.toString('base64')}`;
        } catch (err) {
          console.warn(`[Standalone] Failed to read binary file ${normKey}:`, err);
        }
      }
    }

    console.log(`[Standalone] Packed ${Object.keys(vfs).length} assets into VFS.`);

    // 2. Inlined CSS
    let inlinedCss = '';
    if (fs.existsSync('assets/style.css')) {
      inlinedCss = fs.readFileSync('assets/style.css', 'utf8');
    }

    // 3. Read game scripts in exact order
    const scriptContents = [];
    for (const scriptPath of GAME_SCRIPTS) {
      if (fs.existsSync(scriptPath)) {
        let code = fs.readFileSync(scriptPath, 'utf8');
        // Prevent accidental closing script tag collision
        code = code.replace(/<\/script/gi, '<\\/script');
        scriptContents.push({ path: scriptPath, code });
      } else {
        console.warn(`[Standalone] Warning: Script not found ${scriptPath}`);
      }
    }

    // 4. Construct offline engine runtime & interceptors
    const runtimeScript = `
    (function () {
      "use strict";

      // 1. Safe Web Storage Polyfill (Prevents SecurityError when opening via file:// or in sandboxes)
      (function() {
        var memStorage = {};
        function createStorageMock() {
          return {
            getItem: function(k) { return memStorage.hasOwnProperty(k) ? memStorage[k] : null; },
            setItem: function(k, v) { memStorage[k] = String(v); },
            removeItem: function(k) { delete memStorage[k]; },
            clear: function() { memStorage = {}; },
            key: function(i) { return Object.keys(memStorage)[i] || null; },
            get length() { return Object.keys(memStorage).length; }
          };
        }
        try {
          var testKey = "__wd_test__" + Date.now();
          window.localStorage.setItem(testKey, "1");
          window.localStorage.removeItem(testKey);
        } catch (e) {
          try {
            Object.defineProperty(window, "localStorage", { value: createStorageMock(), configurable: true, writable: true });
          } catch (_) {}
        }
        try {
          var testKey2 = "__wd_test_s__" + Date.now();
          window.sessionStorage.setItem(testKey2, "1");
          window.sessionStorage.removeItem(testKey2);
        } catch (e) {
          try {
            Object.defineProperty(window, "sessionStorage", { value: createStorageMock(), configurable: true, writable: true });
          } catch (_) {}
        }
      })();

      // 2. Safe IndexedDB Wrapper (Prevents crashes in offline restricted environments)
      try {
        if (typeof window.indexedDB !== "undefined" && window.indexedDB) {
          var origOpen = window.indexedDB.open.bind(window.indexedDB);
          window.indexedDB.open = function() {
            try {
              return origOpen.apply(window.indexedDB, arguments);
            } catch (err) {
              console.warn("[Standalone] IndexedDB.open blocked:", err);
              var fakeReq = { addEventListener: function(){}, removeEventListener: function(){} };
              setTimeout(function() { if (fakeReq.onerror) fakeReq.onerror({ target: fakeReq, error: err }); }, 0);
              return fakeReq;
            }
          };
        }
      } catch (_) {}

      // 3. Parse VFS Data
      var vfsElement = document.getElementById("wd-vfs-data");
      var VFS = {};
      try {
        if (vfsElement && vfsElement.textContent) {
          VFS = JSON.parse(vfsElement.textContent);
        }
      } catch (err) {
        console.error("[Standalone] Failed to parse VFS data:", err);
      }
      window.__VFS__ = VFS;
      window.__VFS_BYTES__ = {};

      var MIME_MAP = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        ico: "image/x-icon",
        mp3: "audio/mpeg",
        ogg: "audio/ogg",
        wav: "audio/wav",
        json: "application/json",
        fnt: "text/plain; charset=utf-8",
        txt: "text/plain; charset=utf-8",
        css: "text/css; charset=utf-8"
      };

      function getMime(path) {
        var dot = path.lastIndexOf(".");
        if (dot === -1) return "application/octet-stream";
        var ext = path.substring(dot + 1).toLowerCase();
        return MIME_MAP[ext] || "application/octet-stream";
      }

      // 4. URL Normalizer
      function normalizeAssetPath(url) {
        if (!url || typeof url !== "string") return null;
        if (url.indexOf("data:") === 0 || url.indexOf("blob:") === 0) return null;
        var clean = url.split("?")[0].split("#")[0];
        try { clean = decodeURIComponent(clean); } catch (_) {}
        clean = clean.replace(/\\\\/g, "/");

        if (VFS.hasOwnProperty(clean)) return clean;
        if (VFS.hasOwnProperty("assets/" + clean)) return "assets/" + clean;

        var assetsIdx = clean.toLowerCase().indexOf("assets/");
        if (assetsIdx !== -1) {
          var sub = clean.slice(assetsIdx);
          if (VFS.hasOwnProperty(sub)) return sub;
          var withoutAssets = sub.slice(7);
          if (VFS.hasOwnProperty(withoutAssets)) return withoutAssets;
        }

        var pathOnly = clean.replace(/^[a-z]+:\\/\\/[^\\/]*\\//i, "");
        pathOnly = pathOnly.replace(/^file:\\/\\/\\/?/i, "");
        pathOnly = pathOnly.replace(/^\\.?\\/+/g, "");
        if (VFS.hasOwnProperty(pathOnly)) return pathOnly;
        if (VFS.hasOwnProperty("assets/" + pathOnly)) return "assets/" + pathOnly;

        return null;
      }
      window.__normalizeAssetPath__ = normalizeAssetPath;

      // 5. Binary Byte Decoder with Cache
      function getAssetBytes(key) {
        if (window.__VFS_BYTES__.hasOwnProperty(key)) {
          return window.__VFS_BYTES__[key];
        }
        var entry = VFS[key];
        if (!entry) return null;
        if (entry instanceof Uint8Array) return entry;
        if (typeof entry === "string") {
          var base64 = entry.indexOf(",") !== -1 ? entry.split(",")[1] : entry;
          var bin = atob(base64);
          var len = bin.length;
          var bytes = new Uint8Array(len);
          for (var i = 0; i < len; i++) {
            bytes[i] = bin.charCodeAt(i);
          }
          window.__VFS_BYTES__[key] = bytes;
          return bytes;
        }
        return null;
      }
      window.__getAssetBytes__ = getAssetBytes;

      // 6. Complete, Robust Mock XMLHttpRequest
      var NativeXHR = window.XMLHttpRequest;

      function StandaloneXHR() {
        this.readyState = 0;
        this.status = 0;
        this.statusText = "";
        this.response = null;
        this.responseText = "";
        this.responseURL = "";
        this.responseType = "";
        this.timeout = 0;
        this.withCredentials = false;
        this._headers = {};
        this._listeners = {};
        this._method = "GET";
        this._url = "";
        this._isVfs = false;
        this._vfsKey = null;
        this._nativeXHR = null;

        this.onload = null;
        this.onerror = null;
        this.onprogress = null;
        this.onloadend = null;
        this.onloadstart = null;
        this.onreadystatechange = null;
        this.ontimeout = null;
        this.onabort = null;
      }

      StandaloneXHR.prototype.open = function(method, url, async, user, password) {
        this._method = method;
        this._url = url;
        var normKey = normalizeAssetPath(url);
        if (normKey && VFS.hasOwnProperty(normKey)) {
          this._isVfs = true;
          this._vfsKey = normKey;
          this.responseURL = normKey;
          this.readyState = 1;
          this._fire("readystatechange");
        } else {
          this._isVfs = false;
          if (NativeXHR) {
            this._nativeXHR = new NativeXHR();
            var self = this;
            this._nativeXHR.onload = function(e) { self._syncNative(); self._fire("load", e); };
            this._nativeXHR.onerror = function(e) { self._syncNative(); self._fire("error", e); };
            this._nativeXHR.onprogress = function(e) { self._syncNative(); self._fire("progress", e); };
            this._nativeXHR.onloadend = function(e) { self._syncNative(); self._fire("loadend", e); };
            this._nativeXHR.onreadystatechange = function(e) { self._syncNative(); self._fire("readystatechange", e); };
            try {
              this._nativeXHR.open(method, url, async !== false, user, password);
            } catch (err) {
              console.warn("[Standalone] Native XHR open error:", err);
            }
          }
        }
      };

      StandaloneXHR.prototype._syncNative = function() {
        if (!this._nativeXHR) return;
        try {
          this.readyState = this._nativeXHR.readyState;
          this.status = this._nativeXHR.status;
          this.statusText = this._nativeXHR.statusText;
          this.response = this._nativeXHR.response;
          this.responseText = this._nativeXHR.responseText;
          this.responseURL = this._nativeXHR.responseURL;
        } catch (_) {}
      };

      StandaloneXHR.prototype.setRequestHeader = function(name, value) {
        this._headers[name.toLowerCase()] = value;
        if (this._nativeXHR) {
          try { this._nativeXHR.setRequestHeader(name, value); } catch (_) {}
        }
      };

      StandaloneXHR.prototype.overrideMimeType = function(mime) {
        if (this._nativeXHR) {
          try { this._nativeXHR.overrideMimeType(mime); } catch (_) {}
        }
      };

      StandaloneXHR.prototype.getAllResponseHeaders = function() {
        if (this._isVfs) {
          var mime = getMime(this._vfsKey);
          return "content-type: " + mime + "\\r\\n";
        }
        return this._nativeXHR ? this._nativeXHR.getAllResponseHeaders() : "";
      };

      StandaloneXHR.prototype.getResponseHeader = function(name) {
        if (this._isVfs) {
          if (name.toLowerCase() === "content-type") return getMime(this._vfsKey);
          return null;
        }
        return this._nativeXHR ? this._nativeXHR.getResponseHeader(name) : null;
      };

      StandaloneXHR.prototype.addEventListener = function(type, cb) {
        if (!this._listeners[type]) this._listeners[type] = [];
        this._listeners[type].push(cb);
      };

      StandaloneXHR.prototype.removeEventListener = function(type, cb) {
        if (this._listeners[type]) {
          this._listeners[type] = this._listeners[type].filter(function(l) { return l !== cb; });
        }
      };

      StandaloneXHR.prototype._fire = function(type, origEvent) {
        var evt = origEvent || {};
        evt.type = type;
        evt.target = this;
        evt.currentTarget = this;
        var handler = this["on" + type];
        if (typeof handler === "function") {
          try { handler.call(this, evt); } catch (e) { console.error(e); }
        }
        var list = this._listeners[type];
        if (list) {
          for (var i = 0; i < list.length; i++) {
            try { list[i].call(this, evt); } catch (e) { console.error(e); }
          }
        }
      };

      StandaloneXHR.prototype.send = function(data) {
        if (!this._isVfs) {
          if (this._nativeXHR) {
            try {
              this._nativeXHR.responseType = this.responseType;
              this._nativeXHR.timeout = this.timeout;
              this._nativeXHR.withCredentials = this.withCredentials;
              this._nativeXHR.send(data);
              return;
            } catch (err) {
              var self = this;
              setTimeout(function() {
                self.status = 404;
                self.readyState = 4;
                self._fire("error");
                self._fire("loadend");
              }, 0);
              return;
            }
          }
        }

        var self = this;
        setTimeout(function() {
          var key = self._vfsKey;
          var raw = VFS[key];
          if (raw === undefined) {
            self.status = 404;
            self.statusText = "Not Found";
            self.readyState = 4;
            self._fire("readystatechange");
            self._fire("error");
            self._fire("loadend");
            return;
          }

          self.status = 200;
          self.statusText = "OK";
          self.readyState = 4;
          var mime = getMime(key);
          var type = self.responseType || "";

          if (type === "blob") {
            var bytes = getAssetBytes(key);
            var blobObj;
            if (bytes) {
              blobObj = new Blob([bytes], { type: mime });
            } else {
              blobObj = new Blob([raw], { type: mime });
            }
            if (typeof raw === "string" && raw.indexOf("data:") === 0) {
              blobObj._vfsDataUrl = raw;
            }
            self.response = blobObj;
          } else if (type === "arraybuffer") {
            var bytes2 = getAssetBytes(key);
            if (bytes2) {
              self.response = bytes2.buffer.slice(0);
            } else {
              var enc = new TextEncoder();
              self.response = enc.encode(raw).buffer.slice(0);
            }
          } else if (type === "json") {
            try {
              self.response = typeof raw === "string" ? JSON.parse(raw) : raw;
              self.responseText = typeof raw === "string" ? raw : JSON.stringify(raw);
            } catch (err) {
              self.response = null;
              self.responseText = "";
            }
          } else {
            // text or default
            self.responseText = typeof raw === "string" ? raw : JSON.stringify(raw);
            self.response = self.responseText;
          }

          self._fire("readystatechange");
          self._fire("progress", { loaded: 100, total: 100, lengthComputable: true });
          self._fire("load");
          self._fire("loadend");
        }, 0);
      };

      StandaloneXHR.prototype.abort = function() {
        this.readyState = 0;
        if (this._nativeXHR) {
          try { this._nativeXHR.abort(); } catch (_) {}
        }
      };

      window.XMLHttpRequest = StandaloneXHR;

      // 7. URL.createObjectURL and URL.revokeObjectURL for In-Memory Data URIs
      try {
        if (typeof window.URL !== "undefined" && window.URL && window.URL.createObjectURL) {
          var origCreateObjectURL = window.URL.createObjectURL.bind(window.URL);
          window.URL.createObjectURL = function(obj) {
            if (obj && obj._vfsDataUrl) {
              return obj._vfsDataUrl;
            }
            try {
              return origCreateObjectURL(obj);
            } catch (err) {
              if (obj && obj._vfsDataUrl) return obj._vfsDataUrl;
              throw err;
            }
          };
          if (window.URL.revokeObjectURL) {
            var origRevoke = window.URL.revokeObjectURL.bind(window.URL);
            window.URL.revokeObjectURL = function(url) {
              if (typeof url === "string" && (url.indexOf("data:") === 0 || url.indexOf("blob:") !== 0)) return;
              try { origRevoke(url); } catch (_) {}
            };
          }
        }
      } catch (err) {
        console.warn("[Standalone] Could not patch URL.createObjectURL:", err);
      }

      // 8. Window Fetch Interceptor
      var NativeFetch = window.fetch ? window.fetch.bind(window) : null;
      window.fetch = function(input, init) {
        var url = (typeof input === "object" && input && input.url) ? input.url : String(input);
        var normKey = normalizeAssetPath(url);

        if (normKey && VFS.hasOwnProperty(normKey)) {
          var raw = VFS[normKey];
          var mime = getMime(normKey);

          if (raw.indexOf("data:") === 0) {
            if (NativeFetch) {
              return NativeFetch(raw, init);
            }
            var bytes = getAssetBytes(normKey);
            var blob = new Blob([bytes], { type: mime });
            return Promise.resolve(new Response(blob, {
              status: 200,
              statusText: "OK",
              headers: { "Content-Type": mime }
            }));
          }

          var bodyBlob = new Blob([raw], { type: mime });
          return Promise.resolve(new Response(bodyBlob, {
            status: 200,
            statusText: "OK",
            headers: { "Content-Type": mime }
          }));
        }

        if (NativeFetch) {
          return NativeFetch(input, init);
        }
        return Promise.reject(new Error("[Standalone] Network fetch not available in offline mode"));
      };

      // 9. HTMLImageElement.src Setter Interceptor
      try {
        var imgDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
        if (imgDesc && imgDesc.set) {
          var origImgSet = imgDesc.set;
          Object.defineProperty(HTMLImageElement.prototype, "src", {
            set: function(val) {
              var normKey = normalizeAssetPath(val);
              if (normKey && VFS.hasOwnProperty(normKey)) {
                var entry = VFS[normKey];
                if (typeof entry === "string" && entry.indexOf("data:") === 0) {
                  try { this.removeAttribute("crossOrigin"); } catch (_) {}
                  return origImgSet.call(this, entry);
                }
              }
              return origImgSet.call(this, val);
            },
            get: function() {
              return imgDesc.get.call(this);
            },
            configurable: true,
            enumerable: true
          });
        }
      } catch (err) {
        console.warn("[Standalone] Could not patch HTMLImageElement.src:", err);
      }

      // 10. Audio Element src Setter Interceptor
      try {
        var audioProto = (typeof HTMLMediaElement !== "undefined") ? HTMLMediaElement.prototype : (typeof Audio !== "undefined" ? Audio.prototype : null);
        if (audioProto) {
          var audioDesc = Object.getOwnPropertyDescriptor(audioProto, "src");
          if (audioDesc && audioDesc.set) {
            var origAudioSet = audioDesc.set;
            Object.defineProperty(audioProto, "src", {
              set: function(val) {
                var normKey = normalizeAssetPath(val);
                if (normKey && VFS.hasOwnProperty(normKey)) {
                  var entry = VFS[normKey];
                  if (typeof entry === "string" && entry.indexOf("data:") === 0) {
                    try { this.removeAttribute("crossOrigin"); } catch (_) {}
                    return origAudioSet.call(this, entry);
                  }
                }
                return origAudioSet.call(this, val);
              },
              get: function() {
                return audioDesc.get.call(this);
              },
              configurable: true,
              enumerable: true
            });
          }
        }
      } catch (err) {
        console.warn("[Standalone] Could not patch Audio src:", err);
      }

      console.log("[Standalone] Offline asset engine initialized. VFS entries:", Object.keys(VFS).length);
    })();
`;

    // 5. Build full HTML file
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>Web Dashers - Standalone Edition</title>
    <meta name="description" content="Web Dashers offline standalone single-file build with all main levels, soundtracks, and level editor.">
    <style>
${inlinedCss}
      /* Fallback error display if anything fatal ever happens */
      #wd-error-overlay {
        display: none;
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(10, 10, 20, 0.95);
        color: #ff5555;
        font-family: monospace;
        padding: 30px;
        box-sizing: border-box;
        z-index: 9999999;
        overflow: auto;
      }
    </style>
    <script>
      // Top-level error display so user never sees a silent black screen
      window.addEventListener('error', function(e) {
        console.error('[Web Dashers Error]', e.message, e.filename, e.lineno);
        var overlay = document.getElementById('wd-error-overlay');
        if (overlay && !window.__gameStarted__) {
          overlay.style.display = 'block';
          var pre = overlay.querySelector('pre') || overlay;
          pre.textContent += '\\n[' + new Date().toLocaleTimeString() + '] ' + (e.message || 'Script error') + ' (' + (e.filename || '') + ':' + (e.lineno || '') + ')';
        }
      });
    </script>
</head>
<body>
    <div id="wd-error-overlay">
      <h2 style="color: #ffb86c; margin-bottom: 10px;">Web Dashers - Startup Notice</h2>
      <p style="color: #f8f8f2; margin-bottom: 15px;">A script error occurred during initialization:</p>
      <pre style="background: #19182a; padding: 15px; border-radius: 8px; border: 1px solid #ff5555; white-space: pre-wrap; font-size: 13px;"></pre>
    </div>

    <!-- Embedded Offline Asset Virtual File System -->
    <script id="wd-vfs-data" type="application/json">
${JSON.stringify(vfs)}
    </script>

    <!-- Offline Asset Interceptor Engine -->
    <script>
${runtimeScript}
    </script>

    <!-- Resilient Multi-Host GD Proxy Router -->
    <script>
      (function () {
        var GD_PROXY_HOSTS = [
          "https://webdashers.webdashersdevelopement.workers.dev",
          "https://gd-proxy.webdashers.workers.dev",
          "https://fallbackgdproxy.webdashers.workers.dev",
          "https://fallback2.webdashers.workers.dev"
        ];
        window._gdProxyUrl = GD_PROXY_HOSTS[0];
        window._gdProxyHosts = GD_PROXY_HOSTS;
      })();
    </script>

    <!-- Inlined Game Scripts in Exact Dependency Order -->
`;

    for (const item of scriptContents) {
      html += `    <!-- ${item.path} -->\n    <script>\n${item.code}\n    </script>\n\n`;
    }

    html += `    <script>
      window.__gameStarted__ = true;
      new ResizeObserver(function() {
        window.dispatchEvent(new Event('resize'));
      }).observe(document.documentElement);

      document.oncontextmenu = function(event) {
        event.preventDefault();
      };
    </script>
</body>
</html>`;

    fs.writeFileSync(CACHE_HTML_PATH, html, 'utf8');
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const sizeMb = (html.length / 1024 / 1024).toFixed(2);
    console.log(`[Standalone] Single-file HTML built successfully: ${sizeMb} MB in ${elapsed}s`);

    return CACHE_HTML_PATH;
  })();

  return htmlPromise;
}


// Add this at the very end of the file:
(async () => {
  await generateStandaloneHtml(true);
  console.log('Standalone HTML generated at:', CACHE_HTML_PATH);
  // Copy to current directory so user can find it
  fs.copyFileSync(CACHE_HTML_PATH, 'standalone-build.html');
  console.log('Copied to standalone-build.html');
})();
