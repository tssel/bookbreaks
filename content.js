(() => {
  let keywords = [];
  let keywordExempt = false;
  let approvedVideoKey = null;

  const overlay = document.createElement("div");
  overlay.id = "read-before-youtube-overlay";
  overlay.innerHTML = `
    <div class="read-before-youtube-card">
      <div class="read-before-youtube-mark">READ FIRST</div>
      <h1 id="read-before-youtube-heading">Reading time required</h1>
      <p id="read-before-youtube-message">Finish a reading session in the extension popup to unlock this video.</p>
      <button id="read-before-youtube-allow" hidden>Allow this video</button>
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
    #read-before-youtube-allow {
      background: #93c5fd;
      border: 0;
      border-radius: 10px;
      color: #172033;
      cursor: pointer;
      font-weight: 700;
      margin: 12px 8px 0 0;
      padding: 11px 18px;
    }
  `;
  document.documentElement.append(style, overlay);

  const showBlocked = () => {
    document.getElementById("read-before-youtube-heading").textContent = "Reading time required";
    document.getElementById("read-before-youtube-message").textContent =
      "Finish a reading session in the extension popup to unlock this video.";
    document.getElementById("read-before-youtube-allow").hidden = true;
    overlay.style.display = "flex";
  };

  const isWatchPage = () => location.href.includes("youtube.com/watch");
  const videoKey = () => location.href;
  const isApproved = () => approvedVideoKey === videoKey();

  const titleMatchesKeyword = () => {
    const title = document.title.toLowerCase();
    return keywords.some((keyword) => title.includes(keyword));
  };

  const checkAccess = () => {
    if (!isWatchPage()) {
      overlay.style.display = "none";
      return;
    }
    if (keywordExempt && isApproved()) {
      overlay.style.display = "none";
      return;
    }
    if (keywordExempt) {
      document.getElementById("read-before-youtube-heading").textContent = "Educational video detected";
      document.getElementById("read-before-youtube-message").textContent =
        "This title matches your keyword list. Do you want to allow this video?";
      document.getElementById("read-before-youtube-allow").hidden = false;
      overlay.style.display = "flex";
      return;
    }

    chrome.runtime.sendMessage({ type: "get-state" }, (response) => {
      if (chrome.runtime.lastError || !response?.state) {
        showBlocked();
        return;
      }
      if (response.videoBlocked && response.state.earnedSeconds <= 0) {
        showBlocked();
      } else {
        overlay.style.display = "none";
      }
    });
  };

  document.getElementById("read-before-youtube-allow").addEventListener("click", () => {
    approvedVideoKey = videoKey();
    overlay.style.display = "none";
  });

  document.getElementById("read-before-youtube-close").addEventListener("click", () => {
    history.back();
  });

  checkAccess();
  setInterval(() => {
    if (!isWatchPage() || (keywordExempt && isApproved())) {
      overlay.style.display = "none";
      return;
    }
    if (keywordExempt) {
      checkAccess();
      return;
    }
    chrome.runtime.sendMessage({ type: "consume-watch-second" }, (response) => {
      if (response?.videoBlocked && response.earnedSeconds === 0) {
        showBlocked();
      } else if (response?.videoBlocked === false || response?.earnedSeconds > 0) {
        overlay.style.display = "none";
      }
    });
  }, 1000);

  let lastUrl = location.href;
  let lastTitle = document.title;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      approvedVideoKey = null;
      keywordExempt = titleMatchesKeyword();
      checkAccess();
    }
    if (isWatchPage()) {
      if (document.title !== lastTitle) {
        lastTitle = document.title;
        approvedVideoKey = null;
      }
      const nextKeywordExempt = titleMatchesKeyword();
      if (nextKeywordExempt !== keywordExempt) {
        keywordExempt = nextKeywordExempt;
        checkAccess();
      }
    }
  }, 500);

  fetch(chrome.runtime.getURL("keywords.txt"))
    .then((response) => {
      if (!response.ok) {
        throw new Error(`keywords.txt returned ${response.status}`);
      }
      return response.text();
    })
    .then((text) => {
      keywords = text
        .split(/\r?\n/)
        .map((keyword) => keyword.trim().toLowerCase())
        .filter(Boolean);
      keywordExempt = titleMatchesKeyword();
      checkAccess();
    })
    .catch((error) => {
      console.error("BookBreaks could not load keywords.txt:", error);
    });
})();
