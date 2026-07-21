import React, { useMemo, useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { apiClient } from '../../../shared/services/apiClient';
import { Search, Users, Shield, Store, Smartphone, Mail, Clock, Download, ChevronDown, Award, Eye, FileSpreadsheet, FileText } from 'lucide-react';
import UserDetailModal, { UserItem } from '../components/Users/UserDetailModal';
import TablePagination from '../components/common/TablePagination';

interface LayoutContextType {
  darkMode: boolean;
}

const safeStr = (v?: any): string => (v !== null && v !== undefined ? String(v).toLowerCase() : '');

export function formatRoleLabel(role?: string, subRole?: string): string {
  if (!role) return 'Customer';
  const r = role.toUpperCase();
  if (r.includes('SUPER')) return 'Super Admin';
  if (r.includes('RESTAURANT_ADMIN') || r === 'ADMIN') return 'Restaurant Admin';
  if (r.includes('KITCHEN')) return subRole ? `Kitchen (${subRole})` : 'Kitchen Staff';
  if (r.includes('CLEANING')) return subRole ? `Cleaning (${subRole})` : 'Cleaning Staff';
  if (r.includes('STAFF') || r.includes('WAITER') || r.includes('CASHIER')) return subRole ? `Staff (${subRole})` : 'Operations Staff';
  if (r.includes('CUSTOMER')) return 'Customer';
  return role;
}

export function exportUsersAsCSV(users: UserItem[], filename = "users-directory.csv") {
  const headers = ["ID", "Name", "Email", "Mobile", "Role", "SubRole", "Status", "Restaurant", "Joined Date", "Last Active"];
  const rows = users.map((u) => [
    u.id, u.name, u.email, u.mobile, u.role, u.subRole ?? "", u.status, u.restaurantName, u.createdAt, u.lastActive
  ]);

  const csv = ['\uFEFF' + headers.join(','), ...rows.map((row) => row.map((v) => `"${v}"`).join(","))].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportUsersAsPDF(users: UserItem[]) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const dateStr = new Date().toLocaleString();
  const rowsHtml = users.map((u, idx) => `
    <tr style="${(u.role || '').toUpperCase().includes('SUPER') ? 'background:#fff7ed;font-weight:bold;' : ''}">
      <td>${idx + 1}</td>
      <td><strong>${u.name}</strong> ${(u.role || '').toUpperCase().includes('SUPER') ? '<span style="color:#ea580c;font-size:10px;">(SUPER ADMIN)</span>' : ''}</td>
      <td>${u.email}</td>
      <td>${u.mobile}</td>
      <td><strong>${formatRoleLabel(u.role, u.subRole)}</strong></td>
      <td>${u.restaurantName}</td>
      <td><span style="font-weight:bold;color:${(u.status || '').toUpperCase() === 'ACTIVE' ? '#059669' : '#dc2626'};">${u.status}</span></td>
      <td>${u.createdAt}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Platform Users Directory - ${dateStr}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #0f172a; }
          .header { border-bottom: 2px solid #ea580c; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          h1 { margin: 0; font-size: 24px; color: #ea580c; }
          .meta { font-size: 12px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th { background: #f8fafc; text-align: left; padding: 10px 12px; border-bottom: 2px solid #e2e8f0; font-weight: 700; color: #475569; }
          td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
          tr:nth-child(even) { background: #fafafa; }
          @media print {
            body { padding: 0; }
            @page { margin: 1.5cm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Platform Users Directory</h1>
            <div class="meta">Generated on ${dateStr} • Total Registered Users: ${users.length}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Mobile</th>
              <th>Role</th>
              <th>Restaurant / Scope</th>
              <th>Status</th>
              <th>Joined Date</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

export default function UsersPage() {
  const { darkMode } = useOutletContext<LayoutContextType>();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter]);

  useEffect(() => {
    let isMounted = true;
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get('/super-admin/users');
        const rawUsers = res.data?.data?.users || res.data?.users || [];

        if (isMounted && Array.isArray(rawUsers)) {
          setUsers(rawUsers);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("Failed to fetch platform users:", err);
      }
      if (isMounted) {
        setLoading(false);
      }
    };

    fetchUsers();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter users based on search term & role filter
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        safeStr(u.name).includes(q) ||
        safeStr(u.email).includes(q) ||
        safeStr(u.mobile).includes(q) ||
        safeStr(u.role).includes(q) ||
        safeStr(u.subRole).includes(q) ||
        safeStr(u.restaurantName).includes(q);

      const r = (u.role || '').toUpperCase();
      let matchesRole = true;

      if (roleFilter === 'Super Admin') {
        matchesRole = r.includes('SUPER');
      } else if (roleFilter === 'Restaurant Admin') {
        matchesRole = (r.includes('ADMIN') || r.includes('OWNER')) && !r.includes('SUPER');
      } else if (roleFilter === 'Staff & Operations') {
        matchesRole = r.includes('KITCHEN') || r.includes('STAFF') || r.includes('CLEANING') || r.includes('WAITER') || r.includes('CASHIER') || r.includes('COOK');
      } else if (roleFilter === 'Customers') {
        matchesRole = r.includes('CUSTOMER') || r.includes('USER') || !r;
      }

      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  // Ensure Super Admin user is ALWAYS the first element in filtered list!
  const sortedFilteredUsers = useMemo(() => {
    const superAdmins = filteredUsers.filter((u) => (u.role || '').toUpperCase().includes('SUPER'));
    const others = filteredUsers.filter((u) => !(u.role || '').toUpperCase().includes('SUPER'));
    return [...superAdmins, ...others];
  }, [filteredUsers]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedFilteredUsers.slice(start, start + pageSize);
  }, [sortedFilteredUsers, currentPage, pageSize]);

  const getRoleBadgeStyle = (role?: string) => {
    const r = (role || '').toUpperCase();
    if (r.includes('SUPER')) return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    if (r.includes('ADMIN')) return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    if (r.includes('KITCHEN') || r.includes('STAFF') || r.includes('WAITER') || r.includes('CASHIER')) return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    if (r.includes('CLEANING')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
  };

  return (
    <div
      style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
      className={`min-h-screen font-sans antialiased transition-colors duration-300 ${
        darkMode ? 'bg-slate-950 text-slate-50' : 'bg-slate-50 text-slate-900'
      }`}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">

        {/* 1 ── Page Header + Export Menu */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">User Directory</h1>
              <span className="bg-orange-500/10 text-orange-500 border border-orange-500/20 text-xs font-black px-2.5 py-1 rounded-full">
                {users.length} Users Total
              </span>
            </div>
            <p className={`text-xs sm:text-sm mt-1 font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Platform user accounts, superadmin credentials, restaurant staff, and customer records.
            </p>
          </div>

          {/* Export Dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all shadow-sm ${
                darkMode
                  ? 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700'
                  : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Download className="w-4 h-4 text-orange-500" />
              <span>Export Directory</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {exportDropdownOpen && (
              <div
                className={`absolute right-0 mt-1.5 w-44 rounded-xl border shadow-xl py-1 z-30 ${
                  darkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <button
                  onClick={() => {
                    setExportDropdownOpen(false);
                    exportUsersAsCSV(sortedFilteredUsers);
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition-colors flex items-center gap-2 ${
                    darkMode ? 'hover:bg-slate-800 text-emerald-400' : 'hover:bg-slate-50 text-emerald-600'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Download CSV (.csv)
                </button>
                <button
                  onClick={() => {
                    setExportDropdownOpen(false);
                    exportUsersAsPDF(sortedFilteredUsers);
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs font-semibold transition-colors flex items-center gap-2 ${
                    darkMode ? 'hover:bg-slate-800 text-blue-400' : 'hover:bg-slate-50 text-blue-600'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Download PDF (.pdf)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 2 ── Search & Filter Controls */}
        <div className={`p-4 rounded-2xl border space-y-4 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="relative">
            <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search user by name, email, mobile number, role, or restaurant..."
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-medium outline-none transition-all ${
                darkMode
                  ? 'bg-slate-950 border-slate-800 text-slate-100 focus:border-orange-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-orange-500'
              }`}
            />
          </div>

          {/* Role Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-800/40">
            <span className={`text-xs font-bold uppercase tracking-wider mr-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Category:</span>
            {['All', 'Super Admin', 'Restaurant Admin', 'Staff & Operations', 'Customers'].map((filter) => (
              <button
                key={filter}
                onClick={() => setRoleFilter(filter)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  roleFilter === filter
                    ? 'bg-orange-600 text-white shadow-md'
                    : darkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* 3 ── User Cards Grid */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-medium animate-pulse">
            Loading database user records...
          </div>
        ) : sortedFilteredUsers.length === 0 ? (
          <div className={`p-12 text-center rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}>
            <p className="font-semibold text-sm">No user accounts found matching your search query.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
              {paginatedUsers.map((user) => {
                const isSuperAdmin = (user.role || '').toUpperCase().includes('SUPER');

                return (
                  <div
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className={`group relative p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:scale-[1.01] hover:shadow-xl flex flex-col justify-between min-h-[235px] ${
                      isSuperAdmin
                        ? darkMode
                          ? 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/40 hover:border-amber-500 shadow-lg shadow-amber-500/10'
                          : 'bg-gradient-to-br from-amber-50/80 via-white to-white border-amber-300 hover:border-amber-500 shadow-lg shadow-amber-500/10'
                        : darkMode
                        ? 'bg-slate-900/90 border-slate-800 hover:border-orange-500/50 hover:bg-slate-900'
                        : 'bg-white border-slate-200/80 hover:border-orange-500/50 hover:bg-slate-50/50'
                    }`}
                  >
                    <div>
                      {/* Top Ribbon Badge */}
                      <div className="flex items-center justify-between gap-1.5 mb-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 max-w-[70%] truncate ${getRoleBadgeStyle(user.role)}`}>
                          {isSuperAdmin && <Award className="w-3 h-3 text-amber-500 shrink-0" />}
                          <span className="truncate">{formatRoleLabel(user.role, user.subRole)}</span>
                        </span>
                        
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black shrink-0 ${
                          (user.status || '').toUpperCase() === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-red-500/10 text-red-500'
                        }`}>
                          {user.status || 'Active'}
                        </span>
                      </div>

                      {/* Main User Card Info */}
                      <div className="space-y-2.5 mb-3">
                        {/* Avatar & Name */}
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSuperAdmin
                              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                              : darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {isSuperAdmin ? <Shield className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <h4 className={`text-xs sm:text-sm font-bold font-sans tracking-tight truncate ${darkMode ? 'text-slate-100' : 'text-slate-900'}`} style={{ fontFamily: 'Inter, sans-serif' }}>
                              {user.name || 'Unnamed User'}
                            </h4>
                            <span className={`text-[11px] font-medium font-sans block truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} style={{ fontFamily: 'Inter, sans-serif' }}>
                              {user.email || 'No Email Registered'}
                            </span>
                          </div>
                        </div>

                        {/* Mobile & Restaurant Row */}
                        <div className="space-y-1.5 pt-2.5 border-t border-slate-800/30 text-xs">
                          <div className="flex items-center gap-2 font-bold text-emerald-500">
                            <Smartphone className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{user.mobile || 'N/A'}</span>
                          </div>

                          <div className="flex items-center gap-2 text-slate-400">
                            <Store className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                            <span className={`font-semibold truncate text-[11px] ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              {user.restaurantName || 'Platform Level / System'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/40 text-[10px] mt-auto">
                      <div className="flex items-center gap-1 text-slate-500 font-medium truncate">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span className="truncate">Joined: {user.createdAt || 'N/A'}</span>
                      </div>
                      <span className="flex items-center gap-1 font-bold text-orange-500 group-hover:translate-x-0.5 transition-transform shrink-0">
                        <Eye className="w-3 h-3" />
                        View
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Bar */}
            <div className={`rounded-2xl border overflow-hidden mt-6 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <TablePagination
                currentPage={currentPage}
                pageSize={pageSize}
                totalItems={sortedFilteredUsers.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                darkMode={darkMode}
                itemLabel="users"
              />
            </div>
          </>
        )}

        {/* Modal display when card clicked */}
        <UserDetailModal
          user={selectedUser}
          darkMode={darkMode}
          onClose={() => setSelectedUser(null)}
        />
      </div>
    </div>
  );
}
