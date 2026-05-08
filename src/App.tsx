import { useState } from 'react';
import { Stage } from './canvas/Stage';
import { SlideList } from './ui/LeftPanel/SlideList';
import { RightPanel } from './ui/RightPanel/RightPanel';
import { TopBar } from './ui/TopBar/TopBar';
import { ChatPanel } from './ui/Chat/ChatPanel';
import { SettingsPanel } from './ui/Settings/SettingsPanel';
import { Presenter } from './ui/Presenter/Presenter';
import { Splitter } from './ui/components/Splitter';
import { useDeckStore } from './core/store/deck';
import { useGlobalHotkeys } from './core/events/hotkeys';
import { useAutosave } from './core/persistence/autosave';
import { useUIStore } from './core/store/ui';
import './styles/app.css';

export default function App() {
  useGlobalHotkeys();
  useAutosave();
  const [showSettings, setShowSettings] = useState(false);
  const presenting = useDeckStore((s) => s.presenting);
  const setPresenting = useDeckStore((s) => s.setPresenting);
  const showChat = useUIStore((s) => s.showChat);
  const setChatVisible = useUIStore((s) => s.toggleChat);
  const leftWidth = useUIStore((s) => s.leftWidth);
  const rightWidth = useUIStore((s) => s.rightWidth);
  const chatWidth = useUIStore((s) => s.chatWidth);
  const setLeftWidth = useUIStore((s) => s.setLeftWidth);
  const setRightWidth = useUIStore((s) => s.setRightWidth);
  const setChatWidth = useUIStore((s) => s.setChatWidth);

  return (
    <div className="app-shell">
      <TopBar
        onToggleSettings={() => setShowSettings(true)}
        onToggleChat={setChatVisible}
      />
      <div className="app-body resizable">
        <aside className="left-pane" style={{ width: leftWidth }}>
          <SlideList />
        </aside>
        <Splitter side="left" width={leftWidth} onChange={setLeftWidth} min={180} max={420} />
        <main className="center-pane">
          <Stage />
        </main>
        <Splitter side="right" width={rightWidth} onChange={setRightWidth} min={220} max={500} />
        <aside className="right-pane" style={{ width: rightWidth }}>
          <RightPanel />
        </aside>
        {showChat && (
          <>
            <Splitter side="right" width={chatWidth} onChange={setChatWidth} min={300} max={640} />
            <div style={{ width: chatWidth, display: 'flex', minHeight: 0 }}>
              <ChatPanel onClose={() => setChatVisible()} />
            </div>
          </>
        )}
      </div>
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
      {presenting && <Presenter onClose={() => setPresenting(false)} />}
    </div>
  );
}
