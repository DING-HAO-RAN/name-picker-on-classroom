import type { NamePickerApi } from '../shared/ipcTypes';

declare global {
  interface Window {
    readonly namePicker: NamePickerApi;
  }
}

export {};
