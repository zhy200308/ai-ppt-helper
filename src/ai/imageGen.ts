// Image generation across providers. The active settings store decides
// the route. Returns a data URL (base64) or '' if unsupported.

import { useSettingsStore } from '../core/store/settings';

export async function generateImage(prompt: string, style?: string): Promise<string> {
  const { activeProvider, providers } = useSettingsStore.getState();
  const cfg = providers[activeProvider];
  if (!cfg?.apiKey) throw new Error('Active provider missing API key');
  const fullPrompt = style ? `${prompt} | style: ${style}` : prompt;

  switch (cfg.protocol) {
    case 'openai':
      return imageGenOpenAI(cfg.baseUrl, cfg.apiKey, fullPrompt);
    case 'gemini':
      return imageGenGemini(cfg.baseUrl, cfg.apiKey, fullPrompt);
    case 'anthropic':
      // Anthropic has no native image gen; fall back to a tiny SVG card.
      return svgFallback(fullPrompt);
    default:
      return '';
  }
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

function svgFallback(prompt: string): string {
  const safe = prompt.replace(/[<&>]/g, '').slice(0, 80);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="576">
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#4F46E5"/>
        <stop offset="1" stop-color="#06B6D4"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="50%" font-family="Inter, sans-serif" font-size="36" fill="white" text-anchor="middle" dominant-baseline="middle">${safe}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}
