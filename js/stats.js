import { $, normalizeValueUnit, state } from "./shared.js";

const pad2 = (n) => String(n).padStart(2, "0");
const toDate = (dateString) => {
  const [y, m, d] = String(dateString || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};
const toDateId = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const formatDateLabel = (date) => `${date.getMonth() + 1}/${date.getDate()}`;
const formatMonthLabel = (monthId) => {
  const [year, month] = monthId.split("-");
  return `${year}/${Number(month)}月`;
};
const monthIdOf = (dateString) => {
  const d = toDate(dateString);
  return d ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}` : "";
};
const weekStartOf = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
};
const weekIdOf = (dateString) => {
  const d = toDate(dateString);
  return d ? toDateId(weekStartOf(d)) : "";
};
const weekLabelOf = (weekId) => {
  const start = toDate(weekId);
  if (!start) return weekId || "週區間";
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${formatDateLabel(start)} ~ ${formatDateLabel(end)}`;
};

function getWeekOptions() {
  const weekIds = [...new Set(state.allRecords.map((r) => weekIdOf(r.date)).filter(Boolean))];
  return weekIds.sort((a, b) => b.localeCompare(a)).map((id) => ({ id, label: weekLabelOf(id) }));
}

function getMonthOptions() {
  const monthIds = [...new Set(state.allRecords.map((r) => monthIdOf(r.date)).filter(Boolean))];
  return monthIds.sort((a, b) => b.localeCompare(a)).map((id) => ({ id, label: formatMonthLabel(id) }));
}

function ensureStatsSelectors() {
  const weekSelect = $("statsWeekSelect");
  const monthSelect = $("statsMonthSelect");
  if (!weekSelect || !monthSelect) return;

  const currentWeekValue = weekSelect.value;
  const weekOptions = getWeekOptions();
  weekSelect.innerHTML = weekOptions.length
    ? weekOptions.map((o) => `<option value="${o.id}">${o.label}</option>`).join("")
    : `<option value="">沒有週區間資料</option>`;
  if (weekOptions.some((o) => o.id === currentWeekValue)) weekSelect.value = currentWeekValue;

  const currentMonthValue = monthSelect.value;
  const monthOptions = getMonthOptions();
  monthSelect.innerHTML = monthOptions.length
    ? monthOptions.map((o) => `<option value="${o.id}">${o.label}</option>`).join("")
    : `<option value="">沒有月份資料</option>`;
  if (monthOptions.some((o) => o.id === currentMonthValue)) monthSelect.value = currentMonthValue;
}

function updateStatsControls(range) {
  const controls = $("statsRangeControls");
  const weekField = $("weekRangeField");
  const monthField = $("monthRangeField");
  if (!controls || !weekField || !monthField) return;
  controls.classList.toggle("hidden", range === "all");
  weekField.classList.toggle("hidden", range !== "week");
  monthField.classList.toggle("hidden", range !== "month");
}

function getRangeRecords(range) {
  if (range === "week") {
    const selectedWeek = $("statsWeekSelect")?.value || getWeekOptions()[0]?.id || "";
    return state.allRecords.filter((r) => weekIdOf(r.date) === selectedWeek);
  }
  if (range === "month") {
    const selectedMonth = $("statsMonthSelect")?.value || getMonthOptions()[0]?.id || "";
    return state.allRecords.filter((r) => monthIdOf(r.date) === selectedMonth);
  }
  return state.allRecords;
}

function getRangeText(range) {
  if (range === "week") return $("statsWeekSelect")?.selectedOptions?.[0]?.textContent || "週區間";
  if (range === "month") return $("statsMonthSelect")?.selectedOptions?.[0]?.textContent || "月份";
  return "全部";
}

export function renderStats() {
  ensureStatsSelectors();
  const range = document.querySelector(".range-tab.active")?.dataset.range || "all";
  updateStatsControls(range);
  const records = getRangeRecords(range);
  const dates = new Set(records.map((r) => r.date));
  const strength = records.filter((r) => r.type === "strength");
  const cardio = records.filter((r) => r.type === "cardio");
  const cardioMinutes = cardio.reduce((s, r) => s + (Number(r.minutes) || 0), 0);
  const totalReps = strength
    .filter((r) => normalizeValueUnit(r.valueUnit || r.repUnit || "reps") === "reps")
    .reduce((s, r) => s + (Number(r.value ?? r.reps) || 0), 0);
  const totalTime = strength
    .filter((r) => normalizeValueUnit(r.valueUnit || r.repUnit || "reps") !== "reps")
    .reduce((s, r) => {
      const unit = normalizeValueUnit(r.valueUnit || r.repUnit || "sec");
      const value = Number(r.value ?? r.reps) || 0;
      return s + (unit === "min" ? value * 60 : value);
    }, 0);
  const bodyweightCount = strength.filter((r) => r.mode === "bodyweight" || r.weight === "Bodyweight").length;

  if ($("totalWorkoutDays")) $("totalWorkoutDays").textContent = dates.size;
  if ($("totalSets")) $("totalSets").textContent = strength.length;
  if ($("totalCardio")) $("totalCardio").textContent = `${cardioMinutes} 分`;
  if ($("totalExercises")) $("totalExercises").textContent = state.exerciseOptions.length;

  const byCategory = strength.reduce((acc, r) => {
    const k = r.category || "其他";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const byMode = strength.reduce((acc, r) => {
    const k = r.mode || "weight";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const rangeText = getRangeText(range);
  const el = $("statsDetail");
  if (!el) return;

  el.innerHTML = records.length
    ? `<div class="stats-selected-range">目前檢視：<strong>${rangeText}</strong></div><div class="stats-grid">
    <div><h4>${rangeText}重訓部位</h4>${top.map(([k, v]) => `<p>${k}：${v} 組</p>`).join("") || "<p>尚無重訓</p>"}</div>
    <div><h4>${rangeText}重訓摘要</h4><p>訓練天數：${dates.size} 天</p><p>總組數：${strength.length}</p><p>總次數：${totalReps} reps</p><p>總時間：${totalTime} sec</p><p>Bodyweight：${bodyweightCount} 組</p></div>
    <div><h4>${rangeText}型態</h4><p>Weight：${byMode.weight || 0}</p><p>Bodyweight：${byMode.bodyweight || 0}</p><p>Time：${byMode.time || 0}</p></div>
    <div><h4>${rangeText}有氧摘要</h4><p>筆數：${cardio.length}</p><p>總時間：${cardioMinutes} 分</p></div>
  </div>`
    : `${rangeText}尚無紀錄。請切換其他週區間、月份，或查看「全部」。`;
}

export function bindStatsTabs() {
  document.querySelectorAll(".range-tab").forEach((btn) =>
    btn.addEventListener("click", () => {
      document.querySelectorAll(".range-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderStats();
    })
  );
  $("statsWeekSelect")?.addEventListener("change", renderStats);
  $("statsMonthSelect")?.addEventListener("change", renderStats);
}
