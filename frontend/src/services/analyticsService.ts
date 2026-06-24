/**
 * Analytics API service.
 */
import { apiClient } from './apiClient';
import type { ApiSuccess } from '@/types';
import type { AnalyticsOverview } from '@/types/analytics';

export const analyticsService = {
  async overview(): Promise<AnalyticsOverview> {
    const { data } = await apiClient.get<ApiSuccess<AnalyticsOverview>>('/analytics/overview');
    return data.data;
  },
};
