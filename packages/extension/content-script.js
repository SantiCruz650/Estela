window.addEventListener("message", (event) => {
  if (event.source !== window) {
    return;
  }
  const data = event.data;
  if (!data || data.source !== "devtool-webapp") {
    return;
  }
  if (data.type === "DEVTOOL_PING") {
    chrome.runtime.sendMessage({ type: "PING" }, (resp) => {
      window.postMessage(
        { source: "devtool-extension", type: "DEVTOOL_PONG", version: resp?.version ?? null },
        window.location.origin,
      );
    });
    return;
  }
  if (data.type === "EXECUTE_REQUEST") {
    chrome.runtime.sendMessage({ type: "EXECUTE_REQUEST", payload: data.payload }, (resp) => {
      window.postMessage(
        {
          source: "devtool-extension",
          type: "EXECUTE_RESPONSE",
          requestId: data.payload?.requestId,
          response: resp ?? null,
          bridgeError: chrome.runtime.lastError ? String(chrome.runtime.lastError) : null,
        },
        window.location.origin,
      );
    });
    return;
  }
});
