import { useRef } from 'react';

/** 指针按下时的拖动状态：用于区分「点击」与「拖动」并做 rAF 节流 */
interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  moveScheduled: boolean;
  /** 自上次上报以来累积的物理像素增量（rAF 节流期间持续累加） */
  pendingDx: number;
  pendingDy: number;
}

/** 拖动死区（像素）：移动超过该距离才视为拖动，避免触控轻微抖动误触发 */
const DRAG_THRESHOLD_PX = 4;

/** 悬浮球可请求的操作（与 preload 暴露的能力保持一致） */
type FloatingAction = 'restore' | 'menu' | 'quit' | 'drag-start' | 'drag-move' | 'drag-end';

/**
 * 悬浮球：主界面缩到后台时显示的置顶圆形图标。
 * - 整个圆形区域（64x64）任何位置都可点击与拖动，无额外边框或拖动区
 * - 单击：恢复主界面；拖动：移动位置；右键：系统菜单（打开主界面 / 退出）
 * - 拖动按「增量」上报：每次移动报出指针自上一次以来的物理像素位移（screenX 差），
 *   主进程按 devicePixelRatio 换算 DIP 后移动窗口——鼠标与触控统一，不依赖系统光标
 */
export function FloatingBall() {
  const dragRef = useRef<DragState | null>(null);

  function control(
    action: FloatingAction,
    payload?: { dpr?: number; dx?: number; dy?: number },
  ): void {
    void window.namePicker?.floatingControls?.control(action, payload);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    if (dragRef.current) {
      return;
    }
    // 捕获指针：移出窗口也能持续收到 move/up 事件
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.screenX,
      lastY: event.screenY,
      moved: false,
      moveScheduled: false,
      pendingDx: 0,
      pendingDy: 0,
    };
    control('drag-start', { dpr: window.devicePixelRatio || 1 });
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    const state = dragRef.current;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }

    // 死区判定用窗口内相对位移（clientX/Y），无需换算屏幕坐标系
    if (!state.moved) {
      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
        // 未超死区也要同步参考点，避免首次上报把之前的微小位移一次性带上
        state.lastX = event.screenX;
        state.lastY = event.screenY;
        return;
      }
      state.moved = true;
    }

    // 累积物理像素增量（screenX 差值即指针在屏幕上的实际位移）
    state.pendingDx += event.screenX - state.lastX;
    state.pendingDy += event.screenY - state.lastY;
    state.lastX = event.screenX;
    state.lastY = event.screenY;

    // rAF 节流：一帧最多发一次拖动信号，发送时携带累积增量
    if (!state.moveScheduled) {
      state.moveScheduled = true;
      requestAnimationFrame(() => {
        if (dragRef.current === state) {
          state.moveScheduled = false;
          const dx = state.pendingDx;
          const dy = state.pendingDy;
          state.pendingDx = 0;
          state.pendingDy = 0;
          if (dx !== 0 || dy !== 0) {
            control('drag-move', { dx, dy });
          }
        }
      });
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>): void {
    const state = dragRef.current;
    dragRef.current = null;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }
    // 没有超出死区 = 一次点击，恢复主界面；否则结束拖动
    if (!state.moved) {
      control('restore');
    } else {
      control('drag-end');
    }
  }

  function handleContextMenu(event: React.MouseEvent<HTMLDivElement>): void {
    event.preventDefault();
    control('menu');
  }

  return (
    <div
      className="floating-ball"
      role="button"
      aria-label="恢复名字抽取器主界面"
      title="点击回到主界面 · 拖动移动 · 右键更多操作"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        dragRef.current = null;
        control('drag-end');
      }}
      onContextMenu={handleContextMenu}
    >
      {/* 复刻应用图标的矢量版本：外圆环 + 内弧环 + 人像 + 双星，颜色跟随品牌蓝 */}
      <svg className="floating-ball__icon" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="27.5" fill="none" stroke="currentColor" strokeWidth="4" />
        <path
          d="M 36.1 16.5 A 16 16 0 1 1 18.1 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="32" cy="26.5" r="7" fill="currentColor" />
        <path d="M 20.5 43 A 11.5 11.5 0 0 1 43.5 43 Z" fill="currentColor" />
        <path
          d="M 47 11.5 Q 48.6 16.4 53.5 18 Q 48.6 19.6 47 24.5 Q 45.4 19.6 40.5 18 Q 45.4 16.4 47 11.5 Z"
          fill="currentColor"
        />
        <path
          d="M 17.5 40 Q 18.9 44.1 23 45.5 Q 18.9 46.9 17.5 51 Q 16.1 46.9 12 45.5 Q 16.1 44.1 17.5 40 Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}
