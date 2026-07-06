# Workout Tracker

目前版本：v1.5

## v1.5 更新重點

- 新增「訓練分析」頁面
- 新增訓練熱度圖 Heatmap
  - 灰色：沒有訓練
  - 綠色：只有重訓
  - 藍色：只有有氧
  - 黃色：重訓 + 有氧
- 點選 Heatmap 日期可查看當天摘要
- 新增「動作歷史」
  - 可選擇單一動作
  - 可切換最大重量、Volume、總次數、總時間圖表
  - 顯示該動作每天的歷史組數、重量、次數、RPE、備註
- 背景建立 Exercise Database：從既有訓練紀錄自動補動作資料
- 保持 Firestore `users/{uid}` 架構

## Firestore 主要結構

```text
users/{uid}
  workouts/{date}
    records/{recordId}
  exerciseOptions/{exerciseId}
  bodyRecords/{recordId}
  cardioRecords/{recordId}
```
