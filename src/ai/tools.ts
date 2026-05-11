import type { ToolSpec } from './service';

// Tools the AI can invoke to mutate the deck. The orchestrator parses
// tool_use events and dispatches them to the deck store via patch ops.

export const TOOL_GENERATE_DECK: ToolSpec = {
  name: 'generate_deck',
  description: 'Generate a complete presentation deck from a prompt. Use when the user wants a brand new deck. Provide concise, structured slides with clear hierarchy.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Deck title' },
      theme_hint: { type: 'string', description: 'Optional style/theme hint' },
      slides: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            layout: { type: 'string', enum: ['cover', 'agenda', 'two-column', 'image-left', 'kpi', 'quote', 'closing', 'bullet'] },
            title: { type: 'string' },
            subtitle: { type: 'string' },
            bullets: { type: 'array', items: { type: 'string' } },
            body: { type: 'string' },
            notes: { type: 'string' },
          },
          required: ['layout', 'title'],
        },
      },
    },
    required: ['title', 'slides'],
  },
};

export const TOOL_ADD_SLIDE: ToolSpec = {
  name: 'add_slide',
  description: 'Add a new slide after a target index. Use when the user asks to extend the deck.',
  parameters: {
    type: 'object',
    properties: {
      after_index: { type: 'number', description: 'Insert after this slide index (0-based). -1 to append.' },
      layout: { type: 'string' },
      title: { type: 'string' },
      bullets: { type: 'array', items: { type: 'string' } },
      body: { type: 'string' },
    },
    required: ['title'],
  },
};

export const TOOL_EDIT_BLOCK: ToolSpec = {
  name: 'edit_block',
  description: 'Edit a specific block (text/shape/image) on a specific slide.',
  parameters: {
    type: 'object',
    properties: {
      slide_id: { type: 'string' },
      block_id: { type: 'string' },
      patch: {
        type: 'object',
        description: 'Partial fields to merge. e.g. { x, y, w, h, color, fill, text }',
      },
    },
    required: ['slide_id', 'block_id', 'patch'],
  },
};

export const TOOL_REWRITE_TEXT: ToolSpec = {
  name: 'rewrite_text',
  description: 'Rewrite a text block with a new tone/style/length while preserving meaning.',
  parameters: {
    type: 'object',
    properties: {
      slide_id: { type: 'string' },
      block_id: { type: 'string' },
      new_text: { type: 'string' },
    },
    required: ['slide_id', 'block_id', 'new_text'],
  },
};

export const TOOL_SET_THEME: ToolSpec = {
  name: 'set_theme',
  description: 'Apply or save a theme. Saves the theme and applies it to the deck.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      primaryColor: { type: 'string' },
      accentColor: { type: 'string' },
      backgroundColor: { type: 'string' },
      textColor: { type: 'string' },
      mutedColor: { type: 'string' },
      fontFamilyHeading: { type: 'string' },
      fontFamilyBody: { type: 'string' },
    },
    required: ['name', 'primaryColor', 'accentColor', 'backgroundColor', 'textColor'],
  },
};

const LAYOUT_ENUM = [
  'cover-bold', 'cover-image', 'agenda', 'section-divider', 'bullet',
  'two-column-text', 'image-left', 'image-right', 'kpi-trio', 'comparison',
  'timeline-h', 'steps-vertical', 'quote', 'closing',
];

export const TOOL_OUTLINE_DECK: ToolSpec = {
  name: 'outline_deck',
  description: 'Plan a deck as a sequence of slide titles + one-line goals (NO body content). The orchestrator immediately renders skeleton slides so the user sees structure within ~1s, then you call populate_slide for each.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      theme_hint: { type: 'string' },
      slides: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            layout: { type: 'string', enum: LAYOUT_ENUM },
            title: { type: 'string' },
            goal: { type: 'string', description: 'One-line description of what this slide must communicate' },
          },
          required: ['layout', 'title', 'goal'],
        },
      },
    },
    required: ['title', 'slides'],
  },
};

