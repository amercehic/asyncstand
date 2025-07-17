import React from 'react';
import ReactDOM from 'react-dom/client';
import { sharedHello } from '@asyncstand/shared';

sharedHello();

const App = () => (
  <div style={{ fontFamily: 'sans-serif', textAlign: 'center', marginTop: '2rem' }}>
    <h1>AsyncStand Frontend</h1>
    <p>Your React app is running!</p>
  </div>
);

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
