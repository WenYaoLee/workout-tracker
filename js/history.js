import { db } from "./firebase.js";
import { deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import { $, escapeHtml, recordText, state, todayId, tsMs } from "./shared.js";

function renderRecords(targetId, records, emptyText, deletable = false, refresh) {
  const el = $(targetId); if (!el) return;
  el.innerHTML = records.length ? records.map(r => `<div class="record-card"><div>${recordText(r)}<p>日期：${escapeHtml(r.date || "-")}｜儲存時間：${escapeHtml(r.savedAtText || "-")}</p></div>${deletable ? `<button class="delete-btn" data-delete-path="${escapeHtml(r.path || "")}">刪除</button>` : ""}</div>`).join("") : emptyText;
  el.querySelectorAll("[data-delete-path]").forEach(btn => btn.addEventListener("click", async () => { if (!btn.dataset.deletePath) return; await deleteDoc(doc(db, btn.dataset.deletePath)); await refresh(); }));
}
export function renderToday(refresh) {
  const records = state.allRecords.filter(r => r.date === todayId());
  renderRecords("todayRecords", records, "今天尚無紀錄。", true, refresh);
  renderRecords("quickTodayRecords", records.slice(0, 5), "今天尚無紀錄。", false, refresh);
}
function recordTimeValue(record) {
  const time = record.trainingTime || record.startTime || "";
  const match = String(time).match(/^(\d{1,2}):(\d{2})/);
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  const created = tsMs(record.createdAt);
  return created ? new Date(created).getHours() * 60 + new Date(created).getMinutes() : 99999;
}

function sortRecordsInDay(records) {
  return [...records].sort((a, b) => {
    const timeCompare = recordTimeValue(a) - recordTimeValue(b);
    if (timeCompare !== 0) return timeCompare;
    return tsMs(a.createdAt) - tsMs(b.createdAt);
  });
}

export function renderHistory() {
  const grouped = new Map();
  state.allRecords.forEach(r => { if (!grouped.has(r.date)) grouped.set(r.date, []); grouped.get(r.date).push(r); });
  const dates = [...grouped.keys()].sort().reverse();
  const el = $("historyList"); if (!el) return;
  el.innerHTML = dates.length ? dates.map(date => {
    const records = sortRecordsInDay(grouped.get(date));
    const strength = records.filter(r => r.type === "strength").length;
    const cardioMin = records.filter(r => r.type === "cardio").reduce((s, r) => s + (Number(r.minutes) || 0), 0);
    const detail = records.map(r => `<div class="history-detail-item">${recordText(r)}</div>`).join("");
    return `<details class="history-day"><summary><strong>${date}</strong><span>重訓 ${strength} 組｜有氧 ${cardioMin} 分</span></summary>${detail}</details>`;
  }).join("") : "尚無歷史紀錄。";
}
