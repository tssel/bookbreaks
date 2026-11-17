const timerElement = document.getElementById("timer");
const earnedElement = document.getElementById("earned");
const durationInput = document.getElementById("duration");
const startButton = document.getElementById("start");
const pauseButton = document.getElementById("pause");
const stopButton = document.getElementById("stop");
const statusElement = document.getElementById("status");
const scheduleToggle = document.getElementById("schedule-toggle");
const schedulePanel = document.getElementById("schedule-panel");
const scheduleEnabled = document.getElementById("schedule-enabled");
const scheduleStart = document.getElementById("schedule-start");
const scheduleEnd = document.getElementById("schedule-end");
const saveSchedule = document.getElementById("save-schedule");
const scheduleStatus = document.getElementById("schedule-status");

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const send = (type, extra = {}) => new Promise((resolve) => {
  chrome.runtime.sendMessage({ type, ...extra }, resolve);
});

const render = (state) => {
  const { reading, earnedSeconds, schedule } = state;
  const editingDuration = document.activeElement === durationInput;
  const editingSchedule = [scheduleEnabled, scheduleStart, scheduleEnd].includes(document.activeElement);
  timerElement.textContent = formatTime(reading.remainingSeconds);
  earnedElement.textContent = formatTime(earnedSeconds);
  if (!editingDuration) {
    durationInput.value = Math.round(reading.durationSeconds / 60);
  }
  startButton.hidden = reading.isRunning;
  pauseButton.hidden = !reading.isRunning;
  durationInput.disabled = reading.isRunning;
  statusElement.textContent = earnedSeconds > 0
    ? "Your earned time is ready for video pages."
    : "Video pages stay restricted until you earn time.";
  if (!editingSchedule) {
    scheduleEnabled.checked = schedule.enabled;
    scheduleStart.value = schedule.start;
    scheduleEnd.value = schedule.end;
  }
  scheduleStatus.textContent = schedule.enabled
    ? `Videos restricted from ${schedule.start} to ${schedule.end}.`
    : "Off: videos are restricted all day.";
};

const refresh = async () => {
  const response = await send("get-state");
  if (response?.state) {
    render(response.state);
  }
};

startButton.addEventListener("click", async () => {
  const response = await send("start");
  if (response?.state) render(response.state);
});

pauseButton.addEventListener("click", async () => {
  const response = await send("pause");
  if (response?.state) render(response.state);
});

stopButton.addEventListener("click", async () => {
  const response = await send("stop");
  if (response?.state) render(response.state);
});

durationInput.addEventListener("change", async () => {
  const minutes = Math.min(120, Math.max(1, Number(durationInput.value) || 25));
  durationInput.value = minutes;
  const response = await send("set-duration", { seconds: minutes * 60 });
  if (response?.state) render(response.state);
  if (response?.error) statusElement.textContent = response.error;
});

scheduleToggle.addEventListener("click", () => {
  schedulePanel.hidden = !schedulePanel.hidden;
});

saveSchedule.addEventListener("click", async () => {
  const response = await send("set-schedule", {
    enabled: scheduleEnabled.checked,
    start: scheduleStart.value,
    end: scheduleEnd.value
  });
  if (response?.state) {
    render(response.state);
  }
  if (response?.error) {
    scheduleStatus.textContent = response.error;
  }
});

refresh();
setInterval(refresh, 1000);
