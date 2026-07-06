import { db } from "./firebase.js";
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { $, cardioText, durationToMinutes, formatDateTime, state, todayId, touchWorkoutDate, userPath } from "./shared.js";

export async function addCardioRecord(refresh) {
  if (!state.currentUser) return alert("請先登入");
  const date = $("cardioDate").value || todayId();
  const durationText = $("cardioDuration").value.trim();
  const record = { type: "cardio", cardioType: $("cardioType").value, date, startTime: $("cardioStartTime").value || "", endTime: $("cardioEndTime").value || "", duration: durationText, minutes: durationToMinutes(durationText), calories: Number($("cardioCalories").value) || null, avgHeartRate: Number($("cardioHeartRate").value) || null, avgPower: Number($("cardioPower").value) || null, distance: Number($("cardioDistance").value) || null, speed: $("cardioSpeed").value.trim(), resistance: $("cardioResistance").value.trim(), imageUrl: $("cardioImageUrl").value.trim(), note: $("cardioNote").value.trim(), savedAtText: formatDateTime(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  if (!record.minutes && !record.duration) return alert("請輸入有氧運動時間，例如 45:37");
  await touchWorkoutDate(date, { hasCardio: true });
  await addDoc(collection(db, ...userPath("cardioRecords")), record);
  await addDoc(collection(db, ...userPath("workouts", date, "records")), record);
  ["cardioDuration", "cardioCalories", "cardioHeartRate", "cardioPower", "cardioDistance", "cardioSpeed", "cardioResistance", "cardioImageUrl", "cardioNote", "cardioStartTime", "cardioEndTime"].forEach(id => { if ($(id)) $(id).value = ""; });
  await refresh();
}
export function renderCardioRecords() { const el = $("cardioList"); if (!el) return; el.innerHTML = state.cardioRecords.length ? state.cardioRecords.map(r => `<div class="record-card"><div>${cardioText(r, true)}</div></div>`).join("") : "尚無紀錄。"; }
