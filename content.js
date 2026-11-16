(() => {
  const overlay = document.createElement("div");
  overlay.id = "read-before-youtube-overlay";
  overlay.innerHTML = `
    <div class="read-before-youtube-card">
      <div class="read-before-youtube-mark">READ FIRST</div>
      <h1>Reading time required</h1>
      <p>Finish a reading session in the extension popup to unlock this video.</p>
      <button id="read-before-youtube-close">Go back</button>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #read-before-youtube-overlay {
      align-items: center;
      background: rgba(15, 23, 42, .94);
      color: #f8fafc;
      display: none;
      font-family: Arial, sans-serif;
      inset: 0;
      justify-content: center;
      position: fixed;
      z-index: 2147483647;
    }
    .read-before-youtube-card {
      background: #1e293b;
      border: 1px solid #475569;
      border-radius: 18px;
      box-shadow: 0 24px 80px rgba(0, 0, 0, .35);
      max-width: 380px;
      padding: 32px;
      text-align: center;
    }
    .read-before-youtube-mark {
      color: #93c5fd;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .14em;
    }
    .read-before-youtube-card h1 {
      font-size: 28px;
      margin: 12px 0;
    }
    .read-before-youtube-card p {
      color: #cbd5e1;
      line-height: 1.5;
    }
    #read-before-youtube-close {
      background: #93c5fd;
      border: 0;
      border-radius: 10px;
      color: #172033;
      cursor: pointer;
      font-weight: 700;
      margin-top: 12px;
      padding: 11px 18px;
    }
  `;
  document.documentElement.append(style, overlay);

  const showBlocked = () => {
    overlay.style.display = "flex";
  };

  const isWatchPage = () => location.href.includes("youtube.com/watch");

  const checkAccess = () => {
    if (!isWatchPage()) {
      overlay.style.display = "none";
      return;
    }

    chrome.runtime.sendMessage({ type: "get-state" }, (response) => {
      if (chrome.runtime.lastError || !response?.state) {
        showBlocked();
        return;
      }
      if (response.state.earnedSeconds <= 0) {
        showBlocked();
      }
    });
  };

  document.getElementById("read-before-youtube-close").addEventListener("click", () => {
    history.back();
  });

  checkAccess();
  setInterval(() => {
    if (!isWatchPage()) {
      overlay.style.display = "none";
      return;
    }
    chrome.runtime.sendMessage({ type: "consume-watch-second" }, (response) => {
      if (response?.earnedSeconds === 0) {
        showBlocked();
      }
    });
  }, 1000);

  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      checkAccess();
    }
  }, 500);
})();
