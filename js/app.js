import { auth, provider } from "./firebase.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { db } from "./firebase.js";
import { $, buildExerciseRecord, durationToMinutes, formatDateTime, refreshData, state, todayId, touchWorkoutDate, userPath } from "./shared.js";
import { setTodayDate, renderDashboard } from "./dashboard.js";
import { renderHistory, renderToday } from "./history.js";
import { bindStatsTabs, renderStats } from "./stats.js";
import { addBodyRecord, bindBodyRecordUi, renderBodyRecords } from "./body.js";
import { addCardioRecord, renderCardioRecords } from "./cardio.js";
import { renderExerciseInsight, renderExerciseList, renderExerciseOptions, renderPrList, syncExerciseDatabaseFromRecords, toggleCurrentFavorite, updateExerciseOption } from "./exercise.js";
import { escapeHtml, recordText } from "./shared.js";
import { bindAnalysisControls, renderExerciseHistory, renderHeatmap } from "./analysis.js";

let selectedRpe = "";

function switchView(viewId) {
  const btn = document.querySelector(`.nav-link[data-view="${viewId}"]`);
  if (!btn || !$(viewId)) return;
  document.querySelectorAll(".nav-link").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".page-view").forEach(v => v.classList.remove("active"));
  btn.classList.add("active");
  $(viewId).classList.add("active");
  $("pageTitle").textContent = btn.textContent.replace(/[🏠🏋️📋🗓️🧰🏆⚖️🚴📊📈📥]/g, "").trim();
  $("sidebar").classList.remove("open");
}
function bindNavigation() {
  document.querySelectorAll(".nav-link").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));
  document.querySelectorAll("[data-go-view]").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.goView)));
  $("menuToggle")?.addEventListener("click", () => $("sidebar").classList.toggle("open"));
}
async function ensureUserProfile(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const profile = { displayName: user.displayName || "", email: user.email || "", photoURL: user.photoURL || "", targetWeight: 95, preferredUnit: "kg", theme: "dark" };
  await setDoc(ref, snap.exists() ? { displayName: profile.displayName, email: profile.email, photoURL: profile.photoURL, updatedAt: serverTimestamp() } : { ...profile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
}
async function refreshAll() {
  if (!state.currentUser) return;
  await refreshData();
  await syncExerciseDatabaseFromRecords();
  renderExerciseOptions();
  renderExerciseInsight();
  renderExerciseList(refreshAll);
  renderPrList();
  renderToday(refreshAll);
  renderHistory();
  renderBodyRecords();
  renderCardioRecords();
  renderDashboard();
  renderStats();
  renderHeatmap();
  renderExerciseHistory();
}
function bindAuth() {
  $("loginBtn").addEventListener("click", () => signInWithPopup(auth, provider));
  $("logoutBtn").addEventListener("click", () => signOut(auth));
  onAuthStateChanged(auth, async (user) => {
    state.currentUser = user;
    if (user) {
      $("userStatus").textContent = `已登入：${user.displayName || user.email}`;
      $("helloText").textContent = `準備好了，${(user.displayName || "Fire").split(" ")[0]}`;
      $("loginBtn").classList.add("hidden"); $("logoutBtn").classList.remove("hidden");
      await ensureUserProfile(user);
      await refreshAll();
    } else {
      $("userStatus").textContent = "尚未登入";
      $("helloText").textContent = "準備開始今天的訓練";
      $("loginBtn").classList.remove("hidden"); $("logoutBtn").classList.add("hidden");
    }
  });
}
function updateExerciseModeUI() {
  const mode = $("exerciseMode")?.value || "weight";
  const valueUnit = $("valueUnit")?.value || "reps";
  const weightInput = $("weight");
  const unitField = $("unitField");
  const weightLabel = $("weightLabel");
  const valueLabel = $("valueLabel");
  if (mode === "bodyweight") {
    if (weightInput) { weightInput.value = ""; weightInput.disabled = true; weightInput.placeholder = "Bodyweight"; }
    if (unitField) unitField.style.display = "none";
    if (weightLabel) weightLabel.textContent = "重量類型";
    if (valueLabel) valueLabel.textContent = valueUnit === "reps" ? "次數" : "時間";
  } else {
    if (weightInput) { weightInput.disabled = false; weightInput.placeholder = "0"; }
    if (unitField) unitField.style.display = "block";
    if (weightLabel) weightLabel.textContent = mode === "time" ? "重量 / 負重" : "重量";
    if (valueLabel) valueLabel.textContent = mode === "time" || valueUnit !== "reps" ? "時間" : "次數";
    if (mode === "time" && $("valueUnit")?.value === "reps") $("valueUnit").value = "sec";
  }
}
function currentExerciseInput() {
  const mode = $("exerciseMode")?.value || "weight";
  return {
    exerciseName: $("exerciseName").value,
    category: $("muscleGroup").value || "其他",
    mode,
    weight: mode === "bodyweight" ? "Bodyweight" : $("weight").value,
    unit: mode === "bodyweight" ? "" : $("unit").value,
    value: $("reps").value,
    valueUnit: $("valueUnit")?.value || "reps",
    rpe: selectedRpe || $("rpe")?.value,
    note: $("note").value
  };
}
function clearStrengthForm(clearName = true) {
  if (clearName) $("exerciseName").value = "";
  ["weight", "reps", "note", "rpe"].forEach(id => { if ($(id)) $(id).value = ""; });
  if ($("exerciseMode")) $("exerciseMode").value = "weight";
  if ($("valueUnit")) $("valueUnit").value = "reps";
  selectedRpe = "";
  document.querySelectorAll("#rpeButtons button").forEach(b => b.classList.remove("active"));
  updateExerciseModeUI();
  renderExerciseInsight();
}
async function addStrengthRecord() {
  if (!state.currentUser) return alert("請先登入");
  const parsed = buildExerciseRecord(currentExerciseInput());
  if (!parsed.ok) return alert(parsed.errors.join("\n"));
  const record = { ...parsed.record, date: todayId(), trainingTime: new Date().toTimeString().slice(0, 5), savedAtText: formatDateTime(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await touchWorkoutDate(record.date, { hasStrength: true });
  await addDoc(collection(db, ...userPath("workouts", record.date, "records")), record);
  await updateExerciseOption(record);
  $("reps").value = ""; $("note").value = "";
  await refreshAll();
}
function bindWorkoutForm() {
  $("exerciseName")?.addEventListener("input", renderExerciseInsight);
  $("exerciseName")?.addEventListener("change", renderExerciseInsight);
  $("exerciseMode")?.addEventListener("change", updateExerciseModeUI);
  $("valueUnit")?.addEventListener("change", updateExerciseModeUI);
  $("muscleGroup")?.addEventListener("change", () => { renderExerciseOptions(); renderExerciseInsight(); });
  $("addStrengthBtn")?.addEventListener("click", addStrengthRecord);
  $("clearStrengthBtn")?.addEventListener("click", () => clearStrengthForm(true));
  $("favoriteCurrentBtn")?.addEventListener("click", () => toggleCurrentFavorite(refreshAll));
  document.querySelectorAll("[data-step-target]").forEach(btn => btn.addEventListener("click", () => { const input = $(btn.dataset.stepTarget); if (!input || input.disabled) return; const next = Math.max(0, (Number(input.value) || 0) + Number(btn.dataset.step)); input.value = Number.isInteger(next) ? next : next.toFixed(1); }));
  document.querySelectorAll("#rpeButtons button").forEach(btn => btn.addEventListener("click", () => { selectedRpe = btn.dataset.rpe; $("rpe").value = selectedRpe; document.querySelectorAll("#rpeButtons button").forEach(b => b.classList.remove("active")); btn.classList.add("active"); }));
  updateExerciseModeUI();
}
function historicalTimestamp(dateString, timeString = "", offsetMinutes = 0) { const d = new Date(`${/^\d{4}-\d{2}-\d{2}$/.test(dateString) ? dateString : todayId()}T${/^\d{1,2}:\d{2}$/.test(timeString) ? timeString : "12:00"}:00`); d.setMinutes(d.getMinutes() + offsetMinutes); return Timestamp.fromDate(d); }
const looksLikeTime = (value) => /^\d{1,2}:\d{2}$/.test(String(value || "").trim());
function splitCsvLine(line) { const result = []; let current = ""; let inQuotes = false; for (let i = 0; i < line.length; i++) { const ch = line[i], next = line[i + 1]; if (ch === '"' && inQuotes && next === '"') { current += '"'; i++; continue; } if (ch === '"') { inQuotes = !inQuotes; continue; } if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; continue; } current += ch; } result.push(current.trim()); return result; }
function parseImportText() {
  const rows = ($("importText")?.value || "").split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("#"));
  const records = [], errors = []; let currentDate = "", mode = "";
  rows.forEach((line, index) => {
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(line)) { const [y,m,d] = line.split("-").map(Number); currentDate = `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`; mode = ""; return; }
    if (["重訓", "有氧", "身體數據", "身體紀錄"].includes(line)) { mode = line === "身體數據" ? "身體紀錄" : line; return; }
    if (!currentDate) { errors.push(`第 ${index + 1} 行：缺少日期`); return; }
    if (!mode) { errors.push(`第 ${index + 1} 行：缺少分類（重訓 / 有氧 / 身體紀錄）`); return; }
    const parts = splitCsvLine(line);
    if (mode === "重訓") {
      let trainingTime = "", values = parts;
      if (looksLikeTime(parts[0])) { trainingTime = parts[0]; values = parts.slice(1); }
      const [exerciseName, weightRaw = "", unitRaw = "", repsRaw = "", rpeRaw = "", categoryRaw = "其他", ...noteParts] = values;
      const parsed = buildExerciseRecord({ exerciseName, category: categoryRaw || "其他", weight: weightRaw, unit: unitRaw, value: repsRaw, valueUnit: unitRaw, rpe: rpeRaw, note: noteParts.join(", ") });
      if (!parsed.ok) { errors.push(`第 ${index + 1} 行：重訓格式錯誤（${parsed.errors.join("、")}）`); return; }
      records.push({ ...parsed.record, date: currentDate, trainingTime, savedAtText: `${currentDate} ${trainingTime || "12:00"}:00`, source: "import" });
    }
    if (mode === "有氧") { let startTime = "", endTime = "", values = parts; if (looksLikeTime(parts[0])) { startTime = parts[0]; if (looksLikeTime(parts[1])) { endTime = parts[1]; values = parts.slice(2); } else values = parts.slice(1); } const [cardioType, durationRaw, caloriesRaw = "", hrRaw = "", powerRaw = "", distanceRaw = "", speedRaw = "", resistanceRaw = "", noteRaw = "", imageUrlRaw = "", ...extraNoteParts] = values; const minutes = durationToMinutes(durationRaw); if (!cardioType || !minutes) { errors.push(`第 ${index + 1} 行：有氧格式錯誤`); return; } records.push({ type: "cardio", cardioType, startTime, endTime, duration: String(durationRaw || "").trim(), minutes, calories: Number(caloriesRaw) || null, avgHeartRate: Number(hrRaw) || null, avgPower: Number(powerRaw) || null, distance: Number(distanceRaw) || null, speed: speedRaw || "", resistance: resistanceRaw || "", note: [noteRaw, ...extraNoteParts].filter(Boolean).join(", "), imageUrl: imageUrlRaw || "", date: currentDate, trainingTime: startTime, savedAtText: `${currentDate} ${startTime || "12:00"}:00`, source: "import" }); }
    if (mode === "身體紀錄") { let trainingTime = "", values = parts; if (looksLikeTime(parts[0])) { trainingTime = parts[0]; values = parts.slice(1); } const [weightRaw = "", bodyFatRaw = "", muscleMassRaw = "", ...noteParts] = values; records.push({ type: "body", weight: Number(weightRaw) || null, bodyFat: Number(bodyFatRaw) || null, muscleMass: Number(muscleMassRaw) || null, note: noteParts.join(", "), date: currentDate, trainingTime, savedAtText: `${currentDate} ${trainingTime || "12:00"}:00`, source: "import" }); }
  });
  return { records, errors };
}
function renderImportPreview() { const { records, errors } = parseImportText(); const strength = records.filter(r => r.type === "strength").length, cardio = records.filter(r => r.type === "cardio").length, body = records.filter(r => r.type === "body").length; const lines = []; if (errors.length) lines.push(`<div class="import-error"><strong>格式錯誤</strong><p>${errors.map(escapeHtml).join("<br>")}</p></div>`); lines.push(`<div class="record-card"><div><h4>預計匯入</h4><p>重訓 ${strength} 筆｜有氧 ${cardio} 筆｜身體紀錄 ${body} 筆</p></div></div>`); lines.push(...records.slice(0, 30).map(r => `<div class="record-card"><div>${recordText(r)}<p>日期：${r.date}</p></div></div>`)); if (records.length > 30) lines.push(`<div class="empty-state">還有 ${records.length - 30} 筆未顯示。</div>`); $("importPreview").innerHTML = lines.join(""); return { records, errors }; }
async function runImport() {
  if (!state.currentUser) return alert("請先登入");
  const { records, errors } = renderImportPreview();
  if (errors.length) return alert("格式有錯，請先修正後再匯入");
  if (!records.length) return alert("沒有可匯入的資料");
  if (!confirm(`確定要匯入 ${records.length} 筆資料嗎？`)) return;
  for (let i = 0; i < records.length; i++) {
    const record = records[i]; const createdAt = historicalTimestamp(record.date, record.trainingTime || record.startTime || "", i);
    if (record.type === "strength") { await touchWorkoutDate(record.date, { hasStrength: true }); await addDoc(collection(db, ...userPath("workouts", record.date, "records")), { ...record, createdAt, updatedAt: createdAt }); await updateExerciseOption(record, createdAt); }
    if (record.type === "cardio") { await touchWorkoutDate(record.date, { hasCardio: true }); await addDoc(collection(db, ...userPath("workouts", record.date, "records")), { ...record, createdAt, updatedAt: createdAt }); await addDoc(collection(db, ...userPath("cardioRecords")), { ...record, createdAt, updatedAt: createdAt }); }
    if (record.type === "body") await addDoc(collection(db, ...userPath("bodyRecords")), { ...record, createdAt, updatedAt: createdAt });
  }
  alert("匯入完成"); $("importText").value = ""; $("importPreview").innerHTML = "匯入完成。"; await refreshAll();
}
function bindImport() { $("previewImportBtn")?.addEventListener("click", renderImportPreview); $("runImportBtn")?.addEventListener("click", runImport); }
function bindOtherForms() { $("addCardioBtn")?.addEventListener("click", () => addCardioRecord(refreshAll)); $("addBodyBtn")?.addEventListener("click", () => addBodyRecord(refreshAll)); $("finishWorkoutBtn")?.addEventListener("click", () => alert("今天訓練已完成！")); }

setTodayDate();
if ($("cardioDate")) $("cardioDate").value = todayId();
if ($("bodyDate")) $("bodyDate").value = todayId();
bindBodyRecordUi();
bindNavigation(); bindAuth(); bindWorkoutForm(); bindOtherForms(); bindImport(); bindStatsTabs(); bindAnalysisControls();
