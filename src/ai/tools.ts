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
  description: 'Insert a precisely positioned editable design element on a slide. Prefer kind=shape, line, or icon for PPTX-editable output; use kind=svg only for complex illustrations that cannot be represented with native PowerPoint objects. Always include x/y/w/h and layer placement.',
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
      svg_code: { type: 'string', description: 'Raw <svg>...</svg> markup for kind=svg. SVG exports to PPTX as an image and is not PowerPoint-editable; keep scripts/events out.' },
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
  description: 'Generate a text-free illustrative image and place it on the deck. The image must not contain words, letters, numbers, logos, labels, captions, signage, watermarks, or UI text; all editable copy belongs in PPT text blocks. Use sparingly for cover slides or featured visuals.',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Describe only the visual scene/style. Do not ask the image model to render any text.' },
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

export const TOOL_DELETE_BLOCKS: ToolSpec = {
  name: 'delete_blocks',
  description: 'Delete one or more blocks from a slide. Use only when the target blocks are explicit in PPT context or after asking the user to choose.',
  parameters: {
    type: 'object',
    properties: {
      slide_id: { type: 'string' },
      block_ids: { type: 'array', items: { type: 'string' } },
      reason: { type: 'string' },
    },
    required: ['slide_id', 'block_ids'],
  },
};

export const TOOL_DELETE_SLIDE: ToolSpec = {
  name: 'delete_slide',
  description: 'Delete a slide. For destructive changes, ask_user_choice should be used first unless the user explicitly requested this exact deletion.',
  parameters: {
    type: 'object',
    properties: {
      slide_id: { type: 'string' },
      reason: { type: 'string' },
    },
    required: ['slide_id'],
  },
};

export const TOOL_MOVE_RESIZE_BLOCK: ToolSpec = {
  name: 'move_resize_block',
  description: 'Move or resize a specific block with typed geometry fields. Prefer this over edit_block for layout operations.',
  parameters: {
    type: 'object',
    properties: {
      slide_id: { type: 'string' },
      block_id: { type: 'string' },
      x: { type: 'number' },
      y: { type: 'number' },
      w: { type: 'number' },
      h: { type: 'number' },
      rotation: { type: 'number' },
    },
    required: ['slide_id', 'block_id'],
  },
};

export const TOOL_REORDER_BLOCK: ToolSpec = {
  name: 'reorder_block',
  description: 'Change a block layer order on a slide.',
  parameters: {
    type: 'object',
    properties: {
      slide_id: { type: 'string' },
      block_id: { type: 'string' },
      direction: { type: 'string', enum: ['up', 'down', 'top', 'bottom'] },
    },
    required: ['slide_id', 'block_id', 'direction'],
  },
};

export const TOOL_STYLE_BLOCK: ToolSpec = {
  name: 'style_block',
  description: 'Apply common style fields to a block. Prefer this over edit_block for color, typography, fill, stroke, opacity, and radius changes.',
  parameters: {
    type: 'object',
    properties: {
      slide_id: { type: 'string' },
      block_id: { type: 'string' },
      color: { type: 'string' },
      fill: { type: 'string' },
      stroke: { type: 'string' },
      strokeWidth: { type: 'number' },
      strokeDash: { type: 'string', enum: ['solid', 'dashed', 'dotted'] },
      fontSize: { type: 'number' },
      fontFamily: { type: 'string' },
      background: { type: 'string' },
      opacity: { type: 'number' },
      cornerRadius: { type: 'number' },
    },
    required: ['slide_id', 'block_id'],
  },
};

export const TOOL_ASK_USER_CHOICE: ToolSpec = {
  name: 'ask_user_choice',
  description: 'Ask the user to choose from structured options before continuing. Use for theme/color decisions, ambiguous component targets, destructive operations, or export strategy choices. Each option carries custom reply text that will be sent back to the AI.',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string' },
      detail: { type: 'string' },
      choices: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            description: { type: 'string' },
            reply: { type: 'string', description: 'The exact message to send back when this option is selected.' },
          },
          required: ['id', 'label', 'reply'],
        },
      },
      allow_custom: { type: 'boolean' },
    },
    required: ['question', 'choices'],
  },
};

export const TOOL_SET_SLIDE_BACKGROUND: ToolSpec = {
  name: 'set_slide_background',
  description: 'Set a slide background to a solid color, image, or gradient. Use for professional cover slides, section dividers, and brand-driven decks.',
  parameters: {
    type: 'object',
    properties: {
      slide_id: { type: 'string' },
      color: { type: 'string', description: 'Solid background color, e.g. #F8FAFC or rgba(...)' },
      image: { type: 'string', description: 'Optional data URL or image URL for full-slide background' },
      gradient: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['linear', 'radial'] },
          angle: { type: 'number' },
          stops: {
            type: 'array',
            items: {
              type: 'object',
              properties: { offset: { type: 'number' }, color: { type: 'string' } },
              required: ['offset', 'color'],
            },
          },
        },
      },
    },
    required: ['slide_id'],
  },
};

export const TOOL_SET_SLIDE_TRANSITION: ToolSpec = {
  name: 'set_slide_transition',
  description: 'Set a simple PowerPoint-compatible slide transition. Use sparingly for presentation polish.',
  parameters: {
    type: 'object',
    properties: {
      slide_id: { type: 'string' },
      type: { type: 'string', enum: ['none', 'fade', 'slide', 'zoom'] },
      duration: { type: 'number' },
    },
    required: ['slide_id', 'type'],
  },
};

