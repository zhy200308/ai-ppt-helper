// Lightweight JSON Patch (RFC 6902 subset) used for undo/redo and AI-driven edits.
// Operations: replace, add, remove. Path uses '/' separators with array indices.

export type PatchOp =
  | { op: 'replace'; path: string; value: unknown; prev?: unknown }
  | { op: 'add'; path: string; value: unknown }
  | { op: 'remove'; path: string; prev?: unknown };

export type Patch = PatchOp[];

function parsePath(path: string): (string | number)[] {
  if (path === '' || path === '/') return [];
  if (!path.startsWith('/')) throw new Error(`Invalid patch path: ${path}`);
  return path
    .slice(1)
    .split('/')
    .map((seg) => seg.replace(/~1/g, '/').replace(/~0/g, '~'))
    .map((seg) => (/^\d+$/.test(seg) ? Number(seg) : seg));
}

function getParent(root: any, parts: (string | number)[]): { parent: any; key: string | number } {
  let node = root;
  for (let i = 0; i < parts.length - 1; i++) {
    node = node[parts[i]];
    if (node == null) throw new Error(`Patch path missing at ${parts.slice(0, i + 1).join('/')}`);
  }
  return { parent: node, key: parts[parts.length - 1] };
}

export function applyPatch<T>(state: T, patch: Patch): T {
  // Mutates input; we always pass an immer draft or a structured clone.
  for (const op of patch) {
    const parts = parsePath(op.path);
    if (parts.length === 0) {
      if (op.op === 'replace') return op.value as T;
      throw new Error('Cannot add/remove root');
    }
    const { parent, key } = getParent(state, parts);
    switch (op.op) {
      case 'replace':
        parent[key as any] = op.value;
        break;
      case 'add':
        if (Array.isArray(parent)) {
          if (key === '-') parent.push(op.value);
          else parent.splice(Number(key), 0, op.value);
        } else {
          parent[key as any] = op.value;
        }
        break;
      case 'remove':
        if (Array.isArray(parent)) parent.splice(Number(key), 1);
        else delete parent[key as any];
        break;
    }
  }
  return state;
}

export function invertPatch(patch: Patch, base: any): Patch {
  // Build inverse using `prev` snapshots captured at apply time, when available.
  const inverse: Patch = [];
  for (let i = patch.length - 1; i >= 0; i--) {
    const op = patch[i];
    const parts = parsePath(op.path);
    const { parent, key } = parts.length ? getParent(base, parts) : { parent: null, key: '' as any };
    switch (op.op) {
      case 'replace': {
        const prev = op.prev !== undefined ? op.prev : parent ? parent[key as any] : base;
        inverse.push({ op: 'replace', path: op.path, value: prev });
        break;
      }
      case 'add':
        inverse.push({ op: 'remove', path: op.path });
        break;
      case 'remove': {
        const prev = op.prev !== undefined ? op.prev : parent ? parent[key as any] : undefined;
        inverse.push({ op: 'add', path: op.path, value: prev });
        break;
      }
    }
  }
  return inverse;
}
