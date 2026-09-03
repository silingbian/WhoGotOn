# 动物素材说明

游戏的动物清单在同目录的 `catalog.js`。页面右上角的“动物”按钮可打开素材表格，新增素材不需要改动游戏逻辑。素材可使用 `.png`、`.jpg`、`.jpeg` 或 `.svg`。

新增动物时：

1. 将图片放到本目录。推荐透明背景、主体居中、竖版构图；建议画布比例接近 180 × 200。
2. 打开游戏右上角“动物”，点击“添加动物”，填写中文名称与图片文件名，例如 `red-crowned-crane.png`。表格会自动生成唯一 id。
3. 点击“保存到 catalog.js”，首次保存时选择本目录中的 `catalog.js` 并授权写入。
4. 如需图片加载失败时回退 SVG，可在 `catalog.js` 的条目补充 `fallback`：

   ```js
   { id: "red-crowned-crane", name: "丹顶鹤", src: "red-crowned-crane.png", fallback: "red-crowned-crane.svg" }
   ```

目录内已有 `cjl.png`（长颈鹿）和 `ss.jpeg`（松鼠），均已登记进当前清单。动物总数保持 10 只以上，才能确保相邻两轮的 5 只动物完全不重复。
