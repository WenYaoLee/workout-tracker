import { $, escapeHtml, exerciseDisplayText, normalizeId, normalizeValueUnit, state } from "./shared.js";

const pad2 = (n) => String(n).padStart(2, "0");
const dateId = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const toDate = (id) => {
  const [y, m, d] = String(id || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};
const formatShortDate = (id) => {
  const d = toDate(id);
  return d ? `${d.getMonth() + 1}/${d.getDate()}` : id;
};
const formatFullDate = (id) => {
  const d = toDate(id);
  return d ? `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}` : id;
};
const dayLabel = ["日", "一", "二", "三", "四", "五", "六"];

function getActivityByDate() {
  const map = new Map();
  state.allRecords.forEach((record) => {
    if (!record.date) return;
    const item = map.get(record.date) || { date: record.date, strength: 0, cardio: 0, cardioMinutes: 0 };
    if (record.type === "strength") item.strength += 1;
    if (record.type === "cardio") {
      item.cardio += 1;
      item.cardioMinutes += Number(record.minutes) || 0;
    }
    map.set(record.date, item);
  });
  return map;
}

function getHeatmapRange(activityMap) {
  const today = new Date();
  const dates = [...activityMap.keys()].sort();
  const minDataDate = dates[0] ? toDate(dates[0]) : today;
  const maxDataDate = dates.at(-1) ? toDate(dates.at(-1)) : today;
  const end = new Date(Math.max(today.getTime(), maxDataDate.getTime()));
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + (6 - end.getDay()));
  const fallbackStart = new Date(end);
  fallbackStart.setDate(end.getDate() - 7 * 11 - end.getDay());
  const start = new Date(Math.min(minDataDate.getTime(), fallbackStart.getTime()));
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return { start, end };
}

function activityClass(item) {
  if (!item || (!item.strength && !item.cardio)) return "none";
  if (item.strength && item.cardio) return "both";
  if (item.strength) return "strength";
  return "cardio";
}

function activityText(item) {
  if (!item || (!item.strength && !item.cardio)) return "沒有訓練";
  if (item.strength && item.cardio) return "重訓 + 有氧";
  if (item.strength) return "重訓";
  return "有氧";
}

export function renderHeatmap() {
  const el = $("trainingHeatmap");
  if (!el) return;
  const activity = getActivityByDate();
  const { start, end } = getHeatmapRange(activity);
  const days = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const id = dateId(d);
    days.push({ id, day: d.getDay(), item: activity.get(id) });
  }
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  el.classList.remove("empty-state");
  el.innerHTML = `<div class="heatmap-scroll"><div class="heatmap-grid" style="grid-template-columns: 28px repeat(${weeks.length}, 18px);">
    <div></div>${weeks.map((week) => `<div class="heatmap-month">${week[0] && toDate(week[0].id).getDate() <= 7 ? `${toDate(week[0].id).getMonth() + 1}月` : ""}</div>`).join("")}
    ${dayLabel.map((label, dayIndex) => `<div class="heatmap-day-label">${label}</div>${weeks.map((week) => {
      const day = week.find((w) => w.day === dayIndex);
      const item = day?.item;
      const type = activityClass(item);
      return `<button class="heatmap-cell heatmap-${type}" data-heatmap-date="${day.id}" title="${formatFullDate(day.id)} ${activityText(item)}"></button>`;
    }).join("")}`).join("")}
  </div></div>
  <div class="heatmap-legend">
    <span><i class="heatmap-dot heatmap-none"></i>沒有訓練</span>
    <span><i class="heatmap-dot heatmap-strength"></i>重訓</span>
    <span><i class="heatmap-dot heatmap-cardio"></i>有氧</span>
    <span><i class="heatmap-dot heatmap-both"></i>重訓 + 有氧</span>
  </div>`;
  el.querySelectorAll("[data-heatmap-date]").forEach((btn) => btn.addEventListener("click", () => renderHeatmapSummary(btn.dataset.heatmapDate)));
  renderHeatmapSummary(days.findLast((d) => d.item)?.id || dateId(new Date()));
}

