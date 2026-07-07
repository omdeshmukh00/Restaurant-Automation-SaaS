import { apiClient } from "../../../shared/services/apiClient";

export const tableApi = {
  getTables: async (restaurantId: string) => {
    const res = await apiClient.get(
      `/admin/tables/restaurant/${restaurantId}`
    );

    return res.data.data.tables;
  },
};