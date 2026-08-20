const API_URL = import.meta.env.VITE_API_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

async function request(path) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Erro ${response.status} ao chamar ${path}: ${body}`);
  }

  return response.json();
}

export function getOverview() {
  return request("/analytics/overview");
}

export function getEnrichments({ page = 1, limit = 10, idWorkspace = "", status = "" } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (idWorkspace) params.set("id_workspace", idWorkspace);
  if (status) params.set("status_processamento", status);
  return request(`/analytics/enrichments?${params.toString()}`);
}

export function getTopWorkspaces(limit = 5) {
  return request(`/analytics/workspaces/top?limit=${limit}`);
}