export function renderHeatmapSummary(date) {
  const el = $("heatmapSummary");
  if (!el) return;
  const records = state.allRecords.filter((r) => r.date === date);
  const strength = records.filter((r) => r.type === "strength");
  const cardio = records.filter((r) => r.type === "cardio");
  const cardioMinutes = cardio.reduce((sum, r) => sum + (Number(r.minutes) || 0), 0);
  const exerciseNames = [...new Set(strength.map((r) => r.exerciseName).filter(Boolean))];
  el.classList.remove("empty-state");
  el.innerHTML = `<div class="heatmap-summary-card">
    <div><span class="muted">${formatFullDate(date)}</span><h4>${activityText({ strength: strength.length, cardio: cardio.length })}</h4></div>
    <div class="heatmap-summary-grid">
      <span>重訓 ${strength.length} 組</span>
      <span>有氧 ${cardioMinutes} 分</span>
      <span>動作 ${exerciseNames.length} 種</span>
    </div>
    ${exerciseNames.length ? `<p class="muted">${exerciseNames.map(escapeHtml).join("、")}</p>` : `<p class="muted">這天沒有訓練紀錄。</p>`}
  </div>`;
}

function strengthRecords() {
  return state.allRecords.filter((r) => r.type === "strength" && r.exerciseName);
}
function exerciseNames() {
  return [...new Set(strengthRecords().map((r) => r.exerciseName))].sort((a, b) => a.localeCompare(b, "zh-Hant"));
}
function groupSelectedExerciseRecords(name) {
  const rows = strengthRecords().filter((r) => normalizeId(r.exerciseName) === normalizeId(name));
  const map = new Map();
  rows.forEach((r) => {
    const item = map.get(r.date) || { date: r.date, records: [] };
    item.records.push(r);
    map.set(r.date, item);
  });
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date)).map((item) => {
    item.records.sort((a, b) => String(a.trainingTime || "").localeCompare(String(b.trainingTime || "")));
    return item;
  });
}

function metricValue(day, metric) {
  if (metric === "maxWeight") {
    const weights = day.records.map((r) => Number(r.weight)).filter(Number.isFinite);
    return weights.length ? Math.max(...weights) : null;
  }
  if (metric === "volume") {
    const total = day.records.reduce((sum, r) => {
      const weight = Number(r.weight);
      const reps = Number(r.value ?? r.reps);
      const unit = normalizeValueUnit(r.valueUnit || r.repUnit || "reps");
      return Number.isFinite(weight) && Number.isFinite(reps) && unit === "reps" ? sum + weight * reps : sum;
    }, 0);
    return total || null;
  }
  if (metric === "time") {
    const total = day.records.reduce((sum, r) => {
      const unit = normalizeValueUnit(r.valueUnit || r.repUnit || "reps");
      const value = Number(r.value ?? r.reps);
      if (!Number.isFinite(value) || unit === "reps") return sum;
      return sum + (unit === "min" ? value * 60 : value);
    }, 0);
    return total || null;
  }
  const total = day.records.reduce((sum, r) => {
    const unit = normalizeValueUnit(r.valueUnit || r.repUnit || "reps");
    const value = Number(r.value ?? r.reps);
    return unit === "reps" && Number.isFinite(value) ? sum + value : sum;
  }, 0);
  return total || null;
}

function metricLabel(metric) {
  return { maxWeight: "最大重量", volume: "Volume", reps: "總次數", time: "總時間(sec)" }[metric] || "最大重量";
}

