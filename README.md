# ai-ppt-helper

工业级 AI PowerPoint 协作编辑器 — Vite + React 19 + zustand + immer。

## 快速开始

```bash
# 1. 安装依赖（每次拉新代码后必跑！）
npm install

# 2. 启动开发服务
npm run dev
# → http://localhost:5173

# 3. 跑测试（含 Mock-LLM 端到端验证生成核心）
npm test

# 4. 生产构建
npm run build
```

> ⚠️ 如果启动报 `Failed to resolve import "echarts" / "mermaid" / "katex"` 之类，
> **删 `node_modules` 后重装**：`rm -rf node_modules package-lock.json && npm install`。
> 这通常是拉新代码但没装新依赖导致的。

## 首次使用

1. 进入页面，右上角 **设置** → **AI 服务** 填入 Anthropic / OpenAI / Gemini 任一 API Key
2. 在右侧对话框输入 「**生成一份 6 页关于 AI Co-pilot 的发布会 PPT**」
3. 等待 outline_deck 立即落 6 张骨架 → 逐页 populate_slide 流式补内容
4. 顶栏 **导出 PPTX / PDF / PNG** 下载结果

## 目录结构

```
src/
  ai/              # AIService (Anthropic/OpenAI/Gemini)、orchestrator、tools
  canvas/          # 画布渲染、交互、文本编辑器、连接线锚点
  core/            # schema / store (zustand) / patch / events / persistence
  generation/      # 14 layout 模板 + 质量验证器
  themes/          # PPTX 解析、WCAG 配色、字体配对
  skills/          # 用户技能 (zip/md 导入)、3 个内置技能
  integrations/    # Tauri sidecar、Y.js 协同接口契约
  export/          # pptx / pdf / png + 审计 (水印/密码/分享)
  ui/              # TopBar / LeftPanel / RightPanel / ChatPanel / Settings / Presenter
  i18n/            # zh / en
  styles/          # 全局 CSS 变量主题
```

## 核心特性

### 编辑
- 14 工业级 layout（cover-bold / kpi-trio / comparison / timeline-h / steps-vertical / quote / closing 等）
- 富文本就地编辑（双击 + 浮动工具栏）
- 8 把手 resize + 旋转 + 智能吸附线
- 12 种形状 + 列表 / 分隔线 / 视频 / 嵌入 (mermaid / KaTeX / iframe / HTML) / 连接线
- 拖拽 / 粘贴板图片入画布
- 对齐 / 分布工具 + 8pt 网格

### AI 生成
- 流式三阶段：`outline_deck` 立即落骨架 → 逐页 `populate_slide` → 终结对话
- 工具：generate_deck / add_slide / edit_block / rewrite_text / set_theme / derive_theme / generate_image
- 质量验证器：clamp 越界 / 修正低对比度 / 检测溢出 / 标记重叠
- @-references：自动携带当前 slide / 选中 block 作为编辑上下文
- Skills 系统：`/skill-name` 调用预置或用户导入的自定义 prompt
- Anthropic prompt caching + thinking 自动启用

### 协同 / 演示 / 输出
- Y.js + WebSocket 多人协同（CollabSection 配置）
- 演示模式：全屏 / 翻页 / 备注 / 计时器 / 激光笔 / 批注笔 / 语音录制
- 导出 PPTX (含连接线 / 列表 / 视频 / embed) / 矢量 PDF / PNG
- 导出审计：水印 / PDF 密码提示 / 分享 token (4 档过期)
- 版本快照：每 25 步或 5 分钟自动存档（保留最近 50 个）

### 持久化
- IndexedDB 存 deck / chatSessions / snapshots（schema v3）
- 多项目切换、对话历史、版本时间线
- 浏览器关闭后所有数据保留

## 配置 LLM

进入 **设置 → AI 服务**：
- **Anthropic**: `https://api.anthropic.com` + `x-api-key`
- **OpenAI**: `https://api.openai.com/v1` + `Bearer`
- **Gemini**: 内置默认 endpoint + API Key in URL
- **DeepSeek / 通义 / 豆包**: OpenAI 兼容协议
- **Claude 中转 / OpenAI 中转**: 自定义 URL + 鉴权方式 (lanyiapi / AnyRouter)

代理：**设置 → 网络代理** 支持 system / HTTP / SOCKS5 / PAC。浏览器仅作 hint，桌面 sidecar 才能真正路由。

## 测试

```bash
npm test            # 跑全部 40 单测，包含 Mock-LLM 端到端
npm run test:watch  # 监听模式
```

`src/ai/orchestrator.test.ts` 是关键：模拟 Anthropic SSE 流，跑完整 outline → 6× populate 流程，断言生成的 deck 结构正确（kpi-trio 有 3 张大数字、comparison 双卡、所有 block 不越界）。
