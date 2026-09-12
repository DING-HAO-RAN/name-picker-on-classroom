/**
 * 悬浮球：主界面缩到后台时显示的置顶小圆钮。
 * - 单击：恢复主界面并隐藏悬浮球
 * - 右键：弹出系统菜单（打开主界面 / 退出程序）
 * - 整个小窗可拖动（-webkit-app-region: drag），球体本身不拦截拖拽
 */
export function FloatingBall() {
  function handleRestore(): void {
    void window.namePicker?.floatingControls?.control('restore');
  }

  function handleContextMenu(event: React.MouseEvent): void {
    event.preventDefault();
    void window.namePicker?.floatingControls?.control('menu');
  }

  return (
    <div className="floating-ball-layer" onContextMenu={handleContextMenu}>
      <button
        type="button"
        className="floating-ball"
        aria-label="恢复名字抽取器主界面"
        title="点击回到主界面 · 右键更多操作"
        onClick={handleRestore}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="floating-ball__icon">
          {/* 六面骰子造型：呼应应用图标 */}
          <rect x="4" y="4" width="16" height="16" rx="4" />
          <circle cx="9" cy="9" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="15" cy="15" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      </button>
    </div>
  );
}
