/**
 * 胶囊状左右选择开关：替代方形对勾框，带滑块切换动画。
 * 内部仍保留 input[type=checkbox]（视觉隐藏），保证键盘操作与无障碍语义。
 */
export function PillSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  description,
  ariaLabel,
}: {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** 开关标题 */
  label: string;
  /** 开关下方的补充说明 */
  description?: string;
  /** 无障碍名称；缺省用 label */
  ariaLabel?: string;
}) {
  return (
    <label className={`pill-switch${checked ? ' pill-switch--on' : ''}${disabled ? ' pill-switch--disabled' : ''}`}>
      <input
        type="checkbox"
        className="visually-hidden"
        aria-label={ariaLabel ?? label}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
      />
      <span className="pill-switch__track" aria-hidden="true">
        <span className="pill-switch__thumb" />
      </span>
      <span className="pill-switch__text">
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
    </label>
  );
}
