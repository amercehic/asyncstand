import React from 'react';
import { Gate, MultiGate, ExperimentGate, DevGate, RoleGate } from '@/components/ui/Gate';
import { useFlag, useFlagsContext } from '@/contexts/FlagsProvider';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Example component showcasing different feature flag patterns
 */
export function FlaggedComponents() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold">Feature Flag Examples</h2>

      {/* Basic feature gate */}
      <section className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2">Basic Feature Gate</h3>
        <Gate flag="newUI">
          <div className="bg-blue-100 p-3 rounded">
            ✨ New UI is enabled! This appears immediately without flicker.
          </div>
        </Gate>

        <Gate flag="newUI" invert>
          <div className="bg-gray-100 p-3 rounded">📺 Classic UI mode (newUI is disabled)</div>
        </Gate>
      </section>

      {/* Multiple flags gate */}
      <section className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2">Multiple Flags Gate</h3>
        <MultiGate flags={['teams', 'integrations']} mode="and">
          <div className="bg-green-100 p-3 rounded">
            🎯 Both Teams AND Integrations are enabled!
          </div>
        </MultiGate>

        <MultiGate flags={['reports', 'analytics']} mode="or">
          <div className="bg-yellow-100 p-3 rounded">
            📊 Either Reports OR Analytics is enabled!
          </div>
        </MultiGate>
      </section>

      {/* A/B Experiment gate */}
      <section className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2">A/B Experiment</h3>
        <ExperimentGate
          experiment="betaBanner"
          treatment={
            <div className="bg-purple-100 p-3 rounded border-l-4 border-purple-500">
              🎉 Treatment: You're seeing the new beta banner design!
            </div>
          }
          control={
            <div className="bg-gray-100 p-3 rounded border-l-4 border-gray-500">
              📝 Control: Classic banner design
            </div>
          }
          debug={process.env.NODE_ENV === 'development'}
        />
      </section>

      {/* Role-based gate */}
      <section className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2">Role + Feature Gate</h3>
        <RoleGate
          roles={['owner', 'admin']}
          userRole={user?.role}
          flag="admin_panel"
          fallback={
            <div className="bg-red-100 p-3 rounded">
              ❌ Admin panel requires admin role + admin_panel feature
            </div>
          }
        >
          <div className="bg-green-100 p-3 rounded">👑 Admin Panel Access Granted!</div>
        </RoleGate>
      </section>

      {/* Development only */}
      <DevGate flag="debug_panel">
        <section className="border rounded-lg p-4 bg-yellow-50">
          <h3 className="text-lg font-semibold mb-2">Development Only</h3>
          <div className="bg-yellow-100 p-3 rounded">
            🔧 This only shows in development with debug_panel flag
          </div>
        </section>
      </DevGate>

      {/* Flags dashboard */}
      <section className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2">Flags Dashboard</h3>
        <FlagsDashboard />
      </section>

      {/* Component using hooks directly */}
      <section className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-2">Direct Hook Usage</h3>
        <DirectHookExample />
      </section>
    </div>
  );
}

/**
 * Component showing direct hook usage
 */
function DirectHookExample() {
  const isDarkMode = useFlag('dark_mode');
  const hasNotifications = useFlag('notifications');
  const isProUser = useFlag('pro_features');

  return (
    <div className={`p-3 rounded ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-black'}`}>
      <p>Dark mode: {isDarkMode ? '🌙 On' : '☀️ Off'}</p>
      <p>Notifications: {hasNotifications ? '🔔 Enabled' : '🔕 Disabled'}</p>
      <p>Pro features: {isProUser ? '💎 Active' : '👤 Basic'}</p>
    </div>
  );
}

/**
 * Debug dashboard showing all flags
 */
function FlagsDashboard() {
  const { flags, loading, error, lastUpdated, refetch, isSticky } = useFlagsContext();

  if (loading) {
    return <div className="animate-pulse">Loading flags...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-100 p-3 rounded text-red-700">
        Error: {error}
        <button onClick={() => refetch()} className="ml-2 px-2 py-1 bg-red-200 rounded text-sm">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500">
          Last updated: {lastUpdated?.toLocaleTimeString() || 'Never'}
        </span>
        <button
          onClick={() => refetch()}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        {Object.entries(flags).map(([key, value]) => (
          <div
            key={key}
            className={`p-2 rounded flex justify-between items-center ${
              value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            <span className="font-mono">{key}</span>
            <div className="flex items-center gap-2">
              {isSticky(key) && (
                <span className="text-xs bg-yellow-200 text-yellow-800 px-1 rounded">STICKY</span>
              )}
              <span className={value ? 'text-green-600' : 'text-red-600'}>{value ? '✓' : '✗'}</span>
            </div>
          </div>
        ))}
      </div>

      {Object.keys(flags).length === 0 && (
        <div className="text-gray-500 text-center py-4">No flags loaded</div>
      )}
    </div>
  );
}
