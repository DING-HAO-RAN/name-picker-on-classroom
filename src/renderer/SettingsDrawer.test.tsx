import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImportResult, NamePickerApi } from '../shared/ipcTypes';
import type { DrawHistoryItem, RosterState, StudentRecord } from '../shared/types';
import { App } from './App';
import { HistoryPanel } from './components/HistoryPanel';
import { SettingsDrawer } from './components/SettingsDrawer';

const students: StudentRecord[] = [
  { id: '1', name: '林小雨', weight: 1, drawnThisRound: false },
  { id: '2', name: '周明', weight: 1, drawnThisRound: false },
  { id: '3', name: '林小雨', weight: 0.5, drawnThisRound: false },
];

const settings = {
  animationEnabled: false,
  animationDurationMs: 800,
  theme: 'light' as const,
};

function createHistoryItem(index: number): DrawHistoryItem {
  return {
    id: `history-${index}`,
    drawnAt: `2025-01-${String((index % 28) + 1).padStart(2, '0')}T08:00:00.000Z`,
    studentNames: [`学生${index}`],
  };
}

function createState(overrides: Partial<RosterState> = {}): RosterState {
  return {
    sourceName: '三年级一班.txt',
    students,
    history: [],
    settings,
    ...overrides,
  };
}

function installApi(overrides: Partial<NamePickerApi> = {}): NamePickerApi {
  const api: NamePickerApi = {
    importRoster: vi.fn<() => Promise<ImportResult>>().mockResolvedValue({
      sourceName: '导入名单.txt',
      students,
    }),
    loadState: vi.fn<() => Promise<RosterState | null>>().mockResolvedValue(createState()),
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

function DrawerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        打开设置
      </button>
      {open ? (
        <SettingsDrawer
          students={students}
          history={[]}
          onWeightChange={vi.fn()}
          onResetWeights={vi.fn()}
          onClearHistory={vi.fn()}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

afterEach(() => {
  Reflect.deleteProperty(window, 'namePicker');
  vi.restoreAllMocks();
});

describe('设置抽屉', () => {
  it('打开后把焦点放到关闭按钮，关闭后恢复触发按钮焦点', async () => {
    render(<DrawerHarness />);
    const trigger = screen.getByRole('button', { name: '打开设置' });
    trigger.focus();
    fireEvent.click(trigger);

    const closeButton = screen.getByRole('button', { name: '关闭设置' });
    await waitFor(() => expect(closeButton).toHaveFocus());

    fireEvent.click(closeButton);
    expect(trigger).toHaveFocus();
  });

  it('按 Escape 关闭设置并恢复触发按钮焦点', async () => {
    render(<DrawerHarness />);
    const trigger = screen.getByRole('button', { name: '打开设置' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: '设置' });
    await waitFor(() => expect(screen.getByRole('button', { name: '关闭设置' })).toHaveFocus());

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '设置' })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(dialog).not.toBeInTheDocument();
  });

  it('按 Tab 和 Shift+Tab 在设置对话内循环焦点', async () => {
    render(<DrawerHarness />);
    const trigger = screen.getByRole('button', { name: '打开设置' });
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: '设置' });
    await waitFor(() => expect(screen.getByRole('button', { name: '关闭设置' })).toHaveFocus());
    const focusableElements = Array.from(
      dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])'),
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    expect(firstElement).toBeDefined();
    expect(lastElement).toBeDefined();

    lastElement.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(firstElement).toHaveFocus();

    firstElement.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(lastElement).toHaveFocus();
  });

  it('显示清除确认框时把焦点移入取消按钮，并可完成取消和确认流程', async () => {
    const onClearHistory = vi.fn();
    render(
      <HistoryPanel history={[createHistoryItem(0)]} onClearHistory={onClearHistory} />,
    );

    const clearButton = screen.getByRole('button', { name: '清除历史记录' });
    clearButton.focus();
    fireEvent.click(clearButton);

    const confirmation = screen.getByRole('alertdialog', { name: '确认清除历史记录' });
    const cancelButton = within(confirmation).getByRole('button', { name: '取消' });
    await waitFor(() => expect(cancelButton).toHaveFocus());

    fireEvent.click(cancelButton);
    expect(screen.queryByRole('alertdialog', { name: '确认清除历史记录' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '清除历史记录' }));
    const secondConfirmation = screen.getByRole('alertdialog', { name: '确认清除历史记录' });
    const confirmButton = within(secondConfirmation).getByRole('button', { name: '确认清除历史记录' });
    await waitFor(() => expect(within(secondConfirmation).getByRole('button', { name: '取消' })).toHaveFocus());

    fireEvent.click(confirmButton);
    expect(onClearHistory).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog', { name: '确认清除历史记录' })).not.toBeInTheDocument();
  });

  it('支持按姓名搜索、提示同名并把权重 0 设为暂不参与', () => {
    const onWeightChange = vi.fn();
    render(
      <SettingsDrawer
        students={students}
        history={[]}
        onWeightChange={onWeightChange}
        onResetWeights={vi.fn()}
        onClearHistory={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('发现同名学生，请根据各行分别调整权重。')).toBeInTheDocument();
    const searchInput = screen.getByRole('searchbox', { name: '搜索学生姓名' });
    fireEvent.change(searchInput, { target: { value: '周' } });
    expect(screen.getByText('周明')).toBeInTheDocument();
    expect(screen.queryAllByRole('spinbutton', { name: '林小雨权重' })).toHaveLength(0);

    fireEvent.change(searchInput, { target: { value: '' } });
    const weightInputs = screen.getAllByRole('spinbutton', { name: '林小雨权重' });
    fireEvent.change(weightInputs[0], { target: { value: '0' } });

    expect(onWeightChange).toHaveBeenCalledWith('1', 0);
    expect(screen.getAllByText('暂不参与抽取')).toHaveLength(1);
  });

  it('非法权重显示中文提示且不调用保存回调', () => {
    const onWeightChange = vi.fn();
    render(
      <SettingsDrawer
        students={students}
        history={[]}
        onWeightChange={onWeightChange}
        onResetWeights={vi.fn()}
        onClearHistory={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const input = screen.getAllByRole('spinbutton', { name: '林小雨权重' })[0];
    fireEvent.change(input, { target: { value: '-1' } });

    expect(screen.getByText('权重必须是有限的非负数。')).toBeInTheDocument();
    expect(onWeightChange).not.toHaveBeenCalled();
  });

  it('点击恢复默认权重会通知父级', () => {
    const onResetWeights = vi.fn();
    render(
      <SettingsDrawer
        students={students}
        history={[]}
        onWeightChange={vi.fn()}
        onResetWeights={onResetWeights}
        onClearHistory={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '恢复默认权重' }));
    expect(onResetWeights).toHaveBeenCalledTimes(1);
  });

  it('恢复默认权重后 App 状态和保存快照中的权重都为 1', async () => {
    const loadedStudents = students.map((student, index) => ({
      ...student,
      weight: index + 0.25,
    }));
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(createState({ students: loadedStudents })),
    });
    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    const dialog = screen.getByRole('dialog', { name: '设置' });
    fireEvent.click(within(dialog).getByRole('button', { name: '恢复默认权重' }));

    expect(
      within(dialog)
        .getAllByRole('spinbutton')
        .map((input) => (input as HTMLInputElement).value),
    ).toEqual(['1', '1', '1']);
    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(1));
    const savedStudents = vi.mocked(api.saveState).mock.calls[0][0].students;
    expect(savedStudents.map((student) => student.weight)).toEqual([1, 1, 1]);
  });

  it('点击遮罩关闭抽屉', () => {
    const onClose = vi.fn();
    render(
      <SettingsDrawer
        students={students}
        history={[]}
        onWeightChange={vi.fn()}
        onResetWeights={vi.fn()}
        onClearHistory={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByTestId('settings-drawer-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('抽取历史', () => {
  it('只展示最近 50 条记录并在清除前二次确认', () => {
    const history = Array.from({ length: 51 }, (_, index) => createHistoryItem(index));
    const onClearHistory = vi.fn();
    render(<HistoryPanel history={history} onClearHistory={onClearHistory} />);

    expect(screen.getByText('学生0')).toBeInTheDocument();
    expect(screen.getByText('学生49')).toBeInTheDocument();
    expect(screen.queryByText('学生50')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '清除历史记录' }));
    expect(screen.getByText('确定清除全部历史记录？')).toBeInTheDocument();
    expect(onClearHistory).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '确认清除历史记录' }));
    expect(onClearHistory).toHaveBeenCalledTimes(1);
  });
});

