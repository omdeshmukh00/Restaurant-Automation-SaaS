import React from 'react';
import { Plug, Check } from 'lucide-react';
import { useSettingsStore } from '../../store/settings.store';

export function IntegrationsCard(): JSX.Element {
  const { integrations, toggleIntegration } = useSettingsStore();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function handleToggle(id: string) {
    setBusy(id);
    try {
      await toggleIntegration(id);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 sm:p-6">
      <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-4">Integrations</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {integrations.map((item) => {
          const connected = item.status === 'Connected';
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 p-3"
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  connected
                    ? 'bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900'
                    : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                }`}
              >
                <Plug className={`w-5 h-5 ${connected ? 'text-purple-500' : 'text-gray-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{item.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.description}</p>
              </div>
              <span
                className={`text-xs font-semibold mr-1 ${
                  connected ? 'text-green-600 dark:text-green-400' : 'text-gray-400'
                }`}
              >
                {item.status}
              </span>
              <button
                type="button"
                onClick={() => handleToggle(item.id)}
                disabled={busy === item.id}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  connected ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-700'
                } disabled:opacity-60`}
                aria-label={connected ? `Disconnect ${item.name}` : `Connect ${item.name}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center transition-transform ${
                    connected ? 'translate-x-6' : 'translate-x-0'
                  }`}
                >
                  {connected && <Check className="w-3 h-3 text-purple-600" />}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
