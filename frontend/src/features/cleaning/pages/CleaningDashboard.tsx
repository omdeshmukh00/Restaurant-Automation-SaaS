import React, { useState, useEffect, useRef } from 'react';
import { useCleaning } from '../hooks/usecleaning';
import { useNotifications } from '../hooks/useNotifications';
import { useCleaningSearch } from '../components/dashboard/CleaningSearchContext';
import { cleaningStore, CleaningRequest, CleaningStaffMember } from '../store/cleaning.store';
import { useToast } from '../components/dashboard/Toast';
import { useTranslation } from '../hooks/useTranslation';

interface HygieneTask {
  id: string;
  name: string;
  lastDone: string;
  icon: string;
  colorClass: string;
  textColor: string;
  completed: boolean;
}

interface TableTask {
  id: string;
  rawId?: string;
  rawStatus?: 'PENDING' | 'REQUESTED' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';
  rawPriority?: 'High' | 'Medium' | 'Low';
  progress?: number;
  waiting?: string;
  tableNumber?: string;
  seats?: number;
  area?: string;
  section?: string;
  floor?: number;
}

interface TableRow {
  id: string;
  area: string;
  seats: number;
  status: string;
  priority: 'High' | 'Medium' | 'Low';
  lastCleaned: string;
  assignedTo: { name: string; avatar: string } | null;
  rawId: string;
}

