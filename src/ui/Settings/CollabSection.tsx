import { useState } from 'react';
import { Users, Loader2, X, Wifi } from 'lucide-react';

export function CollabSection() {
  const [url, setUrl] = useState('wss://demos.yjs.dev/ws');
  const [room, setRoom] = useState('ai-ppt-' + Math.random().toString(36).slice(2, 8));
  const [name, setName] = useState('Guest');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const { activateYjsCollab } = await import('../../integrations/yjsCollab');
      await activateYjsCollab({
        url,
        room,
        identity: {
          id: `u_${Math.random().toString(36).slice(2, 8)}`,
          name,
          color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'),
        },
      });
      setConnected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    const c = (globalThis as any).__COLLAB__;
    c?.disconnect?.();
    (globalThis as any).__COLLAB__ = null;
    setConnected(false);
  };

  return (
    <section className="settings-content">
      <h3><Users size={14}/> 协同编辑</h3>
      <p className="hint">
        通过 Y.js + WebSocket 实现多人实时编辑。指定房间 ID，几个人在同一个房间即可看到对方的光标 / 选择。
        本仓库不内置 WebSocket 服务，可使用公共测试节点（功能演示）或自建（正式环境）。
      </p>

      <label className="field">
        <span className="field-label">WebSocket URL</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="wss://your-yjs-server.com" disabled={connected}/>
      </label>
      <label className="field">
        <span className="field-label">房间 ID</span>
        <input value={room} onChange={(e) => setRoom(e.target.value)} disabled={connected}/>
      </label>
      <label className="field">
        <span className="field-label">显示名</span>
        <input value={name} onChange={(e) => setName(e.target.value)} disabled={connected}/>
      </label>

      {error && <div className="form-error">{error}</div>}

      <div className="row" style={{ marginTop: 8 }}>
        {!connected ? (
          <button className="btn-sm btn-primary" onClick={connect} disabled={busy}>
            {busy ? <Loader2 size={11} className="spin"/> : <Wifi size={11}/>}
            连接
          </button>
        ) : (
          <button className="btn-sm btn-danger" onClick={disconnect}>
            <X size={11}/> 断开
          </button>
        )}
      </div>
    </section>
  );
}
