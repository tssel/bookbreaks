const timerElement = document.getElementById("timer");
const earnedElement = document.getElementById("earned");
const durationInput = document.getElementById("duration");
const startButton = document.getElementById("start");
const pauseButton = document.getElementById("pause");
const stopButton = document.getElementById("stop");
const statusElement = document.getElementById("status");

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const send = (type, extra = {}) => new Promise((resolve) => {
  chrome.runtime.sendMessage({ type, ...extra }, resolve);
});

const render = (state) => {
  const { reading, earnedSeconds } = state;
  timerElement.textContent = formatTime(reading.remainingSeconds);
  earnedElement.textContent = formatTime(earnedSeconds);
  durationInput.value = Math.round(reading.durationSeconds / 60);
  startButton.hidden = reading.isRunning;
  pauseButton.hidden = !reading.isRunning;
  durationInput.disabled = reading.isRunning;
  statusElement.textContent = earnedSeconds > 0
    ? "You can watch video links until your balance runs out."
    : "YouTube video links are locked until you earn time.";
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

refresh();
setInterval(refresh, 1000);
