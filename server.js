const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const os = require('os');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
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

      if (msg.type === 'signal') {
        const target = clients.get(msg.to);
        if (target && target.readyState === WebSocket.OPEN) {
          target.send(JSON.stringify({
            type: 'signal',
            from: msg.from,
            data: msg.data
          }));
        }
      }

      if (msg.type === 'disconnect') {
        const target = clients.get(msg.to);
        if (target && target.readyState === WebSocket.OPEN) {
          target.send(JSON.stringify({ type: 'peer-disconnected' }));
        }
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
  const interfaces = os.networkInterfaces();
  let localIP = '127.0.0.1';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
  }
  
  console.log('');
  console.log('========================================');
  console.log('  P2P File Transfer Server');
  console.log('========================================');
  console.log('Local:   http://localhost:' + PORT);
  console.log('Network: http://' + localIP + ':' + PORT);
  console.log('');
  console.log('Open this URL in two browser tabs!');
  console.log('========================================');
  console.log('');
});
