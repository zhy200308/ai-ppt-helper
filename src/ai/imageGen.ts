// Image generation across providers. The active settings store decides
// the route. Returns a data URL (base64) or '' if unsupported.

import { useSettingsStore } from '../core/store/settings';

export async function generateImage(prompt: string, style?: string): Promise<string> {
  const { activeProvider, providers } = useSettingsStore.getState();
  const cfg = providers[activeProvider];
  if (!cfg?.apiKey) throw new Error('Active provider missing API key');
  const fullPrompt = buildTextFreePrompt(prompt, style);

  switch (cfg.protocol) {
    case 'openai':
      return imageGenOpenAI(cfg.baseUrl, cfg.apiKey, fullPrompt);
    case 'gemini':
      return imageGenGemini(cfg.baseUrl, cfg.apiKey, fullPrompt);
    case 'anthropic':
      // Anthropic has no native image gen; fall back to a text-free SVG card.
      return svgFallback();
    default:
      return '';
  }
}

function buildTextFreePrompt(prompt: string, style?: string): string {
  const parts = [prompt.trim()];
  if (style?.trim()) parts.push(`style: ${style.trim()}`);
  parts.push('Strict requirement: create a purely visual image with no text, no letters, no numbers, no readable words, no logos, no captions, no labels, no signage, no watermark, and no UI typography. Any needed wording will be added later as editable PowerPoint text.');
  return parts.filter(Boolean).join(' | ');
}

async function imageGenOpenAI(baseUrl: string, apiKey: string, prompt: string): Promise<string> {
  const url = baseUrl.replace(/\/+$/, '') + '/images/generations';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024', response_format: 'b64_json' }),
  });
  if (!res.ok) throw new Error(`OpenAI image: HTTP ${res.status}`);
  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (b64) return `data:image/png;base64,${b64}`;
  const url2 = data.data?.[0]?.url;
  if (url2) return url2;
  throw new Error('OpenAI image: no data returned');
}

async function imageGenGemini(baseUrl: string, apiKey: string, prompt: string): Promise<string> {
  const url = `${baseUrl.replace(/\/+$/, '')}/models/imagen-3.0-generate-002:generateImages?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: { text: prompt }, config: { numberOfImages: 1, aspectRatio: '16:9' } }),
  });
  if (!res.ok) throw new Error(`Gemini image: HTTP ${res.status}`);
  const data = await res.json();
  const b64 = data.generatedImages?.[0]?.image?.bytesBase64Encoded;
  if (b64) return `data:image/png;base64,${b64}`;
  throw new Error('Gemini image: no data returned');
}

function svgFallback(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="576" viewBox="0 0 1024 576">
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#4F46E5"/>
        <stop offset="0.55" stop-color="#06B6D4"/>
        <stop offset="1" stop-color="#F97316"/>
      </linearGradient>
      <radialGradient id="r" cx="50%" cy="45%" r="55%">
        <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.42"/>
        <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
      </radialGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="18"/></filter>
    </defs>
    <rect width="1024" height="576" fill="url(#g)"/>
    <circle cx="266" cy="172" r="164" fill="#FFFFFF" opacity="0.18" filter="url(#blur)"/>
    <circle cx="782" cy="380" r="218" fill="#0F172A" opacity="0.18" filter="url(#blur)"/>
    <path d="M96 408 C238 316 342 476 486 370 S736 204 928 286" fill="none" stroke="#FFFFFF" stroke-width="30" stroke-linecap="round" opacity="0.22"/>
    <path d="M108 432 C252 340 356 500 500 394 S750 228 940 310" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity="0.58"/>
    <rect x="640" y="96" width="184" height="184" rx="44" fill="#FFFFFF" opacity="0.16" transform="rotate(12 732 188)"/>
    <rect x="178" y="314" width="144" height="144" rx="36" fill="#FFFFFF" opacity="0.14" transform="rotate(-18 250 386)"/>
    <circle cx="512" cy="288" r="210" fill="url(#r)"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}
