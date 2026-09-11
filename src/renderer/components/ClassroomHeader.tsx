export interface ClassroomHeaderProps {
  sourceName: string;
  studentCount: number;
  onOpenSettings?: () => void;
}

export function ClassroomHeader({ sourceName, studentCount, onOpenSettings }: ClassroomHeaderProps) {
  return (
    <header className="classroom-header">
      <div>
        <p className="app-kicker">课堂工具</p>
        <h1>名字抽取器</h1>
        <p className="app-description">让每一次课堂点名都公平、清晰、轻松。</p>
      </div>
      <div className="classroom-summary" aria-label="课堂名单概况">
        <p className="summary-count">共 {studentCount} 名学生</p>
        <p className="summary-source">{sourceName ? `当前名单：${sourceName}` : '尚未导入名单'}</p>
        {onOpenSettings ? (
          <button
            type="button"
            className="settings-trigger secondary-button"
            aria-label="打开设置"
            onClick={onOpenSettings}
          >
            设置
          </button>
        ) : null}
      </div>
    </header>
  );
}
