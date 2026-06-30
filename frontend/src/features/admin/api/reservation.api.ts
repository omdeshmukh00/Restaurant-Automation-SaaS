import { apiClient } from "../../../shared/services/apiClient";

export const reservationApi = {
  getReservations: async () => {
    const { data } = await apiClient.get("/admin/reservations");
    return data;
  },

  getReservation: async (id: string) => {
    const { data } = await apiClient.get(`/admin/reservations/${id}`);
    return data;
  },

  createReservation: async (payload: any) => {
    const { data } = await apiClient.post("/admin/reservations", payload);
    return data;
  },

  updateReservation: async (id: string, payload: any) => {
    const { data } = await apiClient.patch(`/admin/reservations/${id}`, payload);
    return data;
  },
};