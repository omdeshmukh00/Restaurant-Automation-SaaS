import { apiClient } from "../../../shared/services/apiClient";

export const reservationApi = {
  getReservations: async () => {
  const response = await apiClient.get("/admin/reservations");
  return response.data.data.reservations;
},

  getReservation: async (id: string) => {
    const response = await apiClient.get(`/admin/reservations/${id}`);
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