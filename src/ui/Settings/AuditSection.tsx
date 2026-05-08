import { Lock, ShieldCheck, Stamp, Copy } from 'lucide-react';
import { useAuditStore, makeShareToken } from '../../export/audit';
import { useDeckStore } from '../../core/store/deck';
import { useState } from 'react';

const HOURS = [
  { label: '1 小时', ms: 60 * 60 * 1000 },
  { label: '24 小时', ms: 24 * 60 * 60 * 1000 },
  { label: '7 天', ms: 7 * 24 * 60 * 60 * 1000 },
  { label: '30 天', ms: 30 * 24 * 60 * 60 * 1000 },
];

export function AuditSection() {
  const wm = useAuditStore((s) => s.watermark);
  const pwd = useAuditStore((s) => s.pdfPassword);
  const share = useAuditStore((s) => s.share);
  const setWatermark = useAuditStore((s) => s.setWatermark);
  const setPdfPassword = useAuditStore((s) => s.setPdfPassword);
  const setShare = useAuditStore((s) => s.setShare);
  const [token, setToken] = useState<string | null>(null);
  const deckId = useDeckStore((s) => s.deck.meta.id);

  const generateToken = async (ms: number) => {
    const expiresAt = Date.now() + ms;
    setShare({ enabled: true, expiresAt });
    setToken(await makeShareToken(deckId, expiresAt));
  };

  return (
    <section className="settings-content">
      <h3><ShieldCheck size={14}/> 导出审计</h3>

      <div className="provider-group-label">水印</div>
      <label className="toggle-label">
        启用水印
        <input type="checkbox" checked={wm.enabled} onChange={(e) => setWatermark({ enabled: e.target.checked })}/>
      </label>
      {wm.enabled && (
        <>
          <label className="field">
            <span className="field-label">水印文字</span>
            <input value={wm.text} onChange={(e) => setWatermark({ text: e.target.value })}/>
          </label>
          <div className="row">
            <label className="field">
              <span className="field-label">不透明度</span>
              <input type="number" step="0.05" min="0.05" max="0.9" value={wm.opacity} onChange={(e) => setWatermark({ opacity: parseFloat(e.target.value) })}/>
            </label>
            <label className="field">
              <span className="field-label">角度</span>
              <input type="number" value={wm.angle} onChange={(e) => setWatermark({ angle: parseInt(e.target.value, 10) || 0 })}/>
            </label>
          </div>
        </>
      )}

      <div className="provider-group-label" style={{ marginTop: 14 }}><Lock size={11}/> PDF 密码（提示）</div>
      <p className="hint">浏览器内 pdf-lib 暂不支持原生加密。设置后会在文档元数据写入提示，正式加密需经桌面 sidecar。</p>
      <label className="toggle-label">
        启用密码提示
        <input type="checkbox" checked={pwd.enabled} onChange={(e) => setPdfPassword({ enabled: e.target.checked })}/>
      </label>
      {pwd.enabled && (
        <label className="field">
          <span className="field-label">密码</span>
          <input type="password" value={pwd.password} onChange={(e) => setPdfPassword({ password: e.target.value })}/>
        </label>
      )}

      <div className="provider-group-label" style={{ marginTop: 14 }}><Stamp size={11}/> 分享过期 token</div>
      <p className="hint">生成带过期时间的分享 token；正式部署中由后端在校验时解码。</p>
      <div className="row">
        {HOURS.map((h) => (
          <button key={h.label} className="btn-sm" onClick={() => void generateToken(h.ms)}>
            {h.label}
          </button>
        ))}
      </div>
      {token && (
        <div className="row" style={{ marginTop: 8 }}>
          <code style={{
            fontSize: 12, padding: 8, background: 'var(--bg-soft)',
            borderRadius: 4, flex: 1, overflow: 'auto', wordBreak: 'break-all',
          }}>{token}</code>
          <button
            className="icon-btn"
            onClick={() => navigator.clipboard.writeText(token)}
            title="复制"
          >
            <Copy size={12}/>
          </button>
        </div>
      )}
      {share.enabled && share.expiresAt && (
        <p className="hint" style={{ marginTop: 6 }}>
          有效期至 {new Date(share.expiresAt).toLocaleString()}
        </p>
      )}
    </section>
  );
}
