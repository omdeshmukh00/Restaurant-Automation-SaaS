import { apiClient } from '../../../shared/services/apiClient';

export interface AdminProfile {
  id: string;
  name: string | null;
  email: string;
  mobile: string | null;
  role: string;
  avatar?: string | null;
}

export interface UpdateProfilePayload {
  name?: string;
  mobile?: string;
  avatar?: string;
  themeMode?: string;
}

export const adminUserApi = {
  getMe: async (): Promise<AdminProfile> => {
    const response = await apiClient.get('/users/me');
    return response.data.data.user;
  },
  updateMe: async (data: UpdateProfilePayload): Promise<AdminProfile> => {
    const response = await apiClient.patch('/users/me', data);
    return response.data.data.user;
  },
};
