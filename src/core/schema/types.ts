// Deck / Slide / Block schema — the single source of truth.
// All editor state, AI patches, undo/redo and persistence flow through these types.

export type ID = string;

export type RGBA = string; // "#RRGGBB" or "rgba(...)"

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number; // degrees
}

export interface BlockBase extends Rect {
  id: ID;
  z: number;
  locked?: boolean;
  hidden?: boolean;
  opacity?: number; // 0..1
  name?: string;
}

export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: RGBA;
  fontSize?: number;
  fontFamily?: string;
  link?: string;
}

export interface TextBlock extends BlockBase {
  type: 'text';
  runs: TextRun[];
  align?: 'left' | 'center' | 'right' | 'justify';
  vAlign?: 'top' | 'middle' | 'bottom';
  lineHeight?: number;
  letterSpacing?: number;
  fontFamily?: string;
  fontSize?: number;
  color?: RGBA;
  background?: RGBA;
  padding?: number;
}

export type ShapeKind =
  | 'rectangle'
  | 'rounded-rectangle'
  | 'ellipse'
  | 'triangle'
  | 'line'
  | 'arrow'
  | 'star'
  | 'polygon'
  | 'pentagon'
  | 'hexagon'
  | 'octagon'
  | 'parallelogram'
  | 'trapezoid'
  | 'rhombus'
  | 'cloud'
  | 'heart'
  | 'callout'
  | 'speech-bubble'
  | 'cross'
  | 'chevron';

export interface ShapeBlock extends BlockBase {
  type: 'shape';
  shape: ShapeKind;
  fill?: RGBA;
  stroke?: RGBA;
  strokeWidth?: number;
  strokeDash?: 'solid' | 'dashed' | 'dotted';
  cornerRadius?: number;
  shadow?: ShadowSpec;
  gradient?: GradientSpec;
}

export interface ShadowSpec {
  color: RGBA;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface GradientSpec {
  type: 'linear' | 'radial';
  angle?: number; // for linear
  stops: { offset: number; color: RGBA }[];
}

export interface ImageBlock extends BlockBase {
  type: 'image';
  src: string; // data URL or asset ref "asset://<id>"
  alt?: string;
  fit?: 'cover' | 'contain' | 'fill';
  cornerRadius?: number;
  filter?: { brightness?: number; contrast?: number; saturate?: number; blur?: number };
}

export interface ChartBlock extends BlockBase {
  type: 'chart';
  chart: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
  series: { name: string; data: number[] }[];
  categories?: string[];
  options?: Record<string, unknown>;
}

export interface TableBlock extends BlockBase {
  type: 'table';
  rows: number;
  cols: number;
  cells: string[][]; // [row][col]
  headerRow?: boolean;
  headerCol?: boolean;
}

export interface CodeBlock extends BlockBase {
  type: 'code';
  language: string;
  code: string;
  theme?: 'light' | 'dark';
}

export interface IconBlock extends BlockBase {
  type: 'icon';
  iconName: string; // lucide name
  color?: RGBA;
  strokeWidth?: number;
}

export interface ListBlock extends BlockBase {
  type: 'list';
  ordered: boolean;
  items: { text: string; level: number }[];
  fontSize?: number;
  color?: RGBA;
  fontFamily?: string;
  lineHeight?: number;
  bulletColor?: RGBA;
}

export interface DividerBlock extends BlockBase {
  type: 'divider';
  color?: RGBA;
  thickness?: number;
  style?: 'solid' | 'dashed' | 'dotted';
}

export interface VideoBlock extends BlockBase {
  type: 'video';
  src: string;
  poster?: string;
  autoplay?: boolean;
  loop?: boolean;
  controls?: boolean;
  cornerRadius?: number;
}

export interface EmbedBlock extends BlockBase {
  type: 'embed';
  src: string;
  kind: 'iframe' | 'mermaid' | 'math' | 'html';
  fallback?: string;
  cornerRadius?: number;
}

export type AnchorEdge = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface ConnectorEndpoint {
  // Either an absolute deck-space point (free) or anchored to a sibling block.
  blockId?: ID;
  edge?: AnchorEdge;
  x: number;
  y: number;
}

export interface InkStroke {
  color: RGBA;
  width: number;
  // Local coordinates relative to the InkBlock's top-left (deck-space).
  points: { x: number; y: number; pressure?: number }[];
}

export interface InkBlock extends BlockBase {
  type: 'ink';
  strokes: InkStroke[];
}

export interface ConnectorBlock extends BlockBase {
  type: 'connector';
  kind: 'straight' | 'elbow' | 'curve';
  start: ConnectorEndpoint;
  end: ConnectorEndpoint;
  color?: RGBA;
  strokeWidth?: number;
  arrowStart?: boolean;
  arrowEnd?: boolean;
  strokeDash?: 'solid' | 'dashed' | 'dotted';
}

export type Block =
  | TextBlock
  | ShapeBlock
  | ImageBlock
  | ChartBlock
  | TableBlock
  | CodeBlock
  | IconBlock
  | ListBlock
  | DividerBlock
  | VideoBlock
  | EmbedBlock
  | ConnectorBlock
  | InkBlock;

export type BlockType = Block['type'];

export interface SlideTransition {
  type: 'none' | 'fade' | 'slide' | 'zoom';
  duration?: number;
}

export interface Slide {
  id: ID;
  layout?: string; // layout key, e.g. "cover", "two-column"
  background?: { color?: RGBA; image?: string; gradient?: GradientSpec };
  blocks: Block[];
  notes?: string;
  transition?: SlideTransition;
  hidden?: boolean;
  audio?: { src: string; mime: string; duration?: number; createdAt?: number };
}

export interface ThemeSpec {
  name: string;
  primaryColor: RGBA;
  accentColor: RGBA;
  backgroundColor: RGBA;
  textColor: RGBA;
  mutedColor: RGBA;
  fontFamilyHeading: string;
  fontFamilyBody: string;
  fontFamilyCode?: string;
  borderRadius?: number;
}

export interface DeckMeta {
  id: ID;
  title: string;
  author?: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  // Canvas size in pixels (16:9 @ 1920x1080 logical)
  width: number;
  height: number;
}

export interface Deck {
  meta: DeckMeta;
  theme: ThemeSpec;
  slides: Slide[];
}

export type SelectionRef =
  | { kind: 'slide'; slideId: ID }
  | { kind: 'block'; slideId: ID; blockId: ID };

export interface Selection {
  // Currently focused slide (always present unless deck empty).
  slideId: ID | null;
  // Selected block ids on the focused slide (multi-select).
  blockIds: ID[];
}
