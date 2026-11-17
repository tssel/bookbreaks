const DEFAULT_STATE = {
  earnedSeconds: 0,
  reading: {
    durationSeconds: 1500,
    remainingSeconds: 1500,
    isRunning: false,
    startedAt: null
  },
  schedule: {
    enabled: false,
    configured: false,
    start: "09:00",
    end: "17:00",
    pending: null
  }
};

const getState = async () => {
  const stored = await chrome.storage.local.get("state");
  const state = stored.state ? normalizeState(stored.state) : DEFAULT_STATE;
  if (state.schedule.pending) {
    state.schedule = {
      ...state.schedule.pending,
      configured: true,
      pending: null
    };
    await saveState(state);
  }
  return state;
};

const normalizeState = (state) => ({
  earnedSeconds: Math.max(0, Number(state.earnedSeconds) || 0),
  reading: {
    durationSeconds: Math.max(60, Number(state.reading?.durationSeconds) || 1500),
    remainingSeconds: Math.max(0, Number(state.reading?.remainingSeconds) || 0),
    isRunning: Boolean(state.reading?.isRunning),
    startedAt: state.reading?.startedAt || null
  },
  schedule: {
    enabled: Boolean(state.schedule?.enabled),
    configured: Boolean(state.schedule?.configured),
    start: validTime(state.schedule?.start) ? state.schedule.start : "09:00",
    end: validTime(state.schedule?.end) ? state.schedule.end : "17:00",
    pending: state.schedule?.pending || null
  }
});

const validTime = (value) => typeof value === "string" && /^\d{2}:\d{2}$/.test(value)
  && Number(value.slice(0, 2)) < 24 && Number(value.slice(3)) < 60;

const scheduleIsActive = (schedule) => {
  if (!schedule.enabled) return true;
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const start = Number(schedule.start.slice(0, 2)) * 60 + Number(schedule.start.slice(3));
  const end = Number(schedule.end.slice(0, 2)) * 60 + Number(schedule.end.slice(3));
  if (start === end) return true;
  return start < end ? current >= start && current < end : current >= start || current < end;
};

const videoBlocked = (state) => scheduleIsActive(state.schedule);

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
        sendResponse({
          state: completedState,
          videoBlocked: videoBlocked(completedState)
        });
        return;
      }
      const currentState = { ...state, reading };
      sendResponse({ state: currentState, videoBlocked: videoBlocked(currentState) });
      return;
    }

    if (message.type === "set-schedule") {
      if (!validTime(message.start) || !validTime(message.end)) {
        sendResponse({ error: "Choose valid start and end times." });
        return;
      }

      const nextSchedule = {
        enabled: Boolean(message.enabled),
        start: message.start,
        end: message.end
      };
      const nextState = {
        ...state,
        schedule: { ...nextSchedule, configured: true, pending: null }
      };
      await saveState(nextState);
      sendResponse({ state: nextState, videoBlocked: videoBlocked(nextState) });
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
      if (!videoBlocked(state)) {
        sendResponse({ earnedSeconds: state.earnedSeconds, videoBlocked: false });
        return;
      }
      if (state.earnedSeconds <= 0) {
        sendResponse({ earnedSeconds: 0, videoBlocked: true });
        return;
      }
      const earnedSeconds = Math.max(0, state.earnedSeconds - 1);
      await saveState({ ...state, earnedSeconds });
      sendResponse({ earnedSeconds, videoBlocked: true });
    }
  })().catch((error) => {
    console.error("BookBreaks:", error);
    sendResponse({ error: "Something went wrong. Please try again." });
  });

  return true;
});
