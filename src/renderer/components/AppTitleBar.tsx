import { useEffect, useState } from 'react';
import type { WindowControlsApi } from '../../shared/ipcTypes';

/**
 * 读取自绘标题栏所需的窗口控制能力。
 * 非 Electron 宿主（普通浏览器、单元测试）没有该能力，返回 null，标题栏按钮保持禁用。
 */
function getWindowControls(): WindowControlsApi | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.namePicker?.windowControls ?? null;
}

/**
 * 自绘标题栏：配合主进程的 `frame: false` 使用，替换 Windows 原生标题栏。
 * 顶部区域整体可拖拽窗口，右侧按钮按应用主题配色自绘。
 */
export function AppTitleBar() {
  const [controls, setControls] = useState<WindowControlsApi | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const api = getWindowControls();
    if (!api) {
      return;
    }

    setControls(api);
    let active = true;
    void api.isMaximized().then(
      (maximized) => {
        if (active) {
          setIsMaximized(maximized);
        }
      },
      () => undefined,
    );
    // 订阅主进程推送，保证系统双击标题栏最大化后按钮图标同步
    const unsubscribe = api.onMaximizedChange((maximized) => setIsMaximized(maximized));

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <header className="app-titlebar">
      <div className="app-titlebar__brand">
        <span className="app-titlebar__mark" aria-hidden="true">
          🎲
        </span>
        <span className="app-titlebar__title">名字抽取器</span>
      </div>

      <div className="app-titlebar__actions">
        <button
          type="button"
          className="app-titlebar__button"
          aria-label="最小化窗口"
          title="最小化"
          disabled={!controls}
          onClick={() => void controls?.minimize()}
        >
          <svg className="app-titlebar__icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8h10" />
          </svg>
        </button>

        <button
          type="button"
          className="app-titlebar__button"
          aria-label={isMaximized ? '还原窗口' : '最大化窗口'}
          title={isMaximized ? '还原' : '最大化'}
          disabled={!controls}
          onClick={() => void controls?.toggleMaximize()}
        >
          {isMaximized ? (
            <svg className="app-titlebar__icon" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="5.5" y="2.5" width="8" height="8" rx="1.5" />
              <path d="M10.5 13.5H4A1.5 1.5 0 0 1 2.5 12V5.5" />
            </svg>
          ) : (
            <svg className="app-titlebar__icon" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="3" y="3" width="10" height="10" rx="1.5" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className="app-titlebar__button app-titlebar__button--close"
          aria-label="关闭窗口"
          title="关闭"
          disabled={!controls}
          onClick={() => void controls?.close()}
        >
          <svg className="app-titlebar__icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
    </header>
  );
}
