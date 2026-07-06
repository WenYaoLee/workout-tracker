import { db } from "./firebase.js";
import { doc, getDoc, increment, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { $, escapeHtml, exerciseDisplayText, normalizeId, normalizeValueUnit, state, tsMs, userPath } from "./shared.js";

export function sortExercises(list = state.exerciseOptions) {
  return [...list].sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite) || tsMs(b.lastUsedAt) - tsMs(a.lastUsedAt) || (b.useCount || 0) - (a.useCount || 0));
}
function filteredExerciseOptions() { const group = $("muscleGroup")?.value; return sortExercises(group ? state.exerciseOptions.filter(e => (e.category || "其他") === group) : state.exerciseOptions); }
export function renderExerciseOptions() { const d = $("exerciseOptions"); if (d) d.innerHTML = filteredExerciseOptions().map(e => `<option value="${escapeHtml(e.name)}">${escapeHtml(e.category || "其他")}</option>`).join(""); }
export function getSelectedExercise() { const name = ($("exerciseName")?.value || "").trim().toLowerCase(); return state.exerciseOptions.find(e => e.name?.toLowerCase() === name); }
export function renderExerciseInsight() {
  const box = $("exerciseInsight"); if (!box) return;
  const selected = getSelectedExercise();
  if (!selected) { box.innerHTML = `<div class="insight-box"><span>🏆 最大重量</span><strong>-</strong></div><div class="insight-box"><span>🔥 最多次數</span><strong>-</strong></div><div class="insight-box"><span>🕓 上次訓練</span><strong>新器材</strong></div>`; if ($("favoriteCurrentBtn")) $("favoriteCurrentBtn").textContent = "☆ 收藏器材"; return; }
  if (selected.category && !$("muscleGroup").value) $("muscleGroup").value = selected.category;
  if ((selected.defaultUnit || selected.lastUnit) && $("unit")) $("unit").value = selected.defaultUnit || selected.lastUnit;
  if ($("favoriteCurrentBtn")) $("favoriteCurrentBtn").textContent = selected.favorite ? "★ 已收藏" : "☆ 收藏器材";
  const last = selected.lastDisplay || `${selected.lastWeight ?? "-"}${selected.lastUnit || ""} × ${selected.lastReps ?? "-"}${selected.lastValueUnit && selected.lastValueUnit !== "reps" ? ` ${selected.lastValueUnit}` : ""}${selected.lastRpe ? `｜RPE ${selected.lastRpe}` : ""}`;
  box.innerHTML = `<div class="insight-box"><span>🏆 最大重量</span><strong>${selected.maxWeight ?? "-"}${selected.maxWeightUnit || ""} × ${selected.maxWeightReps ?? "-"}</strong></div><div class="insight-box"><span>🔥 最多次數</span><strong>${selected.maxRepsWeight ?? "-"}${selected.maxRepsUnit || ""} × ${selected.maxReps ?? "-"}</strong></div><div class="insight-box"><span>🕓 上次訓練</span><strong>${last}</strong></div>`;
}
export async function updateExerciseOption(record, usedAtValue = serverTimestamp()) {
  const ref = doc(db, ...userPath("exerciseOptions", normalizeId(record.exerciseName)));
  const snap = await getDoc(ref); const old = snap.exists() ? snap.data() : {};
  const sameUnitMaxWeight = !old.maxWeightUnit || old.maxWeightUnit === record.unit;
  const sameUnitMaxReps = !old.maxRepsUnit || old.maxRepsUnit === record.unit;
  const numericWeight = Number(record.weight);
  const hasNumericWeight = Number.isFinite(numericWeight);
  const valueUnit = normalizeValueUnit(record.valueUnit || record.repUnit || "reps");
  const repsValue = Number(record.value ?? record.reps);
  const canWeightPr = hasNumericWeight && valueUnit === "reps";
  const canRepsPr = valueUnit === "reps" && Number.isFinite(repsValue);
  const isMaxWeight = canWeightPr && (old.maxWeight == null || (sameUnitMaxWeight && numericWeight > Number(old.maxWeight)) || !sameUnitMaxWeight);
  const isMaxReps = canRepsPr && (old.maxReps == null || (sameUnitMaxReps && repsValue > Number(old.maxReps)) || !sameUnitMaxReps);
  const isMaxTime = valueUnit !== "reps" && Number.isFinite(repsValue) && (old.maxTime == null || repsValue > Number(old.maxTime));
  const shouldUpdateLast = !tsMs(old.lastUsedAt) || Date.parse(`${record.date}T12:00:00`) >= tsMs(old.lastUsedAt);
  await setDoc(ref, { name: record.exerciseName, category: record.category || old.category || "其他", defaultUnit: record.unit || old.defaultUnit || "kg", favorite: old.favorite || false, useCount: increment(1), updatedAt: serverTimestamp(), createdAt: old.createdAt || usedAtValue, ...(shouldUpdateLast ? { lastUsedAt: usedAtValue, lastWeight: record.weight, lastUnit: record.unit || "", lastReps: record.value ?? record.reps, lastValueUnit: valueUnit, lastRpe: record.rpe, lastDisplay: exerciseDisplayText(record) } : {}), ...(isMaxWeight ? { maxWeight: record.weight, maxWeightUnit: record.unit, maxWeightReps: record.value ?? record.reps } : {}), ...(isMaxReps ? { maxReps: record.value ?? record.reps, maxRepsWeight: record.weight, maxRepsUnit: record.unit } : {}), ...(isMaxTime ? { maxTime: record.value ?? record.reps, maxTimeUnit: valueUnit, maxTimeWeight: record.weight, maxTimeLoadUnit: record.unit || "" } : {}) }, { merge: true });
}
export async function syncExerciseDatabaseFromRecords() {
  if (!state.currentUser || !state.allRecords?.length) return;
  const existingIds = new Set(state.exerciseOptions.map((e) => e.id));
  const grouped = new Map();
  state.allRecords.filter((r) => r.type === "strength" && r.exerciseName).forEach((record) => {
    const id = normalizeId(record.exerciseName);
    const item = grouped.get(id) || { id, name: record.exerciseName, category: record.category || "其他", defaultUnit: record.unit || "kg", modes: new Set(), count: 0 };
    item.count += 1;
    item.category = item.category || record.category || "其他";
    if (record.unit) item.defaultUnit = record.unit;
    if (record.mode) item.modes.add(record.mode);
    grouped.set(id, item);
  });
  const missing = [...grouped.values()].filter((item) => !existingIds.has(item.id));
  for (const item of missing) {
    await setDoc(doc(db, ...userPath("exerciseOptions", item.id)), {
      name: item.name,
      category: item.category || "其他",
      defaultUnit: item.defaultUnit || "kg",
      modes: [...item.modes],
      useCount: item.count,
      favorite: false,
      source: "autoSync",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    state.exerciseOptions.push({ id: item.id, name: item.name, category: item.category || "其他", defaultUnit: item.defaultUnit || "kg", modes: [...item.modes], useCount: item.count, favorite: false, source: "autoSync" });
  }
}

export async function toggleCurrentFavorite(refresh) {
  if (!state.currentUser) return alert("請先登入");
  const exerciseName = $("exerciseName").value.trim(); if (!exerciseName) return alert("請先選擇或輸入器材");
  const selected = getSelectedExercise();
  await setDoc(doc(db, ...userPath("exerciseOptions", normalizeId(exerciseName))), { name: exerciseName, category: $("muscleGroup").value || selected?.category || "其他", defaultUnit: $("unit").value, favorite: !selected?.favorite, updatedAt: serverTimestamp(), createdAt: selected?.createdAt || serverTimestamp() }, { merge: true });
  await refresh();
}
export async function toggleFavorite(optionId, refresh) { const item = state.exerciseOptions.find(e => e.id === optionId); if (!item) return; await setDoc(doc(db, ...userPath("exerciseOptions", optionId)), { favorite: !item.favorite, updatedAt: serverTimestamp() }, { merge: true }); await refresh(); }
export function renderExerciseList(refresh) {
  const el = $("exerciseList"); if (!el) return;
  const list = sortExercises();
  el.innerHTML = list.length ? list.map(e => `<div class="record-card"><div><h4>${e.favorite ? "⭐ " : ""}${escapeHtml(e.name)}</h4><p>${escapeHtml(e.category || "其他")}｜使用 ${e.useCount || 0} 次｜上次：${escapeHtml(e.lastDisplay || `${e.lastWeight ?? "-"}${e.lastUnit || ""} × ${e.lastReps ?? "-"}`)}</p><p>PR：${e.maxWeight ?? "-"}${e.maxWeightUnit || ""} × ${e.maxWeightReps ?? "-"}｜最多：${e.maxRepsWeight ?? "-"}${e.maxRepsUnit || ""} × ${e.maxReps ?? "-"}${e.maxTime ? `｜最長：${e.maxTime} ${e.maxTimeUnit || "sec"}` : ""}</p></div><button class="mini-btn" data-favorite-id="${e.id}">${e.favorite ? "取消收藏" : "收藏"}</button></div>`).join("") : "尚無器材資料。";
  el.querySelectorAll("[data-favorite-id]").forEach(btn => btn.addEventListener("click", () => toggleFavorite(btn.dataset.favoriteId, refresh)));
}
export function renderPrList() { const el = $("prList"); if (!el) return; const list = sortExercises().filter(e => e.maxWeight != null || e.maxReps != null || e.maxTime != null); el.innerHTML = list.length ? list.map(e => `<div class="record-card"><div><h4>🏆 ${escapeHtml(e.name)}</h4><p>最大重量：${e.maxWeight ?? "-"}${e.maxWeightUnit || ""} × ${e.maxWeightReps ?? "-"}</p><p>最多次數：${e.maxRepsWeight ?? "-"}${e.maxRepsUnit || ""} × ${e.maxReps ?? "-"}</p>${e.maxTime ? `<p>最長時間：${e.maxTime} ${e.maxTimeUnit || "sec"}</p>` : ""}</div></div>`).join("") : "尚無 PR 紀錄。"; }
