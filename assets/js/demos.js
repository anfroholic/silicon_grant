/* Live figures for the proposal deck. Each demo starts on slide:enter and stops on slide:leave. */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const slideOf = (el) => el && el.closest(".slide");
  function svg(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  const STATIC = document.documentElement.classList.contains("static");
  function onSlide(el, enter, leave) {
    const sl = slideOf(el);
    if (!sl || STATIC) return;   // ?static: no timers, figures stay in their final state
    sl.addEventListener("slide:enter", enter);
    if (leave) sl.addEventListener("slide:leave", leave);
  }

  /* ---------- numbers ---------- */
  // [data-count] numbers no longer count up (too jarring). They resolve in from a blur via CSS: see "resolve" in theme.css.

  /* ---------- donut ---------- */
  $$(".donut .arc").forEach((arc) => {
    const C = 565.5, pct = +arc.dataset.pct;
    if (STATIC) arc.setAttribute("stroke-dashoffset", C * (1 - pct / 100));
    onSlide(arc, () => {
      arc.style.transition = "none"; arc.setAttribute("stroke-dashoffset", C);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        arc.style.transition = ""; arc.setAttribute("stroke-dashoffset", C * (1 - pct / 100));
      }));
    });
  });

  /* ---------- PUF demo ---------- */
  const puf = $("#puf");
  if (puf) {
    const s = $("svg", puf), fp = $(".fp", puf), btn = $("button", puf);
    const ALPHA = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // 32 symbols, 5 bits/tap
    const W = 1000, H = 380, mid = 190, cw = W / 6;
    for (let c = 0; c < 6; c++) {
      svg("rect", { class: "cluster", x: c * cw + 6, y: 10, width: cw - 12, height: H - 40, rx: 6 }, s);
      const t = svg("text", { class: "small", x: c * cw + cw / 2, y: H - 6, "text-anchor": "middle" }, s);
      t.textContent = "MEDALLION " + (c + 1);
    }
    svg("line", { class: "axis", x1: 0, y1: mid, x2: W, y2: mid }, s);
    const bars = [];
    for (let k = 0; k < 48; k++) {
      const c = Math.floor(k / 8), j = k % 8;
      const x = c * cw + 18 + j * ((cw - 36) / 8);
      bars.push(svg("rect", { class: "bar pos", x: x, y: mid, width: (cw - 36) / 8 - 5, height: 0, rx: 2 }, s));
    }
    let last = "";
    function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    function read() {
      let str = "";
      bars.forEach((b) => {
        const d = Math.max(-2.6, Math.min(2.6, gauss()));       // deviation in σ
        const h = Math.abs(d) * 58;
        b.setAttribute("class", "bar " + (d >= 0 ? "pos" : "neg"));
        b.setAttribute("y", d >= 0 ? mid - h : mid);
        b.setAttribute("height", Math.max(2, h));
        const q = Math.max(0, Math.min(31, Math.floor((d + 2.6) / 5.2 * 32)));
        str += ALPHA[q];
      });
      fp.innerHTML = str.split("").map((ch, i) =>
        `<span class="ch${last && last[i] !== ch ? " new" : ""}">${ch}</span>`).join("");
      last = str;
      setTimeout(() => $$(".ch.new", fp).forEach((e) => e.classList.remove("new")), 700);
    }
    let timer = null;
    btn.addEventListener("click", () => { read(); clearInterval(timer); timer = setInterval(read, 3200); });
    onSlide(puf, () => { read(); clearInterval(timer); timer = setInterval(read, 3200); }, () => clearInterval(timer));
    read();
  }

  /* ---------- 2,000 chip tiles: a probe line sweeps down, each chip reveals its own fingerprint ---------- */
  const tiles = $("#dots");
  if (tiles) {
    const ctx = tiles.getContext("2d");
    const W = tiles.width, H = tiles.height;                    // backing store, about 2x the stage size
    const COLS = 50, ROWS = 40, N = COLS * ROWS, K = 3;         // K x K cells per tile
    const P = W / COLS;                                         // tile pitch (40)
    const CELL = Math.round(P * 0.175), GAP = Math.round(P * 0.1);   // 7 and 4: cells stay distinct at 1080p
    const GLYPH = K * CELL + (K - 1) * GAP, M = (P - GLYPH) / 2;
    // Slow on purpose. The reading is the point, not the finished field, so one pass takes a while and
    // then it starts over: a re-read gives the same fingerprint, with just a glint as the probe goes by.
    const SWEEP = 24, PAUSE = 2, SLANT = 0.8, SETTLE = 3, FLASH = 1.2;   // seconds; slant = rows the front leads on the left
    const PERIOD = SWEEP + PAUSE;
    const cs = getComputedStyle(document.documentElement);
    const rgb = (v, fb) => { const h = (cs.getPropertyValue(v).trim().match(/^#[0-9a-f]{6}$/i) || [fb])[0]; const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    const TEAL = rgb("--raw-mono-1", "#36d9bb"), LINE = rgb("--line-2", "#2d4d45");
    const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
    // Seeded per chip: every tile differs, and it looks the same on every run (and in ?static).
    const rnd = (s) => () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    // Each cell is an analog read, not just a bit: above the threshold it's brighter, below it's faint, and the level varies.
    const chips = Array.from({ length: N }, (_, i) => { const r = rnd(i * 7919 + 17); return Array.from({ length: K * K }, () => { const v = r(); return v < 0.5 ? 0.05 + v * 0.18 : 0.26 + (v - 0.5) * 0.72; }); });
    const when = (i) => ((Math.floor(i / COLS) + SLANT * (i % COLS) / COLS) / ROWS) * SWEEP;  // when, within a pass, the probe reaches chip i
    const ease = (p) => 1 - Math.pow(1 - p, 3);

    function tile(c, i, s, flash) {   // s: 0 = not read yet (outline only) .. 1 = settled; flash: the probe just went by (kept faint)
      const x = (i % COLS) * P + M, y = Math.floor(i / COLS) * P + M;
      c.lineWidth = 2;
      if (s < 1) { c.strokeStyle = rgba(LINE, 1 - s); c.strokeRect(x - 2, y - 2, GLYPH + 4, GLYPH + 4); }   // the empty box fades once the chip is read
      if (s > 0) {
        const v = chips[i];
        for (let k = 0; k < K * K; k++) {
          c.fillStyle = rgba(TEAL, v[k] * s * (1 + 0.25 * flash));   // the probe leaves only a faint lift as it passes
          c.fillRect(x + (k % K) * (CELL + GAP), y + Math.floor(k / K) * (CELL + GAP), CELL, CELL);
        }
      }
    }
    // Settled tiles live in an offscreen layer, so each frame only redraws the band near the probe.
    const baked = document.createElement("canvas"); baked.width = W; baked.height = H;
    const bc = baked.getContext("2d"), done = new Uint8Array(N);
    const S = new Float32Array(N), F = new Float32Array(N), live = [];
    let raf = 0;
    function frame(t) {          // t = seconds since the first sweep began; -1 = untouched, Infinity = final pose
      const tp = t === Infinity ? 0 : t - Math.floor(t / PERIOD) * PERIOD;   // time within the current pass
      live.length = 0;
      for (let i = 0; i < N; i++) {
        const w = when(i);
        let s, f;
        if (t === Infinity) { s = 1; f = 0; }
        else if (t < w) { s = 0; f = 0; }                                 // not reached yet (first pass only)
        else { s = ease(Math.min(1, (t - w) / SETTLE)); f = Math.max(0, 1 - (tp >= w ? tp - w : tp + PERIOD - w) / FLASH); }
        if (s === 1 && f === 0) { if (!done[i]) { tile(bc, i, 1, 0); done[i] = 1; } continue; }
        S[i] = s; F[i] = f; live.push(i);
      }
      ctx.clearRect(0, 0, W, H); ctx.drawImage(baked, 0, 0);
      for (const i of live) { ctx.clearRect((i % COLS) * P, Math.floor(i / COLS) * P, P, P); tile(ctx, i, S[i], F[i]); }
      if (t >= 0 && t !== Infinity && tp < SWEEP * 1.03) {                // the probe line, slightly slanted, with a soft glow
        const r0 = tp / SWEEP * ROWS + 0.5, yl = r0 * P, yr = (r0 - SLANT) * P;
        ctx.lineCap = "round";
        ctx.lineWidth = 14; ctx.strokeStyle = rgba(TEAL, 0.07); ctx.beginPath(); ctx.moveTo(0, yl); ctx.lineTo(W, yr); ctx.stroke();
        ctx.lineWidth = 2;  ctx.strokeStyle = rgba(TEAL, 0.4); ctx.beginPath(); ctx.moveTo(0, yl); ctx.lineTo(W, yr); ctx.stroke();
      }
    }
    function start() {
      cancelAnimationFrame(raf); done.fill(0); bc.clearRect(0, 0, W, H);
      const t0 = performance.now();
      (function step(now) { frame((now - t0) / 1000); raf = requestAnimationFrame(step); })(t0);   // runs until the slide is left
    }
    if (STATIC) frame(Infinity);
    else {
      frame(-1);
      onSlide(tiles, start, () => cancelAnimationFrame(raf));
      if (slideOf(tiles).classList.contains("active")) start();
    }
  }

  /* ---------- lifecycle diagram ---------- */
  const life = $("#life");
  if (life) {
    // "|" splits a label onto two lines
    const steps = ["Architect", "Stitch", "Foundry", "Wafer test", "WCSP bump", "Dicing", "Sort", "Package", "Test /|provision", "Ship pack"];
    const ws = [
      ["ext", "Designers", "GDS"], ["ws", "wafer.space", "56 designs"], ["ext", "GF", "Singapore"],
      ["skip", "not needed", ""], ["skip", "can't be|done", ""], ["ext", "Dicing|vendor", "Singapore"],
      ["me", "Andrew", "sort machine"], ["me", "Andrew", "CoB / LGA"], ["me", "Andrew", "diode bond|check"], ["skip", "TBD", "SMT tape?"],
    ];
    const bun = [
      ["ext", "bunnie", "GDS"], ["skip", "not used?", ""], ["ext", "Foundry", ""],
      ["cost", "Test house", "expensive"], ["cost", "Bump house", "expensive"], ["ext", "Dicing|vendor", "Singapore"],
      ["bun", "bunnie", "grant-built|tools"], ["skip", "not needed", "bumps"], ["bun", "bunnie", "test, firmware|+ keys"], ["bun", "bunnie", "SMT tape|& reel"],
    ];
    // custody changes hands entering step k (marker sits on the connector just before k)
    const handoff = { ws: [1, 2, 5, 6], bun: [2, 3, 4, 5, 6] };
    const x0 = 44, cw = 165, bw = 147, bh = 130, y1 = 110, y2 = 330;
    const label = (x, y, txt, cls, lh) => {
      const lines = txt.split("|"), t = svg("text", { class: cls, x, y: y - (lines.length - 1) * lh / 2, "text-anchor": "middle" }, life);
      lines.forEach((l, i) => { const ts = svg("tspan", { x, dy: i ? lh : 0 }, t); ts.textContent = l; });
      return t;
    };
    svg("rect", { class: "lastmile", x: x0 + 6 * cw - 10, y: y1 - 14, width: 3 * cw + bw + 20, height: y2 + bh - y1 + 28, rx: 14 }, life);
    const lm = svg("text", { class: "small", x: x0 + 6 * cw - 10 + (3 * cw + bw + 20) / 2, y: 520, "text-anchor": "middle" }, life);
    lm.textContent = "THE LAST MILE · BUILT WITH THIS GRANT"; lm.style.fill = "var(--raw-mono-1)";
    [["WAFER.SPACE", y1], ["BAOCHIP", y2]].forEach(([t, y]) => {
      const e = svg("text", { class: "small", x: 20, y: y + bh / 2, "text-anchor": "middle", transform: `rotate(-90 20 ${y + bh / 2})` }, life);
      e.textContent = t;
    });
    steps.forEach((name, i) => {
      const x = x0 + i * cw, cx = x + bw / 2;
      svg("text", { class: "n", x: cx, y: 30, "text-anchor": "middle" }, life).textContent = String(i + 1).padStart(2, "0");
      label(cx, 74, name, "h", 22);
      [[ws[i], y1], [bun[i], y2]].forEach(([d, y]) => {
        svg("rect", { class: "step " + d[0], x, y, width: bw, height: bh, rx: 8 }, life);
        const lines = d[1].split("|").length + (d[2] ? d[2].split("|").length : 0);
        const top = y + bh / 2 - (lines - 1) * 12;
        label(cx, top + (d[1].split("|").length - 1) * 12, d[1], d[0] === "skip" ? "s" : "t", 24);
        if (d[2]) label(cx, top + d[1].split("|").length * 24 + (d[2].split("|").length - 1) * 11, d[2], "s", 22);
      });
      if (i < 9) {
        [["ws", y1], ["bun", y2]].forEach(([k, y]) => {
          const bad = handoff[k].includes(i + 1);
          svg("line", { class: "ln" + (bad ? " bad" : ""), x1: x + bw, y1: y + bh / 2, x2: x + cw, y2: y + bh / 2 }, life);
          if (bad) svg("rect", { class: "hand", x: x + bw + (cw - bw) / 2 - 9, y: y + bh / 2 - 9, width: 18, height: 18,
            transform: `rotate(45 ${x + bw + (cw - bw) / 2} ${y + bh / 2})` }, life);
        });
      }
    });
    // one token in the channel between the rows; it stops under every step
    const ty = (y1 + bh + y2) / 2, xa = x0 + bw / 2, xb = x0 + 9 * cw + bw / 2;
    svg("line", { class: "chan", x1: xa, y1: ty, x2: xb, y2: ty }, life);
    for (let i = 0; i < 10; i++) svg("circle", { class: "stop", cx: xa + i * cw, cy: ty, r: 4 }, life);
    const tok = svg("circle", { class: "token", r: 11, cx: 0, cy: 0 }, life);
    const MOVE = 0.55, HOLD = 1.0, total = 9 * MOVE + 10 * HOLD;
    const kp = [], kt = []; let t = 0;
    for (let i = 0; i < 10; i++) {
      kp.push(i / 9, i / 9); kt.push(t / total, (t += HOLD) / total);
      t += MOVE;
    }
    kt[kt.length - 1] = 1;
    svg("animateMotion", { dur: total + "s", repeatCount: "indefinite", path: `M${xa} ${ty} H${xb}`,
      calcMode: "linear", keyPoints: kp.join(";"), keyTimes: kt.map((v) => v.toFixed(4)).join(";") }, tok);
  }

  /* ---------- handoff chain ---------- */
  const out = $("#chain-out"), inn = $("#chain-in");
  if (out) {
    function row(g, labels, y, ours) {
      const n = labels.length, w = 1700 / n, bw = w - 46;
      labels.forEach((l, i) => {
        const x = i * w;
        const own = ours && ours.includes(i);
        svg("rect", { class: "v" + (own ? " ours" : ""), x, y, width: bw, height: 86, rx: 8 }, g);
        const t = svg("text", { class: "strong", x: x + bw / 2, y: y + 50, "text-anchor": "middle" }, g);
        t.textContent = l; if (l.length > 10) t.style.fontSize = "15px";
        if (i < n - 1) {
          svg("path", { class: "arr", d: `M${x + bw + 4} ${y + 43} H${x + w - 6}`, style: own && ours.includes(i + 1) ? "stroke:var(--raw-mono-1)" : "" }, g);
          if (!(own && ours.includes(i + 1))) {
            const wt = svg("text", { class: "warn", x: x + bw + 23, y: y + 30, "text-anchor": "middle" }, g);
            wt.textContent = "⚠";
          }
        }
      });
    }
    row(out, ["Foundry", "Dicing", "Sort house", "Bond house", "Package house", "Test house", "Provisioner", "Customer"], 34);
    row(inn, ["Foundry", "Dicing", "Sort", "Package", "Test", "Provision", "Customer"], 214, [2, 3, 4, 5]);
  }

  /* ---------- route split: partitioned 5N vs mixed N+4 ---------- */
  // data-n on the svg sets how many lines a bundle draws (default 10, illustrative; the slide draws the real 56)
  $$(".fig.routes").forEach((R) => {
    const N = +R.dataset.n || 10, ARR = "rt-arr-" + R.id;
    const BW = 160, COLS = [520, 715, 910, 1105, 1300];
    const TOP = [30, 140], BOT = [320, 430], cyT = 85, cyB = 375, MID = 230;
    const T = { x: 1500, w: 140 };
    const defs = svg("defs", {}, R);
    const mk = svg("marker", { id: ARR, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto" }, defs);
    svg("path", { d: "M0 0 L10 5 L0 10 z", style: "fill:var(--raw-mono-1)" }, mk);
    const txt = (x, y, s, cls, anchor) => {
      const t = svg("text", { class: cls, x, y, "text-anchor": anchor || "middle" }, R); t.textContent = s; return t;
    };
    // box with a title and an optional sub ("|" = line break)
    const box = (x, y, w, h, cls, title, sub) => {
      svg("rect", { class: "bx " + cls, x, y, width: w, height: h, rx: 6 }, R);
      const cx = x + w / 2, cy = y + h / 2, subs = sub ? sub.split("|") : [];
      const top = cy - (subs.length ? 6 + subs.length * 9 : -7);
      txt(cx, top, title, "t");
      subs.forEach((s, i) => txt(cx, top + 26 + i * 19, s, "s"));
    };
    const bundle = (pts) => svg("path", { class: N > 20 ? "bundle dense" : "bundle", d: pts }, R);
    const lane = (cy, i) => cy + (i - (N - 1) / 2) * 72 / (N - 1);
    const dot = (x, y, s, anchor) => {
      const end = anchor === "end";
      svg("circle", { class: "dot", cx: end ? x - s.length * 10.6 - 14 : x + 6, cy: y - 5, r: 6 }, R);
      txt(end ? x : x + 20, y, s, "d", end ? "end" : "start");
    };
    if (N > 20) return dense();

    // row titles
    txt(0, 74, "PARTITIONED", "x bad", "start"); txt(0, 102, "every design", "s", "start"); txt(0, 121, "travels alone", "s", "start");
    txt(0, 364, "MIXED", "x good", "start"); txt(0, 392, "one stream,", "s", "start"); txt(0, 411, "marked at sort", "s", "start");

    // wafer → dice → sort
    box(0, 195, 110, 70, "pre", "Wafer", "56 designs");
    box(145, 195, 110, 70, "pre", "Dice", "local");
    svg("path", { class: "pre-ln", d: `M110 ${MID} H145 M255 ${MID} H290` }, R);
    svg("rect", { class: "bx part", x: 290, y: 170, width: BW, height: 120, rx: 6 }, R);
    txt(370, 202, "Sort", "t");
    for (let i = 0; i < 6; i++) svg("rect", { class: "bin", x: 301 + i * 24, y: 220, width: 18, height: 16 }, R);
    txt(370, 272, "1 bin per design", "s");
    dot(0, 182, "WHOLE WAFER");

    // partitioned row (top): sort → tape is an L-shaped bundle of N
    for (let i = 0; i < N; i++) bundle(`M${302 + 135 * i / (N - 1)} 170 V${lane(cyT, i)} H${COLS[0]}`);
    txt(478, 165, "×N", "x bad");
    box(COLS[0], TOP[0], BW, 110, "part", "Tape & reel", "N reels");
    box(COLS[1], TOP[0], BW, 110, "part", "Mount", "unload reels|onto boards");
    box(COLS[2], TOP[0], BW, 110, "part", "Wire bond", "keep N bins|apart");
    box(COLS[3], TOP[0], BW, 110, "part", "Package", "already|sorted");
    for (let k = 0; k < 4; k++) {
      const x1 = COLS[k] + BW, x2 = k < 3 ? COLS[k + 1] : T.x;
      for (let i = 0; i < N; i++) bundle(`M${x1} ${lane(cyT, i)} H${x2}`);
      txt((x1 + x2) / 2, 165, k < 3 ? "×N" : "×N · no re-sort", "x bad");
    }
    dot(COLS[0], 18, "BARE DIE ON TAPE");
    dot(COLS[3], 18, "UNTESTED PACKAGE");

    // mixed row (bottom): one stream until the re-sort
    svg("rect", { class: "bx skip", x: COLS[0], y: BOT[0], width: BW, height: 110, rx: 6 }, R);
    txt(COLS[0] + BW / 2, cyB - 22, "Tape & reel", "s"); txt(COLS[0] + BW / 2, cyB + 34, "skipped", "s");
    svg("path", { class: "one", d: `M370 290 V${cyB} H${COLS[1] - 2}`, "marker-end": `url(#${ARR})` }, R);
    txt(445, 362, "×1", "x good");
    box(COLS[1], BOT[0], BW, 110, "mix", "Mount + mark", "on boards,|at sort");
    box(COLS[2], BOT[0], BW, 110, "mix", "Wire bond", "one stream");
    box(COLS[3], BOT[0], BW, 110, "mix", "Package", "mixed");
    box(COLS[4], BOT[0], BW, 110, "part", "Re-sort", "read the|marks");
    for (let k = 1; k < 4; k++) {
      const x1 = COLS[k] + BW, x2 = COLS[k + 1];
      svg("path", { class: "one", d: `M${x1} ${cyB} H${x2 - 2}`, "marker-end": `url(#${ARR})` }, R);
      txt((x1 + x2) / 2, 362, "×1", "x good");
    }
    for (let i = 0; i < N; i++) bundle(`M${COLS[4] + BW} ${lane(cyB, i)} H${T.x}`);
    txt((COLS[4] + BW + T.x) / 2, 312, "×N", "x bad");
    dot(COLS[1], 462, "MARKED BOARDS");
    dot(COLS[4], 462, "UNTESTED PACKAGE");

    // shared test stage
    box(T.x, TOP[0], T.w, BOT[1] - TOP[0], "part", "Test", "per design");
    dot(1700, 18, "TESTED · SMT-READY", "end");

    // dense (the real N): pitch 4.5 so every line reads, and every box an N-bundle touches grows to hold it
    function dense() {
      const P = 4.5, SP = P * (N - 1), H = SP + 24;                  // ribbon span, box height
      const T0 = 30, T1 = T0 + H, cyT = T0 + H / 2;                    // partitioned row
      const R0 = T1 + 42, R1 = R0 + H, cyB = R0 + H / 2;               // re-sort box; mixed row centred on it
      const B0 = cyB - 55, B1 = cyB + 55, MID = T1 - 22;
      const ln = (cy, i) => cy + (i - (N - 1) / 2) * P;

      txt(0, 74, "PARTITIONED", "x bad", "start"); txt(0, 102, "every design", "s", "start"); txt(0, 121, "travels alone", "s", "start");
      txt(0, cyB - 11, "MIXED", "x good", "start"); txt(0, cyB + 17, "one stream,", "s", "start"); txt(0, cyB + 36, "marked at sort", "s", "start");

      // wafer → dice → sort; sort is as tall as the ribbon it feeds, one bin per design
      // wafer: a disc with a notch, scribe streets edge to edge, a die wherever one fits whole
      const WX = 62, WY = 200, WR = 60, DP = 12, DS = 10;
      const clipId = "wf-" + R.id;
      svg("circle", { cx: WX, cy: WY, r: WR }, svg("clipPath", { id: clipId }, defs));
      svg("circle", { class: "wf", cx: WX, cy: WY, r: WR }, R);
      const wg = svg("g", { "clip-path": `url(#${clipId})` }, R);
      for (let k = -5; k <= 5; k++) {
        const o = k * DP - (DP - DS) / 2;                             // street centre between die k-1 and k
        svg("path", { class: "street", d: `M${WX + o} ${WY - WR} V${WY + WR} M${WX - WR} ${WY + o} H${WX + WR}` }, wg);
      }
      for (let i = -5; i < 5; i++) for (let j = -5; j < 5; j++) {
        const x = WX + i * DP, y = WY + j * DP, far = Math.max(Math.hypot(x - WX, y - WY), Math.hypot(x + DS - WX, y - WY),
          Math.hypot(x - WX, y + DS - WY), Math.hypot(x + DS - WX, y + DS - WY));
        if (far < WR - 2) svg("rect", { class: "die", x, y, width: DS, height: DS }, wg);
      }
      svg("path", { class: "notch", d: `M${WX - 5} ${WY + WR + 1} L${WX} ${WY + WR - 6} L${WX + 5} ${WY + WR + 1} Z` }, R);
      txt(WX, WY + 92, "Wafer", "t"); txt(WX, WY + 112, N + " designs", "s");
      // dice: the same dies cut apart, loose and a little askew; smaller than sort
      svg("rect", { class: "bx pre", x: 150, y: WY - 45, width: 100, height: 90, rx: 6 }, R);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const q = i * 4 + j, jx = Math.sin(q * 12.9898) * 1.6, jy = Math.sin(q * 78.233) * 1.6, a = Math.sin(q * 37.719) * 7;
        const x = 163 + i * 20 + jx, y = WY - 35 + j * 18 + jy;
        svg("rect", { class: "die", x, y, width: 14, height: 14, transform: `rotate(${a.toFixed(1)} ${x + 7} ${y + 7})` }, R);
      }
      txt(200, WY + 92, "Dice", "t"); txt(200, WY + 112, "local", "s");
      svg("path", { class: "pre-ln", d: `M${WX + WR} ${WY} H150 M250 ${WY} H290` }, R);
      dot(0, WY + 150, "WHOLE WAFER");
      svg("rect", { class: "bx quiet", x: 290, y: T0, width: BW, height: H, rx: 6 }, R);
      txt(370, T0 + 34, "Sort", "t");
      const bc = 7, br = Math.ceil(N / bc), by = cyT - br * 9 + 6;
      for (let i = 0; i < N; i++) svg("rect", { class: "bin dense", x: 303 + (i % bc) * 19.5, y: by + Math.floor(i / bc) * 18, width: 13, height: 12 }, R);
      txt(370, by + br * 18 + 18, "1 bin per design", "s");

      // partitioned row: N lines straight out of sort, through every step (6N, as on the handoff tally)
      const xs = [450, ...COLS.map((c) => c + BW)], xe = [...COLS, T.x];
      ["Tape & reel", "Mount", "Wire bond", "Package", "Test"].forEach((t, k) =>
        box(COLS[k], T0, BW, H, "quiet", t, ["N reels", "unload reels|onto boards", "keep N bins|apart", "already|sorted", "per design"][k]));
      xs.forEach((x1, k) => {
        for (let i = 0; i < N; i++) bundle(`M${x1} ${ln(cyT, i)} H${xe[k]}`);
        txt((x1 + xe[k]) / 2, T1 + 24, "×N", "x bad");
      });
      dot(COLS[0], 18, "BARE DIE ON TAPE");
      dot(COLS[3], 18, "UNTESTED PACKAGE");

      // mixed row: one stream through test; reading the marks at packing fans it back out to N (N+4)
      svg("rect", { class: "bx skip", x: COLS[0], y: B0, width: BW, height: 110, rx: 6 }, R);
      txt(COLS[0] + BW / 2, cyB - 22, "Tape & reel", "s"); txt(COLS[0] + BW / 2, cyB + 34, "skipped", "s");
      svg("path", { class: "one", d: `M370 ${T1} V${cyB} H${COLS[1] - 2}`, "marker-end": `url(#${ARR})` }, R);
      txt(445, cyB - 13, "×1", "x good");
      box(COLS[1], B0, BW, 110, "mix", "Mount + mark", "on boards,|at sort");
      box(COLS[2], B0, BW, 110, "mix", "Wire bond", "one stream");
      box(COLS[3], B0, BW, 110, "mix", "Package", "mixed");
      box(COLS[4], R0, BW, H, "mix", "Test", "one run,|read the|marks");
      for (let k = 1; k < 4; k++) {
        const x1 = COLS[k] + BW, x2 = COLS[k + 1];
        svg("path", { class: "one", d: `M${x1} ${cyB} H${x2 - 2}`, "marker-end": `url(#${ARR})` }, R);
        txt((x1 + x2) / 2, cyB - 13, "×1", "x good");
      }
      for (let i = 0; i < N; i++) bundle(`M${COLS[4] + BW} ${ln(cyB, i)} H${T.x}`);
      txt((COLS[4] + BW + T.x) / 2, R1 + 30, "×N", "x bad");                // under the ribbon; above it is the partitioned ×N
      dot(COLS[1], B1 + 32, "MARKED BOARDS");

      box(T.x, T0, 185, R1 - T0, "quiet", "Pack & ship", "split by|design");   // wider than T.w to hold the title
      dot(1700, 18, "TESTED · SMT-READY", "end");
      dot(0, R1 + 32, "= CUSTOMER CAN TAKE DELIVERY");                // key, in the empty corner
      R.setAttribute("viewBox", `0 0 1700 ${R1 + 42}`);
    }
  });

  /* ---------- handoff tally: one mark = one handoff, today vs one operator ---------- */
  const hand = $("#handoffs");
  if (hand) {
    const H = hand, N = +H.dataset.n || 56, P = 12, TW = 7, TH = 38;   // tick pitch, tick size
    const A = 300, B = 1034, Y0 = 136, RP = 72;                            // column x, first row y, row pitch
    const txt = (x, y, s, cls, anchor) => {
      const t = svg("text", { class: cls, x, y, "text-anchor": anchor || "start" }, H); t.textContent = s; return t;
    };
    const ticks = (x, y, n, cls) => { for (let i = 0; i < n; i++) svg("rect", { class: "tk " + cls, x: x + i * P, y: y - TH / 2, width: TW, height: TH }, H); };
    // [step, today, ours, note on ours] : count of handoffs into that step; null = step doesn't happen
    const ROWS = [
      ["Tape & reel", N, null, "skipped: dies go straight onto boards"],
      ["Mount", N, 1, "all " + N + " together, each one marked"],
      ["Wire bond", N, 1, "one job"],
      ["Package", N, 1, "one job"],
      ["Test", N, 1, "one run, every part"],
      ["Pack & ship", N, N, ""],
    ];
    txt(A, 36, "EACH DESIGN TRAVELS ALONE", "h bad"); txt(A, 66, "how it's done today", "s");
    txt(B, 36, "ONE STREAM, ONE OPERATOR", "h good"); txt(B, 66, "marked at sort, split at the end", "s");
    ROWS.forEach(([name, a, b, note], r) => {
      const y = Y0 + r * RP;
      svg("path", { class: "rule", d: `M0 ${y + RP / 2} H1700` }, H);
      txt(0, y + 10, name, "t");
      ticks(A, y, a, "bad");
      if (b) { ticks(B, y, b, "good"); if (note) txt(B + 30, y + 7, note, "s"); }
      else txt(B, y + 7, note, "s dim");
    });
    svg("path", { class: "rule", d: `M0 ${Y0 - RP / 2} H1700` }, H);
    const yT = Y0 + ROWS.length * RP + 62;
    const sum = (k) => ROWS.reduce((t, row) => t + (row[k] || 0), 0);
    txt(0, yT, "HANDOFFS", "h");
    txt(A, yT + 12, String(sum(1)), "big bad"); txt(A + 170, yT, ROWS.length + " steps × " + N + " designs", "s");
    txt(B, yT + 12, String(sum(2)), "big good"); txt(B + 120, yT, "4 shared + " + N + " at packing", "s");
  }

  /* ---------- one tester, every chip ---------- */
  const sock = $("#socket");
  if (sock) {
    const s = $("svg", sock);
    const CX = 440, CY = 290;                                          // socket centre
    const SX = 250, SY = 100, SW = 380;                                // socket body
    // probe patterns per insert, as [x, y, gnd] around the centre, in test order
    const PKG = {
      lga: { name: "LGA-100", size: 260, r: 7, lands() {               // 10 × 10 at 0.922 mm, GND rows B D G J × cols 2 4 7 9
        const G = new Set([1, 3, 6, 8]), out = [];
        for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) out.push([(c - 4.5) * 24, (r - 4.5) * 24, G.has(r) && G.has(c), "ABCDEFGHJK"[r] + (c + 1)]);
        return out; } },
      cob: { name: "COB · 70-PIN", size: 260, r: 3.2, lands() {        // two rows on the mezzanine edge
        const out = [];
        for (let k = 0; k < 70; k++) { const row = k % 2, c = Math.floor(k / 2); out.push([(c - 17) * 7, row ? 104 : 90, false, "P" + (k + 1)]); }
        return out; } },
      qfn: { name: "QFN-64", size: 230, r: 3.6, lands() {              // 16 per side, counter-clockwise from pin 1
        const out = [], h = 104, p = 12.4;
        for (let k = 0; k < 64; k++) {
          const side = Math.floor(k / 16), i = k % 16 - 7.5;
          const xy = [[-h, i * p], [i * p, h], [h, -i * p], [-i * p, -h]][side];
          out.push([xy[0], xy[1], false, "PIN " + (k + 1)]);
        }
        return out; } },
    };
    const CHIPS = [
      { n: "MEME", from: "WAFER.SPACE", pkg: "lga", steps: ["BOND CHECK", "PUF READ"] },
      { n: "RISC-V CPU", from: "WAFER.SPACE", pkg: "cob", steps: ["BOND CHECK", "FUNCTIONAL"] },
      { n: "SENSOR AFE", from: "ANOTHER SHUTTLE", pkg: "qfn", steps: ["BOND CHECK", "FUNCTIONAL"] },
      { n: "AUDIO DSP", from: "WAFER.SPACE", pkg: "lga", steps: ["BOND CHECK", "FUNCTIONAL"], fail: 37 },
      { n: "PLL TESTCHIP", from: "WAFER.SPACE", pkg: "cob", steps: ["BOND CHECK", "FUNCTIONAL"] },
      { n: "YOUR CHIP", from: "ANY SHUTTLE", pkg: "qfn", steps: ["BOND CHECK", "YOUR TEST"] },
    ];
    const SAYS = {
      "PUF READ": "6 MEDALLIONS · 48 READS", "FUNCTIONAL": "TEST VECTORS", "YOUR TEST": "WHATEVER YOU NEED",
    };
    // bunnie's testbed, in draft: each chip through this rig inks in one lesson that carries over; the last stays open
    const LESSONS = ["CONTACT CHECK", "PROBE INSERTS", "TEST SOFTWARE", "RESULT LOG"];
    const DX = 781, DY = 464, DB = 6, DP = 17;                         // draft centre, bump grid (illustrative)
    const QX = 40, QY = [110, 250, 390], QS = 90;                      // queue slots
    const TX = 690, TY = 110, TC = 3, TP = 64;                         // tested tray

    // socket body, clamp holes, pocket
    svg("rect", { class: "body", x: SX, y: SY, width: SW, height: SW, rx: 6 }, s);
    [[30, 30], [SW - 30, 30], [30, SW - 30], [SW - 30, SW - 30]].forEach(([x, y]) => svg("circle", { class: "hole", cx: SX + x, cy: SY + y, r: 10 }, s));
    svg("rect", { class: "pocket", x: SX + 50, y: SY + 50, width: SW - 100, height: SW - 100 }, s);
    const name = svg("text", { class: "strong mlabel", x: CX, y: SY - 54, "text-anchor": "middle" }, s);
    const from = svg("text", { class: "small", x: CX, y: SY - 22, "text-anchor": "middle" }, s);
    const insert = svg("text", { class: "small", x: CX, y: SY + SW + 32, "text-anchor": "middle" }, s);

    // queue + tray
    svg("text", { class: "small", x: QX + QS / 2, y: 78, "text-anchor": "middle" }, s).textContent = "NEXT";
    const queue = svg("g", {}, s);
    svg("text", { class: "small", x: TX + (TC * TP - 14) / 2, y: 78, "text-anchor": "middle" }, s).textContent = "TESTED";
    for (let i = 0; i < 9; i++) svg("rect", { class: "slot", x: TX + (i % TC) * TP, y: TY + Math.floor(i / TC) * TP, width: TP - 14, height: TP - 14 }, s);
    const tray = svg("g", {}, s);
    [[QX + QS + 14, SX - 14], [SX + SW + 14, TX - 14]].forEach(([x1, x2]) => svg("path", { class: "flow", d: `M${x1} ${CY} H${x2}` }, s));
    const count = svg("text", { class: "small", x: TX + (TC * TP - 14) / 2, y: TY + 3 * TP + 24, "text-anchor": "middle" }, s);

    // the draft: header, dashed frame, bump grid, lessons, and a dashed link from the socket
    const draft = svg("g", { class: "draft" }, s);
    svg("path", { class: "flow", d: `M${SX + SW + 14} ${DY} H${DX - 70}` }, s);
    svg("text", { class: "hd", x: DX, y: 372, "text-anchor": "middle" }, draft).textContent = "BUNNIE'S TESTBED";
    svg("text", { x: DX, y: 391, "text-anchor": "middle" }, draft).textContent = "IN DRAFT";
    const dFrame = svg("rect", { class: "frame", x: DX - 60, y: DY - 60, width: 120, height: 120, rx: 4 }, draft);
    const bumps = [];
    for (let r = 0; r < DB; r++) for (let c = 0; c < DB; c++)
      bumps.push({ el: svg("circle", { class: "bump", cx: DX + (c - (DB - 1) / 2) * DP, cy: DY + (r - (DB - 1) / 2) * DP, r: 4.5 }, draft), o: (r * 7 + c * 11) % 36 });
    const dLines = LESSONS.map((l, k) => svg("text", { x: 694, y: 556 + k * 22 }, draft));
    svg("text", { class: "ask", x: 694, y: 556 + LESSONS.length * 22 }, draft).textContent = "? WHAT ELSE IT NEEDS";
    let dShown = -1;
    function drawDraft(n) {            // n chips done → n lessons learned (capped), ~4/5 of the bumps inked at most
      const k = Math.min(n, LESSONS.length);
      if (dShown === k) return; dShown = k;
      dFrame.classList.toggle("on", k > 0);
      const inked = Math.round(bumps.length * k / (LESSONS.length + 1));
      bumps.forEach((b) => b.el.classList.toggle("on", b.o < inked));
      dLines.forEach((t, j) => { t.textContent = (j < k ? "✓ " : "○ ") + LESSONS[j]; t.classList.toggle("on", j < k); });
    }

    // the chip that moves queue → socket → tray (drawn at 0..QS, transformed), then its probes
    const mover = svg("g", { class: "mover" }, s);
    svg("rect", { class: "cob", width: QS, height: QS, rx: 2, "vector-effect": "non-scaling-stroke" }, mover);
    const die = svg("rect", { class: "die", x: QS * 0.3, y: QS * 0.3, width: QS * 0.4, height: QS * 0.4, "vector-effect": "non-scaling-stroke" }, mover);
    svg("circle", { class: "pin1", cx: 4, cy: 4, r: 1.6 }, mover);
    const probeG = svg("g", {}, s);

    // test steps, verdict, readout
    const steps = svg("text", { class: "steps", x: CX, y: SY + SW + 78, "text-anchor": "middle" }, s);
    const verdict = svg("text", { class: "verdict", x: CX, y: SY + SW + 132, "text-anchor": "middle" }, s);
    const read = svg("text", { class: "read", x: CX, y: SY + SW + 170, "text-anchor": "middle" }, s);

    let probes = [], shownPkg = null, qShown = -1, tShown = -1;
    function setChip(ch) {
      const P = PKG[ch.pkg];
      name.textContent = ch.n; from.textContent = ch.from; insert.textContent = "INSERT: " + P.name;
      if (shownPkg === ch.pkg) return; shownPkg = ch.pkg;
      probeG.textContent = "";
      probes = P.lands().map(([x, y, gnd, id]) => ({ el: svg("circle", { class: "probe" + (gnd ? " gnd" : ""), cx: CX + x, cy: CY + y, r: P.r }, probeG), gnd, id }));
    }
    function pose(x, y, size) { mover.setAttribute("transform", `translate(${x - size / 2} ${y - size / 2}) scale(${size / QS})`); }
    function drawQueue(i) {
      if (qShown === i) return; qShown = i; queue.textContent = "";
      for (let q = 0; q < 3; q++) {
        const ch = CHIPS[i + 1 + q];   // past the named chips: the rest of the shuttle
        svg("rect", { class: "cob q" + (ch ? "" : " more"), x: QX, y: QY[q], width: QS, height: QS }, queue);
        svg("text", { class: "qn", x: QX + QS / 2, y: QY[q] + QS / 2 + 5, "text-anchor": "middle" }, queue).textContent = ch ? ch.n : "+ MORE";
      }
    }
    function drawTray(n) {
      if (tShown === n) return; tShown = n; tray.textContent = "";
      CHIPS.slice(0, n).forEach((ch, i) => {
        const x = TX + (i % TC) * TP, y = TY + Math.floor(i / TC) * TP, w = TP - 14;
        svg("rect", { class: "cob t" + (ch.fail ? " bad" : ""), x: x + 4, y: y + 4, width: w - 8, height: w - 8 }, tray);
        if (ch.fail) svg("path", { class: "x", d: `M${x + 14} ${y + 14} L${x + w - 14} ${y + w - 14} M${x + w - 14} ${y + 14} L${x + 14} ${y + w - 14}` }, tray);
      });
      const bad = CHIPS.slice(0, n).filter((c) => c.fail).length;
      count.textContent = `${n} TESTED` + (bad ? ` · ${bad} CAUGHT` : "");
    }
    function lands(ch, upTo) {         // light lands in test order below index upTo
      probes.forEach((p, k) => {
        const on = k < upTo && !p.gnd;
        p.el.classList.toggle("on", on && ch.fail !== k);
        p.el.classList.toggle("bad", on && ch.fail === k);
      });
    }
    function drawSteps(ch, cur, failed) {   // cur = index of the running step; steps before it are done
      steps.textContent = "";
      ch.steps.forEach((st, k) => {
        const state = failed && k === 0 ? "bad" : failed ? "skip" : k < cur ? "done" : k === cur ? "run" : "todo";
        const mark = { bad: "✕ ", skip: "– ", done: "✓ ", run: "▸ ", todo: "○ " }[state];
        svg("tspan", k ? { class: state, dx: 34 } : { class: state }, steps).textContent = mark + st;
      });
    }

    // timeline: one chip = in, sweep (first step), each later step, hold, out (s)
    const T_IN = 1.8, T_SWEEP = 4.6, T_STEP = 1.8, T_HOLD = 2.4, T_OUT = 1.6;
    const plan = CHIPS.map((ch) => {
      const extra = ch.fail ? 0 : ch.steps.length - 1;
      return { ch, len: T_IN + T_SWEEP + extra * T_STEP + T_HOLD + T_OUT, extra };
    });
    const LOOP = plan.reduce((a, p) => a + p.len, 0);
    const ease = (p) => p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const lerp = (a, b, p) => a + (b - a) * p;
    const trayXY = (i) => [TX + (i % TC) * TP + (TP - 14) / 2, TY + Math.floor(i / TC) * TP + (TP - 14) / 2];
    function finished(ch) {
      lands(ch, probes.length); drawSteps(ch, ch.steps.length, !!ch.fail);
      verdict.textContent = ch.fail ? "OPEN BOND" : "PASS"; verdict.classList.toggle("bad", !!ch.fail);
      read.textContent = ch.fail ? `${probes[ch.fail].id} · NO CURRENT` : `${probes.filter((p) => !p.gnd).length} / ${probes.filter((p) => !p.gnd).length} CONTACTS OK`;
    }
    let raf = 0, t0 = 0;
    function frame(now) {
      let t = ((now - t0) / 1000) % LOOP, i = 0;
      while (t >= plan[i].len) t -= plan[i++].len;
      const { ch, extra } = plan[i], P = PKG[ch.pkg];
      setChip(ch); drawQueue(i); drawTray(i); drawDraft(i);
      const tSweep = T_IN, tSteps = tSweep + T_SWEEP, tHold = tSteps + extra * T_STEP, tOut = tHold + T_HOLD;
      if (t < tSweep) {                                // slide in from the queue head
        const p = ease(t / T_IN);
        pose(lerp(QX + QS / 2, CX, p), lerp(QY[0] + QS / 2, CY, p), lerp(QS, P.size, p)); lands(ch, 0); drawSteps(ch, 0);
        read.textContent = p < 1 ? "LID CLOSING" : ""; verdict.textContent = ""; verdict.classList.remove("bad");
      } else if (t < tSteps) {                         // first step: every contact, one by one
        const n = probes.length, k = Math.min(n - 1, Math.floor((t - tSweep) / T_SWEEP * n)), pr = probes[k];
        pose(CX, CY, P.size); lands(ch, k + 1);
        const failed = ch.fail !== undefined && k >= ch.fail;
        drawSteps(ch, 0, failed);
        read.textContent = pr.gnd ? `${pr.id} · GND RETURN` : ch.fail === k ? `${pr.id} · NO CURRENT` : `${pr.id} · ${(0.6 + ((k * 37) % 7) / 100).toFixed(2)} V`;
        if (failed) { verdict.textContent = "OPEN BOND"; verdict.classList.add("bad"); }
      } else if (t < tHold) {                          // later steps
        const k = 1 + Math.floor((t - tSteps) / T_STEP);
        pose(CX, CY, P.size); lands(ch, probes.length); drawSteps(ch, k);
        read.textContent = SAYS[ch.steps[k]] || "";
      } else if (t < tOut) {                           // verdict
        pose(CX, CY, P.size); finished(ch);
      } else {                                         // out to the tray
        const p = ease((t - tOut) / T_OUT), [tx, ty] = trayXY(i);
        pose(lerp(CX, tx, p), lerp(CY, ty, p), lerp(P.size, TP - 22, p)); lands(ch, 0);
      }
      raf = requestAnimationFrame(frame);
    }
    // ?static and first paint: YOUR CHIP in the socket, passing; the rest already in the tray
    const last = CHIPS.length - 1;
    setChip(CHIPS[last]); drawQueue(last); drawTray(last); drawDraft(last); pose(CX, CY, PKG[CHIPS[last].pkg].size); finished(CHIPS[last]);
    onSlide(sock, () => { cancelAnimationFrame(raf); t0 = performance.now(); raf = requestAnimationFrame(frame); },
      () => cancelAnimationFrame(raf));
  }
})();
