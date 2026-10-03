export async function requestJson(path) {
  const response = await fetch(path, {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export const healthApi = {
  service: () => requestJson("/api/health"),
  database: () => requestJson("/api/ready"),
};