export const TOOL_INSERT_CONNECTOR: ToolSpec = {
  name: 'insert_connector',
  description: 'Insert a connector line/arrow between two blocks or explicit deck-space points. Use for process flows, architecture diagrams, and relationships.',
  parameters: {
    type: 'object',
    properties: {
      slide_id: { type: 'string' },
      kind: { type: 'string', enum: ['straight', 'elbow', 'curve'] },
      from_block_id: { type: 'string' },
      to_block_id: { type: 'string' },
      start: { type: 'object', description: 'Optional endpoint {x,y,edge}' },
      end: { type: 'object', description: 'Optional endpoint {x,y,edge}' },
      color: { type: 'string' },
      strokeWidth: { type: 'number' },
      arrowStart: { type: 'boolean' },
      arrowEnd: { type: 'boolean' },
      strokeDash: { type: 'string', enum: ['solid', 'dashed', 'dotted'] },
    },
    required: ['slide_id'],
  },
};

export const TOOL_STYLE_CHART: ToolSpec = {
  name: 'style_chart',
  description: 'Style a chart block with title, legend, labels, and series colors. Use after insert_chart_from_table to make data slides presentation-grade.',
  parameters: {
    type: 'object',
    properties: {
      slide_id: { type: 'string' },
      block_id: { type: 'string' },
      title: { type: 'string' },
      subtitle: { type: 'string' },
      legend: { type: 'string', enum: ['show', 'hide', 'top', 'bottom', 'left', 'right'] },
      dataLabels: { type: 'boolean' },
      colors: { type: 'array', items: { type: 'string' } },
    },
    required: ['slide_id', 'block_id'],
  },
};

export const TOOL_STYLE_TABLE: ToolSpec = {
  name: 'style_table',
  description: 'Style a table block with header fill, zebra stripes, text alignment, and font size.',
  parameters: {
    type: 'object',
    properties: {
      slide_id: { type: 'string' },
      block_id: { type: 'string' },
      headerFill: { type: 'string' },
      zebraStripe: { type: 'boolean' },
      fontSize: { type: 'number' },
      align: { type: 'string', enum: ['left', 'center', 'right'] },
    },
    required: ['slide_id', 'block_id'],
  },
};

export const TOOL_DISTRIBUTE_BLOCKS: ToolSpec = {
  name: 'distribute_blocks',
  description: 'Align or evenly distribute multiple blocks. Use for precise professional layouts.',
  parameters: {
    type: 'object',
    properties: {
      slide_id: { type: 'string' },
      block_ids: { type: 'array', items: { type: 'string' } },
      mode: { type: 'string', enum: ['align-left', 'align-center', 'align-right', 'align-top', 'align-middle', 'align-bottom', 'distribute-horizontal', 'distribute-vertical', 'equal-width', 'equal-height'] },
    },
    required: ['slide_id', 'block_ids', 'mode'],
  },
};

export const TOOL_POLISH_SLIDE: ToolSpec = {
  name: 'polish_slide',
  description: 'Apply a conservative automatic visual polish pass to one slide: align to safe margins, balance spacing, improve backgrounds, and ensure readable hierarchy.',
  parameters: {
    type: 'object',
    properties: {
      slide_id: { type: 'string' },
      intensity: { type: 'string', enum: ['subtle', 'standard', 'bold'] },
    },
    required: ['slide_id'],
  },
};

export const TOOL_INSPECT_SLIDE_VISUAL: ToolSpec = {
  name: 'inspect_slide_visual',
  description: 'Render a slide preview and run static visual checks for text overflow, occlusion, and layout risks. Use before/after polish or critique tasks.',
  parameters: {
    type: 'object',
    properties: {
      slide_id: { type: 'string' },
      maxWidth: { type: 'number', description: 'Optional preview width in pixels, default 960.' },
    },
    required: ['slide_id'],
  },
};

export const ALL_TOOLS: ToolSpec[] = [
  TOOL_OUTLINE_DECK,
  TOOL_POPULATE_SLIDE,
  TOOL_GENERATE_DECK,
  TOOL_ADD_SLIDE,
  TOOL_EDIT_BLOCK,
  TOOL_REWRITE_TEXT,
  TOOL_DELETE_BLOCKS,
  TOOL_DELETE_SLIDE,
  TOOL_MOVE_RESIZE_BLOCK,
  TOOL_REORDER_BLOCK,
  TOOL_STYLE_BLOCK,
  TOOL_ASK_USER_CHOICE,
  TOOL_SET_THEME,
  TOOL_DERIVE_THEME,
  TOOL_GENERATE_IMAGE,
  TOOL_INSERT_DESIGN_ELEMENT,
  TOOL_CREATE_DATA_TABLE,
  TOOL_INSERT_CHART_FROM_TABLE,
  TOOL_INSERT_TABLE_FROM_TABLE,
  TOOL_SET_SLIDE_BACKGROUND,
  TOOL_SET_SLIDE_TRANSITION,
  TOOL_INSERT_CONNECTOR,
  TOOL_STYLE_CHART,
  TOOL_STYLE_TABLE,
  TOOL_DISTRIBUTE_BLOCKS,
  TOOL_POLISH_SLIDE,
  TOOL_INSPECT_SLIDE_VISUAL,
];
