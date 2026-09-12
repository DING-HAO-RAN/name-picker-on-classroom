import '@testing-library/jest-dom/vitest';
import { act, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as drawEngine from '../shared/drawEngine';
import type { ImportResult, NamePickerApi, WindowControlsApi } from '../shared/ipcTypes';
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
  animationStyle: 'slot' as const,
  allowDuplicates: false,
  fullscreenDisplayMs: 3000,
  theme: 'light' as const,
  colorTheme: 'ink' as const,
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
  }
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
    const api = installApi({ loadState: vi.fn().mockResolvedValue(createState()) });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();

    // 人数输入已改为 text 型草稿态输入，角色是 textbox 而非 spinbutton
    const countInput = await screen.findByRole('textbox', { name: '抽取人数' });
    expect(countInput).toHaveValue('1');
    expect(screen.getByRole('checkbox', { name: '显示抽取动画' })).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: '增加抽取人数' }));
    expect(countInput).toHaveValue('2');
    fireEvent.click(screen.getByRole('button', { name: '减少抽取人数' }));
    expect(countInput).toHaveValue('1');
    fireEvent.click(screen.getByRole('checkbox', { name: '显示抽取动画' }));
    expect(screen.getByRole('checkbox', { name: '显示抽取动画' })).not.toBeChecked();
    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(1));
    await act(async () => {
      await flushPromises();
    });
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

  it('非动画抽取在保存完成前拒绝重复操作，完成后才允许继续', async () => {
    const pendingSaves: Array<{
      deferred: ReturnType<typeof createDeferred<void>>;
    }> = [];
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(
        createState({ settings: { ...savedSettings, animationEnabled: false } }),
      ),
      saveState: vi.fn(() => {
        const deferred = createDeferred<void>();
        pendingSaves.push({ deferred });
        return deferred.promise;
      }),
    });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();
    const startButton = screen.getByRole('button', { name: '开始抽取' });

    fireEvent.click(startButton);
    fireEvent.click(startButton);

    expect(api.saveState).toHaveBeenCalledTimes(1);
    expect(pendingSaves).toHaveLength(1);

    pendingSaves[0].deferred.resolve();
    await act(async () => {
      await pendingSaves[0].deferred.promise;
      await flushPromises();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(api.saveState).toHaveBeenCalledTimes(1);
    fireEvent.click(startButton);
    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(2));
  });

  it('重置本轮在保存完成前拒绝重复操作，完成后才允许继续', async () => {
    const pendingSaves: Array<{
      deferred: ReturnType<typeof createDeferred<void>>;
    }> = [];
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(
        createState({ settings: { ...savedSettings, animationEnabled: false } }),
      ),
      saveState: vi.fn(() => {
        const deferred = createDeferred<void>();
        pendingSaves.push({ deferred });
        return deferred.promise;
      }),
    });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();
    const resetButton = screen.getByRole('button', { name: '重置本轮' });

    fireEvent.click(resetButton);
    fireEvent.click(resetButton);

    expect(api.saveState).toHaveBeenCalledTimes(1);
    expect(pendingSaves).toHaveLength(1);

    pendingSaves[0].deferred.resolve();
    await act(async () => {
      await pendingSaves[0].deferred.promise;
      await flushPromises();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    expect(api.saveState).toHaveBeenCalledTimes(1);
    fireEvent.click(resetButton);
    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(2));
  });

  it('保存期间显示可观察状态并禁用会改变名单的控件', async () => {
    const saveDeferred = createDeferred<void>();
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(
        createState({ settings: { ...savedSettings, animationEnabled: false } }),
      ),
      saveState: vi.fn(() => saveDeferred.promise),
    });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();
    const startButton = screen.getByRole('button', { name: '开始抽取' });

    fireEvent.click(startButton);

    const saveStatus = screen.getByRole('status', { name: '名单保存状态' });
    await waitFor(() => expect(saveStatus).toHaveTextContent('正在保存…'));
    expect(startButton).toBeDisabled();
    expect(screen.getByRole('button', { name: '重置本轮' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: '显示抽取动画' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '打开设置' })).toBeDisabled();
    // 导入入口已移入设置抽屉；保存期间抽屉无法打开（见上两行断言）
    expect(screen.queryByRole('button', { name: '重新选取人员名单' })).not.toBeInTheDocument();

    saveDeferred.resolve();
    await waitFor(() => expect(saveStatus).toHaveTextContent('已保存'));
    expect(startButton).not.toBeDisabled();
  });

  it('动画结果展示但保存未完成时仍拒绝重复操作，二者完成后才允许继续', async () => {
    const pendingSaves: Array<{
      deferred: ReturnType<typeof createDeferred<void>>;
    }> = [];
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(
        createState({
          settings: { ...savedSettings, animationEnabled: true, animationDurationMs: 100 },
        }),
      ),
      saveState: vi.fn(() => {
        const deferred = createDeferred<void>();
        pendingSaves.push({ deferred });
        return deferred.promise;
      }),
    });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();
    vi.useFakeTimers();
    const startButton = screen.getByRole('button', { name: '开始抽取' });
    fireEvent.click(startButton);

    expect(api.saveState).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: '本次抽取结果' })).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screen.getByRole('heading', { name: '本次抽取结果' })).toBeInTheDocument();

    fireEvent.click(startButton);
    expect(api.saveState).toHaveBeenCalledTimes(1);

    pendingSaves[0].deferred.resolve();
    await act(async () => {
      await pendingSaves[0].deferred.promise;
      await flushPromises();
    });

    expect(api.saveState).toHaveBeenCalledTimes(1);
    fireEvent.click(startButton);
    await act(async () => {
      await flushPromises();
    });
    expect(api.saveState).toHaveBeenCalledTimes(2);
  });

  it('错误提示只面向教师，不暴露技术细节', async () => {
    const api = installApi({
      importRoster: vi.fn().mockRejectedValue(new Error('C:\\\\secret\\\\stack trace')),
    });

    render(<App />);
    const importButton = await screen.findByRole('button', { name: '导入名单' });
    fireEvent.click(importButton);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('导入名单失败，请重试。');
    expect(alert).not.toHaveTextContent('secret');
    expect(alert).not.toHaveTextContent('stack trace');
  });

  it('空名单切换动画只更新本地设置，不保存无效状态', async () => {
    const api = installApi();

    render(<App />);
    expect(await screen.findByText('名单为空，请导入名单后开始抽取。')).toBeInTheDocument();

    const animationToggle = screen.getByRole('checkbox', { name: '显示抽取动画' });
    fireEvent.click(animationToggle);

    expect(animationToggle).not.toBeChecked();
    expect(api.saveState).not.toHaveBeenCalled();
  });

  it('导入取消时显示取消提示而不是失败提示', async () => {
    const cancellation = Object.assign(new Error('用户取消'), { code: 'IMPORT_CANCELLED' });
    const api = installApi({ importRoster: vi.fn().mockRejectedValue(cancellation) });

    render(<App />);
    expect(await screen.findByText('名单为空，请导入名单后开始抽取。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '导入名单' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('已取消导入。');
    expect(alert).not.toHaveTextContent('导入名单失败');
    expect(api.saveState).not.toHaveBeenCalled();
  });

  it('阻止拖放默认行为且不调用导入', async () => {
    const api = installApi();

    render(<App />);
    expect(await screen.findByText('名单为空，请导入名单后开始抽取。')).toBeInTheDocument();

    expect(screen.queryByText(/拖/)).not.toBeInTheDocument();
    const importRegion = screen.getByRole('region', { name: '名单导入' });
    const dataTransfer = {
      files: [new File(['甲同学'], 'roster.txt', { type: 'text/plain' })],
    };
    const dragOverEvent = createEvent.dragOver(importRegion, { dataTransfer });
    const dropEvent = createEvent.drop(importRegion, { dataTransfer });
    const dragOverPreventDefault = vi.spyOn(dragOverEvent, 'preventDefault');
    const dropPreventDefault = vi.spyOn(dropEvent, 'preventDefault');

    fireEvent(importRegion, dragOverEvent);
    fireEvent(importRegion, dropEvent);

    expect(dragOverPreventDefault).toHaveBeenCalledTimes(1);
    expect(dropPreventDefault).toHaveBeenCalledTimes(1);
    expect(api.importRoster).not.toHaveBeenCalled();
  });

  it('加载失败时显示教师可读错误', async () => {
    const api = installApi({
      loadState: vi.fn().mockRejectedValue(new Error('C:\\\\private\\\\roster-state.json')),
    });

    render(<App />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('本地名单加载失败，请重试。');
    expect(alert).not.toHaveTextContent('private');
    expect(api.loadState).toHaveBeenCalledTimes(1);
  });

  it('只按未抽取且正权重候选计算上限，并允许全员已抽取后重置', async () => {
    const loadedStudents: StudentRecord[] = [
      { ...students[0], drawnThisRound: true },
      { ...students[1], weight: 0 },
      { ...students[2], drawnThisRound: false },
    ];
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(
        createState({ students: loadedStudents, settings: { ...savedSettings, animationEnabled: false } }),
      ),
    });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();
    expect(screen.getByText('最多可抽取 1 人')).toBeInTheDocument();
    expect(screen.getByText('暂不参与抽取')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '开始抽取' }));
    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: '重置本轮' })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '重置本轮' }));
    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(2));
    const resetState = vi.mocked(api.saveState).mock.calls[1][0];
    expect(resetState.students.every((student) => !student.drawnThisRound)).toBe(true);
  });

  it('抽取不足时展示实际抽取人数提示', async () => {
    const loadedState = createState({ settings: { ...savedSettings, animationEnabled: false } });
    const selectedStudent = { ...loadedState.students[0], drawnThisRound: true };
    vi.spyOn(drawEngine, 'drawStudents').mockReturnValueOnce({
      selected: [selectedStudent],
      updatedStudents: loadedState.students.map((student, index) =>
        index === 0 ? selectedStudent : student,
      ),
      shortage: true,
    });
    installApi({ loadState: vi.fn().mockResolvedValue(loadedState) });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '开始抽取' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('仅抽到 1 人');
    expect(screen.getByRole('heading', { name: '本次抽取结果' })).toBeInTheDocument();
  });

  it('动画前后保持同一批抽取学生', async () => {
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(
        createState({ settings: { ...savedSettings, animationEnabled: true, animationDurationMs: 100 } }),
      ),
    });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: '开始抽取' }));

    const drawnState = vi.mocked(api.saveState).mock.calls[0][0];
    const drawnStudents = drawnState.students.filter((student) => student.drawnThisRound);
    expect(drawnStudents).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: '本次抽取结果' })).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    const resultList = screen.getByRole('list', { name: '本次抽取的学生' });
    expect(within(resultList).getByText(drawnStudents[0].name)).toBeInTheDocument();
    expect(
      Array.from(resultList.querySelectorAll<HTMLElement>('.result-card')).map(
        (card) => card.dataset.studentId,
      ),
    ).toEqual(drawnStudents.map((student) => student.id));
  });

  it('抽取保存完成后才允许重置，并最终保留最新快照', async () => {
    const pendingSaves: Array<{
      state: RosterState;
      deferred: ReturnType<typeof createDeferred<void>>;
    }> = [];
    let persistedState: RosterState | null = null;
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(
        createState({ settings: { ...savedSettings, animationEnabled: false } }),
      ),
      saveState: vi.fn((state: RosterState) => {
        const deferred = createDeferred<void>();
        pendingSaves.push({ state, deferred });
        return deferred.promise.then(() => {
          persistedState = state;
        });
      }),
    });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '开始抽取' }));
    fireEvent.click(screen.getByRole('button', { name: '重置本轮' }));

    expect(api.saveState).toHaveBeenCalledTimes(1);
    expect(pendingSaves).toHaveLength(1);
    expect(pendingSaves[0].state.students.some((student) => student.drawnThisRound)).toBe(true);

    pendingSaves[0].deferred.resolve();
    await act(async () => {
      await pendingSaves[0].deferred.promise;
      await flushPromises();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    fireEvent.click(screen.getByRole('button', { name: '重置本轮' }));

    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(2));
    expect(pendingSaves[1].state.students.every((student) => !student.drawnThisRound)).toBe(true);

    pendingSaves[1].deferred.resolve();
    await waitFor(() => expect(persistedState).toEqual(pendingSaves[1].state));
  });

  it('保存失败后锁定写操作并可通过重试继续', async () => {
    const pendingSaves: Array<{
      deferred: ReturnType<typeof createDeferred<void>>;
    }> = [];
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(
        createState({ settings: { ...savedSettings, animationEnabled: false } }),
      ),
      saveState: vi.fn(() => {
        const deferred = createDeferred<void>();
        pendingSaves.push({ deferred });
        return deferred.promise;
      }),
    });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();
    const startButton = screen.getByRole('button', { name: '开始抽取' });
    const resetButton = screen.getByRole('button', { name: '重置本轮' });
    const animationToggle = screen.getByRole('checkbox', { name: '显示抽取动画' });
    fireEvent.click(startButton);

    expect(api.saveState).toHaveBeenCalledTimes(1);
    pendingSaves[0].deferred.reject(new Error('写入失败'));
    await act(async () => {
      await flushPromises();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });

    const saveStatus = screen.getByRole('status', { name: '名单保存状态' });
    expect(saveStatus).toHaveTextContent('尚未保存');
    expect(saveStatus).not.toHaveTextContent('已保存');
    expect(await screen.findByRole('alert')).toHaveTextContent('名单状态保存失败，请重试。');
    expect(startButton).toBeDisabled();
    expect(resetButton).toBeDisabled();
    expect(animationToggle).toBeDisabled();
    // 导入入口已移入设置抽屉；保存失败期间抽屉无法打开
    expect(screen.queryByRole('button', { name: '重新选取人员名单' })).not.toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: '重试保存' });
    expect(retryButton).toBeEnabled();
    fireEvent.click(retryButton);
    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(2));
    expect(saveStatus).toHaveTextContent('正在保存…');

    pendingSaves[1].deferred.resolve();
    await waitFor(() => expect(saveStatus).toHaveTextContent('已保存'));
    expect(startButton).toBeEnabled();

    fireEvent.click(resetButton);
    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(3));
    pendingSaves[2].deferred.resolve();
  });

  it('同一事件批次的快速抽取只执行一次', async () => {
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(
        createState({ settings: { ...savedSettings, animationEnabled: false } }),
      ),
    });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();
    const startButton = screen.getByRole('button', { name: '开始抽取' });

    act(() => {
      fireEvent.click(startButton);
      fireEvent.click(startButton);
    });

    expect(api.saveState).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(api.saveState).mock.calls[0][0].students.filter((student) => student.drawnThisRound),
    ).toHaveLength(1);
    await act(async () => {
      await flushPromises();
    });
  });

  it('同一事件批次的快速导入只调用一次导入 API', async () => {
    const importDeferred = createDeferred<ImportResult>();
    const api = installApi({ importRoster: vi.fn().mockReturnValue(importDeferred.promise) });

    render(<App />);
    const importButton = await screen.findByRole('button', { name: '导入名单' });

    act(() => {
      fireEvent.click(importButton);
      fireEvent.click(importButton);
    });

    expect(api.importRoster).toHaveBeenCalledTimes(1);
    importDeferred.resolve({ sourceName: '快速导入.txt', students });
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();
  });

  it('重新选取人员名单入口在设置抽屉里，导入成功后回到主界面', async () => {
    const api = installApi({
      importRoster: vi.fn<() => Promise<ImportResult>>().mockResolvedValue({
        sourceName: '新名单.txt',
        students: [students[0]],
      }),
      loadState: vi.fn().mockResolvedValue(createState()),
    });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();
    // 主界面控制栏不再提供导入入口
    expect(screen.queryByText('更换课堂名单')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    fireEvent.click(screen.getByRole('button', { name: '重新选取人员名单' }));

    await waitFor(() => expect(api.importRoster).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('共 1 名学生')).toBeInTheDocument();
    // 导入成功后设置抽屉自动关闭
    expect(screen.queryByRole('dialog', { name: '设置' })).not.toBeInTheDocument();
  });

  it('支持允许重复抽取选项，开启后已抽取学生仍可被再次抽取', async () => {
    // 3位学生全部处于已抽取状态
    const allDrawnStudents = students.map((s) => ({ ...s, drawnThisRound: true }));
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(
        createState({
          students: allDrawnStudents,
          settings: { ...savedSettings, animationEnabled: false, allowDuplicates: false },
        }),
      ),
    });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();

    const startButton = screen.getByRole('button', { name: '开始抽取' });
    // 未开启重复抽取时，可用人数为0，开始抽取被禁用
    expect(startButton).toBeDisabled();

    // 勾选“允许重复抽取”
    const allowDuplicatesCheckbox = screen.getByRole('checkbox', { name: '允许重复抽取' });
    expect(allowDuplicatesCheckbox).not.toBeChecked();
    fireEvent.click(allowDuplicatesCheckbox);
    expect(allowDuplicatesCheckbox).toBeChecked();

    // 开启后，等待状态保存完成，开始抽取按钮变为可用
    await waitFor(() => expect(startButton).not.toBeDisabled());
    fireEvent.click(startButton);

    // 触发成功抽取，全屏结果展示组件出现
    expect(await screen.findByRole('dialog', { name: '抽取结果全屏展示' })).toBeInTheDocument();
  });

  it('抽取结果显示在全部名单区域上方，且抽取后默认触发全屏展示', async () => {
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(
        createState({ settings: { ...savedSettings, animationEnabled: false } }),
      ),
    });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();

    const startButton = screen.getByRole('button', { name: '开始抽取' });
    fireEvent.click(startButton);

    // 全屏展示弹层出现，默认停留 3 秒
    const fullscreenDialog = await screen.findByRole('dialog', { name: '抽取结果全屏展示' });
    expect(fullscreenDialog).toBeInTheDocument();
    expect(
      within(fullscreenDialog).getByText('点击任意处或等待 3 秒自动关闭'),
    ).toBeInTheDocument();

    // 结果区域处于学生列表上方
    const resultHeading = screen.getByRole('heading', { name: '本次抽取结果' });
    const rosterHeading = screen.getByRole('heading', { name: '学生列表' });
    expect(resultHeading.compareDocumentPosition(rosterHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('主名单为重复姓名显示同名标记和无障碍提示', async () => {
    const duplicateStudents: StudentRecord[] = [
      students[0],
      { ...students[0], id: 'duplicate-1' },
      students[1],
    ];
    installApi({
      loadState: vi.fn().mockResolvedValue(createState({ students: duplicateStudents })),
    });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();

    expect(screen.getAllByLabelText('同名学生')).toHaveLength(2);
    expect(screen.getAllByText('同名')).toHaveLength(2);
  });

  it('加载并保存动画时长和主题，同时应用主题 class', async () => {
    const loadedSettings = {
      ...savedSettings,
      animationDurationMs: 1200,
      theme: 'dark' as const,
    };
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(createState({ settings: loadedSettings })),
    });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveClass('theme-dark');

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    const dialog = screen.getByRole('dialog', { name: '设置' });
    // 时长输入是 text 型草稿态输入，角色是 textbox，失焦后才提交
    const durationInput = within(dialog).getByRole('textbox', { name: '动画时长（毫秒）' });
    const themeSelect = within(dialog).getByRole('combobox', { name: '界面主题' });
    expect(durationInput).toHaveValue('1200');
    expect(themeSelect).toHaveValue('dark');

    fireEvent.change(durationInput, { target: { value: '1600' } });
    fireEvent.blur(durationInput);
    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.saveState).mock.calls[0][0].settings.animationDurationMs).toBe(1600);

    fireEvent.change(themeSelect, { target: { value: 'light' } });
    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('main')).toHaveClass('theme-light');
    expect(vi.mocked(api.saveState).mock.calls[1][0].settings.theme).toBe('light');
  });

  it('确认清除本机数据后清空课堂状态、恢复默认设置并关闭抽屉', async () => {
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(
        createState({ settings: { ...savedSettings, animationEnabled: false } }),
      ),
    });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '开始抽取' }));
    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    const dialog = screen.getByRole('dialog', { name: '设置' });
    fireEvent.click(within(dialog).getByRole('button', { name: '清除本机数据' }));

    const confirmation = screen.getByRole('alertdialog', { name: '确认清除本机数据' });
    const cancelButton = within(confirmation).getByRole('button', { name: '取消' });
    await waitFor(() => expect(cancelButton).toHaveFocus());
    fireEvent.click(within(confirmation).getByRole('button', { name: '确认清除本机数据' }));

    await waitFor(() => expect(api.clearState).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('名单为空，请导入名单后开始抽取。')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '本次抽取结果' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '显示抽取动画' })).toBeChecked();
    expect(screen.queryByRole('dialog', { name: '设置' })).not.toBeInTheDocument();
  });

  it('清除本机数据失败时保留名单并显示固定错误', async () => {
    const api = installApi({
      // 需要先载入一份已有名单，才能验证「清除失败后名单仍在」
      loadState: vi.fn().mockResolvedValue(createState()),
      clearState: vi.fn().mockRejectedValue(new Error('C:\\private\\state.json')),
    });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    const dialog = screen.getByRole('dialog', { name: '设置' });
    fireEvent.click(within(dialog).getByRole('button', { name: '清除本机数据' }));
    const confirmation = screen.getByRole('alertdialog', { name: '确认清除本机数据' });
    fireEvent.click(within(confirmation).getByRole('button', { name: '确认清除本机数据' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('清除本机数据失败，请重试。');
    expect(alert).not.toHaveTextContent('private');
    expect(screen.getByText('共 3 名学生')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: '设置' })).toBeInTheDocument();
  });

  it('Ctrl/Cmd+O 快捷键触发导入名单', async () => {
    const api = installApi();

    render(<App />);
    expect(await screen.findByText('名单为空，请导入名单后开始抽取。')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'o', ctrlKey: true });

    await waitFor(() => expect(api.importRoster).toHaveBeenCalledTimes(1));
  });

  it('快捷键可导入、抽取和重置，且不会抢占输入框', async () => {
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(
        createState({ settings: { ...savedSettings, animationEnabled: false } }),
      ),
    });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();
    const countInput = screen.getByRole('textbox', { name: '抽取人数' });

    fireEvent.keyDown(countInput, { key: ' ', code: 'Space' });
    fireEvent.keyDown(countInput, { key: 'r' });
    expect(api.saveState).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: ' ', code: 'Space' });
    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(1));
    // 等待保存状态落定（isSaving 归零）后再按 R，否则会命中「保存中忽略快捷键」的保护
    await act(async () => {
      await flushPromises();
    });
    fireEvent.keyDown(document, { key: 'r' });
    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(2));
  });

  it('抽屉打开或保存忙碌时快捷键不触发操作', async () => {
    const saveDeferred = createDeferred<void>();
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(
        createState({ settings: { ...savedSettings, animationEnabled: false } }),
      ),
      saveState: vi.fn(() => saveDeferred.promise),
    });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    fireEvent.keyDown(document, { key: ' ', code: 'Space' });
    fireEvent.keyDown(document, { key: 'r' });
    expect(api.saveState).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '关闭设置' }));
    fireEvent.click(screen.getByRole('button', { name: '开始抽取' }));
    expect(api.saveState).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: ' ', code: 'Space' });
    fireEvent.keyDown(document, { key: 'r' });
    fireEvent.keyDown(document, { key: 'o', ctrlKey: true });
    expect(api.saveState).toHaveBeenCalledTimes(1);
    expect(api.importRoster).not.toHaveBeenCalled();

    saveDeferred.resolve();
  });

  it('结果全屏停留时长默认 3 秒，并可在设置中修改后保存', async () => {
    const api = installApi();

    render(<App />);
    expect(await screen.findByText('名单为空，请导入名单后开始抽取。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '导入名单' }));
    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.saveState).mock.calls[0][0].settings.fullscreenDisplayMs).toBe(3000);

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    const dialog = screen.getByRole('dialog', { name: '设置' });
    // 时长输入是 text 型草稿态输入，角色是 textbox，失焦后才提交
    const durationInput = within(dialog).getByRole('textbox', {
      name: '结果全屏停留时长（毫秒）',
    });
    expect(durationInput).toHaveValue('3000');

    fireEvent.change(durationInput, { target: { value: '5000' } });
    fireEvent.blur(durationInput);
    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.saveState).mock.calls[1][0].settings.fullscreenDisplayMs).toBe(5000);
  });

  it('把历史存档里旧的内置停留时长迁移为默认 3 秒并回写', async () => {
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(
        createState({ settings: { ...savedSettings, fullscreenDisplayMs: 1000 } }),
      ),
    });

    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();

    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.saveState).mock.calls[0][0].settings.fullscreenDisplayMs).toBe(3000);
  });

  it('自绘标题栏转发窗口控制，并跟随最大化状态切换按钮', async () => {
    let maximizedListener: ((isMaximized: boolean) => void) | null = null;
    const windowControls: WindowControlsApi = {
      minimize: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      toggleMaximize: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      close: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      isMaximized: vi.fn<() => Promise<boolean>>().mockResolvedValue(false),
      onMaximizedChange: vi.fn((listener: (isMaximized: boolean) => void) => {
        maximizedListener = listener;
        return () => {
          maximizedListener = null;
        };
      }),
    };
    installApi({ windowControls });

    render(<App />);
    expect(await screen.findByRole('heading', { name: '名字抽取器' })).toBeInTheDocument();

    const minimizeButton = screen.getByRole('button', { name: '最小化窗口' });
    fireEvent.click(minimizeButton);
    expect(windowControls.minimize).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '最大化窗口' }));
    expect(windowControls.toggleMaximize).toHaveBeenCalledTimes(1);

    // 主进程推送最大化状态后，按钮切换为「还原窗口」
    act(() => {
      maximizedListener?.(true);
    });
    expect(screen.getByRole('button', { name: '还原窗口' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '最大化窗口' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '关闭窗口' }));
    expect(windowControls.close).toHaveBeenCalledTimes(1);
  });

  it('没有窗口控制能力时标题栏按钮保持禁用', async () => {
    installApi();

    render(<App />);
    expect(await screen.findByRole('heading', { name: '名字抽取器' })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: '最小化窗口' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '最大化窗口' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '关闭窗口' })).toBeDisabled();
  });
});
