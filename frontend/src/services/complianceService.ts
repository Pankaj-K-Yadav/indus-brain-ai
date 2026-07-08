/**
 * Compliance API service. Wraps the compliance analysis endpoint.
 */
import { apiClient } from './apiClient';
import type { ApiSuccess } from '@/types';
import type { ComplianceInput, ComplianceReport } from '@/types/compliance';

export const complianceService = {
  async analyze(input: ComplianceInput): Promise<ComplianceReport> {
    const { data } = await apiClient.post<ApiSuccess<ComplianceReport>>('/compliance/analyze', input);
    return data.data;
  },
};
