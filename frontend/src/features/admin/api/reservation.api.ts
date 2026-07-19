import { apiClient } from "../../../shared/services/apiClient";

export const reservationApi = {
  getReservations: async (params?: { date?: string; status?: string; q?: string }) => {
  const response = await apiClient.get("/admin/reservations", { params });
  return response.data.data.reservations;
},

  getReservation: async (id: string) => {
    const response = await apiClient.get(`/admin/reservations/${id}`);
    return response.data.data;
  },

  getAvailability: async (date: string) => {
    const response = await apiClient.get("/admin/reservations/availability", { params: { date } });
    return response.data.data;
  },

  createReservation: async (payload: any) => {
    const response = await apiClient.post("/admin/reservations", payload);
    return response.data.data;
  },

  updateReservation: async (id: string, payload: any) => {
  const response = await apiClient.patch(
    `/admin/reservations/${id}`,
    payload
  );

  return response.data.data.reservation;
},
};