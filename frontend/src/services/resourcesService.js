import { apiRequest } from './apiClient';

const SERVICE = 'resources-service';

export function listResources(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return apiRequest(SERVICE, `/resources${query ? `?${query}` : ''}`);
}

export function createResource(data) {
  return apiRequest(SERVICE, '/resources', { method: 'POST', body: data });
}

export function updateResource(id, data) {
  return apiRequest(SERVICE, `/resources/${id}`, { method: 'PUT', body: data });
}

export function listAllocations(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return apiRequest(SERVICE, `/allocations${query ? `?${query}` : ''}`);
}

export function createAllocation(data) {
  return apiRequest(SERVICE, '/allocations', { method: 'POST', body: data });
}

export function updateAllocation(id, data) {
  return apiRequest(SERVICE, `/allocations/${id}`, { method: 'PUT', body: data });
}

export function deleteAllocation(id) {
  return apiRequest(SERVICE, `/allocations/${id}`, { method: 'DELETE' });
}