export const TOOL_POPULATE_SLIDE: ToolSpec = {
  name: 'populate_slide',
  description: 'Fill in the body of a single outlined slide. Provide ONLY the fields relevant to the slide layout (see SYSTEM PROMPT for the mapping).',
  parameters: {
    type: 'object',
    properties: {
      slide_id: { type: 'string' },
      eyebrow: { type: 'string' },
      subtitle: { type: 'string' },
      body: { type: 'string' },
      bullets: { type: 'array', items: { type: 'string' } },
      numbered: { type: 'boolean' },
      stats: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            value: { type: 'string' },
            sub: { type: 'string' },
          },
          required: ['label', 'value'],
        },
      },
      comparison: {
        type: 'object',
        properties: {
          left: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              bullets: { type: 'array', items: { type: 'string' } },
            },
            required: ['title', 'bullets'],
          },
          right: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              bullets: { type: 'array', items: { type: 'string' } },
            },
            required: ['title', 'bullets'],
          },
        },
        required: ['left', 'right'],
      },
      timeline: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            ts: { type: 'string' },
            title: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['ts', 'title'],
        },
      },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['title'],
        },
      },
      quote: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          author: { type: 'string' },
          role: { type: 'string' },
        },
        required: ['text'],
      },
      image: {
        type: 'object',
        properties: {
          src: { type: 'string', description: 'Data URL or asset URL; pair with generate_image first if you need a fresh asset.' },
          alt: { type: 'string' },
          caption: { type: 'string' },
        },
      },
      notes: { type: 'string', description: '演讲者备注（不出现在画布上）' },
    },
    required: ['slide_id'],
  },
};

export const TOOL_CREATE_DATA_TABLE: ToolSpec = {
  name: 'create_data_table',
  description: 'Create or replace a reusable data table in the deck. ANY time the user wants a chart or table populated with numeric data, you MUST call this first to record the source data, then create / edit the chart or table to reference this table by id. Do NOT inline numbers into chart series.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Stable id for this table (or omit to auto-generate). Reuse the id to replace.' },
      name: { type: 'string' },
      columns: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'machine-friendly column key (snake_case)' },
            label: { type: 'string', description: 'human-friendly column label' },
            type: { type: 'string', enum: ['string', 'number', 'date'] },
          },
          required: ['key', 'label', 'type'],
        },
      },
      rows: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: { type: ['string', 'number'] as any },
        },
        description: 'Array of row objects keyed by column.key',
      },
    },
    required: ['name', 'columns', 'rows'],
  },
};

export const TOOL_INSERT_CHART_FROM_TABLE: ToolSpec = {
  name: 'insert_chart_from_table',
  description: 'Insert a chart on a slide that PULLS its data from a previously created data table. Use this instead of hand-rolling chart series.',
  parameters: {
    type: 'object',
    properties: {
      slide_id: { type: 'string' },
      table_id: { type: 'string' },
      chart: { type: 'string', enum: ['bar', 'line', 'pie', 'area', 'scatter'] },
      x_column: { type: 'string', description: 'column key for x-axis labels' },
      y_columns: { type: 'array', items: { type: 'string' }, description: 'optional list of numeric column keys to plot; defaults to all numeric columns' },
      x: { type: 'number' }, y: { type: 'number' },
      w: { type: 'number' }, h: { type: 'number' },
    },
    required: ['slide_id', 'table_id', 'chart', 'x_column'],
  },
};

export const TOOL_INSERT_TABLE_FROM_TABLE: ToolSpec = {
  name: 'insert_table_from_table',
  description: 'Insert a table block on a slide whose cells are sourced from a deck-level data table. Use for tabular data presentation.',
  parameters: {
    type: 'object',
    properties: {
      slide_id: { type: 'string' },
      table_id: { type: 'string' },
      columns: { type: 'array', items: { type: 'string' }, description: 'optional column keys to display in order; defaults to all' },
      x: { type: 'number' }, y: { type: 'number' },
      w: { type: 'number' }, h: { type: 'number' },
    },
    required: ['slide_id', 'table_id'],
  },
};

