import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipcTypes';
import type { NamePickerApi } from '../shared/ipcTypes';
import type { RosterState } from '../shared/types';

const namePicker: NamePickerApi = Object.freeze({
  importRoster: () => ipcRenderer.invoke(IPC_CHANNELS.importRoster),
  loadState: () => ipcRenderer.invoke(IPC_CHANNELS.loadState),
  saveState: (state: RosterState) => ipcRenderer.invoke(IPC_CHANNELS.saveState, state),
  clearState: () => ipcRenderer.invoke(IPC_CHANNELS.clearState),
});

contextBridge.exposeInMainWorld('namePicker', namePicker);
