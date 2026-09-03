# 谁上车了？视觉记忆游戏

一个纯前端的视觉追踪训练小游戏：先记住站台上的动物，再猜哪一只能坐上公交车。无依赖、无构建，浏览器直接打开即可运行。

## 本地运行

直接双击 `index.html`，或用任意静态服务器：

```bash
# Python
python3 -m http.server 8000
# 然后访问 http://localhost:8000
```

## 目录结构

- `index.html`  — 页面结构
- `styles.css`  — 样式与移动端适配
- `game.js`     — 游戏逻辑
- `assets/`     — 动物素材、公交车底图等
- `assets/animals/catalog.js` — 动物清单，可直接在此登记新动物

## 新增动物素材

把图片放进 `assets/animals/`（推荐透明背景、接近 180×200 竖版），然后在右上角「动物」弹窗中点击「添加动物」填写名称与文件名，最后「保存到 catalog.js」。

详情见 `assets/animals/README.md`。

## 线上部署

本仓库为纯静态资源，可直接部署到任意静态托管平台：

- **Vercel** / **Netlify** / **Cloudflare Pages**：连接到本仓库即可自动部署，构建命令留空（目录选根目录即可）。
- **GitHub Pages**：仓库 Settings → Pages，选择部署分支。

