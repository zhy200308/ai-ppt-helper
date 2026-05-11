import { Grid3X3, CheckCircle2, CircleDot, AlertTriangle } from 'lucide-react';

const MATRIX = [
  {
    area: 'AI 生成与编辑',
    capabilities: [
      ['大纲到整套 PPT', '已支持', 'outline_deck + populate_slide 分步生成'],
      ['指定页/块改写', '已支持', '@slide / @block 上下文引用'],
      ['精细设计元素插入', '已支持', 'SVG / 图标 / 线条携带坐标与图层标记'],
    ],
  },
  {
    area: '设计与画布',
    capabilities: [
      ['位置尺寸旋转透明度', '已支持', '右侧属性面板编辑'],
      ['图层控制', '已支持', '置顶/上移/下移/置底与 AI layer placement'],
      ['背景与装饰 SVG', '已支持', 'SVG 转 image block 插入并可放底层'],
    ],
  },
  {
    area: '数据与图表',
    capabilities: [
      ['柱状图行列编辑', '已支持', '组件栏默认图表可直接编辑内联 categories/series'],
      ['共享数据表', '已支持', '图表/表格可绑定 deck-level dataTables'],
      ['AI 数据表强制引用', '已支持', '生成图表前先 create_data_table'],
    ],
  },
  {
    area: '协同',
    capabilities: [
      ['Y.js 房间连接', '已支持', '设置 → 协同配置 WebSocket URL 与 room'],
      ['远端光标', '已支持', '同房间成员在画布显示姓名与光标'],
      ['实时快照同步', '基础版', '本地非临时编辑同步为 deck 快照'],
    ],
  },
  {
    area: '导出与审计',
    capabilities: [
      ['PPTX / PDF / PNG', '已支持', '顶部栏导出入口'],
      ['导出审计水印/分享', '已支持', '设置 → 导出审计'],
      ['演示模式', '已支持', '顶部栏演示入口'],
    ],
  },
];

function statusIcon(status: string) {
  if (status === '已支持') return <CheckCircle2 size={13} className="cap-ok"/>;
  if (status === '基础版') return <CircleDot size={13} className="cap-basic"/>;
  return <AlertTriangle size={13} className="cap-warn"/>;
}

export function CapabilityMatrixSection() {
  return (
    <section className="settings-content">
      <h3><Grid3X3 size={14}/> 能力矩阵</h3>
      <p className="hint">当前产品能力按模块拆解如下，用于明确 AI 可调用能力、前端可编辑能力以及仍需增强的边界。</p>
      <div className="capability-matrix">
        {MATRIX.map((group) => (
          <div className="cap-group" key={group.area}>
            <div className="cap-area">{group.area}</div>
            <div className="cap-rows">
              {group.capabilities.map(([name, status, detail]) => (
                <div className="cap-row" key={name}>
                  <div className="cap-name">{name}</div>
                  <div className="cap-status">{statusIcon(status)} {status}</div>
                  <div className="cap-detail">{detail}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