describe('设置与 App 保存接线', () => {
  it('合法权重修改通过 App 保存状态', async () => {
    const api = installApi();
    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    const weightInput = within(screen.getByRole('dialog', { name: '设置' })).getAllByRole(
      'spinbutton',
      { name: '林小雨权重' },
    )[0];
    fireEvent.change(weightInput, { target: { value: '0' } });

    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.saveState).mock.calls[0][0].students[0].weight).toBe(0);
  });

  it('抽取会保存最多 50 条带时间、人数和姓名的历史', async () => {
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(createState({ history: [createHistoryItem(1)] })),
    });
    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '开始抽取' }));
    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(1));

    const savedState = vi.mocked(api.saveState).mock.calls[0][0];
    expect(savedState.history).toHaveLength(2);
    expect(savedState.history[0].studentNames).toHaveLength(1);
    expect(savedState.history[0].drawnAt).not.toHaveLength(0);
  });

  it('加载 51 条历史后立即保存最多 50 条，并保留后续设置保存', async () => {
    const history = Array.from({ length: 51 }, (_, index) => createHistoryItem(index));
    const loadedSettings = { ...settings, animationEnabled: true, animationDurationMs: 1200 };
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(createState({ history, settings: loadedSettings })),
    });
    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();

    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(1));
    const normalizedState = vi.mocked(api.saveState).mock.calls[0][0];
    expect(normalizedState.history).toEqual(history.slice(0, 50));
    expect(normalizedState.settings).toEqual(loadedSettings);

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    const dialog = screen.getByRole('dialog', { name: '设置' });
    expect(within(dialog).getByText('50 条')).toBeInTheDocument();
    expect(within(dialog).queryByText('学生50')).not.toBeInTheDocument();

    fireEvent.change(
      within(dialog).getAllByRole('spinbutton', { name: '林小雨权重' })[0],
      { target: { value: '0' } },
    );
    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(2));
    const settingState = vi.mocked(api.saveState).mock.calls[1][0];
    expect(settingState.history).toHaveLength(50);
    expect(settingState.students[0].weight).toBe(0);
  });

  it('清除历史需通过 App 保存而不是直接清除文件', async () => {
    const api = installApi({
      loadState: vi.fn().mockResolvedValue(createState({ history: [createHistoryItem(1)] })),
    });
    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    fireEvent.click(screen.getByRole('button', { name: '清除历史记录' }));
    fireEvent.click(screen.getByRole('button', { name: '确认清除历史记录' }));

    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.saveState).mock.calls[0][0].history).toEqual([]);
    expect(api.clearState).not.toHaveBeenCalled();
  });
});
