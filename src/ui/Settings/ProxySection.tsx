import { useState } from 'react';
import { Loader2, Wifi } from 'lucide-react';
import { useSettingsStore } from '../../core/store/settings';
import { detectSystemProxy, parseProxyUrl } from '../../ai/service';

export function ProxySection() {
  const config = useSettingsStore((s) => s.proxyConfig);
  const onChange = useSettingsStore((s) => s.setProxyConfig);
  const [detecting, setDetecting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const detect = async () => {
    setDetecting(true);
    try {
      const r = await detectSystemProxy();
      if (r?.httpsProxy || r?.httpProxy) {
        const url = r.httpsProxy || r.httpProxy!;
        setInfo(url);
        const p = parseProxyUrl(url);
        onChange({ ...config, enabled: true, mode: p.mode, host: p.host, port: p.port });
      } else {
        setInfo('未检测到系统代理（或浏览器环境无 sidecar）');
      }
    } catch {
      setInfo('检测失败');
    } finally {
      setDetecting(false);
    }
  };

  return (
    <section className="settings-content">
      <h3>网络代理</h3>
      <p className="hint">浏览器环境下，代理由系统/浏览器统一管理；当通过桌面 sidecar 启动时，本地配置可覆盖系统行为。</p>

      <label className="toggle-label">
        启用代理
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
        />
      </label>

      {config.enabled && (
        <>
          <label className="field">
            <span className="field-label">代理模式</span>
            <select
              value={config.mode}
              onChange={(e) => onChange({ ...config, mode: e.target.value as any })}
            >
              <option value="system">系统代理</option>
              <option value="http">HTTP 代理</option>
              <option value="socks5">SOCKS5 代理</option>
              <option value="pac">PAC 脚本</option>
            </select>
          </label>

          {config.mode === 'system' && (
            <div className="row">
              <button className="btn-sm" onClick={detect} disabled={detecting}>
                {detecting ? <Loader2 size={11} className="spin"/> : <Wifi size={11}/>}
                检测系统代理
              </button>
              {info && <span className="hint">{info}</span>}
            </div>
          )}

          {(config.mode === 'http' || config.mode === 'socks5') && (
            <>
              <div className="row">
                <label className="field" style={{ flex: 1 }}>
                  <span className="field-label">地址</span>
                  <input value={config.host ?? ''} onChange={(e) => onChange({ ...config, host: e.target.value })} placeholder="127.0.0.1"/>
                </label>
                <label className="field" style={{ width: 120 }}>
                  <span className="field-label">端口</span>
                  <input
                    type="number"
                    value={config.port ?? (config.mode === 'http' ? 7890 : 1080)}
                    onChange={(e) => onChange({ ...config, port: parseInt(e.target.value, 10) })}
                  />
                </label>
              </div>
              <div className="row">
                <label className="field" style={{ flex: 1 }}>
                  <span className="field-label">用户名（可选）</span>
                  <input value={config.username ?? ''} onChange={(e) => onChange({ ...config, username: e.target.value })}/>
                </label>
                <label className="field" style={{ flex: 1 }}>
                  <span className="field-label">密码（可选）</span>
                  <input type="password" value={config.password ?? ''} onChange={(e) => onChange({ ...config, password: e.target.value })}/>
                </label>
              </div>
            </>
          )}

          {config.mode === 'pac' && (
            <label className="field">
              <span className="field-label">PAC URL</span>
              <input value={config.pacUrl ?? ''} onChange={(e) => onChange({ ...config, pacUrl: e.target.value })} placeholder="http://127.0.0.1:1080/proxy.pac"/>
            </label>
          )}
        </>
      )}
    </section>
  );
}
