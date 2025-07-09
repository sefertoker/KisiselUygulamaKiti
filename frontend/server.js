const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  let filePath;

  // Yolun sonu / ile bitiyorsa kaldır
  if (url.length > 1 && url.endsWith('/')) {
    url = url.slice(0, -1);
  }

  // Ana sayfa yönlendirmesi (index.html)
  if (url === '/' || url === '/index.html') {
    filePath = path.join(__dirname, 'index.html');
    sendFile(res, filePath, 'text/html');
    return;
  }
  // Login yönlendirmesi
  if (url === '/login' || url === '/login.html') {
    filePath = path.join(__dirname, 'login.html');
    sendFile(res, filePath, 'text/html');
    return;
  }
  // Register yönlendirmesi
  if (url === '/register' || url === '/register.html') {
    filePath = path.join(__dirname, 'register.html');
    sendFile(res, filePath, 'text/html');
    return;
  }

  // Statik dosyaları sun
  filePath = path.join(__dirname, url);
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      sendFile(res, filePath, contentType);
    } else {
      // SPA: Diğer tüm yolları index.html'e yönlendir
      sendFile(res, path.join(__dirname, 'index.html'), 'text/html');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Static server running at http://localhost:${PORT}`);
});
