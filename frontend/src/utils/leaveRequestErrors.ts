type AxiosErrorShape = {
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
    };
  };
};

export function getLeaveRequestErrorMessage(err: unknown, fallback: string): string {
  const response = (err as AxiosErrorShape)?.response;
  if (response?.status === 409) {
    return 'มีการลาซ้ำซ้อนหรือเคยลาวันดังกล่าวแล้ว';
  }

  const apiMessage = response?.data?.message || response?.data?.error;
  return apiMessage || fallback;
}
