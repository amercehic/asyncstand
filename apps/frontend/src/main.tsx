import { createRoot } from 'react-dom/client';
import App from '@/App';
import '@/styles/globals.css';
import '@/styles/accessibility.css';

createRoot(document.getElementById('root')!).render(<App />);
