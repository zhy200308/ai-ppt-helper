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

export const ALL_TOOLS: ToolSpec[] = [
  TOOL_GENERATE_DECK,
  TOOL_ADD_SLIDE,
  TOOL_EDIT_BLOCK,
  TOOL_REWRITE_TEXT,
  TOOL_SET_THEME,
];
