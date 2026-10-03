export async function updateStatus(target, load, successMessage) {
  target.textContent = "正在连接…";
  target.className = "status";
  try {
    const result = await load();
    if (result.status !== "ok") throw new Error("Service unavailable");
    target.textContent = successMessage;
    target.className = "status connected";
  } catch {
    target.textContent = "暂时无法连接";
    target.className = "status error";
  }
}
