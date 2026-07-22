// src/features/staff/hooks/useStaffProfile.ts

import { useState, useEffect } from 'react';
import { userAPI } from '../api/staff.api';
import { staffStore, type WaiterProfile } from '../store/staff.store';

export function useStaffProfile() {
  const [profile, setProfile] = useState(() => staffStore.profile);

  useEffect(() => {
    const unsubscribe = staffStore.subscribe(() => {
      setProfile(staffStore.profile);
    });

    void (async () => {
      try {
        const result = await userAPI.getProfile();
        if (result.success && result.data) {
          staffStore.updateProfile({
            name: result.data.name,
            role: result.data.role,
            email: result.data.email,
            phone: result.data.phone,
          });
        }
      } catch (error) {
        console.warn('Unable to refresh staff profile', error);
      }
    })();

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    profile,
    updateProfile: async (updated: Partial<WaiterProfile> & { mobileOtp?: string }) => {
      staffStore.updateProfile(updated);
      try {
        await userAPI.updateProfile({
          name: updated.name,
          phone: updated.phone,
          mobileOtp: updated.mobileOtp,
        } as any);
      } catch (error) {
        console.error('Failed to sync profile change with backend', error);
      }
    }
  };
}
