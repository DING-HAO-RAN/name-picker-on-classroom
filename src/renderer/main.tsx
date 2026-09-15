import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

export { App, App as NamePickerApp } from './App';

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
