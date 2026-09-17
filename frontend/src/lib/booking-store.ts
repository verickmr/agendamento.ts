import { create } from 'zustand';
type Selection = {
  date: string;
  time: string;
  setDate: (date: string) => void;
  setTime: (time: string) => void;
  clear: () => void;
};
export const useBookingSelection = create<Selection>((set) => ({
  date: '',
  time: '',
  setDate: (date) => set({ date, time: '' }),
  setTime: (time) => set({ time }),
  clear: () => set({ time: '' }),
}));
