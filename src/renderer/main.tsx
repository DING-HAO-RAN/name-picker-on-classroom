import { createRoot } from 'react-dom/client';
import { App } from './App';
import { FloatingBall } from './components/FloatingBall';
import './styles.css';

export { App, App as NamePickerApp } from './App';

const rootElement = document.getElementById('root');
if (rootElement) {
  // 悬浮球窗口（?window=floating）只渲染悬浮球本体，不渲染主界面
  const isFloatingWindow =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('window') === 'floating';

  if (isFloatingWindow) {
    createRoot(rootElement).render(<FloatingBall />);
  } else {
    createRoot(rootElement).render(<App />);
  }
}
