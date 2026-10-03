const refreshButton = document.querySelector("#refresh");

async function checkService(path, target, successMessage) {
  target.textContent = "正在连接…";
  target.className = "status";
  try {
    const response = await fetch(path, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Service unavailable");
    const result = await response.json();
    if (result.status !== "ok") throw new Error("Service unavailable");
    target.textContent = successMessage;
    target.className = "status connected";
  } catch {
    target.textContent = "暂时无法连接";
    target.className = "status error";
  }
}

async function refreshStatus() {
  refreshButton.disabled = true;
  await Promise.all([
    checkService("/api/health", document.querySelector("#api-status"), "服务已连接"),
    checkService("/api/ready", document.querySelector("#database-status"), "数据库已连接"),
  ]);
  refreshButton.disabled = false;
}

refreshButton.addEventListener("click", refreshStatus);
refreshStatus();
