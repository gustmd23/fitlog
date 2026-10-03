// =============================================================
// 핏로그 — 운동·식단 기록 앱 (PWA)
// 모든 데이터는 이 기기 브라우저의 localStorage 에 저장됩니다.
// =============================================================

// ---------- 1. 데이터 저장/불러오기 ----------
// 데이터 구조
// {
//   days: {
//     "2026-10-04": {
//       weight: 72.4,
//       meals: [ { id, type: "아침", menu: "...", kcal: 450 } ],
//       workouts: [ { id, name: "스쿼트", weight: 60, reps: 8, sets: 4 } ]
//     }
//   },
//   menus: { "닭가슴살 샐러드": 320 }   // 자주 먹는 메뉴 → 칼로리
// }
const STORE_KEY = "fitlog-v1";
const MEAL_TYPES = ["아침", "점심", "저녁", "간식"];

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      d.days = d.days || {};
      d.menus = d.menus || {};
      return d;
    }
  } catch (e) { console.error(e); }
  return { days: {}, menus: {} };
}
let db = load();

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(db));
}

function getDay(date) {
  if (!db.days[date]) db.days[date] = { weight: null, meals: [], workouts: [] };
  return db.days[date];
}

// 비어 있는 날짜는 지워서 표가 깔끔하게 유지되도록
function cleanDay(date) {
  const d = db.days[date];
  if (d && d.weight == null && !d.meals.length && !d.workouts.length) delete db.days[date];
}

// ---------- 2. 날짜 도우미 ----------
function toKey(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function fromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function shiftKey(key, n) {
  const dt = fromKey(key);
  dt.setDate(dt.getDate() + n);
  return toKey(dt);
}
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
function shortLabel(key) {
  const dt = fromKey(key);
  return `${dt.getMonth() + 1}/${dt.getDate()}(${WEEK[dt.getDay()]})`;
}

let currentDate = toKey(new Date());

// ---------- 3. 작은 도우미 ----------
const $ = (id) => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 1600);
}

function dayKcal(d) {
  return d.meals.reduce((s, m) => s + (m.kcal || 0), 0);
}
function dayTotalSets(d) {
  return d.workouts.reduce((s, w) => s + (w.sets || 0), 0);
}

// ---------- 4. 입력 화면 ----------
function renderInput() {
  $("dateInput").value = currentDate;
  const d = db.days[currentDate] || { weight: null, meals: [], workouts: [] };

  $("weightInput").value = d.weight ?? "";

  // 식단 목록 (끼니 순서대로 정렬)
  const meals = [...d.meals].sort((a, b) => MEAL_TYPES.indexOf(a.type) - MEAL_TYPES.indexOf(b.type));
  $("mealList").innerHTML = meals.length
    ? meals.map((m) => `
      <div class="item">
        <span class="tag">${m.type}</span>
        <span class="main">${esc(m.menu)}</span>
        <span class="num">${m.kcal ?? "-"} kcal</span>
        <button class="del" data-meal="${m.id}" aria-label="삭제">×</button>
      </div>`).join("")
    : `<div class="empty">아직 기록이 없어요.</div>`;
  const kcal = dayKcal(d);
  $("kcalSum").textContent = kcal ? `총 ${kcal.toLocaleString()} kcal` : "";

  // 운동 목록
  $("exListView").innerHTML = d.workouts.length
    ? d.workouts.map((w) => `
      <div class="item">
        <span class="main"><b>${esc(w.name)}</b></span>
        <span class="num">${w.weight ? w.weight + "kg × " : ""}${w.reps}회 × ${w.sets}세트</span>
        <button class="del" data-ex="${w.id}" aria-label="삭제">×</button>
      </div>`).join("")
    : `<div class="empty">아직 기록이 없어요.</div>`;
  const sets = dayTotalSets(d);
  $("setSum").textContent = sets ? `총 ${sets}세트` : "";

  // 자동완성 목록 갱신
  $("menuList").innerHTML = Object.keys(db.menus).sort().map((m) => `<option value="${esc(m)}">`).join("");
  $("exList").innerHTML = allExercises().map((n) => `<option value="${esc(n)}">`).join("");
}

