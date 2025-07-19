import axios from 'axios';
import { ApiErrorPayload } from 'shared';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

api.interceptors.response.use(
  (resp) => resp,
  (err) => {
    const payload = err?.response?.data as ApiErrorPayload | undefined;
    const message =
      payload?.message ??
      (err.code === 'ERR_NETWORK' ? 'Network error – check connection' : 'Unexpected error');
    console.log({
      title: 'Oops',
      description: message,
      variant: 'destructive',
    });
    return Promise.reject(err);
  },
);
