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

/** Response shape when updateProfile triggers a phone-change OTP flow */
export interface PhoneChangeResponse {
  message: string;
  pendingPhone: string;
  otpSent: true;
  otpExpiresIn: number;
}

/** Normal profile update response (no phone change, or phone was unchanged) */
export interface ProfileUpdateResponse {
  user: AdminProfile;
}

export type UpdateMeResponse = ProfileUpdateResponse | PhoneChangeResponse;

export const adminUserApi = {
  getMe: async (): Promise<AdminProfile> => {
    const response = await apiClient.get('/users/me');
    return response.data.data.user;
  },
  /** Update profile. When `mobile` differs from current, returns PhoneChangeResponse (no user). */
  updateMe: async (data: UpdateProfilePayload): Promise<UpdateMeResponse> => {
    const response = await apiClient.patch('/users/me', data);
    return response.data.data;
  },
  /** Request OTP resend for phone change */
  requestPhoneChangeOtp: async (mobile: string): Promise<PhoneChangeResponse> => {
    const response = await apiClient.patch('/users/me', { mobile });
    return response.data.data;
  },
  verifyPhoneOtp: async (otp: string): Promise<AdminProfile> => {
    const response = await apiClient.post('/users/me/verify-phone', { otp });
    return response.data.data.user;
  },
};
