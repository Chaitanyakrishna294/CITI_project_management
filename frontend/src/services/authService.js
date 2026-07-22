import { apiRequest } from './apiClient';

const SERVICE = 'auth-service';

export function login(email, password) {
  return apiRequest(SERVICE, '/login', { method: 'POST', body: { email, password }, auth: false });
}

export function logout() {
  return apiRequest(SERVICE, '/logout', { method: 'POST' });
}

export function fetchCurrentUser() {
  return apiRequest(SERVICE, '/me', { method: 'GET' });
}
