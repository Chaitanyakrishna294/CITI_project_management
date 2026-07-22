import { apiRequest } from './apiClient';

const SERVICE = 'deliverables-service';

export function listDeliverables(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return apiRequest(SERVICE, `/deliverables${query ? `?${query}` : ''}`);
}

export function createDeliverable(data) {
  return apiRequest(SERVICE, '/deliverables', { method: 'POST', body: data });
}

export function updateDeliverable(id, data) {
  return apiRequest(SERVICE, `/deliverables/${id}`, { method: 'PUT', body: data });
}

export function deleteDeliverable(id) {
  return apiRequest(SERVICE, `/deliverables/${id}`, { method: 'DELETE' });
}

export function listDependencies(id) {
  return apiRequest(SERVICE, `/deliverables/${id}/dependencies`);
}

export function addDependency(id, dependsOnId) {
  return apiRequest(SERVICE, `/deliverables/${id}/dependencies`, {
    method: 'POST',
    body: { depends_on_deliverable_id: dependsOnId },
  });
}

export function removeDependency(id, dependencyId) {
  return apiRequest(SERVICE, `/deliverables/${id}/dependencies/${dependencyId}`, { method: 'DELETE' });
}
