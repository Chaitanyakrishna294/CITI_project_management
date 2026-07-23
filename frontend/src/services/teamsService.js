import { apiRequest } from './apiClient';

const SERVICE = 'teams-service';

// --- Individuals ---

export function listIndividuals(search) {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiRequest(SERVICE, `/individuals${query}`);
}

export function createIndividual(data) {
  return apiRequest(SERVICE, '/individuals', { method: 'POST', body: data });
}

export function updateIndividual(id, data) {
  return apiRequest(SERVICE, `/individuals/${id}`, { method: 'PUT', body: data });
}

export function deleteIndividual(id) {
  return apiRequest(SERVICE, `/individuals/${id}`, { method: 'DELETE' });
}

// --- Teams ---

export function listTeams(search) {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiRequest(SERVICE, `/teams${query}`);
}

export function getTeam(id) {
  return apiRequest(SERVICE, `/teams/${id}`);
}

export function createTeam(data) {
  return apiRequest(SERVICE, '/teams', { method: 'POST', body: data });
}

export function updateTeam(id, data) {
  return apiRequest(SERVICE, `/teams/${id}`, { method: 'PUT', body: data });
}

export function deleteTeam(id) {
  return apiRequest(SERVICE, `/teams/${id}`, { method: 'DELETE' });
}

export function addTeamMember(teamId, individualId) {
  return apiRequest(SERVICE, `/teams/${teamId}/members`, {
    method: 'POST',
    body: { individual_id: individualId },
  });
}

export function removeTeamMember(teamId, individualId) {
  return apiRequest(SERVICE, `/teams/${teamId}/members/${individualId}`, { method: 'DELETE' });
}

// --- Achievements ---

export function createAchievement(teamId, data) {
  return apiRequest(SERVICE, `/teams/${teamId}/achievements`, { method: 'POST', body: data });
}

export function updateAchievement(id, data) {
  return apiRequest(SERVICE, `/achievements/${id}`, { method: 'PUT', body: data });
}

export function deleteAchievement(id) {
  return apiRequest(SERVICE, `/achievements/${id}`, { method: 'DELETE' });
}

// --- Insights ---

export function getInsights() {
  return apiRequest(SERVICE, '/insights');
}
