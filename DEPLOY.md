# P2P 文件传输 - 部署指南

## 本地运行（测试）

`npm install && npm start`

打开两个浏览器标签页访问 http://localhost:3000

---

## 分享给朋友（公网访问）

### 方案一：Railway（推荐，免费）

1. 注册 https://railway.app
2. 把代码推送到 GitHub
3. Railway 导入仓库，自动部署
4. 获得公网 URL，分享给朋友

### 方案二：Render（免费）

1. 注册 https://render.com
2. New → Public Web Service
3. 连接 GitHub 仓库
4. Build: `npm install`, Start: `node server.js`
5. 部署完成

### 方案三：本地网络共享

和朋友在同一 WiFi 下：
1. 运行 `npm start`
2. 查看本机 IP: `ipconfig | findstr IPv4`
3. 朋友访问 `http://你的IP:3000`

---

详见 DEPLOY.md