function drawLineChart(data, metric) {
  const chart = $("exerciseHistoryChart");
  if (!chart) return;
  const points = data.map((d) => ({ date: d.date, value: metricValue(d, metric) })).filter((d) => d.value !== null);
  if (points.length < 2) {
    chart.className = "exercise-chart empty-state";
    chart.innerHTML = points.length === 1 ? `只有 1 天資料，累積更多紀錄後會顯示趨勢圖。` : `這個指標目前沒有足夠資料。`;
    return;
  }
  const width = 720, height = 260, pad = 42;
  const values = points.map((p) => p.value);
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const coords = points.map((p, i) => {
    const x = pad + (i * (width - pad * 2)) / Math.max(1, points.length - 1);
    const y = height - pad - ((p.value - min) / range) * (height - pad * 2);
    return { ...p, x, y };
  });
  chart.className = "exercise-chart";
  chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${metricLabel(metric)}趨勢圖">
    <line class="axis" x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}"></line>
    <line class="axis" x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}"></line>
    <text x="${pad}" y="24">${metricLabel(metric)}</text>
    <text x="${pad}" y="${height - 12}">${formatShortDate(points[0].date)}</text>
    <text x="${width - pad - 44}" y="${height - 12}">${formatShortDate(points.at(-1).date)}</text>
    <text x="8" y="${pad + 5}">${Math.round(max * 10) / 10}</text>
    <text x="8" y="${height - pad + 5}">${Math.round(min * 10) / 10}</text>
    <polyline points="${coords.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
    ${coords.map((p) => `<g><circle cx="${p.x}" cy="${p.y}" r="5"></circle><text x="${p.x - 14}" y="${p.y - 10}">${Math.round(p.value * 10) / 10}</text></g>`).join("")}
  </svg>`;
}

function renderExerciseDetail(name, days) {
  const el = $("exerciseHistoryDetail");
  if (!el) return;
  if (!name || !days.length) {
    el.className = "record-list empty-state";
    el.innerHTML = "尚無動作歷史。";
    return;
  }
  el.className = "record-list";
  el.innerHTML = days.slice().reverse().map((day) => {
    const records = day.records;
    const weights = [...new Set(records.map((r) => r.weight === "Bodyweight" ? "Bodyweight" : `${r.weight ?? "-"}${r.unit || ""}`))].join(" / ");
    const reps = records.map((r) => {
      const unit = normalizeValueUnit(r.valueUnit || r.repUnit || "reps");
      const value = r.value ?? r.reps ?? "-";
      return unit === "reps" ? value : `${value} ${unit}`;
    }).join(" / ");
    const rpes = records.map((r) => r.rpe ?? "-").join(" / ");
    const totalReps = records.reduce((sum, r) => normalizeValueUnit(r.valueUnit || r.repUnit || "reps") === "reps" ? sum + (Number(r.value ?? r.reps) || 0) : sum, 0);
    const notes = records.map((r) => r.note).filter(Boolean).join("；");
    return `<div class="record-card exercise-history-card"><div><h4>${formatFullDate(day.date)}｜${escapeHtml(name)}</h4><p>重量：${escapeHtml(weights)}｜組數：${records.length}｜次數：${escapeHtml(reps)}｜RPE：${escapeHtml(rpes)}</p><p>總次數：${totalReps || "-"}${notes ? `｜備註：${escapeHtml(notes)}` : ""}</p><div class="record-meta">${records.map((r) => `<span class="tag">${escapeHtml(r.trainingTime || "--:--")} ${exerciseDisplayText(r)}</span>`).join("")}</div></div></div>`;
  }).join("");
}

export function renderExerciseHistory() {
  const select = $("exerciseHistorySelect");
  if (!select) return;
  const names = exerciseNames();
  const current = select.value;
  select.innerHTML = names.length ? names.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("") : `<option value="">尚無動作資料</option>`;
  if (names.includes(current)) select.value = current;
  const name = select.value || names[0] || "";
  const metric = $("exerciseMetricSelect")?.value || "maxWeight";
  const days = name ? groupSelectedExerciseRecords(name) : [];
  drawLineChart(days, metric);
  renderExerciseDetail(name, days);
}

export function bindAnalysisControls() {
  $("exerciseHistorySelect")?.addEventListener("change", renderExerciseHistory);
  $("exerciseMetricSelect")?.addEventListener("change", renderExerciseHistory);
}
