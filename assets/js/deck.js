/* The Last Mile of Open Silicon — slide engine
   Based on the teardown2026_talk engine, plus section chrome and speaker notes.
   Keys: ←/→/Space/PgUp/PgDn navigate, Home/End jump, O overview, F fullscreen,
         N notes pane, P presenter window (notes on a second screen), ? help */
(function () {
  "use strict";

  const stage = document.getElementById("stage");
  const slides = Array.from(stage.querySelectorAll(".slide"));
  const rail = stage.querySelector(".rail i");
  const sectLabel = stage.querySelector(".sect-label");
  const hudCur = stage.querySelector(".hud .cur");
  const hudTotal = stage.querySelector(".hud .total");
  const tierChips = Array.from(stage.querySelectorAll(".tiers .chip"));   // A-E strip, top right
  const help = document.getElementById("help");
  const notesPane = document.getElementById("notes-pane");

  const SECT_NAMES = {
    open: "Opening", meme: "I made a chip", needs: "The bigger picture",
    prod: "Production overview", sg: "Singapore", ask: "The ask",
    line: "How it runs today", people: "Testing · bunnie", close: "Closing",
  };

  // ?static (or #12&static): animations finish instantly, demos hold still. For screenshots / PDF.
  if (/[?&]static/.test(location.href)) document.documentElement.classList.add("static");

  let current = 0;
  let overview = false;
  let presenter = null;

  hudTotal.textContent = String(slides.length).padStart(2, "0");

  /* ---------- stage scaling ---------- */
  function fit() {
    if (overview) return;
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = `scale(${s})`;
  }
  window.addEventListener("resize", fit);
  fit();

  /* ---------- notes ---------- */
  function notesHTML(n) {
    const sl = slides[n];
    const aside = sl.querySelector("aside.notes");
    const title = sl.dataset.title || "";
    return `<h5>${n + 1} / ${slides.length} — ${title}</h5>` + (aside ? aside.innerHTML : "<p>(no notes)</p>");
  }

  // Presenter window: big notes (+/- to resize), next-slide preview, total and per-slide clocks (R resets).
  // Keys typed in it drive the deck, so it can keep focus on the second screen while the deck is recorded.
  let slideT0 = Date.now(), talkT0 = Date.now(), clockTimer = null;
  const mmss = (ms) => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

  function renderNotes() {
    notesPane.innerHTML = notesHTML(current);
    if (presenter && !presenter.closed) {
      const d = presenter.document, nxt = slides[current + 1];
      d.getElementById("cur").innerHTML = notesHTML(current);
      d.getElementById("cur").scrollTop = 0;
      d.getElementById("nxt-t").textContent = nxt ? "Next: " + (nxt.dataset.title || "") : "End of deck";
      const f = d.getElementById("nxt-f");
      f.style.visibility = nxt ? "visible" : "hidden";
      // file:// pages are cross-origin to each other, so set src (a hash-only change, no reload), not location.hash
      if (nxt) f.src = f.src.replace(/#.*$/, "") + "#" + (current + 2);
    }
  }

  function openPresenter() {
    presenter = window.open("", "lastmile-notes", "width=1280,height=860");
    if (!presenter) return;
    const d = presenter.document;
    let size = 28;
    try { size = +presenter.localStorage.getItem("notes-size") || 28; } catch (e) {}
    d.title = "Speaker notes";
    d.body.innerHTML =
      `<style>
       html,body{height:100%;margin:0}
       body{background:#0c1311;color:#e4e4e4;font-family:"Segoe UI",sans-serif;display:grid;grid-template-columns:1fr 420px;gap:32px;padding:28px 36px;box-sizing:border-box}
       #cur{overflow-y:auto;line-height:1.5;font-size:var(--fs);padding-right:12px}
       #cur h5{font:600 15px Consolas,monospace;letter-spacing:.2em;text-transform:uppercase;color:#36d9bb;margin:0 0 18px}
       #cur p{margin:0 0 .7em;max-width:46ch}
       aside{display:flex;flex-direction:column;gap:14px;font:15px Consolas,monospace;color:#7fa69e}
       #clk{font-size:44px;color:#e4e4e4;letter-spacing:.04em}
       #clk small{display:block;font-size:15px;color:#7fa69e;letter-spacing:.1em;margin-top:4px}
       #nxt-f{width:420px;height:236px;border:1px solid #2c5a4f;pointer-events:none;background:#000}
       .keys{margin-top:auto;font-size:13px;line-height:1.7;color:#4f7a70}
       </style>
       <div id="cur"></div>
       <aside>
         <div id="clk">0:00<small>this slide 0:00</small></div>
         <div id="nxt-t"></div>
         <iframe id="nxt-f" tabindex="-1" src="${new URL("index.html?static", location.href).href}#${current + 2}"></iframe>
         <div class="keys">→ / Space next · ← back · + / − text size · R reset clock<br>F here does nothing: press F on the slides window first</div>
       </aside>`;
    d.body.style.setProperty("--fs", size + "px");
    presenter.addEventListener("keydown", (e) => {
      if (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_") {
        size = Math.max(16, Math.min(56, size + (e.key === "+" || e.key === "=" ? 2 : -2)));
        d.body.style.setProperty("--fs", size + "px");
        try { presenter.localStorage.setItem("notes-size", size); } catch (err) {}
      } else if (e.key === "r" || e.key === "R") {
        talkT0 = slideT0 = Date.now();
      } else if (e.key !== "f" && e.key !== "F") {
        onKey(e);
      }
    });
    clearInterval(clockTimer);
    clockTimer = setInterval(() => {
      if (!presenter || presenter.closed) return clearInterval(clockTimer);
      const now = Date.now();
      d.getElementById("clk").innerHTML = `${mmss(now - talkT0)}<small>this slide ${mmss(now - slideT0)}</small>`;
    }, 500);
    talkT0 = slideT0 = Date.now();
    renderNotes();
  }

  /* ---------- navigation ---------- */
  function show(n) {
    n = Math.max(0, Math.min(slides.length - 1, n));
    const prevSlide = slides[current];
    slides.forEach((sl, i) => sl.classList.toggle("active", i === n));
    current = n;
    const sl = slides[n];
    const sect = sl.dataset.sect || "open";
    stage.style.setProperty("--sect-hue", `var(--h-${sect})`);
    rail.style.width = ((n + 1) / slides.length) * 100 + "%";
    sectLabel.textContent = SECT_NAMES[sect] || "";
    hudCur.textContent = String(n + 1).padStart(2, "0");
    const lit = (sl.dataset.tiers || "").split(/\s+/);
    tierChips.forEach((ch) => ch.classList.toggle("on", lit.includes(ch.textContent.trim())));
    if (location.hash !== "#" + (n + 1)) history.replaceState(null, "", "#" + (n + 1));
    if (prevSlide && prevSlide !== sl) prevSlide.dispatchEvent(new CustomEvent("slide:leave"));
    sl.dispatchEvent(new CustomEvent("slide:enter"));
    if (prevSlide !== sl) slideT0 = Date.now();
    renderNotes();
  }
  const next = () => show(current + 1);
  const prev = () => show(current - 1);

  /* ---------- overview mode ---------- */
  const COLS = 6, GAP = 26, SCALE = 0.145;
  function enterOverview() {
    overview = true;
    stage.classList.add("overview");
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = `scale(${s})`;
    const cellW = 1920 * SCALE, cellH = 1080 * SCALE;
    const rows = Math.ceil(slides.length / COLS);
    const totalW = COLS * cellW + (COLS - 1) * GAP;
    const totalH = rows * cellH + (rows - 1) * GAP;
    const offX = (1920 - totalW) / 2, offY = Math.max(20, (1080 - totalH) / 2);
    slides.forEach((sl, i) => {
      const x = offX + (i % COLS) * (cellW + GAP);
      const y = offY + Math.floor(i / COLS) * (cellH + GAP);
      sl.style.transform = `translate(${x}px, ${y}px) scale(${SCALE})`;
      sl.style.width = "1920px"; sl.style.height = "1080px"; sl.style.inset = "0 auto auto 0";
    });
  }
  function exitOverview(target) {
    overview = false;
    stage.classList.remove("overview");
    slides.forEach((sl) => { sl.style.transform = ""; sl.style.width = ""; sl.style.height = ""; sl.style.inset = ""; });
    fit();
    if (typeof target === "number") show(target);
  }
  slides.forEach((sl, i) => sl.addEventListener("click", () => { if (overview) exitOverview(i); }));

  /* ---------- keyboard ---------- */
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target && e.target.tagName === "INPUT") return;
    switch (e.key) {
      case "ArrowRight": case "ArrowDown": case " ": case "PageDown":
        e.preventDefault(); overview ? exitOverview(current) : next(); break;
      case "ArrowLeft": case "ArrowUp": case "PageUp":
        e.preventDefault(); overview ? exitOverview(current) : prev(); break;
      case "Home": e.preventDefault(); show(0); break;
      case "End": e.preventDefault(); show(slides.length - 1); break;
      case "o": case "O": overview ? exitOverview() : enterOverview(); break;
      case "n": case "N": notesPane.classList.toggle("open"); break;
      case "p": case "P": openPresenter(); break;
      case "Escape":
        if (overview) exitOverview();
        help.classList.remove("open"); notesPane.classList.remove("open"); break;
      case "f": case "F":
        document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
        break;
      case "?": help.classList.toggle("open"); break;
    }
  }
  document.addEventListener("keydown", onKey);

  /* ---------- touch ---------- */
  let touchX = null;
  document.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) (dx < 0 ? next() : prev());
    touchX = null;
  }, { passive: true });

  /* ---------- hash routing ---------- */
  function fromHash() {
    const n = parseInt(location.hash.slice(1), 10);
    return Number.isFinite(n) ? n - 1 : 0;
  }
  window.addEventListener("hashchange", () => { if (fromHash() !== current) show(fromHash()); });

  // let demos.js register its slide:enter listeners first
  window.addEventListener("DOMContentLoaded", () => show(fromHash()));
})();
