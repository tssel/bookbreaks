(() => {
  let keywords = [];
  let keywordExempt = false;
  let approvedVideoKey = null;

  const overlay = document.createElement("div");
  overlay.id = "read-before-youtube-overlay";
  overlay.innerHTML = `
    <div class="read-before-youtube-card">
      <div class="read-before-youtube-mark">BOOKBREAKS</div>
      <h1 id="read-before-youtube-heading">Read before this video</h1>
      <p id="read-before-youtube-message">Complete a reading session in the BookBreaks popup to watch this video.</p>
      <button id="read-before-youtube-allow" hidden>Allow this video</button>
      <button id="read-before-youtube-close">Return to YouTube</button>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #read-before-youtube-overlay {
      align-items: center;
      background: rgba(11, 13, 20, .96);
      color: #eef0f5;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      inset: 0;
      justify-content: center;
      position: fixed;
      z-index: 2147483647;
    }
    .read-before-youtube-card {
      background: #11141c;
      border: 1px solid rgba(238, 240, 245, .12);
      border-left: 3px solid #c8955a;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, .28);
      max-width: 384px;
      padding: 32px;
      text-align: center;
    }
    .read-before-youtube-mark {
      color: #c8955a;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: .08em;
    }
    .read-before-youtube-card h1 {
      color: #f3eadc;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 30px;
      font-weight: 500;
      letter-spacing: -.02em;
      line-height: 1.15;
      margin: 12px 0 8px;
    }
    .read-before-youtube-card p {
      color: #a3a9b8;
      font-size: 14px;
      line-height: 1.5;
      margin: 0;
    }
    #read-before-youtube-close {
      background: #1a1e28;
      border: 1px solid rgba(238, 240, 245, .12);
      border-radius: 8px;
      color: #d7dbe4;
      cursor: pointer;
      font-weight: 700;
      margin-top: 12px;
      padding: 11px 18px;
    }
    #read-before-youtube-allow {
      background: #f3eadc;
      border: 0;
      border-radius: 8px;
      color: #17191f;
      cursor: pointer;
      font-weight: 700;
      margin: 12px 8px 0 0;
      padding: 11px 18px;
    }
    #read-before-youtube-allow:hover {
      background: #fff7eb;
    }
    #read-before-youtube-close:hover {
      background: #232936;
    }
    #read-before-youtube-allow:focus-visible,
    #read-before-youtube-close:focus-visible {
      outline: 2px solid #c8955a;
      outline-offset: 2px;
    }
  `;
  document.documentElement.append(style, overlay);

  const showBlocked = () => {
    document.getElementById("read-before-youtube-heading").textContent = "Read before this video";
    document.getElementById("read-before-youtube-message").textContent =
      "Complete a reading session in the BookBreaks popup to watch this video.";
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
      document.getElementById("read-before-youtube-heading").textContent = "Possible study video";
      document.getElementById("read-before-youtube-message").textContent =
        "This title matches your keyword list. Allow this video without using earned time?";
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
