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

export const TOOL_OUTLINE_DECK: ToolSpec = {
  name: 'outline_deck',
  description: 'Plan a deck as a sequence of slide titles + one-line goals (NO body content). Use this as the FIRST step when the user asks for a brand new deck. The orchestrator will then populate each slide.',
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
            layout: { type: 'string', enum: ['cover', 'agenda', 'two-column', 'image-left', 'kpi', 'quote', 'closing', 'bullet'] },
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
  description: 'Fill in the body of a single slide that was previously outlined. Use AFTER outline_deck to produce slide bodies one by one.',
  parameters: {
    type: 'object',
    properties: {
      slide_id: { type: 'string' },
      subtitle: { type: 'string' },
      bullets: { type: 'array', items: { type: 'string' } },
      body: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['slide_id'],
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
];