function allExercises() {
  const set = new Set();
  Object.values(db.days).forEach((d) => d.workouts.forEach((w) => set.add(w.name)));
  return [...set].sort();
}

// 가장 최근에 한 같은 종목 기록 찾기 (지난 기록 자동 채우기용)
function lastWorkout(name) {
  const keys = Object.keys(db.days).sort().reverse();
  for (const k of keys) {
    const w = [...db.days[k].workouts].reverse().find((x) => x.name === name);
    if (w) return w;
  }
  return null;
}

function setupInput() {
  $("dateInput").addEventListener("change", (e) => {
    if (e.target.value) { currentDate = e.target.value; renderInput(); }
  });
  $("prevDay").onclick = () => { currentDate = shiftKey(currentDate, -1); renderInput(); };
  $("nextDay").onclick = () => { currentDate = shiftKey(currentDate, 1); renderInput(); };

  // 체중 저장
  $("saveWeight").onclick = () => {
    const w = num($("weightInput").value);
    getDay(currentDate).weight = w;
    cleanDay(currentDate);
    save();
    toast(w == null ? "체중을 지웠어요" : `체중 ${w}kg 저장`);
  };
  $("weightInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("saveWeight").click(); });

  // 메뉴를 고르면 칼로리 자동 입력
  $("mealMenu").addEventListener("input", (e) => {
    const k = db.menus[e.target.value.trim()];
    if (k != null) $("mealKcal").value = k;
  });

  // 식사 추가
  $("addMeal").onclick = () => {
    const menu = $("mealMenu").value.trim();
    const kcal = num($("mealKcal").value);
    if (!menu) { toast("메뉴를 입력해 주세요"); return; }
    getDay(currentDate).meals.push({ id: uid(), type: $("mealType").value, menu, kcal });
    if (kcal != null) db.menus[menu] = kcal; // 다음에 자동 입력되도록 기억
    save();
    $("mealMenu").value = ""; $("mealKcal").value = "";
    renderInput();
    toast("식단 추가");
  };

  // 종목을 고르면 지난 기록으로 채우기
  $("exName").addEventListener("change", (e) => {
    const last = lastWorkout(e.target.value.trim());
    if (last) {
      $("exWeight").value = last.weight ?? "";
      $("exReps").value = last.reps ?? "";
      $("exSets").value = last.sets ?? "";
    }
  });

  // 운동 추가
  $("addEx").onclick = () => {
    const name = $("exName").value.trim();
    const reps = num($("exReps").value);
    const sets = num($("exSets").value);
    if (!name) { toast("종목을 입력해 주세요"); return; }
    if (!reps || !sets) { toast("횟수와 세트수를 입력해 주세요"); return; }
    getDay(currentDate).workouts.push({ id: uid(), name, weight: num($("exWeight").value), reps, sets });
    save();
    renderInput();
    toast(`${name} 추가`);
  };

  // 삭제 버튼 (목록 안의 × 버튼)
  $("mealList").addEventListener("click", (e) => {
    const id = e.target.dataset.meal;
    if (!id) return;
    const d = getDay(currentDate);
    d.meals = d.meals.filter((m) => m.id !== id);
    cleanDay(currentDate); save(); renderInput();
  });
  $("exListView").addEventListener("click", (e) => {
    const id = e.target.dataset.ex;
    if (!id) return;
    const d = getDay(currentDate);
    d.workouts = d.workouts.filter((w) => w.id !== id);
    cleanDay(currentDate); save(); renderInput();
  });
}

// ---------- 5. 기록 표 ----------
// 7일 이동평균: 해당 날짜 포함 최근 7일 안에 있는 체중들의 평균
function movingAvg(key) {
  const vals = [];
  for (let i = 0; i < 7; i++) {
    const d = db.days[shiftKey(key, -i)];
    if (d && d.weight != null) vals.push(d.weight);
  }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function renderTable() {
  const keys = Object.keys(db.days).sort().reverse();
  if (!keys.length) {
    $("logTable").innerHTML = `<tr><td class="empty">아직 기록이 없어요. 입력 탭에서 시작해 보세요.</td></tr>`;
    return;
  }
  const rows = keys.map((k) => {
    const d = db.days[k];
    const ma = movingAvg(k);
    const kcal = dayKcal(d);
    const ex = d.workouts.map((w) => `${esc(w.name)} ${w.sets}×${w.reps}`).join(", ");
    return `<tr data-date="${k}">
      <td>${shortLabel(k)}</td>
      <td>${d.weight ?? "-"}</td>
      <td>${ma != null ? ma.toFixed(1) : "-"}</td>
      <td>${kcal ? kcal.toLocaleString() : "-"}</td>
      <td class="left">${ex || "-"}</td>
    </tr>`;
  }).join("");
  $("logTable").innerHTML = `
    <thead><tr><th>날짜</th><th>체중</th><th>7일평균</th><th>kcal</th><th class="left">운동 (세트×횟수)</th></tr></thead>
    <tbody>${rows}</tbody>`;
}

function setupTable() {
  $("logTable").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-date]");
    if (!tr) return;
    currentDate = tr.dataset.date;
    showTab("input");
  });
}

