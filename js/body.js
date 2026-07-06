import { db } from "./firebase.js";
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { $, escapeHtml, state, todayId, userPath } from "./shared.js";

let bodyMode = "weight";

const numOrNull = (id) => {
  const el = $(id);
  const value = el ? Number(el.value) : NaN;
  return Number.isFinite(value) ? value : null;
};
const signed = (value, suffix = " kg") => {
  if (!Number.isFinite(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}${suffix}`;
};
const weightText = (value) => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)} kg` : "-";
const recordDateMs = (r) => new Date(`${r.date || "1900-01-01"}T00:00:00`).getTime();
const normalizeRecord = (r = {}) => ({
  ...r,
  skeletalMuscle: r.skeletalMuscle ?? r.muscleMass ?? null,
  bodyFatPercent: r.bodyFatPercent ?? r.bodyFat ?? null,
  bodyFatMass: r.bodyFatMass ?? null,
  bmi: r.bmi ?? null
});
const sortedBodyRecords = () => state.bodyRecords.map(normalizeRecord).sort((a, b) => recordDateMs(b) - recordDateMs(a));

export function setBodyMode(mode = "weight") {
  bodyMode = mode;
  const isInBody = mode === "inbody";
  $("bodyWeightModeBtn")?.classList.toggle("active", !isInBody);
  $("bodyInbodyModeBtn")?.classList.toggle("active", isInBody);
  document.querySelectorAll(".inbody-field").forEach(el => el.classList.toggle("hidden", !isInBody));
  const note = $("bodyNote");
  if (note && isInBody && !note.value.trim()) note.value = "InBody";
}

export function bindBodyRecordUi() {
  $("bodyWeightModeBtn")?.addEventListener("click", () => setBodyMode("weight"));
  $("bodyInbodyModeBtn")?.addEventListener("click", () => setBodyMode("inbody"));
  if ($("bodyDate") && !$("bodyDate").value) $("bodyDate").value = todayId();
  setBodyMode("weight");
}

export async function addBodyRecord(refresh) {
  if (!state.currentUser) return alert("請先登入");
  const date = $("bodyDate")?.value || todayId();
  const record = {
    type: bodyMode === "inbody" ? "inbody" : "weight",
    date,
    weight: numOrNull("bodyWeight"),
    skeletalMuscle: bodyMode === "inbody" ? numOrNull("skeletalMuscle") : null,
    bodyFatMass: bodyMode === "inbody" ? numOrNull("bodyFatMass") : null,
    bmi: bodyMode === "inbody" ? numOrNull("bodyBmi") : null,
    bodyFatPercent: bodyMode === "inbody" ? numOrNull("bodyFatPercent") : null,
    note: $("bodyNote")?.value.trim() || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  if (!record.weight) return alert("請輸入體重");
  await addDoc(collection(db, ...userPath("bodyRecords")), record);
  ["bodyWeight", "skeletalMuscle", "bodyFatMass", "bodyBmi", "bodyFatPercent", "bodyNote"].forEach(id => { if ($(id)) $(id).value = ""; });
  if ($("bodyDate")) $("bodyDate").value = todayId();
  setBodyMode("weight");
  await refresh();
}

function renderBodySummary(records) {
  const latest = records[0];
  const previous = records[1];
  const oldest = records[records.length - 1];
  const current = Number(latest?.weight);
  const prev = Number(previous?.weight);
  const start = Number(oldest?.weight);
  const lastChange = Number.isFinite(current) && Number.isFinite(prev) ? current - prev : NaN;
  const totalChange = Number.isFinite(current) && Number.isFinite(start) ? current - start : NaN;

  if ($("bodyCurrentWeight")) $("bodyCurrentWeight").textContent = weightText(current);
  if ($("bodyLastChange")) $("bodyLastChange").textContent = signed(lastChange);
  if ($("bodyStartWeight")) $("bodyStartWeight").textContent = weightText(start);
  if ($("bodyTotalChange")) $("bodyTotalChange").textContent = signed(totalChange);
  if ($("latestBodyWeight")) $("latestBodyWeight").textContent = weightText(current);
  if ($("bodyWeightChange")) $("bodyWeightChange").textContent = signed(totalChange);
}

function renderTrend(records) {
  const el = $("bodyTrend");
  if (!el) return;
  const data = records.filter(r => Number.isFinite(Number(r.weight))).sort((a, b) => recordDateMs(a) - recordDateMs(b));
  if (data.length < 2) {
    el.className = "body-chart empty-state";
    el.textContent = "至少需要兩筆體重資料才會顯示趨勢圖。";
    return;
  }
  const w = 720, h = 240, pad = 34;
  const weights = data.map(r => Number(r.weight));
  const min = Math.min(...weights) - 0.5;
  const max = Math.max(...weights) + 0.5;
  const x = (i) => pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1);
  const y = (value) => h - pad - ((value - min) * (h - pad * 2)) / Math.max(1, max - min);
  const points = data.map((r, i) => `${x(i)},${y(Number(r.weight))}`).join(" ");
  const dots = data.map((r, i) => `<circle cx="${x(i)}" cy="${y(Number(r.weight))}" r="4"><title>${escapeHtml(r.date)}：${Number(r.weight).toFixed(1)} kg</title></circle>`).join("");
  const labels = data.map((r, i) => {
    if (data.length > 8 && i % Math.ceil(data.length / 6) !== 0 && i !== data.length - 1) return "";
    const label = String(r.date || "").slice(5).replace("-", "/");
    return `<text x="${x(i)}" y="${h - 8}" text-anchor="middle">${escapeHtml(label)}</text>`;
  }).join("");
  el.className = "body-chart";
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="體重趨勢圖"><line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h-pad}" class="axis"/><line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" class="axis"/><text x="${pad}" y="18" text-anchor="start">${max.toFixed(1)}kg</text><text x="${pad}" y="${h-pad-6}" text-anchor="start">${min.toFixed(1)}kg</text><polyline points="${points}" fill="none" stroke-width="3"/>${dots}${labels}</svg>`;
}

function renderBodyList(records) {
  const el = $("bodyList");
  if (!el) return;
  if (!records.length) {
    el.className = "record-list empty-state";
    el.textContent = "尚無紀錄。";
    return;
  }
  el.className = "body-table-wrap";
  el.innerHTML = `<table class="body-table"><thead><tr><th>日期</th><th>體重</th><th>骨骼肌</th><th>體脂肪重</th><th>BMI</th><th>體脂率</th><th>備註</th></tr></thead><tbody>${records.map(r => `<tr><td>${escapeHtml(r.date || "-")}</td><td>${r.weight ?? "-"}</td><td>${r.skeletalMuscle ?? "-"}</td><td>${r.bodyFatMass ?? "-"}</td><td>${r.bmi ?? "-"}</td><td>${r.bodyFatPercent ?? "-"}</td><td>${escapeHtml(r.note || (r.type === "inbody" ? "InBody" : ""))}</td></tr>`).join("")}</tbody></table>`;
}

export function renderBodyRecords() {
  const records = sortedBodyRecords();
  renderBodySummary(records);
  renderTrend(records);
  renderBodyList(records);
}
