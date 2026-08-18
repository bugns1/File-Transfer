const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css'
  };
  fs.readFile(filePath, (err, content) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(content);
  });
});

const wss = new WebSocket.Server({ server });
const clients = new Map();

wss.on('connection', (ws, req) => {
  const urlParams = new URL(req.url, 'http://localhost');
  const peerId = urlParams.searchParams.get('peerId');
  if (!peerId) { ws.close(); return; }
  clients.set(peerId, ws);
  console.log('Peer connected: ' + peerId + ' (total: ' + clients.size + ')');

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      console.log(msg.from + ' -> ' + msg.to + ': ' + msg.type);

      const target = clients.get(msg.to);
      if (!target || target.readyState !== WebSocket.OPEN) {
        console.log('Target not found: ' + msg.to);
        return;
      }

      if (msg.type === 'invite' || msg.type === 'signal' || msg.type === 'reject') {
        target.send(JSON.stringify({
          type: msg.type,
          from: msg.from,
          data: msg.data || {},
          fileInfo: msg.fileInfo
        }));
      }

      if (msg.type === 'disconnect') {
        target.send(JSON.stringify({ type: 'peer-disconnected' }));
      }
    } catch (e) {
      console.error('Error:', e);
    }
  });

  ws.on('close', () => {
    console.log('Peer disconnected: ' + peerId);
    clients.delete(peerId);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('P2P File Transfer Server running on port ' + PORT);
  console.log('');
});