// ---------- 6. 그래프 ----------
let rangeDays = 30;
const charts = {};

function rangeKeys() {
  const all = Object.keys(db.days).sort();
  if (!all.length) return [];
  const end = toKey(new Date()) > all[all.length - 1] ? toKey(new Date()) : all[all.length - 1];
  const start = rangeDays ? shiftKey(end, -(rangeDays - 1)) : all[0];
  // 시작~끝 사이 모든 날짜를 채워서 x축 간격이 일정하게
  const keys = [];
  for (let k = start; k <= end; k = shiftKey(k, 1)) keys.push(k);
  return keys;
}

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function makeChart(id, config) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart($(id), config);
}

function baseOptions() {
  const muted = css("--muted"), line = css("--line");
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { labels: { color: muted, boxWidth: 12 } } },
    scales: {
      x: { ticks: { color: muted, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 }, grid: { display: false } },
      y: { ticks: { color: muted }, grid: { color: line } },
    },
  };
}

function renderCharts() {
  if (typeof Chart === "undefined") return;
  const keys = rangeKeys();
  const labels = keys.map(shortLabel);
  const accent = css("--accent"), muted = css("--muted");

  // ① 체중 + 7일 이동평균
  makeChart("weightChart", {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "공복 체중", data: keys.map((k) => db.days[k]?.weight ?? null),
          borderColor: accent, backgroundColor: accent, pointRadius: 3, spanGaps: true, borderWidth: 1.5 },
        { label: "7일 평균", data: keys.map((k) => { const v = movingAvg(k); return v != null ? +v.toFixed(2) : null; }),
          borderColor: muted, borderDash: [5, 4], pointRadius: 0, spanGaps: true, borderWidth: 2 },
      ],
    },
    options: baseOptions(),
  });

  // ② 끼니별로 쌓은 칼로리 막대
  const mealColors = ["#e0a43a", "#3f8fc4", "#1f6f5c", "#b26ab0"];
  const kcalOpts = baseOptions();
  kcalOpts.scales.x.stacked = true;
  kcalOpts.scales.y.stacked = true;
  makeChart("kcalChart", {
    type: "bar",
    data: {
      labels,
      datasets: MEAL_TYPES.map((t, i) => ({
        label: t,
        backgroundColor: mealColors[i],
        borderRadius: 3,
        data: keys.map((k) => {
          const d = db.days[k];
          if (!d) return 0;
          return d.meals.filter((m) => m.type === t).reduce((s, m) => s + (m.kcal || 0), 0);
        }),
      })),
    },
    options: kcalOpts,
  });

  // ③ 종목별 진척: 그날 총 볼륨(중량×횟수×세트)과 최고 중량
  const names = allExercises();
  const sel = $("exChartSelect");
  const prev = sel.value;
  sel.innerHTML = names.length
    ? names.map((n) => `<option ${n === prev ? "selected" : ""}>${esc(n)}</option>`).join("")
    : `<option>운동 기록이 없어요</option>`;
  const name = sel.value;
  const exKeys = keys.filter((k) => db.days[k]?.workouts.some((w) => w.name === name));
  const vol = exKeys.map((k) => db.days[k].workouts.filter((w) => w.name === name)
    .reduce((s, w) => s + (w.weight || 0) * w.reps * w.sets, 0));
  const reps = exKeys.map((k) => db.days[k].workouts.filter((w) => w.name === name)
    .reduce((s, w) => s + w.reps * w.sets, 0));
  const maxW = exKeys.map((k) => Math.max(...db.days[k].workouts.filter((w) => w.name === name).map((w) => w.weight || 0)));
  const bodyweight = vol.every((v) => v === 0); // 맨몸 운동이면 총 횟수로 표시

  const exOpts = baseOptions();
  exOpts.scales.y.title = { display: true, text: bodyweight ? "총 횟수" : "볼륨 (kg)", color: muted };
  if (!bodyweight) {
    exOpts.scales.y2 = { position: "right", grid: { display: false }, ticks: { color: muted },
      title: { display: true, text: "최고 중량 (kg)", color: muted } };
  }
  makeChart("exChart", {
    type: "bar",
    data: {
      labels: exKeys.map(shortLabel),
      datasets: bodyweight
        ? [{ label: "총 횟수", data: reps, backgroundColor: accent, borderRadius: 3 }]
        : [
            { label: "총 볼륨", data: vol, backgroundColor: css("--accent-soft"), borderColor: accent, borderWidth: 1, borderRadius: 3, yAxisID: "y" },
            { label: "최고 중량", data: maxW, type: "line", borderColor: "#e0a43a", backgroundColor: "#e0a43a", pointRadius: 3, yAxisID: "y2" },
          ],
    },
    options: exOpts,
  });
}

