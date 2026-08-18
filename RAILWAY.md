# Railway 部署指南

## 步骤

1. **注册/登录 Railway**
   - 打开 https://railway.app
   - 用 GitHub 账号登录

2. **创建项目**
   - 点击「New Project」
   - 选择「Deploy from GitHub repo」
   - 搜索并选择 `bugns1/File-Transfer`

3. **配置环境变量（可选）**
   - 在项目设置中添加：
     - `PORT` = `80` （Railway 会自动分配端口）

4. **自动部署**
   - Railway 会自动检测 Node.js 项目
   - 运行 `npm install` 和 `node server.js`
   - 等待部署完成

5. **获取 URL**
   - 部署成功后，点击服务
   - 进入「Settings」→「Domains」
   - 复制生成的 URL（如 https://file-transfer-xxx.up.railway.app）

6. **分享给朋友**
   - 把 URL 发给朋友
   - 双方打开同一个 URL
   - 互输 ID 连接即可

---

## 故障排除

**问题：部署失败**
- 检查 Railway 日志
- 确认 package.json 有正确的 start 脚本

**问题：WebRTC 连接失败**
- Railway 默认不支持 WebSocket 升级
- 需要在 Railway 设置中启用「WebSocket Support」

---

## 替代方案

如果 Railway 配置复杂，可以使用：

- **Render**: https://render.com（同样免费）
- **Fly.io**: https://fly.io（有免费额度）
- **Vercel**: 需要额外配置（不支持长连接）
