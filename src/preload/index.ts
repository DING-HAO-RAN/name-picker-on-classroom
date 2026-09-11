import { contextBridge } from 'electron';

const namePicker = {};

contextBridge.exposeInMainWorld('namePicker', namePicker);
