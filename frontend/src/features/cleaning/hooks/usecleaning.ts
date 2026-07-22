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

          if (activeTask) {
            if (activeTask.status === 'IN_PROGRESS') {
              status = 'In Progress';
              progress = 45;
            } else if (activeTask.status === 'COMPLETED') {
              status = 'Ready for Inspection';
            } else {
              status = 'Needs Cleaning';
            }
          } else {
            const tableStatusUpper = (table.status || '').toUpperCase();
            if (['OCCUPIED', 'BILL_PENDING', 'PAYMENT_PENDING', 'PAID', 'ORDERING', 'FOOD_SERVED'].includes(tableStatusUpper)) {
              status = 'Occupied';
            } else if (tableStatusUpper === 'RESERVED') {
              status = 'Reserved';
            } else if (['DIRTY', 'NEEDS_CLEANING'].includes(tableStatusUpper)) {
              status = 'Needs Cleaning';
            } else {
              status = 'Available';
            }
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

          return {
            id: `Table ${table.tableNumber ?? 1}`,
            area: table.section || 'Dining Area A',
            seats: Number(table.capacity || 4),
            status: status as any,
            priority: priority as any,
            timeAgo: activeTask?.createdAt ? new Date(activeTask.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Just Now',
            assignedTo,
            progress,
            taskId,
            floor: table.floor || 1,
            section: table.section || 'Main',
          };
        });

        cleaningStore.syncTasks([]);
        cleaningStore.syncAllTables(mappedTables);
      }

      const staffRes = await apiClient.get<{ success: boolean; data: any[] }>('/admin/staff');
      if (staffRes.data?.success && Array.isArray(staffRes.data.data)) {
        const apiMembers = staffRes.data.data.map((m: any) => ({
          id: String(m._id || m.id),
          name: m.name || 'Cleaning Staff',
          role: m.role || 'Cleaning Staff',
          area: m.assignedArea || 'Dining Area A',
          phone: m.phone || '+91 98000 00000',
          avatar: m.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(m.name || 'Staff')}`,
        }));
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
      cleaningStore.addStaffMember(member);
      try {
        await apiClient.post('/admin/staff', {
          name: member.name,
          phone: member.phone,
          role: member.role || 'service-staff',
          assignedArea: member.area,
        });
      } catch (e) {
        console.warn('Failed to post staff member to backend', e);
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
    updateProfile: async (updated: Partial<StaffProfile>) => {
      cleaningStore.updateProfile(updated);
      try {
        const { profileAPI } = await import('../api/profile.api');
        await profileAPI.updateProfile({
          name: updated.name,
          phone: updated.phone,
        } as any);
      } catch (e) {
        console.error('Failed to sync profile changes with backend', e);
      }
    },
    assignTask: async (taskId: string) => {
      await cleaningAPI.startTask(taskId);
      await loadDashboard();
    },
    assignTaskToStaff: async (taskId: string, staffId?: string | null) => {
      await cleaningAPI.assignTask(taskId, staffId);
      await loadDashboard();
    },
    startTask: async (taskId: string) => {
      await cleaningAPI.startTask(taskId);
      await loadDashboard();
    },
    completeTask: async (taskId: string) => {
      await cleaningAPI.completeTask(taskId);
      await loadDashboard();
    },
    verifyTask: async (taskId: string) => {
      await cleaningAPI.verifyTask(taskId);
      await loadDashboard();
    },
    pauseTask: async (taskId: string, isPaused?: boolean) => {
      await cleaningAPI.pauseTask(taskId, isPaused);
      await loadDashboard();
    },
    triggerDeepClean: async (taskId: string, isDeepCleaning?: boolean) => {
      await cleaningAPI.triggerDeepClean(taskId, isDeepCleaning);
      await loadDashboard();
    },
    reportMaintenanceIssue: async (data: {
      tableId: string;
      issueType: string;
      description: string;
      severity?: string;
    }) => {
      const res = await cleaningAPI.reportMaintenanceIssue(data);
      await loadDashboard();
      return res;
    },
    reportIssue: (taskId: string, issue: string) => cleaningStore.reportMaintenance(taskId, issue),
    refresh: loadDashboard,
  };
}