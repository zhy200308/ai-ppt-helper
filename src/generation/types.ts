// Generation core — shared types for the layout engine.
//
// A LayoutTemplate is a pure function: given semantic content + theme,
// produce a list of Blocks arranged on the canvas. Templates compose
// from the same primitives the renderer uses (text/shape/image/list/etc.)
// so they are honest about runtime cost and exportable to PPTX.

import type { Block, ThemeSpec } from '../core/schema/types';

export interface SlideContent {
  layout: LayoutKey;
  title?: string;
  eyebrow?: string;          // small caps above the title
  subtitle?: string;
  body?: string;
  bullets?: string[];
  numbered?: boolean;        // bullets become 1./2./3.
  image?: { src: string; caption?: string; alt?: string };
  stats?: { label: string; value: string; sub?: string }[];
  comparison?: { left: { title: string; bullets: string[] }; right: { title: string; bullets: string[] } };
  timeline?: { ts: string; title: string; body?: string }[];
  quote?: { text: string; author?: string; role?: string };
  steps?: { title: string; body?: string }[];
  notes?: string;
}

export type LayoutKey =
  | 'cover-bold'        // primary stripe + huge title
  | 'cover-image'       // full-bleed image with overlay text
  | 'agenda'            // numbered agenda bullets
  | 'section-divider'   // section break with eyebrow + huge text
  | 'bullet'            // title + bullet list
  | 'two-column-text'   // title + two columns of bullets
  | 'image-left'        // image left, content right
  | 'image-right'       // mirror of image-left
  | 'kpi-trio'          // three stats / KPIs
  | 'comparison'        // left vs. right
  | 'timeline-h'        // horizontal milestones
  | 'steps-vertical'    // ordered steps
  | 'quote'             // pull quote with attribution
  | 'closing';          // thank-you / call-to-action

export interface LayoutContext {
  theme: ThemeSpec;
  width: number;
  height: number;
}

export interface LayoutTemplate {
  key: LayoutKey;
  name: string;
  // Best-fit content shape for AI hint.
  expects: ('title' | 'subtitle' | 'bullets' | 'image' | 'stats' | 'comparison' | 'timeline' | 'quote' | 'steps' | 'body')[];
  build(content: SlideContent, ctx: LayoutContext): Block[];
}

export const LAYOUT_KEYS: LayoutKey[] = [
  'cover-bold', 'cover-image', 'agenda', 'section-divider', 'bullet',
  'two-column-text', 'image-left', 'image-right', 'kpi-trio', 'comparison',
  'timeline-h', 'steps-vertical', 'quote', 'closing',
];
