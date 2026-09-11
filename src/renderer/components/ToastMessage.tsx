export interface ToastMessageProps {
  message: string | null;
  onDismiss?: () => void;
}

export function ToastMessage({ message, onDismiss }: ToastMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="toast-message" role="alert" aria-live="assertive">
      <span>{message}</span>
      {onDismiss ? (
        <button type="button" className="toast-dismiss" aria-label="关闭提示" onClick={onDismiss}>
          知道了
        </button>
      ) : null}
    </div>
  );
}
