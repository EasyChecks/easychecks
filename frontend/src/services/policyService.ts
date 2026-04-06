import api from './api';

export interface Policy {
  policyId: number;
  key: string;
  title: string;
  content: string;
  version: string;
  isActive: boolean;
}

export const policyService = {
  async getAll(): Promise<Policy[]> {
    const res = await api.get('/policies');
    return res.data.data;
  },

  async getByKey(key: string): Promise<Policy> {
    const res = await api.get(`/policies/${key}`);
    return res.data.data;
  },
};
