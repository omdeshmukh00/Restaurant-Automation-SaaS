import React from 'react';
import { useSettingsStore } from '../../store/settings.store';

const ROLE_LABELS: Record<string, string> = {
  'restaurant-admin': 'Administrator',
  'restaurant-manager': 'Manager',
  admin: 'Administrator',
  manager: 'Manager',
};

function humanizeRole(role: string): string {
  if (ROLE_LABELS[role]) return ROLE_LABELS[role];
  return role
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function ProfileCard(): JSX.Element {
  const admin = useSettingsStore((s) => s.admin);
  const updateProfile = useSettingsStore((s) => s.updateProfile);

  const [formData, setFormData] = React.useState({
    name: admin.name,
    mobile: admin.mobile,
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setFormData({ name: admin.name, mobile: admin.mobile });
  }, [admin.name, admin.mobile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ name: formData.name, mobile: formData.mobile });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 transition-colors duration-200">
      <div className="flex items-center gap-4 mb-5">
        <div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center text-white text-xl font-semibold">
          {admin.name ? admin.name.charAt(0).toUpperCase() : 'A'}
        </div>
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">{admin.name || 'Admin'}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{humanizeRole(admin.role)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Full Name</label>
          <input
            type="text"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={formData.name}
            onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
            placeholder="Your name"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Email</label>
          <input
            type="email"
            disabled
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-sm cursor-not-allowed"
            value={admin.email}
            title="Email cannot be changed from here"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Phone</label>
          <input
            type="tel"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={formData.mobile}
            onChange={(e) => setFormData((f) => ({ ...f, mobile: e.target.value }))}
            placeholder="Phone number"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Role</label>
          <input
            type="text"
            disabled
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-sm cursor-not-allowed"
            value={humanizeRole(admin.role)}
          />
        </div>

        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
