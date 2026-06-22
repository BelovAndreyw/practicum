import { http, openAuthenticatedFile } from '../client';
import { mockDelay } from '../mock/delay';
import { shouldUseMock } from '../mock/config';

const USE_MOCK = shouldUseMock();

export interface ChallengeReportItem {
  id: number;
  team_id: number;
  challenge_id: number | null;
  title: string;
  description: string | null;
  created_by: number;
  created_at: string;
  is_approved: boolean;
  files: Array<{
    id: number;
    filename: string;
    file_size: number;
    content_type: string;
    uploaded_at: string;
  }>;
}

export const reportsApi = {
  async listPending(): Promise<ChallengeReportItem[]> {
    if (USE_MOCK) { await mockDelay(); return []; }
    const data = await http.get<{ reports: ChallengeReportItem[] }>('/reports/pending');
    return data.reports;
  },

  async approve(reportId: number): Promise<void> {
    if (USE_MOCK) { await mockDelay(400); return; }
    await http.post(`/reports/${reportId}/approve`, {});
  },

  async reject(reportId: number): Promise<void> {
    if (USE_MOCK) { await mockDelay(400); return; }
    await http.post(`/reports/${reportId}/reject`, {});
  },

  async openFile(reportId: number, fileId: number): Promise<void> {
    if (USE_MOCK) { await mockDelay(200); return; }
    await openAuthenticatedFile(`/reports/${reportId}/files/${fileId}`);
  },
};
