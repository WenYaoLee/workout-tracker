import { db } from "./firebase.js";
import { collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export const state = { currentUser: null, exerciseOptions: [], allRecords: [], bodyRecords: [], cardioRecords: [] };
export const $ = (id) => document.getElementById(id);
export const todayId = () => new Date().toISOString().slice(0, 10);
export const formatDateTime = (date = new Date()) => date.toLocaleString("zh-TW", { hour12: false });
export const escapeHtml = (value = "") => String(value ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
export const normalizeId = (value) => String(value || "").trim().toLowerCase().replace(/[.#$/\[\]]/g, "-").replace(/\s+/g, "-").slice(0, 120);
export const userPath = (...parts) => {
  if (!state.currentUser) throw new Error("尚未登入");
  return ["users", state.currentUser.uid, ...parts];
};
export const tsMs = (ts) => {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return 0;
};
export function durationToMinutes(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  if (text.includes(":")) {
    const parts = text.split(":").map(Number);
    if (parts.length === 2) return Math.round(((parts[0] || 0) * 60 + (parts[1] || 0)) / 60);
    if (parts.length === 3) return Math.round(((parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)) / 60);
  }
  return Number(text.replace("分鐘", "")) || 0;
}
export const minutesToDuration = (minutes) => (Number(minutes) ? `${Number(minutes)} 分鐘` : "-");
export const isThisWeek = (dateString) => {
  const date = new Date(`${dateString}T00:00:00`);
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(start.getDate() + 7);
  return date >= start && date < end;
};
export const isThisMonth = (dateString) => {
  const d = new Date(`${dateString}T00:00:00`); const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
};

const BODYWEIGHT_WORDS = ["bodyweight", "bw", "自體重", "徒手", "自重"];
const TIME_UNITS = ["sec", "secs", "second", "seconds", "秒", "min", "mins", "minute", "minutes", "分"];
export const isBodyweightText = (value) => BODYWEIGHT_WORDS.includes(String(value || "").trim().toLowerCase());
export const isTimeUnit = (value) => TIME_UNITS.includes(String(value || "").trim().toLowerCase());
export const normalizeValueUnit = (unit = "reps") => {
  const u = String(unit || "reps").trim().toLowerCase();
  if (["sec", "secs", "second", "seconds", "秒"].includes(u)) return "sec";
  if (["min", "mins", "minute", "minutes", "分"].includes(u)) return "min";
  return "reps";
};
export function buildExerciseRecord(input = {}) {
  const exerciseName = String(input.exerciseName || "").trim();
  const category = String(input.category || "其他").trim() || "其他";
  const rawWeight = String(input.weight ?? "").trim();
  const rawUnit = String(input.unit || "").trim();
  const rawValue = String(input.value ?? input.reps ?? "").trim();
  const value = Number(rawValue);
  const valueUnit = normalizeValueUnit(input.valueUnit || input.repUnit || (isTimeUnit(rawUnit) ? rawUnit : "reps"));
  let mode = input.mode || "weight";
  if (isBodyweightText(rawWeight)) mode = valueUnit === "reps" ? "bodyweight" : "time";
  if (valueUnit !== "reps" && !rawUnit) mode = "time";
  const bodyweight = isBodyweightText(rawWeight) || mode === "bodyweight" || (mode === "time" && String(input.weight || "").toLowerCase() === "bodyweight");
  const weightNumber = Number(rawWeight);
  const hasNumericWeight = Number.isFinite(weightNumber);
  const weight = bodyweight ? "Bodyweight" : hasNumericWeight ? weightNumber : null;
  const unit = bodyweight ? "" : rawUnit;
  const rpeText = String(input.rpe ?? "").replace(/RPE/ig, "").trim();
  const rpe = rpeText ? Number(rpeText) : null;
  const validWeight = bodyweight || hasNumericWeight;
  const validUnit = bodyweight || !!unit;
  const errors = [];
  if (!exerciseName) errors.push("請輸入器材 / 動作");
  if (!validWeight) errors.push("請輸入重量，或選擇 Bodyweight");
  if (!validUnit) errors.push("請選擇重量單位");
  if (!Number.isFinite(value) || value <= 0) errors.push(valueUnit === "reps" ? "請輸入次數" : "請輸入時間");
  if (rpeText && !Number.isFinite(rpe)) errors.push("RPE 格式錯誤");
  return {
    ok: errors.length === 0,
    errors,
    record: {
      type: "strength",
      exerciseName,
      category,
      mode: bodyweight ? (valueUnit === "reps" ? "bodyweight" : "time") : (valueUnit === "reps" ? "weight" : "time"),
      weight,
      unit,
      reps: value,
      value,
      valueUnit,
      repUnit: valueUnit === "reps" ? "" : valueUnit,
      rpe: Number.isFinite(rpe) ? rpe : null,
      note: String(input.note || "").trim()
    }
  };
}
export function exerciseDisplayText(r = {}) {
  const value = r.value ?? r.reps ?? "-";
  const valueUnit = normalizeValueUnit(r.valueUnit || r.repUnit || "reps");
  const suffix = valueUnit === "reps" ? "" : ` ${valueUnit}`;
  const weight = r.weight === "Bodyweight" || r.mode === "bodyweight" ? "Bodyweight" : `${r.weight ?? "-"}${r.unit || ""}`;
  return `${escapeHtml(weight)} × ${escapeHtml(value)}${suffix}`;
}
export function cardioText(r, showDate = false) {
  const metrics = [];
  const duration = r.duration || minutesToDuration(r.minutes);
  if (duration && duration !== "-") metrics.push(escapeHtml(duration));
  if (r.calories) metrics.push(`${r.calories} kcal`);
  if (r.avgHeartRate) metrics.push(`${r.avgHeartRate} bpm`);
  if (r.avgPower) metrics.push(`${r.avgPower} W`);
  if (r.distance) metrics.push(`${r.distance} mi`);
  if (r.speed) metrics.push(escapeHtml(r.speed));
  if (r.resistance) metrics.push(`阻力 ${escapeHtml(r.resistance)}`);
  const timeRange = [r.startTime, r.endTime].filter(Boolean).join("–");
  return `<h4>🚴 ${showDate ? `${escapeHtml(r.date || "")}｜` : ""}${escapeHtml(r.cardioType || "有氧")}</h4><p>${metrics.length ? metrics.join("｜") : "未填詳細數據"}</p>${timeRange ? `<p>運動時間：${escapeHtml(timeRange)}</p>` : ""}<div class="record-meta">${r.note ? `<span class="tag">${escapeHtml(r.note)}</span>` : ""}${r.imageUrl ? `<a class="tag" href="${escapeHtml(r.imageUrl)}" target="_blank" rel="noopener">📷 照片</a>` : ""}</div>`;
}
export function recordText(r) {
  if (r.type === "cardio") return cardioText(r);
  if (r.type === "body") return `<h4>⚖️ 身體紀錄</h4><p>體重：${r.weight ?? "-"} kg｜體脂：${r.bodyFat ?? "-"}%｜肌肉量：${r.muscleMass ?? "-"} kg</p><div class="record-meta">${r.trainingTime ? `<span class="tag">${escapeHtml(r.trainingTime)}</span>` : ""}${r.note ? `<span class="tag">${escapeHtml(r.note)}</span>` : ""}</div>`;
  return `<h4>🏋️ ${escapeHtml(r.exerciseName || "未命名")}</h4><p>${exerciseDisplayText(r)}${r.rpe ? `｜RPE ${r.rpe}` : ""}</p><div class="record-meta">${r.trainingTime ? `<span class="tag">${escapeHtml(r.trainingTime)}</span>` : ""}<span class="tag">${escapeHtml(r.category || "其他")}</span>${r.mode ? `<span class="tag">${escapeHtml(r.mode)}</span>` : ""}${r.note ? `<span class="tag">${escapeHtml(r.note)}</span>` : ""}</div>`;
}
export async function touchWorkoutDate(date, patch = {}) {
  if (!date) return;
  await setDoc(doc(db, ...userPath("workouts", date)), { date, updatedAt: serverTimestamp(), ...patch }, { merge: true });
}
export async function loadExerciseOptionsData() {
  const snap = await getDocs(collection(db, ...userPath("exerciseOptions")));
  state.exerciseOptions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return state.exerciseOptions;
}
export async function loadAllWorkoutRecords() {
  const workoutSnap = await getDocs(collection(db, ...userPath("workouts")));
  const records = [];
  for (const workoutDoc of workoutSnap.docs) {
    const date = workoutDoc.data().date || workoutDoc.id;
    const recordSnap = await getDocs(query(collection(db, ...userPath("workouts", workoutDoc.id, "records")), orderBy("createdAt", "desc")));
    recordSnap.docs.forEach(recordDoc => records.push({ id: recordDoc.id, path: recordDoc.ref.path, date, ...recordDoc.data() }));
  }
  state.allRecords = records.sort((a, b) => {
    const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
    if (dateCompare !== 0) return dateCompare;
    return tsMs(b.createdAt) - tsMs(a.createdAt);
  });
  return state.allRecords;
}
export async function loadBodyRecordsData() {
  const snap = await getDocs(query(collection(db, ...userPath("bodyRecords")), orderBy("createdAt", "desc")));
  state.bodyRecords = snap.docs.map(d => ({ id: d.id, path: d.ref.path, type: "body", ...d.data() }));
  return state.bodyRecords;
}
export async function loadCardioRecordsData() {
  const snap = await getDocs(query(collection(db, ...userPath("cardioRecords")), orderBy("createdAt", "desc")));
  state.cardioRecords = snap.docs.map(d => ({ id: d.id, path: d.ref.path, type: "cardio", ...d.data() }));
  return state.cardioRecords;
}
export async function refreshData() { await loadExerciseOptionsData(); await loadAllWorkoutRecords(); await loadBodyRecordsData(); await loadCardioRecordsData(); }
