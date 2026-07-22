import { apiRequest } from './apiClient';

const SERVICE = 'projects-service';

export function listProjects(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return apiRequest(SERVICE, `/projects${query ? `?${query}` : ''}`);
}

export function getProject(id) {
  return apiRequest(SERVICE, `/projects/${id}`);
}

export function createProject(data) {
  return apiRequest(SERVICE, '/projects', { method: 'POST', body: data });
}

export function updateProject(id, data) {
  return apiRequest(SERVICE, `/projects/${id}`, { method: 'PUT', body: data });
}

export function archiveProject(id) {
  return apiRequest(SERVICE, `/projects/${id}`, { method: 'DELETE' });
}
