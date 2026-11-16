const DEFAULT_STATE = {
  earnedSeconds: 0,
  reading: {
    durationSeconds: 1500,
    remainingSeconds: 1500,
    isRunning: false,
    startedAt: null
  }
};

const getState = async () => {
  const stored = await chrome.storage.local.get("state");
  return stored.state ? normalizeState(stored.state) : DEFAULT_STATE;
};

const normalizeState = (state) => ({
  earnedSeconds: Math.max(0, Number(state.earnedSeconds) || 0),
  reading: {
    durationSeconds: Math.max(60, Number(state.reading?.durationSeconds) || 1500),
    remainingSeconds: Math.max(0, Number(state.reading?.remainingSeconds) || 0),
    isRunning: Boolean(state.reading?.isRunning),
    startedAt: state.reading?.startedAt || null
  }
});

const saveState = (state) => chrome.storage.local.set({ state });

const currentReading = (reading) => {
  if (!reading.isRunning || !reading.startedAt) {
    return reading;
  }

  const elapsed = Math.floor((Date.now() - reading.startedAt) / 1000);
  return {
    ...reading,
    remainingSeconds: Math.max(0, reading.remainingSeconds - elapsed),
    startedAt: Date.now()
  };
};

const updateTimer = async () => {
  const state = await getState();
  const reading = currentReading(state.reading);

  if (reading.isRunning && reading.remainingSeconds === 0) {
    await saveState({
      earnedSeconds: state.earnedSeconds + reading.durationSeconds,
      reading: {
        ...reading,
        isRunning: false,
        startedAt: null,
        remainingSeconds: reading.durationSeconds
      }
    });
    return;
  }

  if (reading.isRunning) {
    await saveState({ ...state, reading });
  }
};

chrome.runtime.onInstalled.addListener(async () => {
  const state = await getState();
  await saveState(state);
  chrome.alarms.create("reading-timer", { periodInMinutes: 0.5 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("reading-timer", { periodInMinutes: 0.5 });
});

chrome.alarms.onAlarm.addListener(updateTimer);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    const state = await getState();

    if (message.type === "get-state") {
      const reading = currentReading(state.reading);
      if (reading.isRunning && reading.remainingSeconds === 0) {
        const completedState = {
          earnedSeconds: state.earnedSeconds + reading.durationSeconds,
          reading: {
            ...reading,
            isRunning: false,
            startedAt: null,
            remainingSeconds: reading.durationSeconds
          }
        };
        await saveState(completedState);
        sendResponse({ state: completedState });
        return;
      }
      sendResponse({ state: { ...state, reading } });
      return;
    }

    if (message.type === "set-duration") {
      const durationSeconds = Math.max(60, Math.min(7200, Number(message.seconds) || 1500));
      const reading = currentReading(state.reading);
      if (reading.isRunning) {
        sendResponse({ error: "Pause the timer before changing its length." });
        return;
      }
      const elapsed = reading.durationSeconds - reading.remainingSeconds;
      const nextReading = {
        ...reading,
        durationSeconds,
        remainingSeconds: Math.max(0, durationSeconds - elapsed)
      };
      await saveState({ ...state, reading: nextReading });
      sendResponse({ state: { ...state, reading: nextReading } });
      return;
    }

    if (message.type === "start" || message.type === "pause") {
      const reading = currentReading(state.reading);
      const isRunning = message.type === "start";
      const nextReading = {
        ...reading,
        isRunning,
        startedAt: isRunning ? Date.now() : null
      };
      await saveState({ ...state, reading: nextReading });
      sendResponse({ state: { ...state, reading: nextReading } });
      return;
    }

    if (message.type === "stop") {
      const reading = currentReading(state.reading);
      const readSeconds = reading.durationSeconds - reading.remainingSeconds;
      const nextState = {
        earnedSeconds: state.earnedSeconds + Math.max(0, readSeconds),
        reading: {
          ...reading,
          isRunning: false,
          startedAt: null,
          remainingSeconds: reading.durationSeconds
        }
      };
      await saveState(nextState);
      sendResponse({ state: nextState });
      return;
    }

    if (message.type === "consume-watch-second") {
      if (state.earnedSeconds <= 0) {
        sendResponse({ earnedSeconds: 0 });
        return;
      }
      const earnedSeconds = Math.max(0, state.earnedSeconds - 1);
      await saveState({ ...state, earnedSeconds });
      sendResponse({ earnedSeconds });
    }
  })().catch((error) => {
    console.error("BookBreaks:", error);
    sendResponse({ error: "Something went wrong. Please try again." });
  });

  return true;
});
