// Resolves a Chart/Table block's dataRef into the in-memory shape its
// renderer expects. Called from within React rendering, so we accept the
// deck via subscription rather than reading the store directly.

import type {
  ChartBlock,
  ChartDataRef,
  DataTable,
  Deck,
  TableBlock,
} from '../core/schema/types';

export function resolveChartFromTable(block: ChartBlock, deck: Deck): {
  categories: string[];
  series: { name: string; data: number[] }[];
} {
  const ref = block.dataRef;
  const table = ref ? deck.dataTables?.[ref.tableId] : undefined;
  if (!ref || !table) {
    return {
      categories: block.categories ?? block.series[0]?.data.map((_, i) => `${i + 1}`) ?? [],
      series: block.series,
    };
  }
  return chartFromTable(table, ref);
}

export function chartFromTable(table: DataTable, ref: ChartDataRef): {
  categories: string[];
  series: { name: string; data: number[] }[];
} {
  const xCol = table.columns.find((c) => c.key === ref.xColumn);
  const yKeys = ref.yColumns?.length
    ? ref.yColumns
    : table.columns.filter((c) => c.type === 'number' && c.key !== ref.xColumn).map((c) => c.key);
  const categories = table.rows.map((r) => String(r[ref.xColumn] ?? ''));
  const series = yKeys.map((key) => {
    const col = table.columns.find((c) => c.key === key);
    return {
      name: col?.label ?? key,
      data: table.rows.map((r) => Number(r[key] ?? 0)),
    };
  });
  if (!xCol) {
    // Fallback: if x column is missing, use row indices.
    return {
      categories: table.rows.map((_, i) => `${i + 1}`),
      series,
    };
  }
  return { categories, series };
}

export function resolveTableFromRef(block: TableBlock, deck: Deck): {
  cells: string[][];
  rows: number;
  cols: number;
  headerRow: boolean;
  headerCol: boolean;
} {
  const ref = block.dataRef;
  const table = ref ? deck.dataTables?.[ref.tableId] : undefined;
  if (!ref || !table) {
    return {
      cells: block.cells,
      rows: block.rows,
      cols: block.cols,
      headerRow: block.headerRow ?? false,
      headerCol: block.headerCol ?? false,
    };
  }
  const cols = ref.columns?.length
    ? ref.columns.map((k) => table.columns.find((c) => c.key === k)).filter(Boolean) as DataTable['columns']
    : table.columns;
  const header = cols.map((c) => c.label);
  const body = table.rows.map((r) => cols.map((c) => String(r[c.key] ?? '')));
  return {
    cells: [header, ...body],
    rows: 1 + body.length,
    cols: cols.length,
    headerRow: true,
    headerCol: false,
  };
}
