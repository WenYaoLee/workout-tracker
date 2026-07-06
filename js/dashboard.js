import { $, isThisWeek, recordText, state, todayId } from "./shared.js";

export function setTodayDate() {
  const el = $("todayDate");
  if (el) el.textContent = new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
}
export function renderDashboard() {
  const today = todayId();
  const todayRecords = state.allRecords.filter(r => r.date === today);
  const strengthCount = todayRecords.filter(r => r.type === "strength").length;
  const todayCardio = todayRecords.filter(r => r.type === "cardio").reduce((s, r) => s + (Number(r.minutes) || 0), 0);
  const weekDates = new Set(state.allRecords.filter(r => isThisWeek(r.date)).map(r => r.date));
  const weekCardio = state.allRecords.filter(r => r.type === "cardio" && isThisWeek(r.date)).reduce((s, r) => s + (Number(r.minutes) || 0), 0);
  if ($("todaySetCount")) $("todaySetCount").textContent = `${strengthCount} 組`;
  if ($("todayCardioMinutes")) $("todayCardioMinutes").textContent = `${todayCardio} 分`;
  if ($("weekWorkoutCount")) $("weekWorkoutCount").textContent = `${weekDates.size} 天`;
  if ($("weekCardioMinutes")) $("weekCardioMinutes").textContent = `${weekCardio} 分`;
  if ($("dashboardSummary")) $("dashboardSummary").innerHTML = todayRecords.length ? todayRecords.slice(0, 6).map(recordText).join("") : "今天尚無訓練紀錄。";
}
