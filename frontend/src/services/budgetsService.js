import { apiRequest } from './apiClient';

const SERVICE = 'budgets-service';

export function listBudgets() {
  return apiRequest(SERVICE, '/budgets');
}

export function getBudget(projectId) {
  return apiRequest(SERVICE, `/budgets/${projectId}`);
}

export function createBudget(data) {
  return apiRequest(SERVICE, '/budgets', { method: 'POST', body: data });
}

export function updateBudget(projectId, data) {
  return apiRequest(SERVICE, `/budgets/${projectId}`, { method: 'PUT', body: data });
}

export function recordExpense(projectId, amount, description) {
  return apiRequest(SERVICE, `/budgets/${projectId}/expenses`, {
    method: 'POST',
    body: { amount, description },
  });
}
