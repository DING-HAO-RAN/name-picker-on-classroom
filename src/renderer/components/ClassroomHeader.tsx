import { DEFAULT_BRANDING } from '../../shared/types';

export interface ClassroomHeaderProps {
  sourceName: string;
  studentCount: number;
  onOpenSettings?: () => void;
  settingsDisabled?: boolean;
  /** 主界面标题（品牌自定义）；缺省用默认文案 */
  appTitle?: string;
}

export function ClassroomHeader({
  sourceName,
  studentCount,
  onOpenSettings,
  settingsDisabled = false,
  appTitle,
}: ClassroomHeaderProps) {
  return (
    <header className="classroom-header">
      <div>
        <p className="app-kicker">课堂工具</p>
        <h1>{appTitle ?? DEFAULT_BRANDING.appTitle}</h1>
      </div>
      <div className="classroom-summary" aria-label="课堂名单概况">
        <p className="summary-count">共 {studentCount} 名学生</p>
        <p className="summary-source">{sourceName ? `当前名单：${sourceName}` : '尚未导入名单'}</p>
        {onOpenSettings ? (
          <button
            type="button"
            className="settings-trigger secondary-button"
            aria-label="打开设置"
            disabled={settingsDisabled}
            onClick={onOpenSettings}
          >
            设置
          </button>
        ) : null}
      </div>
    </header>
  );
}
