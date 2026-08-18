// ============================================================
// P2P File Transfer - Pure WebRTC Implementation
// Fixed signaling protocol
// ============================================================

const CONFIG = {
  CHUNK_SIZE: 16 * 1024,
  ICE_SERVERS: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

let peerId = generatePeerId();
let ws = null;
let pc = null;
let dataChannel = null;
let receivedChunks = new Map();
let pendingTransfers = new Map();
let currentUploads = new Map();
let peerConnected = false;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('myPeerId').value = peerId;
  setupDragDrop();
  setupWebSocket();
});

function generatePeerId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

function getTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// ============================================================
// WebSocket Signaling
// ============================================================

function setupWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(protocol + '://' + location.host + '/ws?peerId=' + peerId);

  ws.onopen = () => {
    updateConnectionStatus('connected', '✅ 已连接到信令服务器');
  };

  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      await handleSignalingMessage(msg);
    } catch (e) {
      console.error('Parse error:', e);
    }
  };

  ws.onclose = () => {
    updateConnectionStatus('error', '❌ 信令服务器断开');
  };

  ws.onerror = () => {};
}

async function handleSignalingMessage(msg) {
  console.log("📨 收到消息:", JSON.stringify(msg));
  console.log("Signal:", msg.type, "from:", msg.from);
  switch (msg.type) {
    case "invite":
      console.log("📩 收到邀请!", msg.from, msg.fileInfo);
      window._pendingInvite = msg;
      window._pendingInvite = msg;
      showInviteDialog(msg.from, msg.fileInfo);
      break;
    case "signal":
      await handleSignal(msg.from, msg.data);
      break;
    case "peer-disconnected":
      updateConnectionStatus("error", "❌ 对方已断开");
      closeConnection();
      break;
    default:
      console.warn("Unknown:", msg.type);
  }
}

async function handleSignal(from, data) {
  console.log("Received signal from:", from, "type:", data?.type);
  try {
    if (!pc) {
      pc = new RTCPeerConnection({ iceServers: CONFIG.ICE_SERVERS });
      pc.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannel();
      };
      pc.onconnectionstatechange = () => {
        console.log("State:", pc.connectionState);
        if (pc.connectionState === "connected") { peerConnected = true; onConnected(); }
        else if (pc.connectionState === "disconnected" || pc.connectionState === "closed") { peerConnected = false; onDisconnected(); }
      };
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") updateConnectionStatus("error", "❌ 网络连接失败");
      };
    }

    const desc = new RTCSessionDescription(data);
    await pc.setRemoteDescription(desc);

    if (data.type === "offer") {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIceGathering();

      if (!ws || ws.readyState !== WebSocket.OPEN) { console.error("WebSocket not ready"); return; }
      ws.send(JSON.stringify({ type: "signal", from: peerId, to: from, data: pc.localDescription }));
      updateConnectionStatus("connecting", "🔄 正在建立直连...");
    }
  } catch (err) {
    console.error("Signal error:", err);
    updateConnectionStatus("error", "❌ 信号处理失败: " + err.message);
  }
}