export const TOOL_INSERT_DESIGN_ELEMENT: ToolSpec = {
  name: 'insert_design_element',
  description: 'Insert a precisely positioned design element on a slide: generated SVG image, icon, divider/line, or shape. Always include x/y/w/h and layer placement for fine-grained PPT composition.',
  parameters: {
    type: 'object',
    properties: {
      slide_id: { type: 'string' },
      kind: { type: 'string', enum: ['svg', 'icon', 'line', 'shape'] },
      x: { type: 'number' },
      y: { type: 'number' },
      w: { type: 'number' },
      h: { type: 'number' },
      layer: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['top', 'middle', 'bottom', 'above', 'below'] },
          targetBlockId: { type: 'string', description: 'Required when mode is above/below.' },
        },
      },
      svg_code: { type: 'string', description: 'Raw <svg>...</svg> markup for kind=svg. Keep scripts/events out.' },
      icon_name: { type: 'string', description: 'Lucide icon name for kind=icon.' },
      color: { type: 'string' },
      strokeWidth: { type: 'number' },
      style: { type: 'string', enum: ['solid', 'dashed', 'dotted'] },
      shape: { type: 'string', enum: ['rectangle', 'rounded-rectangle', 'ellipse', 'triangle', 'line', 'arrow', 'star', 'polygon', 'pentagon', 'hexagon', 'octagon', 'parallelogram', 'trapezoid', 'rhombus', 'cloud', 'heart', 'callout', 'speech-bubble', 'cross', 'chevron'] },
      fill: { type: 'string' },
      alt: { type: 'string' },
      opacity: { type: 'number' },
    },
    required: ['slide_id', 'kind', 'x', 'y', 'w', 'h'],
  },
};

export const TOOL_DERIVE_THEME: ToolSpec = {
  name: 'derive_theme',
  description: 'Generate a WCAG-AA compliant palette + heading/body font pair from a single primary color and a vibe description. Saves & applies the theme.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      primary: { type: 'string', description: 'Hex color, e.g. "#4F46E5"' },
      vibe: { type: 'string', description: 'tone description, e.g. "tech blue", "elegant publishing"' },
      mode: { type: 'string', enum: ['light', 'dark'], description: 'background mode' },
    },
    required: ['name', 'primary'],
  },
};

export const TOOL_GENERATE_IMAGE: ToolSpec = {
  name: 'generate_image',
  description: 'Generate an illustrative image and place it on the deck. Returns a data URL. Use sparingly for cover slides or featured visuals.',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string' },
      slide_id: { type: 'string' },
      x: { type: 'number' },
      y: { type: 'number' },
      w: { type: 'number' },
      h: { type: 'number' },
      style: { type: 'string', description: 'optional style hint, e.g. "minimalist", "isometric"' },
      layer: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['top', 'middle', 'bottom', 'above', 'below'] },
          targetBlockId: { type: 'string' },
        },
      },
      fit: { type: 'string', enum: ['cover', 'contain', 'fill'] },
      cornerRadius: { type: 'number' },
    },
    required: ['prompt', 'slide_id'],
  },
};

export const ALL_TOOLS: ToolSpec[] = [
  TOOL_OUTLINE_DECK,
  TOOL_POPULATE_SLIDE,
  TOOL_GENERATE_DECK,
  TOOL_ADD_SLIDE,
  TOOL_EDIT_BLOCK,
  TOOL_REWRITE_TEXT,
  TOOL_SET_THEME,
  TOOL_DERIVE_THEME,
  TOOL_GENERATE_IMAGE,
  TOOL_INSERT_DESIGN_ELEMENT,
  TOOL_CREATE_DATA_TABLE,
  TOOL_INSERT_CHART_FROM_TABLE,
  TOOL_INSERT_TABLE_FROM_TABLE,
];
