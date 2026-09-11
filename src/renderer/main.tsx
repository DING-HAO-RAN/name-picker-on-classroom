import { createRoot } from 'react-dom/client';
import './styles.css';

export interface NamePickerApi {}

declare global {
  interface Window {
    namePicker: NamePickerApi;
  }
}

export function NamePickerApp() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="app-kicker">课堂工具</p>
        <h1>名字抽取器</h1>
      </header>
      <section className="roster-placeholder" aria-label="名单区域">
        <div>
          <h2>准备开始</h2>
          <p>名单为空，请导入名单后开始抽取。</p>
        </div>
      </section>
    </main>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<NamePickerApp />);
}
