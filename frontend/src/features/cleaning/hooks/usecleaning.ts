import { useCallback, useEffect, useState } from 'react';
import { cleaningStore, type StaffProfile } from '../store/cleaning.store';
import { cleaningAPI, type CleaningMetric, type UrgentTask } from '../api/cleaning.api';
import { connectSocket, getSocket } from '../../../lib/socket';
import { apiClient } from '../../../shared/services/apiClient';

interface ProcessedTask extends UrgentTask {
  rawStatus: string;
  rawPriority: string;
  seats?: number;
  area?: string;
  section?: string;
  floor?: number;
  assignedStaffId?: string | { _id: string; name: string } | null;
  isPaused?: boolean;
  isDeepCleaning?: boolean;
  queueWaitingCount?: number;
}

export function useCleaning() {
  const [metrics, setMetrics] = useState<CleaningMetric[]>([]);
  const [urgentTasks, setUrgentTasks] = useState<UrgentTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error] = useState<string | null>(null);

  const [profile, setProfile] = useState(() => cleaningStore.profile);
  const [staffMembers, setStaffMembers] = useState(() => cleaningStore.staffMembers);

  useEffect(() => {
    const unsubscribe = cleaningStore.subscribe(() => {
      setProfile(cleaningStore.profile);
      setStaffMembers(cleaningStore.staffMembers);
    });

    const fetchUser = async () => {
      try {
        const { profileAPI } = await import('../api/profile.api');
        const res = await profileAPI.getProfile();
        if (res.success && res.data) {
          cleaningStore.updateProfile({
            name: res.data.name || cleaningStore.profile.name,
            email: res.data.email || cleaningStore.profile.email,
            phone: res.data.phone || cleaningStore.profile.phone,
            role: res.data.role || cleaningStore.profile.role,
          });
        }
      } catch (e) {
        console.warn('Profile fetch failed', e);
      }
    };
    void fetchUser();

    return () => {
      unsubscribe();
    };
  }, []);

  const processAndSyncData = useCallback(() => {
    const storeTables = cleaningStore.tables || [];

    const needsCleaningCount = storeTables.filter((t) => t.status === 'Needs Cleaning').length;
    const cleaningRequestedCount = storeTables.filter((t) => t.status === 'Cleaning Requested').length;
    const inProgressCount = storeTables.filter((t) => t.status === 'In Progress').length;
    const readyForInspectionCount = storeTables.filter((t) => t.status === 'Ready for Inspection').length;
    const availableCount = storeTables.filter((t) => t.status === 'Available').length;

    setMetrics([
      { label: 'Needs Cleaning', value: `${needsCleaningCount + cleaningRequestedCount}`, color: 'bg-amber-150/10 text-amber-500' },
      { label: 'In Progress', value: `${inProgressCount}`, color: 'bg-orange-500/10 text-orange-500' },
      { label: 'Completed Today', value: `${availableCount + readyForInspectionCount}`, color: 'bg-emerald-500/10 text-green-500' },
      { label: 'Service Rating', value: '4.9/5', color: 'bg-purple-500/10 text-purple-500' },
    ]);

    const processedTasks: ProcessedTask[] = storeTables.map((task) => {
      let displayStatus = 'Needs Cleaning';
      let badgeColor = '#f59e0b';
      let badgeBg = 'rgba(245,158,11,0.15)';
      let rawStatus = 'PENDING';

      if (task.status === 'Needs Cleaning') {
        displayStatus = 'Needs Cleaning';
        badgeColor = '#f59e0b';
        rawStatus = 'PENDING';
      } else if (task.status === 'Cleaning Requested') {
        displayStatus = 'Cleaning Requested';
        badgeColor = '#ef4444';
        badgeBg = 'rgba(239,68,68,0.15)';
        rawStatus = 'REQUESTED';
      } else if (task.status === 'In Progress') {
        displayStatus = 'In Progress';
        badgeColor = '#f97316';
        badgeBg = 'rgba(249,115,22,0.15)';
        rawStatus = 'IN_PROGRESS';
      } else if (task.status === 'Ready for Inspection') {
        displayStatus = 'Ready for Inspection';
        badgeColor = '#a855f7';
        badgeBg = 'rgba(168,85,247,0.15)';
        rawStatus = 'COMPLETED';
      } else if (task.status === 'Available') {
        displayStatus = 'Available';
        badgeColor = '#22c55e';
        badgeBg = 'rgba(34,197,94,0.15)';
        rawStatus = 'VERIFIED';
      }

      return {
        id: (task as any).taskId || task.id,
        tableNumber: task.id,
        title: `Table ${task.id}`,
        subtitle: task.notes ? task.notes : 'Routine turnover strategy sequence',
        priority: displayStatus,
        badgeColor,
        badgeBg,
        waiting: task.timeAgo || 'Just Now',
        rawPriority: task.priority || 'Medium',
        rawStatus: rawStatus,
        progress: task.progress || 0,
        seats: task.seats,
        area: task.area,
        section: task.section,
        floor: task.floor,
        assignedStaffId: (task as any).assignedStaffId,
        isPaused: (task as any).isPaused,
        isDeepCleaning: (task as any).isDeepCleaning,
        queueWaitingCount: (task as any).queueWaitingCount,
      } as ProcessedTask;
    });

    const priorityWeight: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

    const sortedTasks = [...processedTasks].sort((a: ProcessedTask, b: ProcessedTask) => {
      if (a.rawStatus === 'REQUESTED' && b.rawStatus !== 'REQUESTED') return -1;
      if (a.rawStatus !== 'REQUESTED' && b.rawStatus === 'REQUESTED') return 1;
      if ((b.queueWaitingCount || 0) !== (a.queueWaitingCount || 0)) {
        return (b.queueWaitingCount || 0) - (a.queueWaitingCount || 0);
      }
      return (priorityWeight[b.rawPriority] || 0) - (priorityWeight[a.rawPriority] || 0);
    });

    setUrgentTasks(sortedTasks);
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, tablesRes] = await Promise.all([
        cleaningAPI.getTasks(),
        cleaningAPI.getTables(),
      ]);

      if (tablesRes.success && Array.isArray(tablesRes.data)) {
        const mappedTables = tablesRes.data.map((table: any) => {
          const activeTask = tasksRes.success && Array.isArray(tasksRes.data?.tasks)
            ? tasksRes.data.tasks.find((task: any) => String(task.tableDetails?._id || task.tableId) === String(table._id))
            : null;

          let status = 'Available';
          let progress = 0;
          const taskId = activeTask?._id;

          const tableStatusUpper = (table.status || '').toUpperCase();

          if (tableStatusUpper === 'AVAILABLE') {
            status = 'Available';
          } else if (tableStatusUpper === 'CLEANING_IN_PROGRESS' || activeTask?.status === 'IN_PROGRESS') {
            status = 'In Progress';
            progress = (activeTask as any)?.progress || 45;
          } else if (activeTask?.status === 'COMPLETED') {
            status = 'Ready for Inspection';
          } else if (['DIRTY', 'NEEDS_CLEANING'].includes(tableStatusUpper) || (activeTask && activeTask.status === 'PENDING')) {
            status = 'Needs Cleaning';
          } else if (['OCCUPIED', 'BILL_PENDING', 'PAYMENT_PENDING', 'PAID', 'ORDERING', 'FOOD_SERVED'].includes(tableStatusUpper)) {
            status = 'Occupied';
          } else if (tableStatusUpper === 'RESERVED') {
            status = 'Reserved';
          } else {
            status = 'Available';
          }

          let priority = 'Medium';
          if (activeTask?.priority === 'HIGH') priority = 'High';
          else if (activeTask?.priority === 'LOW') priority = 'Low';

          let assignedTo = null;
          if (activeTask?.assignedStaffId) {
            const staff = activeTask.assignedStaffId as any;
            assignedTo = {
              name: staff.name || 'Staff Member',
              avatar: staff.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(staff.name || 'Staff')}`,
            };
          }

          const rawTableNum = String(table.tableNumber ?? table.number ?? '1');
          const displayTableId = rawTableNum.toLowerCase().startsWith('table') ? rawTableNum : `Table ${rawTableNum}`;

          return {
            id: displayTableId,
            area: table.section || 'Dining Area A',
            seats: Number(table.capacity || 4),
            status: status as any,
            priority: priority as any,
            timeAgo: activeTask?.createdAt ? new Date(activeTask.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Just Now',
            assignedTo,
            progress,
            taskId: taskId || String(table._id || table.id),
            floor: table.floor || 1,
            section: table.section || 'Main',
          };
        });

        cleaningStore.syncTasks([]);
        cleaningStore.syncAllTables(mappedTables);
      }

      const staffRes = await apiClient.get<{ success: boolean; data: { staff: any[] } }>('/admin/staff?role=cleaning-staff');
      if (staffRes.data?.success && Array.isArray(staffRes.data.data?.staff)) {
        const apiMembers = staffRes.data.data.staff.map((m: any) => {
          let displayRole = 'Cleaning Staff';
          if (m.cleaning_role === 'HOUSEKEEPING') displayRole = 'Housekeeper';
          else if (m.cleaning_role === 'CLEANING_SUPERVISOR') displayRole = 'Cleaning Supervisor';
          else if (m.role === 'cleaning-staff') displayRole = 'Cleaning Staff';
          else displayRole = m.role || 'Cleaning Staff';

          return {
            id: String(m._id || m.id),
            name: m.name || 'Cleaning Staff',
            role: displayRole,
            area: m.assignedArea || 'Dining Area A',
            phone: m.mobile || m.phone || '+91 98000 00000',
            avatar: m.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(m.name || 'Staff')}`,
          };
        });
        if (apiMembers.length > 0) {
          cleaningStore.setStaffMembers(apiMembers);
        }
      }
    } catch (err) {
      console.warn('[CleanServe Hook] Sync operational.', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => processAndSyncData(), 0);
    const unsubscribe = cleaningStore.subscribe(() => {
      processAndSyncData();
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [processAndSyncData]);

  useEffect(() => {
    const timer = setTimeout(() => loadDashboard(), 0);
    return () => clearTimeout(timer);
  }, [loadDashboard]);

  // Socket sync effect
  useEffect(() => {
    connectSocket();
    const socket = getSocket();
    if (socket) {
      const handleSync = () => {
        loadDashboard();
      };
      socket.on('cleaning.started', handleSync);
      socket.on('cleaning.completed', handleSync);
      socket.on('cleaning.issue.reported', handleSync);
      socket.on('cleaning.task.assigned', handleSync);
      socket.on('cleaning.task.paused', handleSync);
      socket.on('cleaning.task.deepclean', handleSync);
      socket.on('table.status.changed', handleSync);

      return () => {
        socket.off('cleaning.started', handleSync);
        socket.off('cleaning.completed', handleSync);
        socket.off('cleaning.issue.reported', handleSync);
        socket.off('cleaning.task.assigned', handleSync);
        socket.off('cleaning.task.paused', handleSync);
        socket.off('cleaning.task.deepclean', handleSync);
        socket.off('table.status.changed', handleSync);
      };
    }
  }, [loadDashboard]);

  return {
    metrics,
    floorTables: [],
    diningTables: [],
    kitchenTables: [],
    washrooms: [],
    kitchenWashrooms: [],
    urgentTasks,
    staffMembers,
    addStaffMember: async (member: any) => {
      try {
        const sanitizedMobile = (member.phone || '').replace(/[^\d]/g, '').slice(0, 10).padEnd(10, '0');
        const email = `${member.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now().toString().slice(-6)}@ambertable.com`;
        
        const apiRole = 'cleaning-staff';
        let cleaningRole = 'CLEANING_STAFF';
        if (member.role === 'Housekeeper') {
          cleaningRole = 'HOUSEKEEPING';
        } else if (member.role === 'Hygiene Auditor' || member.role === 'Cleaning Supervisor') {
          cleaningRole = 'CLEANING_SUPERVISOR';
        }

        const res = await apiClient.post<{ success: boolean; data: { staff: any } }>('/admin/staff', {
          name: member.name,
          email,
          mobile: sanitizedMobile,
          role: apiRole,
          cleaning_role: cleaningRole,
          assignedArea: member.area,
        });

        if (res.data?.success && res.data.data?.staff) {
          const m = res.data.data.staff;
          let displayRole = 'Cleaning Staff';
          if (m.cleaning_role === 'HOUSEKEEPING') displayRole = 'Housekeeper';
          else if (m.cleaning_role === 'CLEANING_SUPERVISOR') displayRole = 'Cleaning Supervisor';

          cleaningStore.addStaffMember({
            id: String(m._id || m.id),
            name: m.name,
            role: displayRole,
            area: m.assignedArea || 'Dining Area A',
            phone: m.mobile || '+91 98000 00000',
            avatar: m.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(m.name || 'Staff')}`,
          });
        }
        await loadDashboard();
      } catch (e) {
        console.warn('Failed to post staff member to backend', e);
        // Fallback
        cleaningStore.addStaffMember(member);
      }
    },
    removeStaffMember: async (id: string) => {
      cleaningStore.removeStaffMember(id);
      try {
        await apiClient.delete(`/admin/staff/${id}`);
      } catch (e) {
        console.warn('Failed to delete staff member from backend', e);
      }
    },
    activeJobs: [],
    recentActivity: [],
    weeklyRequests: [],
    jobStatus: [],
    loading,
    error,
    profile,
    updateProfile: async (updated: Partial<StaffProfile> & { mobileOtp?: string }) => {
      cleaningStore.updateProfile(updated);
      try {
        const { profileAPI } = await import('../api/profile.api');
        await profileAPI.updateProfile({
          name: updated.name,
          mobile: updated.phone,
          mobileOtp: updated.mobileOtp,
        } as any);
      } catch (e) {
        console.error('Failed to sync profile changes with backend', e);
      }
    },
    requestMobileOtp: async (mobile: string) => {
      try {
        const { profileAPI } = await import('../api/profile.api');
        return await profileAPI.requestMobileOtp(mobile);
      } catch (e) {
        console.error('Failed to request mobile OTP', e);
        return { success: false, error: 'Failed to request OTP' };
      }
    },
    assignTask: async (taskId: string) => {
      await cleaningAPI.startTask(taskId);
      await loadDashboard();
    },
    assignTaskToStaff: async (taskId: string, staffId?: string | null) => {
      const table = cleaningStore.tables.find(t => t.taskId === taskId || t.id === taskId);
      const label = table ? table.id : 'Table';
      const area = table ? table.area : 'Dining Area A';
      if (staffId) {
        const staff = cleaningStore.staffMembers.find(s => s.id === staffId);
        const staffName = staff ? staff.name : 'Staff Member';
        cleaningStore.addActivity(`Assigned ${staffName} to ${label}`, area, 'assignment', 'blue');
      } else {
        cleaningStore.addActivity(`Unassigned staff from ${label}`, area, 'person_remove', 'blue');
      }
      await cleaningAPI.assignTask(taskId, staffId);
      await loadDashboard();
    },
    startTask: async (taskId: string) => {
      const table = cleaningStore.tables.find(t => t.taskId === taskId || t.id === taskId);
      const label = table ? table.id : 'Table';
      const area = table ? table.area : 'Dining Area A';
      cleaningStore.addActivity(`Started cleaning ${label}`, area, 'timer', 'orange');
      await cleaningAPI.startTask(taskId);
      await loadDashboard();
    },
    completeTask: async (taskId: string) => {
      const table = cleaningStore.tables.find(t => t.taskId === taskId || t.id === taskId);
      const label = table ? table.id : 'Table';
      const area = table ? table.area : 'Dining Area A';
      cleaningStore.addActivity(`Completed cleaning ${label}`, area, 'check_circle', 'green');
      await cleaningAPI.completeTask(taskId);
      await loadDashboard();
    },
    verifyTask: async (taskId: string) => {
      const table = cleaningStore.tables.find(t => t.taskId === taskId || t.id === taskId);
      const label = table ? table.id : 'Table';
      const area = table ? table.area : 'Dining Area A';
      cleaningStore.addActivity(`Verified & approved ${label}`, area, 'verified', 'purple');
      await cleaningAPI.verifyTask(taskId);
      await loadDashboard();
    },
    pauseTask: async (taskId: string, isPaused?: boolean) => {
      const table = cleaningStore.tables.find(t => t.taskId === taskId || t.id === taskId);
      const label = table ? table.id : 'Table';
      const area = table ? table.area : 'Dining Area A';
      cleaningStore.addActivity(isPaused ? `Paused cleaning ${label}` : `Resumed cleaning ${label}`, area, 'pause', 'orange');
      await cleaningAPI.pauseTask(taskId, isPaused);
      await loadDashboard();
    },
    triggerDeepClean: async (taskId: string, isDeepCleaning?: boolean) => {
      const table = cleaningStore.tables.find(t => t.taskId === taskId || t.id === taskId);
      const label = table ? table.id : 'Table';
      const area = table ? table.area : 'Dining Area A';
      cleaningStore.addActivity(`Triggered deep clean for ${label}`, area, 'cleaning_services', 'purple');
      await cleaningAPI.triggerDeepClean(taskId, isDeepCleaning);
      await loadDashboard();
    },
    reportMaintenanceIssue: async (data: {
      tableId: string;
      issueType: string;
      description: string;
      severity?: string;
    }) => {
      const table = cleaningStore.tables.find(t => t.id === data.tableId);
      const label = table ? table.id : 'Table';
      const area = table ? table.area : 'Dining Area A';
      const desc = data.issueType ? data.issueType.replace(/_/g, ' ') : 'Maintenance issue';
      cleaningStore.addActivity(`Reported maintenance for ${label}`, desc, 'warning', 'orange');
      const res = await cleaningAPI.reportMaintenanceIssue(data);
      await loadDashboard();
      return res;
    },
    reportIssue: (taskId: string, issue: string) => cleaningStore.reportMaintenance(taskId, issue),
    refresh: loadDashboard,
  };
}