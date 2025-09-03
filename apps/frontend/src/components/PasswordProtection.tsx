import { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';

interface PasswordProtectionProps {
  children: React.ReactNode;
}

const STORAGE_KEY = 'app_access_token';

export const PasswordProtection: React.FC<PasswordProtectionProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Check if already authenticated
  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY);
    if (token === import.meta.env.VITE_APP_PASSWORD) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check password against environment variable
    if (password === import.meta.env.VITE_APP_PASSWORD) {
      localStorage.setItem(STORAGE_KEY, password);
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Invalid password');
    }
  };

  // If no password is set, allow access
  if (!import.meta.env.VITE_APP_PASSWORD) {
    return <>{children}</>;
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md w-96">
        <div className="flex justify-center mb-6">
          <Lock className="h-12 w-12 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">
          Protected Application
        </h2>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            autoFocus
          />
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            className="mt-4 w-full bg-blue-600 dark:bg-blue-500 text-white py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition"
          >
            Access Application
          </button>
        </form>
      </div>
    </div>
  );
};
