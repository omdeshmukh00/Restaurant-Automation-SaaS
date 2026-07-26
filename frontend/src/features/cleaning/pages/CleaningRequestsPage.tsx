import React, { useState, useRef, useEffect } from 'react';
import { useCleaning } from '../hooks/usecleaning';
import { useCleaningSearch } from '../components/dashboard/CleaningSearchContext';
import { useNotifications } from '../hooks/useNotifications';
import { cleaningStore } from '../store/cleaning.store';
import { useToast } from '../components/dashboard/Toast';
import { useTranslation } from '../hooks/useTranslation';
/* eslint-disable @typescript-eslint/no-unused-vars */

interface CleaningRequest {
  id: string;
  type: string;
  icon: string;
  iconColor: string;
  location: string;
  requestedBy: { name: string; avatar: string };
  priority: 'High' | 'Medium' | 'Low';
  status: 'In Progress' | 'Scheduled' | 'Completed' | 'Cancelled' | 'Pending';
  requestedOn: string;
  requestedTime: string;
  assignedTo?: { name: string; avatar: string } | null;
  rawId?: string;
}
interface TableTask {
  id: string;
  rawId?: string; // Yeh '?' add kar
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

export default function CleaningRequestsPage() {
  const { t } = useTranslation();
  const { searchQuery } = useCleaningSearch();
  const { showToast } = useToast();
  const { startTask, completeTask, verifyTask, reportMaintenanceIssue, createTask, urgentTasks } = useCleaning();
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [priorityFilter, setPriorityFilter] = useState('All Priority');
  const [typeFilter, setTypeFilter] = useState('All Type');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const { addNotification } = useNotifications();

  // New request form state
  const [newRequestType, setNewRequestType] = useState('Spill Cleanup');
  const [newRequestLocation, setNewRequestLocation] = useState(() => cleaningStore.tables[0]?.id || '');
  const [newRequestPriority, setNewRequestPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');

  // Maintenance form state
  const [mTableId, setMTableId] = useState(() => cleaningStore.tables[0]?.id || '');
  const [mIssueType, setMIssueType] = useState<'BROKEN_FURNITURE' | 'WATER_LEAK' | 'ELECTRICAL' | 'HYGIENE' | 'OTHER'>('BROKEN_FURNITURE');
  const [mDescription, setMDescription] = useState('');
  const [mSeverity, setMSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');

  // 💥 Premium Custom Top Filter Dropdowns Tracking States
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isRowsOpen, setIsRowsOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<CleaningRequest | null>(null);

  const statusRef = useRef<HTMLDivElement>(null);
  const priorityRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const safeTasks = (urgentTasks || []) as unknown as TableTask[];

  const [allRequests, setAllRequests] = useState(cleaningStore.requests);

  useEffect(() => {
    const unsubscribe = cleaningStore.subscribe(() => {
      setAllRequests([...cleaningStore.requests]);
    });
    return () => {
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (showAddModal && cleaningStore.tables.length > 0) {
      setNewRequestLocation(cleaningStore.tables[0].id);
    }
  }, [showAddModal]);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (statusRef.current && !statusRef.current.contains(target)) setIsStatusOpen(false);
      if (priorityRef.current && !priorityRef.current.contains(target)) setIsPriorityOpen(false);
      if (typeRef.current && !typeRef.current.contains(target)) setIsTypeOpen(false);
      if (rowsRef.current && !rowsRef.current.contains(target)) setIsRowsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Map hook tasks cleanly into CleaningRequest blueprint structural parameters
  const requests: CleaningRequest[] = safeTasks.map((t, index) => {
    let reqStatus: 'In Progress' | 'Scheduled' | 'Completed' | 'Cancelled' = 'Scheduled';
    if (t.rawStatus === 'IN_PROGRESS') reqStatus = 'In Progress';
    if (t.rawStatus === 'COMPLETED' || t.rawStatus === 'VERIFIED') reqStatus = 'Completed';

    const tableLabel = t.tableNumber || t.id;

    let icon = 'water_drop';
    let iconColor = 'text-blue-500';
    let type = 'Spill Cleanup';

    if (tableLabel === 'T03' || tableLabel === 'T-03') {
      type = 'Restroom Cleaning';
      icon = 'wc';
      iconColor = 'text-orange-500';
    } else if (tableLabel === 'T15' || tableLabel === 'T-15') {
      type = 'Waste Overflow';
      icon = 'delete_sweep';
      iconColor = 'text-green-500';
    } else if (tableLabel === 'T01' || tableLabel === 'T-01') {
      type = 'Dusting';
      icon = 'air';
      iconColor = 'text-blue-400';
    }

    let assignedStaff = null;
    if (reqStatus === 'In Progress' || reqStatus === 'Completed') {
      const rawTask = t as unknown as Record<string, unknown>;
      const staffObj = rawTask.assignedStaffId as Record<string, unknown> | null;
      const staffName = staffObj && typeof staffObj.name === 'string' ? staffObj.name : 'Staff';
      assignedStaff = {
        name: staffName,
        avatar: staffObj && typeof staffObj.avatar === 'string' && staffObj.avatar
          ? staffObj.avatar
          : `https://ui-avatars.com/api/?name=${encodeURIComponent(staffName)}&background=f97316&color=fff&bold=true`,
      };
    }

    return {
      id: `CR-2026-0${30 + index}`,
      type: type,
      icon: icon,
      iconColor: iconColor,
      location: t.section ? `Table ${tableLabel} - ${t.section} (Floor ${t.floor})` : `Table ${tableLabel}`,
      requestedBy: {
        name: 'Cleaning Staff',
        avatar: 'https://ui-avatars.com/api/?name=Cleaning+Staff&background=f97316&color=fff&bold=true',
      },
      priority: (t.rawPriority === 'High' || t.rawStatus === 'REQUESTED'
        ? 'High'
        : t.rawPriority === 'Low'
          ? 'Low'
          : 'Medium') as 'High' | 'Medium' | 'Low',
      status: reqStatus,
      requestedOn: 'Jun 16, 2026',
      requestedTime: t.rawStatus === 'REQUESTED' ? 'Just Now' : '10:32 AM',
      assignedTo: assignedStaff,
      rawId: t.id,
    };
  });

  // Dynamic Bento stats calculation driven by store data states lengths
  const totalCount = allRequests.length;
  const inProgressCount = allRequests.filter((r) => r.status === 'In Progress').length;
  const completedCount = allRequests.filter((r) => r.status === 'Completed').length;
  const scheduledCount = allRequests.filter((r) => r.status === 'Scheduled').length;
  const cancelledCount = allRequests.filter((r) => r.status === 'Cancelled').length;

  // Add request via central system trigger
  const handleAddRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    if (!newRequestLocation.trim()) return;

    const requestLocation = newRequestLocation.trim();
    cleaningStore.addCleaningRequest({
      id: `CR-2026-${Math.floor(Math.random() * 999)}`,
      type: newRequestType,
      icon: 'water_drop',
      iconColor: 'text-blue-500',
      location: `Table ${requestLocation}`,
      requestedBy: {
        name: 'Staff',
        avatar: 'https://ui-avatars.com/api/?name=Staff&background=f97316&color=fff&bold=true',
      },
      priority: newRequestPriority as 'High' | 'Medium' | 'Low',
      status: 'Scheduled',
      requestedOn: now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      requestedTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      assignedTo: null,
      rawId: requestLocation,
    });

    try {
      await createTask({
        tableId: requestLocation,
        priority: newRequestPriority,
        notes: newRequestType,
      });
      showToast(`Request for Table ${requestLocation} created successfully`, 'success');
    } catch (err) {
      console.warn('Failed to post cleaning request to backend', err);
    }

    addNotification(
      `New Request: ${newRequestType}`,
      `Location: ${requestLocation}`
    );

    setShowAddModal(false);
  };

  const handleReportMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mTableId || !mDescription.trim()) return;
    try {
      await reportMaintenanceIssue({
        tableId: mTableId,
        issueType: mIssueType,
        description: mDescription,
        severity: mSeverity,
      });
      showToast('Table locked (Under Maintenance). Admin notified.', 'success');
      setShowMaintenanceModal(false);
      setMDescription('');
    } catch (err) {
      showToast('Failed to report maintenance issue.', 'error');
    }
  };
  const handleAction = (data: unknown) => {
    console.log(data);
  };
  const handleToggleRequestStatus = (id: string, currentStatus: string) => {
    if (currentStatus === 'Scheduled' || currentStatus === 'Pending') {
      cleaningStore.updateRequestStatus(id, 'In Progress');
    } else if (currentStatus === 'In Progress') {
      cleaningStore.updateRequestStatus(id, 'Completed');
    }
  };

  // Action Column Interactions Mapped for Requests
  const handleViewRequestDetails = (row: CleaningRequest) => {
    setSelectedRequest(row);
  };

  // CleaningRequestsPage.tsx
  const handleActionClick = async (row: CleaningRequest, action: 'start' | 'complete' | 'verify') => {
    const id = row.id;
    const rawId = row.rawId || row.id;

    if (action === 'start') {
      cleaningStore.updateRequestStatus(id, 'In Progress');
      await startTask(rawId);
    } else if (action === 'complete') {
      cleaningStore.updateRequestStatus(id, 'Completed');
      await completeTask(rawId);
    } else if (action === 'verify') {
      cleaningStore.verifyRequest(id);
      await verifyTask(rawId);
    }
    setOpenMenuId(null);
  };

  const handleOpenRequestActionMenu = (row: CleaningRequest) => {
    cleaningStore.updateRequestStatus(row.id, 'Pending');
    showToast(`Request ${row.id} flagged as urgent.`, 'warning');
  };

  // Fully Functional CSV Export Logic
  const handleExportCSV = () => {
    if (filteredRequests.length === 0) {
      showToast('No data to export.', 'warning');
      return;
    }
    const headers = [
      'Request ID',
      'Type',
      'Location',
      'Requested By',
      'Priority',
      'Status',
      'Requested On',
      'Requested Time',
      'Assigned To',
    ];
    const rows = filteredRequests.map((r) => [
      r.id,
      r.type,
      `"${r.location.replace(/"/g, '""')}"`,
      r.requestedBy.name,
      r.priority,
      r.status,
      r.requestedOn,
      r.requestedTime,
      r.assignedTo ? r.assignedTo.name : 'Unassigned',
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `cleaning_requests_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter requests matching parameters
  const filteredRequests = allRequests.filter((r) => {
    const matchesSearch =
      r.id?.toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.location?.toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.type?.toString().toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'All Status' || r.status === statusFilter;
    const matchesPriority = priorityFilter === 'All Priority' || r.priority === priorityFilter;
    const matchesType = typeFilter === 'All Type' || r.type === typeFilter;

    return matchesSearch && matchesStatus && matchesPriority && matchesType;
  });

  // Calculate pages indexing slices dynamically
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentPaginatedRequests = filteredRequests.slice(indexOfFirstRow, indexOfLastRow);

  const totalPages = Math.ceil(filteredRequests.length / rowsPerPage) || 1;
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="space-y-6 lg:space-y-8 animate-fadeIn cleaning-panel">
      {/* Header Info Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
        <button
          onClick={() => setShowMaintenanceModal(true)}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-amber-500/10 cursor-pointer text-xs"
        >
          <span className="material-symbols-outlined text-[18px]">build</span>
          {t('reportMaintenance')}
        </button>
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-orange-500/10 cursor-pointer text-xs"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t('newRequest')}
        </button>
        <button 
          onClick={handleExportCSV}
          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-orange-500 dark:hover:border-orange-500 transition-all active:scale-95 text-xs cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          {t('export')}
        </button>
      </div>

      {/* Summary Cards Bento Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-sd-surface-container p-5 rounded-2xl border border-slate-150 dark:border-slate-800/60 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-500 shrink-0">
            <span className="material-symbols-outlined text-[20px]">assignment</span>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-150 leading-none">
              {totalCount}
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1 font-sans font-semibold">
              {t('totalRequests')}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-sd-surface-container p-5 rounded-2xl border border-slate-150 dark:border-slate-800/60 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 bg-orange-50 dark:bg-orange-950/20 rounded-xl flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
            <span className="material-symbols-outlined text-[20px]">schedule</span>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-150 leading-none">
              {inProgressCount}
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1 font-sans font-semibold">
              {t('inProgress')}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-sd-surface-container p-5 rounded-2xl border border-slate-150 dark:border-slate-800/60 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 bg-green-50 dark:bg-green-950/20 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400 shrink-0">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-150 leading-none">
              {completedCount}
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1 font-sans font-semibold">
              {t('completed')}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-sd-surface-container p-5 rounded-2xl border border-slate-150 dark:border-slate-800/60 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 bg-purple-50 dark:bg-purple-950/20 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
            <span className="material-symbols-outlined text-[20px]">event_note</span>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-150 leading-none">
              {scheduledCount}
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1 font-sans font-semibold">
              {t('scheduled')}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-sd-surface-container p-5 rounded-2xl border border-slate-150 dark:border-slate-800/60 shadow-sm flex items-center gap-4 col-span-2 sm:col-span-1">
          <div className="w-10 h-10 bg-red-50 dark:bg-red-950/20 rounded-xl flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
            <span className="material-symbols-outlined text-[20px]">cancel</span>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-150 leading-none">
              {cancelledCount}
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-400 mt-1 font-sans font-semibold">
              {t('cancelled')}
            </p>
          </div>
        </div>
      </section>

      {/* Toolbar / Filters */}
      <section className="bg-white dark:bg-sd-surface-container p-4 rounded-2xl border border-slate-150 dark:border-slate-800/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-40">
        <div className="flex flex-wrap items-center gap-3 flex-grow max-w-3xl">
          {/* 💥 Custom HTML All Status Dropdown Menu (Orange Hover Highlights) */}
          <div className="relative" ref={statusRef}>
            <button
              type="button"
              onClick={() => {
                setIsStatusOpen(!isStatusOpen);
                setIsPriorityOpen(false);
                setIsTypeOpen(false);
              }}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-sans py-2 px-3 font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 outline-none hover:border-orange-500 cursor-pointer"
            >
              <span>{t(statusFilter)}</span>
              <span className="material-symbols-outlined text-sm text-slate-400">
                keyboard_arrow_down
              </span>
            </button>
            {isStatusOpen && (
              <div className="absolute left-0 mt-1.5 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden flex flex-col font-sans text-xs z-50">
                {['All Status', 'In Progress', 'Completed', 'Scheduled', 'Cancelled'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      setStatusFilter(st);
                      setIsStatusOpen(false);
                      setCurrentPage(1);
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

          {/* 💥 Custom HTML All Priority Dropdown Menu (Orange Hover Highlights) */}
          <div className="relative" ref={priorityRef}>
            <button
              type="button"
              onClick={() => {
                setIsPriorityOpen(!isPriorityOpen);
                setIsStatusOpen(false);
                setIsTypeOpen(false);
              }}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-sans py-2 px-3 font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 outline-none hover:border-orange-500 cursor-pointer"
            >
              <span>{t(priorityFilter)}</span>
              <span className="material-symbols-outlined text-sm text-slate-400">
                keyboard_arrow_down
              </span>
            </button>
            {isPriorityOpen && (
              <div className="absolute left-0 mt-1.5 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden flex flex-col font-sans text-xs z-50">
                {['All Priority', 'High', 'Medium', 'Low'].map((pr) => (
                  <button
                    key={pr}
                    type="button"
                    onClick={() => {
                      setPriorityFilter(pr);
                      setIsPriorityOpen(false);
                      setCurrentPage(1);
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

          {/* 💥 Custom HTML All Type Dropdown Menu (Orange Hover Highlights - Fixed `8cfcadc1`) */}
          <div className="relative" ref={typeRef}>
            <button
              type="button"
              onClick={() => {
                setIsTypeOpen(!isTypeOpen);
                setIsStatusOpen(false);
                setIsPriorityOpen(false);
              }}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-sans py-2 px-3 font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 outline-none hover:border-orange-500 cursor-pointer"
            >
              <span>{t(typeFilter)}</span>
              <span className="material-symbols-outlined text-sm text-slate-400">
                keyboard_arrow_down
              </span>
            </button>
            {isTypeOpen && (
              <div className="absolute left-0 mt-1.5 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden flex flex-col font-sans text-xs z-50">
                {[
                  'All Type',
                  'Spill Cleanup',
                  'Restroom Cleaning',
                  'Waste Overflow',
                  'Dusting',
                ].map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => {
                      setTypeFilter(tp);
                      setIsTypeOpen(false);
                      setCurrentPage(1);
                    }}
                    className={`w-full text-left px-3 py-2 font-bold transition-colors cursor-pointer ${
                      typeFilter === tp
                        ? 'bg-orange-500 text-white'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-orange-500/10 hover:text-orange-500'
                    }`}
                  >
                    {t(tp)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-slate-450 dark:text-slate-400 text-[10px] font-sans font-bold">
          <button className="flex items-center gap-1.5 hover:text-orange-500 transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-sm">filter_list</span>
            Filter
          </button>
          <div className="h-4 w-px bg-slate-250 dark:bg-slate-700" />
          <p className="flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">history</span>
            Last updated: Just now
          </p>
        </div>
      </section>

      {/* Data Table */}
      <section className="bg-white dark:bg-sd-surface-container rounded-2xl border border-slate-150 dark:border-slate-800/60 shadow-sm overflow-hidden relative z-10">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-550 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 font-bold">
                <th className="px-6 py-4 font-bold uppercase tracking-wider">{t('requestId')}</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">{t('type')}</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">{t('locationArea')}</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">{t('requestedBy')}</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">{t('priority')}</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">{t('status')}</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">{t('requestedOn')}</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">{t('assignedTo')}</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-center">
                  {t('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {currentPaginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-400">
                    No cleaning requests matched search criteria.
                  </td>
                </tr>
              ) : (
                currentPaginatedRequests.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap font-extrabold text-orange-500">
                      {row.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                        <span className={`material-symbols-outlined text-[18px] ${row.iconColor}`}>
                          {row.icon}
                        </span>
                        {t(row.type)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-455 font-semibold">
                      {t(row.location)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <img
                          alt={row.requestedBy.name}
                          className="w-5 h-5 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                          src={row.requestedBy.avatar}
                        />
                        <span className="font-semibold text-slate-700 dark:text-slate-355">
                          {row.requestedBy.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          row.priority === 'High'
                            ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400'
                            : row.priority === 'Medium'
                              ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400'
                              : 'bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400'
                        }`}
                      >
                        {t(row.priority.toLowerCase())}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleRequestStatus(row.id, row.status)}
                        className={`px-3 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer transition-colors ${
                          row.status === 'Completed'
                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30'
                            : row.status === 'In Progress'
                              ? 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30'
                              : row.status === 'Scheduled'
                                ? 'bg-orange-500/10 text-orange-500 border-orange-200 dark:bg-slate-800 dark:text-orange-400'
                                : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}
                      >
                        {t(row.status.toLowerCase().replace(/\s+/g, ''))}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-455 font-semibold leading-relaxed">
                      {row.requestedOn}
                      <br />
                      <span className="text-[10px] text-slate-400 font-bold">
                        {row.requestedTime}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {row.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <img
                            alt={row.assignedTo.name}
                            className="w-5 h-5 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                            src={row.assignedTo.avatar}
                          />
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {row.assignedTo.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-bold">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center relative">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewRequestDetails(row)}
                          className="p-1 text-slate-450 hover:text-orange-500 rounded transition-colors cursor-pointer"
                          title="View Log Details"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === row.id ? null : row.id)}
                          className="p-1 text-slate-400 hover:text-orange-500 rounded transition-colors cursor-pointer"
                          title="More Target Actions"
                        >
                          <span className="material-symbols-outlined text-[18px]">more_vert</span>
                        </button>
                      </div>

                      {/* Dropdown Menu */}
                      {openMenuId === row.id && (
                        <div className="absolute right-0 top-12 w-44 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-2xl z-[999] p-1">
                          <button
                            onClick={() => handleActionClick(row, 'start')}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-orange-600 hover:bg-orange-50 dark:hover:bg-slate-700 rounded-lg"
                          >
                            Start Request
                          </button>
                          <button
                            onClick={() => handleActionClick(row, 'complete')}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg"
                          >
                            Mark Completed
                          </button>
                          <button
                            onClick={() => handleActionClick(row, 'verify')}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-green-600 hover:bg-green-50 dark:hover:bg-slate-700 rounded-lg"
                          >
                            Verify Audit
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
            {/* Pagination Panel Footer */}
        <div className="px-6 py-4 bg-white dark:bg-sd-surface-container flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800 relative z-30">
          <p className="text-slate-400 dark:text-slate-455 font-bold">
            {t('Showing')} {indexOfFirstRow + 1} {t('to')} {Math.min(indexOfLastRow, filteredRequests.length)} {t('of')}{' '}
            {filteredRequests.length} {t('requests')}
          </p>
          <div className="flex items-center gap-6">
            {/* Custom HTML Rows Per Page Menu Block */}
            <div className="flex items-center gap-2" ref={rowsRef}>
              <span className="text-slate-400 dark:text-slate-455 font-bold">{t('rowsPerPage')}</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsRowsOpen(!isRowsOpen);
                    setIsStatusOpen(false);
                    setIsPriorityOpen(false);
                    setIsTypeOpen(false);
                  }}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-1 px-2.5 font-bold text-slate-700 dark:text-slate-355 flex items-center gap-1 outline-none hover:border-orange-500 cursor-pointer"
                >
                  <span>{rowsPerPage}</span>
                  <span className="material-symbols-outlined text-xs text-slate-400">
                    keyboard_arrow_down
                  </span>
                </button>
                {isRowsOpen && (
                  <div className="absolute right-0 bottom-full mb-1.5 w-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden flex flex-col font-sans text-xs z-50">
                    {[10, 20, 50].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          setRowsPerPage(size);
                          setCurrentPage(1);
                          setIsRowsOpen(false);
                        }}
                        className={`w-full text-center py-1.5 font-bold transition-colors cursor-pointer ${
                          rowsPerPage === size
                            ? 'bg-orange-500 text-white'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-orange-500/10 hover:text-orange-500'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Custom HTML Pagination Active Page Layout Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              {pageNumbers.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 font-bold rounded-lg transition-all cursor-pointer ${
                    currentPage === page
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-355'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Add Request Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-sd-surface-container rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl w-full max-w-sm">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 mb-1 font-sans">
              Submit Manual Cleaning Request
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-455 mb-4 font-sans leading-relaxed">
              Log a user request or housekeeping ticket in the queue.
            </p>
            <form onSubmit={handleAddRequest} className="space-y-4 font-sans text-xs">
              <div>
                <label
                  htmlFor="new-request-type"
                  className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  Request Type
                </label>
                <select
                  id="new-request-type"
                  value={newRequestType}
                  onChange={(e) => setNewRequestType(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option className="bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100" value="Spill Cleanup">Spill Cleanup 💧</option>
                  <option className="bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100" value="Restroom Cleaning">Restroom Cleaning 🚾</option>
                  <option className="bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100" value="Waste Overflow">Waste Overflow 🗑️</option>
                  <option className="bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100" value="Dusting">Dusting 💨</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="new-request-location"
                  className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  Location / Table ID
                </label>
                <select
                  id="new-request-location"
                  value={newRequestLocation}
                  onChange={(e) => setNewRequestLocation(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  required
                >
                  {cleaningStore.tables.map((t) => (
                    <option className="bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100" key={t.id} value={t.id}>
                      {t.id} ({t.area})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="new-request-priority"
                  className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  Urgency Level
                </label>
                <select
                  id="new-request-priority"
                  value={newRequestPriority}
                  onChange={(e) =>
                    setNewRequestPriority(e.target.value as 'High' | 'Medium' | 'Low')
                  }
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option className="bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100" value="High">High Urgency (Red Alert)</option>
                  <option className="bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100" value="Medium">Medium Urgency (Normal Flow)</option>
                  <option className="bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100" value="Low">Low Urgency (Routine Check)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-400 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-all active:scale-95"
                >
                  Raise Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border dark:border-slate-800 shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100">Ticket Details</h3>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4 text-sm font-sans">
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
                <p className="text-[10px] text-slate-400 font-bold uppercase">ID & Type</p>
                <p className="font-bold text-slate-700 dark:text-slate-200">
                  {selectedRequest.id} - {selectedRequest.type}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Location</p>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    {selectedRequest.location}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Priority</p>
                  <p
                    className={`font-bold ${selectedRequest.priority === 'High' ? 'text-red-500' : 'text-orange-500'}`}
                  >
                    {selectedRequest.priority}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Requested By</p>
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  {selectedRequest.requestedBy.name}
                </p>
              </div>
              <div className="border-t pt-4 dark:border-slate-800">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="w-full py-2 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Report Maintenance Issue Modal */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-sd-surface-container rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-xl w-full max-w-sm">
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 mb-1 font-sans flex items-center gap-1.5">
              <span className="material-symbols-outlined text-amber-500">warning</span>
              Report Maintenance Issue
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-455 mb-4 font-sans leading-relaxed">
              Report damaged items (broken chair, leak) to lock the table in Under Maintenance state.
            </p>
            <form onSubmit={handleReportMaintenance} className="space-y-4 font-sans text-xs">
              <div>
                <label htmlFor="m-table-id" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  Select Table
                </label>
                <select
                  id="m-table-id"
                  value={mTableId}
                  onChange={(e) => setMTableId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                  required
                >
                  {cleaningStore.tables.map((t) => (
                    <option className="bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100" key={t.id} value={t.id}>
                      {t.id} ({t.area})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="m-issue-type" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  Issue Category
                </label>
                <select
                  id="m-issue-type"
                  value={mIssueType}
                  onChange={(e) => setMIssueType(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option className="bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100" value="BROKEN_FURNITURE">Broken Furniture 🪑</option>
                  <option className="bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100" value="WATER_LEAK">Water Leak 💧</option>
                  <option className="bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100" value="ELECTRICAL">Electrical Issue ⚡</option>
                  <option className="bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100" value="HYGIENE">Hygiene Concern 🧼</option>
                  <option className="bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100" value="OTHER">Other Issue ⚠️</option>
                </select>
              </div>

              <div>
                <label htmlFor="m-severity" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  Severity Level
                </label>
                <select
                  id="m-severity"
                  value={mSeverity}
                  onChange={(e) => setMSeverity(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option className="bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100" value="LOW">Low (Minor scratch/stain)</option>
                  <option className="bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100" value="MEDIUM">Medium (Requires fix today)</option>
                  <option className="bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100" value="HIGH">High (Urgent repair needed)</option>
                  <option className="bg-white dark:bg-slate-850 text-slate-900 dark:text-slate-100" value="CRITICAL">Critical (Immediate safety hazard)</option>
                </select>
              </div>

              <div>
                <label htmlFor="m-description" className="block font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                  Description Details
                </label>
                <textarea
                  id="m-description"
                  rows={3}
                  placeholder="e.g. Chair leg broken, water leaking near socket..."
                  value={mDescription}
                  onChange={(e) => setMDescription(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMaintenanceModal(false)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-400 rounded-xl font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all active:scale-95"
                >
                  Lock Table & Alert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