function setupCharts() {
  $("rangeSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    rangeDays = Number(b.dataset.days);
    document.querySelectorAll("#rangeSeg button").forEach((x) => x.classList.toggle("on", x === b));
    renderCharts();
  });
  $("exChartSelect").addEventListener("change", renderCharts);
}

// ---------- 7. 백업 / 내보내기 ----------
function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function setupSettings() {
  $("exportJson").onclick = () => {
    download(`fitlog-backup-${toKey(new Date())}.json`, JSON.stringify(db, null, 2), "application/json");
  };

  $("importJson").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data.days) throw new Error("형식 오류");
      if (!confirm("지금 기록을 백업 파일 내용으로 바꿀까요?")) return;
      db = { days: data.days, menus: data.menus || {} };
      save(); renderAll();
      toast("백업을 불러왔어요");
    } catch (err) {
      alert("핏로그 백업 파일이 아닌 것 같아요.");
    }
    e.target.value = "";
  });

  // 엑셀에서 한글이 깨지지 않도록 맨 앞에 BOM(﻿) 추가
  $("exportCsv").onclick = () => {
    const lines = [["날짜", "구분", "항목", "체중kg", "kcal", "중량kg", "횟수", "세트"].join(",")];
    Object.keys(db.days).sort().forEach((k) => {
      const d = db.days[k];
      if (d.weight != null) lines.push([k, "체중", "", d.weight, "", "", "", ""].map(csvCell).join(","));
      d.meals.forEach((m) => lines.push([k, m.type, m.menu, "", m.kcal, "", "", ""].map(csvCell).join(",")));
      d.workouts.forEach((w) => lines.push([k, "운동", w.name, "", "", w.weight, w.reps, w.sets].map(csvCell).join(",")));
    });
    download(`fitlog-${toKey(new Date())}.csv`, "﻿" + lines.join("\n"), "text/csv");
  };

  $("resetAll").onclick = () => {
    if (!confirm("정말 모든 기록을 지울까요? 되돌릴 수 없어요.")) return;
    db = { days: {}, menus: {} };
    save(); renderAll();
    toast("모두 지웠어요");
  };
}

// ---------- 8. 탭 전환 ----------
function showTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.id === "tab-" + name));
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
  if (name === "input") renderInput();
  if (name === "table") renderTable();
  if (name === "chart") renderCharts();
  window.scrollTo(0, 0);
}

function renderAll() {
  renderInput();
  renderTable();
  if ($("tab-chart").classList.contains("active")) renderCharts();
}

// ---------- 9. 시작 ----------
document.querySelector(".tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) showTab(b.dataset.tab);
});
setupInput();
setupTable();
setupCharts();
setupSettings();
renderInput();

// 오프라인에서도 열리도록 서비스 워커 등록
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW 등록 실패", e));
  });
}
