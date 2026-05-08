import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  leftWidth: number;
  rightWidth: number;
  chatWidth: number;
  showChat: boolean;
  showLeft: boolean;
  showRight: boolean;
}

interface UIActions {
  setLeftWidth: (w: number) => void;
  setRightWidth: (w: number) => void;
  setChatWidth: (w: number) => void;
  toggleChat: () => void;
  toggleLeft: () => void;
  toggleRight: () => void;
}

export const useUIStore = create<UIState & UIActions>()(
  persist(
    (set) => ({
      leftWidth: 240,
      rightWidth: 280,
      chatWidth: 380,
      showChat: true,
      showLeft: true,
      showRight: true,
      setLeftWidth: (w) => set({ leftWidth: w }),
      setRightWidth: (w) => set({ rightWidth: w }),
      setChatWidth: (w) => set({ chatWidth: w }),
      toggleChat: () => set((s) => ({ showChat: !s.showChat })),
      toggleLeft: () => set((s) => ({ showLeft: !s.showLeft })),
      toggleRight: () => set((s) => ({ showRight: !s.showRight })),
    }),
    { name: 'ai-ppt-ui', version: 1 },
  ),
);
