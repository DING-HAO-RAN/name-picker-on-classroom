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

function expandSection(name: '学生权重' | '最近抽取'): void {
  // 权重与历史默认折叠，需要先展开才能操作内部控件
  fireEvent.click(screen.getByRole('button', { name }));
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
    expandSection('最近抽取');

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

    expandSection('学生权重');
    expect(screen.getByText('发现同名学生，请根据各行分别调整权重。')).toBeInTheDocument();
    const searchInput = screen.getByRole('searchbox', { name: '搜索学生姓名' });
    fireEvent.change(searchInput, { target: { value: '周' } });
    expect(screen.getByText('周明')).toBeInTheDocument();
    expect(screen.queryAllByRole('textbox', { name: '林小雨权重' })).toHaveLength(0);

    fireEvent.change(searchInput, { target: { value: '' } });
    const weightInputs = screen.getAllByRole('textbox', { name: '林小雨权重' });
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

    expandSection('学生权重');
    const input = screen.getAllByRole('textbox', { name: '林小雨权重' })[0];
    fireEvent.change(input, { target: { value: '-1' } });

    expect(screen.getByText('权重格式无效：请输入非负数字，支持小数，例如 1.5。')).toBeInTheDocument();
    expect(onWeightChange).not.toHaveBeenCalled();
  });

  it('权重支持小数并提交数值', () => {
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

    expandSection('学生权重');
    const input = screen.getAllByRole('textbox', { name: '林小雨权重' })[0];
    fireEvent.change(input, { target: { value: '1.5' } });

    expect(onWeightChange).toHaveBeenCalledWith('1', 1.5);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // 负数和多个小数点都属于格式错误
    fireEvent.change(input, { target: { value: '1.2.3' } });
    expect(screen.getByRole('alert')).toHaveTextContent('权重格式无效');
    expect(onWeightChange).toHaveBeenCalledTimes(1);
  });

  it('权重与历史默认折叠，展开后才渲染内部内容', () => {
    render(
      <SettingsDrawer
        students={students}
        history={[createHistoryItem(0)]}
        onWeightChange={vi.fn()}
        onResetWeights={vi.fn()}
        onClearHistory={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const weightToggle = screen.getByRole('button', { name: '学生权重' });
    const historyToggle = screen.getByRole('button', { name: '最近抽取' });
    expect(weightToggle).toHaveAttribute('aria-expanded', 'false');
    expect(historyToggle).toHaveAttribute('aria-expanded', 'false');
    // 折叠时内部控件不渲染，避免焦点落到不可见元素上
    expect(screen.queryByRole('textbox', { name: '林小雨权重' })).not.toBeInTheDocument();
    expect(screen.queryByText('学生0')).not.toBeInTheDocument();
    // 数量徽标仍随标题可见
    expect(screen.getByText('3 人')).toBeInTheDocument();
    expect(screen.getByText('1 条')).toBeInTheDocument();

    fireEvent.click(weightToggle);
    expect(weightToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('textbox', { name: '林小雨权重' })).toHaveLength(2);

    fireEvent.click(historyToggle);
    expect(historyToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('学生0')).toBeInTheDocument();
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
    expandSection('学生权重');
    fireEvent.click(within(dialog).getByRole('button', { name: '恢复默认权重' }));

    expect(
      within(dialog)
        // 只取学生权重输入框：设置面板里还有「动画时长」等其他数字输入
        .getAllByRole('textbox', { name: /权重$/ })
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

  it('选择合法图片后读取为 dataURL 并上报背景变更', async () => {
    const onBackgroundImageChange = vi.fn();
    const { container } = render(
      <SettingsDrawer
        students={students}
        onWeightChange={vi.fn()}
        onResetWeights={vi.fn()}
        onClose={vi.fn()}
        onBackgroundImageChange={onBackgroundImageChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '选择背景图片' }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const pngFile = new File(['fake-png-bytes'], '背景.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [pngFile] } });

    await waitFor(() =>
      expect(onBackgroundImageChange).toHaveBeenCalledWith(
        expect.stringMatching(/^data:image\/png;base64,/),
      ),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('拒绝不支持的图片格式并给出提示', () => {
    const onBackgroundImageChange = vi.fn();
    const { container } = render(
      <SettingsDrawer
        students={students}
        onWeightChange={vi.fn()}
        onResetWeights={vi.fn()}
        onClose={vi.fn()}
        onBackgroundImageChange={onBackgroundImageChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '选择背景图片' }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['x'], '文档.pdf', { type: 'application/pdf' })] },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('暂不支持该格式');
    expect(onBackgroundImageChange).not.toHaveBeenCalled();
  });

  it('已有自定义背景时展示预览，恢复默认会清除背景', () => {
    const onBackgroundImageChange = vi.fn();
    render(
      <SettingsDrawer
        students={students}
        onWeightChange={vi.fn()}
        onResetWeights={vi.fn()}
        onClose={vi.fn()}
        backgroundImage="data:image/png;base64,iVBORw0KGgo="
        onBackgroundImageChange={onBackgroundImageChange}
      />,
    );

    expect(screen.getByAltText('当前背景图预览')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '更换背景图片' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '恢复默认背景' }));
    expect(onBackgroundImageChange).toHaveBeenCalledWith(null);
  });
});

describe('抽取历史', () => {
  it('只展示最近 50 条记录并在清除前二次确认', () => {
    const history = Array.from({ length: 51 }, (_, index) => createHistoryItem(index));
    const onClearHistory = vi.fn();
    render(<HistoryPanel history={history} onClearHistory={onClearHistory} />);
    expandSection('最近抽取');

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
  it('设置背景图后写入保存状态并应用到主界面', async () => {
    const api = installApi();
    const { container } = render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    const dialog = screen.getByRole('dialog', { name: '设置' });
    fireEvent.click(within(dialog).getByRole('button', { name: '选择背景图片' }));
    const fileInput = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['fake'], 'bg.png', { type: 'image/png' })] },
    });

    // 保存状态里带上 dataURL 背景，主界面挂上自定义背景类
    await waitFor(() => expect(api.saveState).toHaveBeenCalled());
    expect(vi.mocked(api.saveState).mock.calls.at(-1)?.[0].settings.backgroundImage).toMatch(
      /^data:image\/png;base64,/,
    );
    await waitFor(() =>
      expect(container.querySelector('.app-shell--custom-bg')).not.toBeNull(),
    );
  });

  it('合法权重修改通过 App 保存状态', async () => {
    const api = installApi();
    render(<App />);
    expect(await screen.findByText('共 3 名学生')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    expandSection('学生权重');
    const weightInput = within(screen.getByRole('dialog', { name: '设置' })).getAllByRole(
      'textbox',
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

    expandSection('学生权重');
    fireEvent.change(
      within(dialog).getAllByRole('textbox', { name: '林小雨权重' })[0],
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
    expandSection('最近抽取');
    fireEvent.click(screen.getByRole('button', { name: '清除历史记录' }));
    fireEvent.click(screen.getByRole('button', { name: '确认清除历史记录' }));

    await waitFor(() => expect(api.saveState).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.saveState).mock.calls[0][0].history).toEqual([]);
    expect(api.clearState).not.toHaveBeenCalled();
  });
});
