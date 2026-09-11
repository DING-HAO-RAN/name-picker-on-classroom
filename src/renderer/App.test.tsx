import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ImportResult, NamePickerApi } from '../shared/ipcTypes';
import type { RosterState, StudentRecord } from '../shared/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const students: StudentRecord[] = [
  { id: '1', name: '林小雨', weight: 1, drawnThisRound: false },
  { id: '2', name: '周明', weight: 1, drawnThisRound: false },
  { id: '3', name: '陈果', weight: 1, drawnThisRound: false },
];

const savedSettings = {
  animationEnabled: true,
  animationDurationMs: 800,
  theme: 'light' as const,
};

function createState(overrides: Partial<RosterState> = {}): RosterState {
  return {
    sourceName: '三年级一班.txt',
    students,
    history: [],
    settings: savedSettings,
    ...overrides,
  };
}

function installApi(overrides: Partial<NamePickerApi> = {}): NamePickerApi {
  const api: NamePickerApi = {
    importRoster: vi.fn<() => Promise<ImportResult>>().mockResolvedValue({
      sourceName: '导入名单.txt',
      students,
    }),
    loadState: vi.fn<() => Promise<RosterState | null>>().mockResolvedValue(null),
    saveState: vi.fn<(state: RosterState) => Promise<void>>().mockResolvedValue(undefined),
    clearState: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    ...overrides,
  };

  Object.defineProperty(window, 'namePicker', {
    configurable: true,
    value: api,
  });
  return api;
}

describe('课堂主界面', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'namePicker');
    vi.restoreAllMocks();
  });

  it('显示空名单状态和导入入口，并禁用开始抽取', async () => {
    const api = installApi();

    render(<App />);

    expect(api.loadState).toHaveBeenCalledTimes(1);

    expect(await screen.findByRole('heading', { name: '名字抽取器' })).toBeInTheDocument();
    expect(screen.getByText('名单为空，请导入名单后开始抽取。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导入名单' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始抽取' })).toBeDisabled();
  });

  it('导入名单后显示人数并保存状态', async () => {
    const api = installApi();
    const importButton = () => screen.getByRole('button', { name: '导入名单' });

    render(<App />);
    expect(await screen.findByText('名单为空，请导入名单后开始抽取。')).toBeInTheDocument();
    fireEvent.click(importButton());

    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();
    expect(api.importRoster).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(1));
    expect(api.saveState).toHaveBeenCalledWith({
      sourceName: '导入名单.txt',
      students,
      history: [],
      settings: savedSettings,
    });
    expect(screen.getByRole('button', { name: '开始抽取' })).not.toBeDisabled();
  });

  it('支持抽取人数步进器和动画开关', async () => {
    installApi({ loadState: vi.fn().mockResolvedValue(createState()) });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();

    const countInput = await screen.findByRole('spinbutton', { name: '抽取人数' });
    expect(countInput).toHaveValue(1);
    expect(screen.getByRole('checkbox', { name: '显示抽取动画' })).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: '增加抽取人数' }));
    expect(countInput).toHaveValue(2);
    fireEvent.click(screen.getByRole('button', { name: '减少抽取人数' }));
    expect(countInput).toHaveValue(1);
    fireEvent.click(screen.getByRole('checkbox', { name: '显示抽取动画' }));
    expect(screen.getByRole('checkbox', { name: '显示抽取动画' })).not.toBeChecked();
  });

  it('关闭动画时立即展示结果，重置本轮也会保存', async () => {
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(
        createState({ settings: { ...savedSettings, animationEnabled: false } }),
      ),
    });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();
    const startButton = screen.getByRole('button', { name: '开始抽取' });
    fireEvent.click(startButton);

    expect(screen.getByRole('heading', { name: '本次抽取结果' })).toBeInTheDocument();
    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(1));
    const drawnState = vi.mocked(api.saveState).mock.calls[0][0];
    expect(drawnState.students.filter((student) => student.drawnThisRound)).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '重置本轮' }));
    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(2));
    const resetState = vi.mocked(api.saveState).mock.calls[1][0];
    expect(resetState.students.every((student) => !student.drawnThisRound)).toBe(true);
  });

  it('动画期间只展示已计算结果并阻止重复提交', async () => {
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(
        createState({
          settings: { ...savedSettings, animationEnabled: true, animationDurationMs: 100 },
        }),
      ),
    });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();
    vi.useFakeTimers();
    const startButton = screen.getByRole('button', { name: '开始抽取' });
    fireEvent.click(startButton);
    fireEvent.click(startButton);

    expect(api.saveState).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: '本次抽取结果' })).not.toBeInTheDocument();
    expect(startButton).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screen.getByRole('heading', { name: '本次抽取结果' })).toBeInTheDocument();
    expect(api.saveState).toHaveBeenCalledTimes(1);
  });

  it('错误提示只面向教师，不暴露技术细节', async () => {
    const api = installApi({
      importRoster: vi.fn().mockRejectedValue(new Error('C:\\\\secret\\\\stack trace')),
    });

    render(<App />);
    expect(await screen.findByText('名单为空，请导入名单后开始抽取。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '导入名单' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('导入名单失败，请重试。');
    expect(alert).not.toHaveTextContent('secret');
    expect(alert).not.toHaveTextContent('stack trace');
  });
});