function showInviteDialog(from, fileInfo) {
  const overlay = document.createElement("div");
  overlay.className = "invite-overlay";
  overlay.innerHTML = `
    <div class="invite-box">
      <h3>📥 收到文件传输请求</h3>
      <p>来自: <strong>${from}</strong></p>
      <p>准备接收文件...</p>
      <p class="encrypt-hint">🔒 WebRTC 端到端加密</p>
      <div class="invite-buttons">
        <button onclick="acceptConnection(); this.closest('.invite-overlay').remove();" class="accept-btn">接受</button>
        <button onclick="rejectConnection(); this.closest('.invite-overlay').remove();" class="reject-btn">拒绝</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function rejectConnection() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "reject", from: peerId, to: window._pendingInvite?.from }));
  }
}

async function connectToPeer() {
  const targetId = document.getElementById("targetPeerId").value.trim().toUpperCase();
  if (!targetId) { alert("请输入对方的连接 ID"); return; }
  if (targetId === peerId) { alert("不能连接自己！"); return; }

  updateConnectionStatus("connecting", "🔄 正在发送连接请求...");

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    updateConnectionStatus("error", "❌ 信令服务器未连接");
    return;
  }

  ws.send(JSON.stringify({ type: "invite", from: peerId, to: targetId }));
  updateConnectionStatus("connecting", "⏳ 等待对方接受...");
}


async function createPeerConnection() {
  pc = new RTCPeerConnection({ iceServers: CONFIG.ICE_SERVERS });
  
  pc.ondatachannel = (event) => {
    dataChannel = event.channel;
    setupDataChannel();
  };
  
  pc.onconnectionstatechange = () => {
    console.log("State:", pc.connectionState);
    if (pc.connectionState === "connected") {
      peerConnected = true;
      onConnected();
    } else if (pc.connectionState === "disconnected" || pc.connectionState === "closed") {
      peerConnected = false;
      onDisconnected();
    }
  };
  
  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === "failed") {
      updateConnectionStatus("error", "❌ 网络连接失败");
    }
  };
}

function setupDataChannel() {
  if (!dataChannel) return;
  
  dataChannel.binaryType = 'arraybuffer';

  dataChannel.onopen = () => {
    console.log('DataChannel opened!');
    peerConnected = true;
    onConnected();
  };

  dataChannel.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      await handleMessage(msg);
    } catch (err) {
      console.error('Parse error:', err);
    }
  };

  dataChannel.onclose = () => {
    console.log('DataChannel closed');
    peerConnected = false;
    onDisconnected();
  };

  dataChannel.onerror = (err) => {
    console.error('DataChannel error:', err);
  };
}


async function acceptConnection() {
  try {
    await createPeerConnection();
    dataChannel = pc.createDataChannel("files", { ordered: true });
    setupDataChannel();

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering();

    if (!ws || ws.readyState !== WebSocket.OPEN) { console.error("WebSocket not ready"); return; }
    ws.send(JSON.stringify({ type: "signal", from: peerId, to: window._pendingInvite?.from, data: pc.localDescription }));
    updateConnectionStatus("connecting", "🔄 正在交换密钥...");
  } catch (err) {
    console.error("Accept failed:", err);
    updateConnectionStatus("error", "❌ 连接失败: " + err.message);
  }
}



async function waitForIceGathering() {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') { resolve(); return; }
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') resolve();
    };
    setTimeout(resolve, 3000);
  });
}

// ============================================================
// Connection State
// ============================================================

function onConnected() {
  updateConnectionStatus('connected', '✅ 已直连 - 可以传输文件');
  document.getElementById('transferSection').style.display = 'block';
  document.getElementById('chatSection').style.display = 'block';
  document.getElementById('connectBtn').disabled = true;
  document.getElementById('connectBtn').textContent = '已连接 ✓';
}

function onDisconnected() {
  updateConnectionStatus('error', '❌ 已断开连接');
  document.getElementById('transferSection').style.display = 'none';
  document.getElementById('chatSection').style.display = 'none';
  document.getElementById('connectBtn').disabled = false;
  document.getElementById('connectBtn').textContent = '连接';
  currentUploads.clear();
  receivedChunks.clear();
}

function closeConnection() {
  if (dataChannel) { try { dataChannel.close(); } catch(e) {} dataChannel = null; }
  if (pc) { try { pc.close(); } catch(e) {} pc = null; }
  peerConnected = false;
}

function updateConnectionStatus(type, message) {
  const el = document.getElementById('connectionStatus');
  el.className = 'status ' + type;
  el.textContent = message;
}

// ============================================================
// File Transfer
// ============================================================

async function handleMessage(msg) {
  console.log('Data message:', msg.type);
  switch (msg.type) {
    case 'file-meta':
      await handleFileMeta(msg);
      break;
    case 'chunk':
      await handleChunk(msg);
      break;
    case 'chunk-ack':
      handleChunkAck(msg);
      break;
    case 'complete':
      await handleComplete(msg);
      break;
    case 'error':
      handleError(msg);
      break;
    case 'chat':
      addChatMessage(msg.text, false);
      break;
    default:
      console.warn('Unknown:', msg.type);
  }
}

async function handleFileMeta(meta) {
  receivedChunks.clear();
  const transferId = meta.transferId || (meta.name + '-' + meta.size);

  pendingTransfers.set(transferId, {
    ...meta,
    transferId,
    receivedSize: 0,
    startTime: Date.now()
  });

  addReceivedFile(transferId);
  sendToPeer({ type: 'ready', transferId });
}

function addReceivedFile(transferId) {
  const transfer = pendingTransfers.get(transferId);
  const list = document.getElementById('receivedFiles');
  if (!transfer || !list) return;

  const item = document.createElement('div');
  item.className = 'file-item';
  item.id = 'received-' + transferId;
  item.innerHTML = `
    <span class="file-icon">📄</span>
    <div class="file-info">
      <div class="file-name">${transfer.name}</div>
      <div class="file-meta">接收中... 0 / ${formatSize(transfer.size)}</div>
    </div>
    <div class="progress-bar" style="width:120px">
      <div class="progress-fill sending" style="width:0%"></div>
    </div>
  `;
  list.insertBefore(item, list.firstChild);
}

async function handleChunk(chunk) {
  const transferId = chunk.transferId;
  if (!pendingTransfers.has(transferId)) return;

  receivedChunks.set(chunk.index, chunk.data);
  const transfer = pendingTransfers.get(transferId);
  transfer.receivedSize += chunk.data.byteLength;

  updateReceiveProgress(transferId);
  sendToPeer({ type: 'chunk-ack', transferId, index: chunk.index });

  if (transfer.receivedSize >= transfer.size) {
    setTimeout(() => finalizeDownload(transferId), 200);
  }
}

function handleChunkAck(ack) {
  const upload = currentUploads.get(ack.transferId);
  if (upload) {
    upload.ackedIndices.add(ack.index);
    updateSendProgress(upload);
  }
}

function updateReceiveProgress(transferId) {
  const transfer = pendingTransfers.get(transferId);
  const item = document.getElementById('received-' + transferId);
  if (!transfer || !item) return;

  const percent = (transfer.receivedSize / transfer.size) * 100;
  const fill = item.querySelector('.progress-fill');
  const meta = item.querySelector('.file-meta');
  const elapsed = (Date.now() - transfer.startTime) / 1000;
  const speed = transfer.receivedSize / Math.max(elapsed, 1);

  if (fill) fill.style.width = percent + '%';
  if (meta) meta.textContent = `接收中... ${formatSize(transfer.receivedSize)} / ${formatSize(transfer.size)} · ${formatSize(speed)}/s`;
}

async function handleComplete(msg) {
  const transferId = msg.transferId;
  await finalizeDownload(transferId);
}

async function finalizeDownload(transferId) {
  const transfer = pendingTransfers.get(transferId);
  if (!transfer) return;

  const sortedIndices = Array.from(receivedChunks.keys()).sort((a, b) => a - b);
  const blobParts = sortedIndices.map(i => receivedChunks.get(i));
  const blob = new Blob(blobParts);

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = transfer.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const item = document.getElementById('received-' + transferId);
  if (item) {
    item.querySelector('.file-meta').textContent = '✅ 下载完成';
    item.querySelector('.progress-fill').classList.add('complete');
  }

  pendingTransfers.delete(transferId);
  receivedChunks.clear();
}

function handleError(err) {
  console.error('Transfer error:', err);
  alert('错误: ' + (err.message || err));
}

// ============================================================
// Upload
// ============================================================

async function uploadFiles(files) {
  for (const file of files) {
    await uploadSingleFile(file);
  }
}

async function uploadSingleFile(file) {
  if (!peerConnected) {
    alert('请先连接到对方！');
    return;
  }

  const transferId = file.name + '-' + file.size + '-' + Date.now();
  const hash = await calculateHash(file);
  const chunks = Math.ceil(file.size / CONFIG.CHUNK_SIZE);

  const fileInfo = {
    name: file.name,
    size: file.size,
    chunks: chunks,
    chunkSize: CONFIG.CHUNK_SIZE,
    hash: hash,
    transferId: transferId
  };

  addUploadItem(transferId, fileInfo);
  sendToPeer({ type: 'file-meta', ...fileInfo });

  const upload = {
    transferId, file, fileInfo,
    sentChunks: 0,
    ackedIndices: new Set(),
    startTime: Date.now()
  };
  currentUploads.set(transferId, upload);

  let offset = 0;
  let index = 0;

  async function sendNext() {
    if (offset >= file.size || !peerConnected) {
      if (peerConnected) {
        sendToPeer({ type: 'complete', transferId, hash });
        upload.sentChunks = chunks;
        updateSendProgress(upload);
      }
      return;
    }

    const chunk = file.slice(offset, offset + CONFIG.CHUNK_SIZE);
    const chunkData = await chunk.arrayBuffer();

    sendToPeer({ type: 'chunk', transferId, index, data: chunkData });

    upload.sentChunks++;
    offset += CONFIG.CHUNK_SIZE;
    index++;
    updateSendProgress(upload);

    requestAnimationFrame(sendNext);
  }

  sendNext();
}

function addUploadItem(transferId, fileInfo) {
  const queue = document.getElementById('uploadQueue');
  const item = document.createElement('div');
  item.className = 'queue-item';
  item.id = 'upload-' + transferId;
  item.innerHTML = `
    <div class="queue-item-header">
      <span class="queue-item-name">${fileInfo.name}</span>
      <span class="queue-item-size">${formatSize(fileInfo.size)}</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill sending" style="width: 0%"></div>
    </div>
    <div class="queue-item-status">
      <span class="upload-status">准备中...</span>
      <span class="upload-speed"></span>
    </div>
  `;
  queue.appendChild(item);
}

function updateSendProgress(upload) {
  const item = document.getElementById('upload-' + upload.transferId);
  if (!item) return;

  const percent = (upload.sentChunks / upload.fileInfo.chunks) * 100;
  const fill = item.querySelector('.progress-fill');
  const status = item.querySelector('.upload-status');
  const speedEl = item.querySelector('.upload-speed');

  if (fill) fill.style.width = percent + '%';

  if (upload.sentChunks >= upload.fileInfo.chunks) {
    if (fill) fill.classList.add('complete');
    if (status) { status.textContent = '✅ 发送完成'; status.style.color = 'var(--success)'; }
  } else {
    const elapsed = (Date.now() - upload.startTime) / 1000;
    const sentBytes = upload.sentChunks * upload.fileInfo.chunkSize;
    const speed = sentBytes / Math.max(elapsed, 1);
    if (status) status.textContent = '发送中...';
    if (speedEl) speedEl.textContent = formatSize(speed) + '/s';
  }
}

// ============================================================
// Drag & Drop
// ============================================================

function setupDragDrop() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) { uploadFiles(fileInput.files); fileInput.value = ''; }
  });
}

// ============================================================
// Chat
// ============================================================

function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || !peerConnected) return;
  addChatMessage(text, true);
  sendToPeer({ type: 'chat', text });
  input.value = '';
}

function handleChatKey(e) {
  if (e.key === 'Enter') sendMessage();
}

function addChatMessage(text, isSent) {
  const messages = document.getElementById('chatMessages');
  const msg = document.createElement('div');
  msg.className = 'chat-msg ' + (isSent ? 'sent' : 'received');
  msg.innerHTML = `${text}<div class="time">${getTime()}</div>`;
  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
}

function sendToPeer(msg) {
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(JSON.stringify(msg));
  }
}

// ============================================================
// Utilities
// ============================================================

async function calculateHash(buffer) {
  const data = buffer instanceof Blob ? await buffer.arrayBuffer() : buffer;
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function copyPeerId() {
  const input = document.getElementById("myPeerId");
  input.select();
  input.setSelectionRange(0, 99999); // For mobile
  
  // Try modern clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(input.value).then(() => {
      showCopyFeedback();
    }).catch(() => {
      fallbackCopy(input.value);
    });
  } else {
    // Fallback for older browsers
    fallbackCopy(input.value);
  }
}

function fallbackCopy(text) {
  try {
    document.execCommand("copy");
    showCopyFeedback();
  } catch (err) {
    alert("复制失败，请手动复制: " + text);
  }
}

function showCopyFeedback() {
  const btn = document.getElementById("copyIdBtn");
  const original = btn.textContent;
  btn.textContent = "已复制 ✓";
  btn.style.background = "var(--success)";
  setTimeout(() => {
    btn.textContent = original;
    btn.style.background = "";
  }, 1500);
}