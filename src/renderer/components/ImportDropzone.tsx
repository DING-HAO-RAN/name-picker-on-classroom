export interface ImportDropzoneProps {
  onImport: () => void | Promise<void>;
  isImporting?: boolean;
  disabled?: boolean;
  hasRoster?: boolean;
  compact?: boolean;
}

export function ImportDropzone({
  onImport,
  isImporting = false,
  disabled = false,
  hasRoster = false,
  compact = false,
}: ImportDropzoneProps) {
  return (
    <section
      className={`import-dropzone${compact ? ' import-dropzone--compact' : ''}`}
      aria-label="名单导入"
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
      }}
    >
      <div>
        <p className="section-kicker">{hasRoster ? '名单管理' : '第一步'}</p>
        <h2>{hasRoster ? '更换课堂名单' : '准备开始'}</h2>
        <p>
          {hasRoster
            ? '选择新的名单文件，开始一个新的课堂抽取。'
            : '名单为空，请导入名单后开始抽取。'}
        </p>
        {!compact ? <small>支持 TXT、CSV 和 XLSX 文件，请点击下方按钮选择名单。</small> : null}
      </div>
      <button
        className="secondary-button import-button"
        type="button"
        disabled={disabled || isImporting}
        onClick={() => void onImport()}
      >
        {isImporting ? '正在导入…' : '导入名单'}
      </button>
    </section>
  );
}
