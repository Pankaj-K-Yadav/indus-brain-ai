/**
 * RCA API service. Wraps the Root Cause Analysis agent endpoint.
 */
import { apiClient } from './apiClient';
import type { ApiSuccess } from '@/types';
import type { RcaInput, RcaResult } from '@/types/rca';

export const rcaService = {
  async analyze(input: RcaInput): Promise<RcaResult> {
    const { data } = await apiClient.post<ApiSuccess<RcaResult>>('/rca/analyze', input);
    return data.data;
  },
};