export default function CleaningDashboard() {
  const { t } = useTranslation();
  const { searchQuery } = useCleaningSearch();
  const { showToast } = useToast();

  // Store data states
  const [tables, setTables] = useState(cleaningStore.tables);
  const [staffList, setStaffList] = useState<CleaningStaffMember[]>(cleaningStore.staffMembers);
  const [requests, setRequests] = useState(cleaningStore.requests);

  // Filter & Toolbar States
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [priorityFilter, setPriorityFilter] = useState('All Priority');
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const priorityRef = useRef<HTMLDivElement>(null);

  // Table Management Modals State
  const [showEditTableModal, setShowEditTableModal] = useState(false);
  const [editingTable, setEditingTable] = useState<TableRow | null>(null);
  const [editTableArea, setEditTableArea] = useState('Dining Area A');
  const [editTableSeats, setEditTableSeats] = useState(4);
  const [editTablePriority, setEditTablePriority] = useState<'High' | 'Medium' | 'Low'>('Medium');

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningTableId, setAssigningTableId] = useState<string | null>(null);
  const [assigningTableLabel, setAssigningTableLabel] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Cleaning Feature Modals State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [newRequestTable, setNewRequestTable] = useState('');
  const [newRequestPriority, setNewRequestPriority] = useState('Medium');
  const [showSpecialModal, setShowSpecialModal] = useState(false);
  const [specialNotes, setSpecialNotes] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Store subscriptions
  useEffect(() => {
    const unsubscribe = cleaningStore.subscribe(() => {
      setTables([...cleaningStore.tables]);
      setStaffList([...cleaningStore.staffMembers]);
      setRequests([...cleaningStore.requests]);
    });
    return () => { unsubscribe(); };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) setIsStatusOpen(false);
      if (priorityRef.current && !priorityRef.current.contains(event.target as Node)) setIsPriorityOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { urgentTasks, startTask, completeTask, verifyTask, createTask, assignTaskToStaff, profile } = useCleaning();

  const staffName = profile?.name ? profile.name.trim() : 'Riya';
  const firstName = staffName.split(' ')[0] || 'Riya';

  const safeTasks = (urgentTasks || []) as unknown as TableTask[];
  const requestCount = safeTasks.filter((t) => t.rawStatus === 'REQUESTED').length || 0;

  // Filtered lists
  const tableRows: TableRow[] = tables.map((t) => ({
    id: t.id,
    area: t.area || t.section || 'Dining Area A',
    seats: t.seats || 4,
    status: t.status,
    priority: t.priority,
    lastCleaned: t.timeAgo || 'Just Now',
    assignedTo: t.assignedTo || null,
    rawId: t.taskId || t.id,
  }));

  const filteredTables = tableRows.filter((t) => {
    const matchesSearch =
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.area.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All Status' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'All Priority' || t.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const tablesToClean = tables
    .filter((t) => t.status === 'Needs Cleaning' || t.status === 'Cleaning Requested')
    .map((t) => ({
      id: t.id,
      seats: t.seats,
      timeAgo: t.timeAgo,
      priority: t.priority,
      priorityClass: t.priority === 'High' ? 'bg-red-50 text-red-650' : 'bg-orange-50 text-orange-600',
      iconColor: t.priority === 'High' ? 'text-red-500' : 'text-orange-500',
      rawId: t.taskId || t.id,
      section: t.section || 'Indoor',
      floor: t.floor || 1,
    }));

  const inProgress = tables
    .filter((t) => t.status === 'In Progress')
    .map((t) => ({
      id: t.id,
      progress: t.progress || 45,
      timeAgo: t.timeAgo,
      rawId: t.taskId || t.id,
      section: t.section || 'Indoor',
      floor: t.floor || 1,
    }));

  const completedToday = tables
    .filter((t) => (t.status as string) === 'Ready for Inspection' || (t.status as string) === 'Done' || (t.status as string) === 'Completed')
    .map((t) => ({
      id: t.id,
      time: t.timeAgo || 'Just Now',
      seats: t.seats || 4,
      rawStatus: t.status === 'Ready for Inspection' ? 'COMPLETED' : 'VERIFIED',
      rawId: t.taskId || t.id,
      section: t.section || t.area || 'Indoor',
      floor: t.floor || 1,
    }));

  const filteredTablesToClean = tablesToClean.filter((t) =>
    t.id.toLowerCase().includes(searchQuery.toLowerCase()) || t.priority.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredInProgress = inProgress.filter((i) => i.id.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredCompleted = completedToday.filter((c) => c.id.toLowerCase().includes(searchQuery.toLowerCase()));

  const [hygieneTasks, setHygieneTasks] = useState<HygieneTask[]>([
    {
      id: '1',
      name: 'Restroom Sanitization',
      lastDone: '09:15 AM',
      icon: 'sanitizer',
      colorClass: 'bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400',
      textColor: 'text-purple-600',
      completed: false,
    },
    {
      id: '2',
      name: 'Waste Bin Check',
      lastDone: '09:20 AM',
      icon: 'delete',
      colorClass: 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400',
      textColor: 'text-blue-600',
      completed: false,
    },
    {
      id: '3',
      name: 'Floor Sanitization',
      lastDone: '09:25 AM',
      icon: 'mop',
      colorClass: 'bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400',
      textColor: 'text-orange-600',
      completed: false,
    },
  ]);

  const handleToggleHygieneTask = (taskId: string) => {
    setHygieneTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task))
    );
  };



  const handleToggleStatus = async (rawId: string, currentStatus: string) => {
    const tableObj = tables.find((t) => t.id === rawId || t.taskId === rawId);
    const taskId = tableObj?.taskId || rawId;

    if (currentStatus === 'Needs Cleaning' || currentStatus === 'Cleaning Requested') {
      cleaningStore.startCleaning(taskId);
      await startTask(taskId);
      showToast(`Started cleaning ${tableObj?.id || rawId}.`, 'success');
    } else if (currentStatus === 'In Progress') {
      cleaningStore.completeInspection(taskId);
      await completeTask(taskId);
      showToast(`Finished cleaning ${tableObj?.id || rawId}. Sent for inspection.`, 'success');
    } else if (currentStatus === 'Ready for Inspection') {
      cleaningStore.verifyInspection(taskId);
      await verifyTask(taskId);
      showToast(`Table ${tableObj?.id || rawId} verified as Available.`, 'success');
    }
  };

  const handleOpenEditModal = (row: TableRow) => {
    setEditingTable(row);
    setEditTableArea(row.area);
    setEditTableSeats(row.seats);
    setEditTablePriority(row.priority);
    setOpenMenuId(null);
    setShowEditTableModal(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable) return;
    cleaningStore.editTable(editingTable.rawId, {
      area: editTableArea,
      seats: editTableSeats,
      priority: editTablePriority,
    });
    showToast(`Table ${editingTable.id} updated.`, 'success');
    setShowEditTableModal(false);
    setEditingTable(null);
  };

  const handleDeleteTable = (id: string) => {
    cleaningStore.deleteTable(id);
    showToast(`Table ${id} removed.`, 'warning');
    setDeleteConfirmId(null);
    setOpenMenuId(null);
  };

  const handleAssignStaff = async (member: CleaningStaffMember) => {
    if (!assigningTableId) return;
    const tableObj = tables.find((t) => t.id === assigningTableId || t.taskId === assigningTableId);
    const taskId = tableObj?.taskId || assigningTableId;

    try {
      await assignTaskToStaff(taskId, member.id);
      showToast(`${member.name} assigned to ${tableObj?.id || assigningTableId}.`, 'success');
      setShowAssignModal(false);
      setAssigningTableId(null);
      setOpenMenuId(null);
    } catch (err) {
      console.error('Failed to assign staff', err);
    }
  };

  const handleExportData = () => {
    const csvRows = [
      ['Table ID', 'Area / Zone', 'Seats Configuration', 'Operational Status', 'Priority Vector', 'Last Cleaned Time'],
      ...filteredTables.map((t) => [t.id, t.area, t.seats, t.status, t.priority, t.lastCleaned]),
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodedUri);
    downloadAnchor.setAttribute('download', `CleanServe_Tables_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequestTable.trim()) return;

    await createTask({ tableId: newRequestTable.trim(), priority: newRequestPriority });
    showToast(`Cleaning request for ${newRequestTable.toUpperCase()} created.`, 'success');
    setNewRequestTable('');
    setShowRequestModal(false);
  };

  const totalTablesCount = tables.length;
  const totalTablesToClean = tablesToClean.length;
  const totalInProgress = inProgress.length;
  const totalCleanedToday = completedToday.length;

  return (
    <div className="space-y-6 lg:space-y-8 animate-fadeIn cleaning-panel">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-sd-surface-container p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
            Hello, {firstName}!
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-sans">
            Welcome back! Monitor live restaurant tables and cleaning operations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {requestCount > 0 && (
            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-md shadow-red-500/10 transition-all animate-pulse cursor-pointer border-none outline-none font-sans"
            >
              <span className="material-symbols-outlined text-[16px]">notifications_active</span>
              {requestCount} Urgent Request{requestCount !== 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={() => setShowRequestModal(true)}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-md shadow-orange-500/10 transition-all cursor-pointer border-none outline-none font-sans"
          >
            <span className="material-symbols-outlined text-[16px]">add_task</span>
            New Request
          </button>
        </div>
      </div>

      {/* Top Stats Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white dark:bg-sd-surface-container p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-transform hover:-translate-y-1">
          <div className="w-11 h-11 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
            <span className="material-symbols-outlined text-[22px]">table_restaurant</span>
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 leading-none">
              {totalTablesCount}
            </h3>
            <p className="text-xs text-slate-450 dark:text-slate-400 mt-1 font-sans">
              Total Tables ({totalTablesToClean} Needs Cleaning)
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-sd-surface-container p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-transform hover:-translate-y-1">
          <div className="w-11 h-11 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
            <span className="material-symbols-outlined text-[22px]">cleaning_services</span>
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 leading-none">
              {totalInProgress}
            </h3>
            <p className="text-xs text-slate-450 dark:text-slate-400 mt-1 font-sans">{t('inProgress')}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-sd-surface-container p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-transform hover:-translate-y-1">
          <div className="w-11 h-11 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center text-green-600 dark:text-green-455 shrink-0">
            <span className="material-symbols-outlined text-[22px]">check_circle</span>
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 leading-none">
              {totalCleanedToday}
            </h3>
            <p className="text-xs text-slate-450 dark:text-slate-400 mt-1 font-sans">{t('cleanedToday')}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-sd-surface-container p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 transition-transform hover:-translate-y-1">
          <div className="w-11 h-11 rounded-full bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <span className="material-symbols-outlined text-[22px]">verified_user</span>
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 leading-none">
              98%
            </h3>
            <p className="text-xs text-slate-450 dark:text-slate-400 mt-1 font-sans">{t('hygieneScore')}</p>
          </div>
        </div>
      </section>

      {/* Comprehensive Table Management Section */}
      <section className="bg-white dark:bg-sd-surface-container rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
              Table Overview & Management
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-sans">
              View all restaurant tables, update cleaning status, assign staff, and edit layout.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <div className="relative" ref={statusRef}>
              <button
                type="button"
                onClick={() => {
                  setIsStatusOpen(!isStatusOpen);
                  setIsPriorityOpen(false);
                }}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-sans py-2 px-3 font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 outline-none hover:border-orange-500 transition-colors cursor-pointer"
              >
                <span>{t(statusFilter)}</span>
                <span className="material-symbols-outlined text-sm text-slate-400">keyboard_arrow_down</span>
              </button>
              {isStatusOpen && (
                <div className="absolute left-0 mt-1.5 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden flex flex-col font-sans text-xs z-30">
                  {['All Status', 'Needs Cleaning', 'In Progress', 'Ready for Inspection', 'Available'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        setStatusFilter(st);
                        setIsStatusOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 font-bold transition-colors cursor-pointer ${
                        statusFilter === st
                          ? 'bg-orange-500 text-white'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-orange-500/10 hover:text-orange-500'
                      }`}
                    >
                      {t(st)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Priority Filter */}
            <div className="relative" ref={priorityRef}>
              <button
                type="button"
                onClick={() => {
                  setIsPriorityOpen(!isPriorityOpen);
                  setIsStatusOpen(false);
                }}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-sans py-2 px-3 font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 outline-none hover:border-orange-500 transition-colors cursor-pointer"
              >
                <span>{t(priorityFilter)}</span>
                <span className="material-symbols-outlined text-sm text-slate-400">keyboard_arrow_down</span>
              </button>
              {isPriorityOpen && (
                <div className="absolute left-0 mt-1.5 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden flex flex-col font-sans text-xs z-30">
                  {['All Priority', 'High', 'Medium', 'Low'].map((pr) => (
                    <button
                      key={pr}
                      type="button"
                      onClick={() => {
                        setPriorityFilter(pr);
                        setIsPriorityOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 font-bold transition-colors cursor-pointer ${
                        priorityFilter === pr
                          ? 'bg-orange-500 text-white'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-orange-500/10 hover:text-orange-500'
                      }`}
                    >
                      {t(pr)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleExportData}
              type="button"
              className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-sans font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              {t('export')}
            </button>
          </div>
        </div>

        {/* Table list view */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 font-bold">
                <th className="px-4 py-3 uppercase tracking-wider">{t('tableNo')}</th>
                <th className="px-4 py-3 uppercase tracking-wider">{t('area')}</th>
                <th className="px-4 py-3 uppercase tracking-wider">{t('seats')}</th>
                <th className="px-4 py-3 uppercase tracking-wider">{t('status')}</th>
                <th className="px-4 py-3 uppercase tracking-wider">{t('priority')}</th>
                <th className="px-4 py-3 uppercase tracking-wider">Last Cleaned</th>
                <th className="px-4 py-3 uppercase tracking-wider">{t('assignedTo')}</th>
                <th className="px-4 py-3 uppercase tracking-wider text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTables.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                    No tables found matching current search and filters.
                  </td>
                </tr>
              ) : (
                filteredTables.map((row) => (
                  <tr key={row.rawId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-extrabold text-slate-800 dark:text-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-orange-500 text-base">table_bar</span>
                        <span>{row.id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-medium">{row.area}</td>
                    <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">{row.seats} Seats</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleStatus(row.rawId, row.status)}
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider border cursor-pointer transition-colors ${
                          row.status === 'Available' || row.status === 'Done'
                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400'
                            : row.status === 'In Progress'
                            ? 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400'
                            : row.status === 'Ready for Inspection'
                            ? 'bg-purple-50 text-purple-750 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400'
                            : 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-slate-800 dark:text-orange-400'
                        }`}
                      >
                        {row.status}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.priority === 'High'
                            ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400'
                            : row.priority === 'Medium'
                            ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400'
                            : 'bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400'
                        }`}
                      >
                        {row.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-medium">{row.lastCleaned}</td>
                    <td className="px-4 py-3">
                      {row.assignedTo ? (
                        <div className="flex items-center gap-1.5">
                          <img
                            src={row.assignedTo.avatar}
                            alt={row.assignedTo.name}
                            className="w-5 h-5 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                          />
                          <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                            {row.assignedTo.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setAssigningTableId(row.rawId);
                            setAssigningTableLabel(row.id);
                            setShowAssignModal(true);
                          }}
                          className="p-1 text-slate-400 hover:text-orange-500 rounded-lg transition-colors cursor-pointer"
                          title="Assign Staff"
                        >
                          <span className="material-symbols-outlined text-[18px]">person_add</span>
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(row)}
                          className="p-1 text-slate-400 hover:text-orange-500 rounded-lg transition-colors cursor-pointer"
                          title="Edit Table"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(row.rawId)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                          title="Delete Table"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Operations & Features Section (Zero Empty Space Layout) */}
      <div className="space-y-6 lg:space-y-8">
        {/* Cleaning Request Features (3 Action Cards across full width) */}
        <section className="space-y-4">
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-150 font-sans tracking-tight">
            {t('cleaningRequestFeatures')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => setShowRequestModal(true)}
              className="bg-white dark:bg-sd-surface-container p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-orange-500/40 transition-all flex items-center gap-3.5 group cursor-pointer text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-orange-500 shrink-0 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-[20px]">add_task</span>
              </div>
              <div>
                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                  {t('newRequest')}
                </span>
                <span className="text-[10px] text-slate-400 font-sans leading-tight block mt-0.5">
                  {t('newRequestDesc')}
                </span>
              </div>
            </button>

            <button
              onClick={() => setShowHistoryModal(true)}
              className="bg-white dark:bg-sd-surface-container p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-purple-500/40 transition-all flex items-center gap-3.5 group cursor-pointer text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center text-purple-600 shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-[20px]">history</span>
              </div>
              <div>
                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                  {t('requestHistory')}
                </span>
                <span className="text-[10px] text-slate-400 font-sans leading-tight block mt-0.5">
                  {t('requestHistoryDesc')}
                </span>
              </div>
            </button>

            <button
              onClick={() => setShowSpecialModal(true)}
              className="bg-white dark:bg-sd-surface-container p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-orange-500/40 transition-all flex items-center gap-3.5 group cursor-pointer text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-orange-600 shrink-0 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                <span className="material-symbols-outlined text-[20px]">stars</span>
              </div>
              <div>
                <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                  {t('specialRequest')}
                </span>
                <span className="text-[10px] text-slate-400 font-sans leading-tight block mt-0.5">
                  {t('specialRequestDesc')}
                </span>
              </div>
            </button>
          </div>
        </section>

        {/* Hygiene Tasks (3 Checklist Cards across full width) */}
        <section className="space-y-4">
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-150 font-sans tracking-tight">
            {t('hygieneTasks')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {hygieneTasks.map((task) => (
              <div
                key={task.id}
                className="bg-white dark:bg-sd-surface-container p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 font-sans">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${task.colorClass}`}>
                    <span className="material-symbols-outlined text-[18px]">{task.icon}</span>
                  </div>
                  <div>
                    <p className={`font-bold text-xs ${task.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                      {t(task.name)}
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold">{task.lastDone}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleHygieneTask(task.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border font-sans transition-all active:scale-95 shrink-0 ${
                    task.completed
                      ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                      : 'bg-orange-500 text-white border-transparent hover:bg-orange-600'
                  }`}
                >
                  {task.completed ? t('completed') : t('markDone')}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* In Progress Tasks */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-150 font-sans tracking-tight">
                {t('inProgress')} Tasks
              </h2>
              <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                {filteredInProgress.length}
              </span>
            </div>
          </div>

          {filteredInProgress.length === 0 ? (
            <div className="bg-white dark:bg-sd-surface-container border border-slate-100 dark:border-slate-800 rounded-2xl p-6 text-center text-slate-400 flex flex-col items-center justify-center">
              <span className="material-symbols-outlined text-3xl mb-1.5 text-slate-300 dark:text-slate-700">cleaning_services</span>
              <p className="text-xs font-semibold">{t('noActiveCleaningTasks')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredInProgress.map((item) => (
                <div
                  key={item.rawId}
                  className="bg-white dark:bg-sd-surface-container p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center text-center"
                >
                  <div className="relative w-16 h-16 mb-3">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        className="text-slate-100 dark:text-slate-800"
                        cx="32"
                        cy="32"
                        fill="transparent"
                        r="26"
                        stroke="currentColor"
                        strokeWidth="3.5"
                      />
                      <circle
                        className="text-orange-500"
                        cx="32"
                        cy="32"
                        fill="transparent"
                        r="26"
                        stroke="currentColor"
                        strokeDasharray="163.3"
                        strokeDashoffset={163.3 - (163.3 * item.progress) / 100}
                        strokeWidth="3.5"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center font-bold text-xs font-sans text-slate-850 dark:text-slate-200">
                      {item.progress}%
                    </div>
                  </div>

                  <div className="font-extrabold text-sm text-slate-800 dark:text-slate-200 mb-0.5">
                    {item.id}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-1 font-sans font-semibold">
                    {item.section} · {t('floor')} {item.floor}
                  </div>
                  <p className="text-[10px] text-slate-400 mb-3 font-sans font-semibold">
                    {item.timeAgo}
                  </p>
                  <button
                    onClick={() => handleToggleStatus(item.rawId, 'In Progress')}
                    className="w-full py-1.5 bg-orange-500 text-white rounded-xl text-[11px] font-bold hover:bg-orange-600 transition-all duration-200 active:scale-95 shadow-sm shadow-orange-500/20 cursor-pointer"
                  >
                    {item.progress >= 90 ? t('complete') : t('continue')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Completed Today Audit Feed */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-150 font-sans tracking-tight">
                {t('completedTodayHeader')}
              </h2>
              <span className="bg-green-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                {filteredCompleted.length}
              </span>
            </div>
          </div>
          {filteredCompleted.length === 0 ? (
            <div className="bg-white dark:bg-sd-surface-container border border-slate-100 dark:border-slate-800 rounded-2xl p-6 text-center text-slate-400">
              <p className="text-xs">{t('noCompletedTables')}</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-sd-surface-container rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCompleted.map((item) => (
                <div key={item.rawId} className="flex items-center justify-between p-4 font-sans text-xs">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-green-500" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{item.id}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                      ({item.section} · {t('floor')} {item.floor})
                    </span>
                  </div>
                  <span className="text-slate-400 dark:text-slate-500 font-semibold">{item.seats} {t('seats')}</span>
                  <span className="text-slate-450 dark:text-slate-400 font-bold">
                    {item.rawStatus === 'COMPLETED' ? (
                      <button
                        onClick={() => verifyTask(item.rawId || '')}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all duration-150 active:scale-95 cursor-pointer"
                      >
                        {t('verifyAudit')}
                      </button>
                    ) : (
                      item.time
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* --- MODALS --- */}

      {/* Edit Table Modal */}
      {showEditTableModal && editingTable && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-sd-surface-container rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl w-full max-w-sm">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 mb-1 font-sans">
              Edit Table {editingTable.id}
            </h3>
            <form onSubmit={handleSaveEdit} className="space-y-4 font-sans text-xs mt-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">Area / Zone</label>
                <input
                  type="text"
                  value={editTableArea}
                  onChange={(e) => setEditTableArea(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">Seats</label>
                  <input
                    type="number"
                    value={editTableSeats}
                    onChange={(e) => setEditTableSeats(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">Priority</label>
                  <select
                    value={editTablePriority}
                    onChange={(e) => setEditTablePriority(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditTableModal(false)}
                  className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Staff Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-sd-surface-container rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl w-full max-w-sm font-sans text-xs">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 mb-1 font-sans">
              Assign Staff Member to {assigningTableLabel || 'Table'}
            </h3>
            <p className="text-[11px] text-slate-400 mb-4 font-sans">Select staff member for table sanitization.</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {staffList.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleAssignStaff(m)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-orange-500/50 bg-slate-50/50 dark:bg-slate-800/40 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <img src={m.avatar} alt={m.name} className="w-7 h-7 rounded-full object-cover" />
                    <div className="text-left">
                      <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">{m.name}</p>
                      <p className="text-[10px] text-slate-400">{m.role}</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-orange-500 text-base">person_add</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAssignModal(false)}
              className="w-full mt-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-sd-surface-container rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl w-full max-w-sm font-sans text-xs">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 mb-1 font-sans">Delete Table</h3>
            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
              Are you sure you want to remove table <strong className="text-slate-700 dark:text-slate-200">{deleteConfirmId}</strong> from cleaning management?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteTable(deleteConfirmId)}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md"
              >
                Delete Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-sd-surface-container rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl w-full max-w-sm">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 mb-1 font-sans">
              {t('newRequest')}
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-400 mb-4 font-sans leading-relaxed">
              {t('newRequestDesc')}
            </p>
            <form onSubmit={handleCreateRequest} className="space-y-4 font-sans text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  {t('tableNo')}
                </label>
                <input
                  type="text"
                  placeholder="e.g. T08, T14"
                  value={newRequestTable}
                  onChange={(e) => setNewRequestTable(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  required
                />
              </div>
              <div>
                <span className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  {t('priority')}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {['High', 'Medium', 'Low'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewRequestPriority(p)}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                        newRequestPriority === p
                          ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {t(p.toLowerCase())}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold shadow-md"
                >
                  {t('submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Special Request Modal */}
      {showSpecialModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-sd-surface-container rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl w-full max-w-sm">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 mb-1 font-sans">
              {t('specialRequest')}
            </h3>
            <p className="text-[11px] text-slate-400 mb-4 font-sans leading-relaxed">
              Add special sanitization notes or spill handling instructions.
            </p>
            <div className="space-y-4 font-sans text-xs">
              <textarea
                rows={4}
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                placeholder="Enter details (e.g. Spill on Table T04, deep carpet wash needed)..."
                className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSpecialModal(false)}
                  className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    showToast('Special request logged.', 'success');
                    setSpecialNotes('');
                    setShowSpecialModal(false);
                  }}
                  className="flex-1 py-2 bg-orange-500 text-white rounded-xl font-bold shadow-md"
                >
                  Submit Special Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-sd-surface-container rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 font-sans">
                {t('requestHistory')}
              </h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600 text-sm">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 font-sans text-xs">
              {requests.length === 0 ? (
                <p className="text-slate-400 text-center py-6">No request history recorded yet.</p>
              ) : (
                requests.map((r) => (
                  <div key={r.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{r.location || r.type}</p>
                      <p className="text-[10px] text-slate-400">{r.priority} Priority · {r.requestedTime || r.requestedOn}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400">
                      {r.status}
                    </span>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => setShowHistoryModal(false)}
              className="mt-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
