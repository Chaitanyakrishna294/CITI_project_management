import { apiRequest } from './apiClient';

const SERVICE = 'users-service';

export function listUsers() {
  return apiRequest(SERVICE, '/users');
}

export function createUser(data) {
  return apiRequest(SERVICE, '/users', { method: 'POST', body: data });
}

export function updateUser(id, data) {
  return apiRequest(SERVICE, `/users/${id}`, { method: 'PUT', body: data });
}

export function deactivateUser(id) {
  return apiRequest(SERVICE, `/users/${id}`, { method: 'DELETE' });
}
