import { healthApi } from "../api/client.js";
import { updateStatus } from "../components/status-card.js";

export function mountHome() {
  const refreshButton = document.querySelector("#refresh");

  async function refreshStatus() {
    refreshButton.disabled = true;
    await Promise.all([
      updateStatus(document.querySelector("#api-status"), healthApi.service, "服务已连接"),
      updateStatus(document.querySelector("#database-status"), healthApi.database, "数据库已连接"),
    ]);
    refreshButton.disabled = false;
  }

  refreshButton.addEventListener("click", refreshStatus);
  refreshStatus();
}
