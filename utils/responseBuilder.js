export function buildResponse(status, message, data = {}) {
  return {
    success: status === "success",
    status,
    message,
    timestamp: new Date().toISOString(),
    ...data
  };
}
