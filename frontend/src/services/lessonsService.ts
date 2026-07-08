/**
 * Lessons Learned API service.
 */
import { apiClient } from './apiClient';
import type { ApiSuccess } from '@/types';
import type { LessonsOverview, LessonsSummary } from '@/types/lessons';

export const lessonsService = {
  async overview(): Promise<LessonsOverview> {
    const { data } = await apiClient.get<ApiSuccess<LessonsOverview>>('/lessons/overview');
    return data.data;
  },

  async summary(): Promise<LessonsSummary> {
    const { data } = await apiClient.post<ApiSuccess<LessonsSummary>>('/lessons/summary');
    return data.data;
  },
};
