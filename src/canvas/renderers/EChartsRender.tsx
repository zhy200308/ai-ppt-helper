import { memo, useEffect, useRef, useState } from 'react';
import type { ChartBlock } from '../../core/schema/types';

// Lazy-load ECharts at runtime. Wrapped in try/catch so a missing
// install (developer forgot `npm install`) shows a placeholder instead
// of crashing the entire app.
export const EChartsRender = memo(function EChartsRender({ block }: { block: ChartBlock }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let resizeObs: ResizeObserver | null = null;

    (async () => {
      try {
        // The /* @vite-ignore */ tells Vite not to fail dev pre-transform
        // when the package is absent; we surface the error at runtime instead.
        const echarts = await import(/* @vite-ignore */ 'echarts');
        if (disposed || !ref.current) return;
        const inst = echarts.init(ref.current);
        chartRef.current = inst;
        inst.setOption(buildOption(block));
        resizeObs = new ResizeObserver(() => inst.resize());
        resizeObs.observe(ref.current);
      } catch (e) {
        if (disposed) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg.includes('ECHARTS') || msg.includes('echarts')
          ? '未安装 echarts，请运行 `npm install` 后刷新'
          : msg);
      }
    })();

    return () => {
      disposed = true;
      resizeObs?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (chartRef.current) chartRef.current.setOption(buildOption(block), { notMerge: true });
  }, [block]);

  if (error) {
    return (
      <div style={{ width: '100%', height: '100%', background: '#FEF3C7', color: '#92400E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, padding: 12, textAlign: 'center', borderRadius: 6 }}>
        {error}
      </div>
    );
  }
  return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
});

function buildOption(block: ChartBlock): any {
  const colors = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
  const categories = block.categories ?? block.series[0]?.data.map((_, i) => `${i + 1}`) ?? [];

  if (block.chart === 'pie') {
    const data = (block.series[0]?.data ?? []).map((v, i) => ({
      value: v,
      name: categories[i] ?? `${i + 1}`,
    }));
    return {
      color: colors,
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [{
        type: 'pie',
        radius: ['35%', '70%'],
        data,
        label: { color: '#0F172A' },
        ...(block.options ?? {}),
      }],
    };
  }

  const series = block.series.map((s, i) => ({
    name: s.name,
    type: block.chart === 'area' ? 'line' : block.chart,
    smooth: block.chart === 'line' || block.chart === 'area',
    areaStyle: block.chart === 'area' ? { opacity: 0.25 } : undefined,
    symbol: block.chart === 'scatter' ? 'circle' : 'emptyCircle',
    data: block.chart === 'scatter' ? s.data.map((v, j) => [j + 1, v]) : s.data,
    itemStyle: { color: colors[i % colors.length] },
  }));

  return {
    color: colors,
    grid: { left: 36, right: 16, top: 32, bottom: 36, containLabel: true },
    tooltip: { trigger: block.chart === 'scatter' ? 'item' : 'axis' },
    legend: block.series.length > 1 ? { top: 0 } : undefined,
    xAxis: block.chart === 'scatter' ? { type: 'value' } : { type: 'category', data: categories, boundaryGap: block.chart !== 'line' && block.chart !== 'area' },
    yAxis: { type: 'value' },
    series,
    ...(block.options ?? {}),
  };
}
