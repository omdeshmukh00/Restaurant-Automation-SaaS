export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  lastGenerated: string;
  frequency: string;
  icon: string;
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  { id: 'RPT-01', name: 'Daily Kitchen Summary', description: 'Orders processed, prep times, waste, and revenue summary', lastGenerated: 'Today, 6:00 AM', frequency: 'Daily', icon: '📊' },
  { id: 'RPT-02', name: 'Weekly Performance', description: 'Staff performance, station efficiency, and order trends', lastGenerated: 'Mon, Jun 9', frequency: 'Weekly', icon: '📈' },
  { id: 'RPT-03', name: 'Inventory Consumption', description: 'Stock usage, wastage, and reorder recommendations', lastGenerated: 'Yesterday', frequency: 'Daily', icon: '📦' },
  { id: 'RPT-04', name: 'Staff Shift Report', description: 'Individual chef output, punctuality, and ratings', lastGenerated: 'Today, 2:00 PM', frequency: 'Per Shift', icon: '👨‍🍳' },
  { id: 'RPT-05', name: 'Monthly Analytics', description: 'Comprehensive monthly KPIs, revenue breakdown, and forecasts', lastGenerated: 'Jun 1, 2024', frequency: 'Monthly', icon: '📋' },
  { id: 'RPT-06', name: 'Food Cost Analysis', description: 'Cost per dish, ingredient costs, and margin analysis', lastGenerated: 'Jun 8, 2024', frequency: 'Weekly', icon: '💰' },
];

export interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'general', title: 'General & Preferences', description: 'Kitchen name, timezone, theme and language preferences', icon: '⚙️' },
  { id: 'stations', title: 'Station Setup', description: 'Add, edit, or remove kitchen stations', icon: '🍳' },
  { id: 'notifications', title: 'Notifications', description: 'Alert preferences, sound, auto-dismiss settings', icon: '🔔' },
  { id: 'display', title: 'Display & KDS', description: 'Order card size, column layout, color coding', icon: '🖥️' },
  { id: 'auto-rules', title: 'Auto-Accept Rules', description: 'Auto-accept orders based on type or table', icon: '🤖' },
  { id: 'prep-times', title: 'Prep Time Defaults', description: 'Set default preparation times per dish category', icon: '⏱️' },
  { id: 'integrations', title: 'Integrations', description: 'POS sync, printer setup, delivery partners', icon: '🔗' },
  { id: 'team', title: 'Team & Access', description: 'Manage who can access the kitchen dashboard', icon: '👥' },
];

export const POPULAR_ITEMS = [
  { name: 'Margherita Pizza', count: 42, pct: 85 },
  { name: 'Caesar Salad', count: 28, pct: 60 },
  { name: 'Spaghetti Bolognese', count: 24, pct: 50 },
  { name: 'Garlic Bread', count: 35, pct: 70 },
  { name: 'Tiramisu', count: 18, pct: 40 },
];
