import { useState } from 'react';
import { Stage } from './canvas/Stage';
import { SlideList } from './ui/LeftPanel/SlideList';
import { RightPanel } from './ui/RightPanel/RightPanel';
import { TopBar } from './ui/TopBar/TopBar';
import { ChatPanel } from './ui/Chat/ChatPanel';
import { SettingsPanel } from './ui/Settings/SettingsPanel';
import { useGlobalHotkeys } from './core/events/hotkeys';
import { useAutosave } from './core/persistence/autosave';
import './styles/app.css';

export default function App() {
  useGlobalHotkeys();
  useAutosave();
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(true);

  return (
    <div className="app-shell">
      <TopBar
        onToggleSettings={() => setShowSettings(true)}
        onToggleChat={() => setShowChat((v) => !v)}
      />
      <div className="app-body">
        <aside className="left-pane">
          <SlideList />
        </aside>
        <main className="center-pane">
          <Stage />
        </main>
        <aside className="right-pane">
          <RightPanel />
        </aside>
        {showChat && <ChatPanel onClose={() => setShowChat(false)} />}
      </div>
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
