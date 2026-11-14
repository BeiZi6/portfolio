/* v5 — 徐元山 portfolio · motion & interaction layer
   intro (particles → name) · hero sculpture + pointer wake + scroll stream
   story formations (packet → funnel → streams → session tree → terminal)
   work stage wipes / tilt / FLIP indicator · cursor · reveals · scramble */
(function () {
  "use strict";

  const root = document.documentElement;
  const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mqDesktop = window.matchMedia("(min-width: 900px)");
  const FINE = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const HAS_GSAP = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";

  root.classList.add("js");
  if (REDUCE) root.classList.add("rm");

  const PROJECTS = [
    { title: "gpu-ncc-matcher", year: "2026", tags: "CUDA",
      desc: "CUDA 上的 GPU 加速归一化互相关（NCC）匹配，采用由粗到精的模板搜索。",
      src: "previews/gpu-ncc-matcher.png", href: "https://github.com/BeiZi6/gpu-ncc-matcher" },
    { title: "MyClaude", year: "2026", tags: "Agents",
      desc: "开箱即用的 Claude Code 隔离工作台：在 macOS / Windows / Linux 虚拟机里跑 Claude，网络代理、时区语言指纹和环境检查集中管理，支持多账号、手机接续和 VPS 部署。",
      src: "previews/myclaude.png", href: "https://github.com/BeiZi6/MyClaude" },
    { title: "kero-web", year: "2026", tags: "Agents",
      desc: "给 Kero 做的手机端遥控：经 Tailscale 在 iPhone / iPad / Mac 上监管和调度多个 Claude Code / Codex 会话，支持主会话派活、审批队列和推送。",
      src: "previews/kero-web.png", private: true },
    { title: "otty-rs", year: "2026", tags: "Agents",
      desc: "从零开始的跨平台 Otty 终端重写，Rust 引擎与 Electron 界面，面向 coding-agent 工作流（hooks、生命周期与会话恢复）。",
      src: "previews/otty-rs.png", href: "https://github.com/BeiZi6/otty-rs" },
    { title: "CSwitch", year: "2026", tags: "Infra",
      desc: "本地 Anthropic 兼容网关：把第三方模型 API 接入 Claude Code，支持模型映射、一键启动和隔离数据目录。",
      src: "previews/cswitch.png", href: "https://github.com/BeiZi6/CSwitch" },
  ];

  /* ---------------- utils ---------------- */
  function hash(i) {
    let t = Math.imul((i * 1000) | 0, 16807) + 12345;
    t = Math.imul(t ^ (t >>> 15), 2246822519);
    t = Math.imul(t ^ (t >>> 13), 3266489917);
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const expoOut = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
  const cubicInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  function loadFont(spec, text, ms) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.race([document.fonts.load(spec, text).catch(() => {}), wait(ms)]);
  }

  const COLOR_TEXT = "#E8F1F5";
  const COLOR_ACC = "#4CC3F0";
  const MONO = '"Geist Mono", "SF Mono", Menlo, "DejaVu Sans Mono", monospace';
  const FIELD = "01<>/\\{}[]|+*-=_#$%·λ∑:;~^";
  const ATLAS_CHARS = (() => {
    let s = "";
    for (let c = 33; c < 127; c++) s += String.fromCharCode(c);
    return s + "─│┌┐└┘├┤▸●◦✓✕→·…▍λ∑•";
  })();
  const SCRAMBLE = "01<>/\\{}[]|+*=_#$%abcdefxyz";

  /* glyph atlas: one tinted sheet per color, glyphs on a fixed grid */
  function makeAtlas(px, color, dpr) {
    const fs = Math.max(8, Math.round(px * dpr));
    const font = `500 ${fs}px ${MONO}`;
    const cw = Math.ceil(fs * 0.78) + 2;
    const chh = Math.ceil(fs * 1.32) + 2;
    const cols = 32;
    const rows = Math.ceil(ATLAS_CHARS.length / cols);
    const c = document.createElement("canvas");
    c.width = cw * cols;
    c.height = chh * rows;
    const g = c.getContext("2d");
    g.font = font;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = color;
    const map = new Map();
    for (let i = 0; i < ATLAS_CHARS.length; i++) {
      const ch = ATLAS_CHARS[i];
      map.set(ch, i);
      g.fillText(ch, (i % cols) * cw + cw / 2, ((i / cols) | 0) * chh + chh / 2 + fs * 0.04);
    }
    const adv = g.measureText("0").width;
    return { canvas: c, cw, chh, cols, map, fs, adv };
  }
  function blit(ctx, A, idx, x, y, s) {
    const sx = (idx % A.cols) * A.cw;
    const sy = ((idx / A.cols) | 0) * A.chh;
    const w = A.cw * s;
    const h = A.chh * s;
    ctx.drawImage(A.canvas, sx, sy, A.cw, A.chh, x - w * 0.5, y - h * 0.5, w, h);
  }

  /* text split with masks; screen readers get one clean copy */
  const kernCtx = document.createElement("canvas").getContext("2d");
  function splitChars(el, opts) {
    opts = opts || {};
    if (!el) return [];
    if (el.__chars) return el.__chars;
    const text = el.textContent.trim();
    el.textContent = "";
    const sr = document.createElement("span");
    sr.className = "visually-hidden";
    sr.textContent = text;
    el.appendChild(sr);
    const chars = [];
    const marks = [];
    for (const ch of text) {
      if (ch === " ") { el.appendChild(document.createTextNode(" ")); marks.push(null); continue; }
      const mk = document.createElement("span");
      mk.className = "mk";
      mk.setAttribute("aria-hidden", "true");
      const mc = document.createElement("span");
      mc.className = "mc";
      mc.textContent = ch;
      mk.appendChild(mc);
      el.appendChild(mk);
      chars.push(mc);
      marks.push(mk);
    }
    if (opts.kern) {
      // inline-block chars lose kerning pairs; restore them from canvas metrics
      const cs = getComputedStyle(el);
      kernCtx.font = `${cs.fontWeight} 200px ${cs.fontFamily}`;
      for (let i = 0; i < text.length - 1; i++) {
        if (!marks[i] || !marks[i + 1]) continue;
        const a = text[i], b = text[i + 1];
        const k = kernCtx.measureText(a + b).width - kernCtx.measureText(a).width - kernCtx.measureText(b).width;
        if (Math.abs(k) > 0.2) marks[i].style.marginRight = (k / 200).toFixed(4) + "em";
      }
    }
    el.__chars = chars;
    return chars;
  }
  function splitWords(el) {
    if (!el) return [];
    const text = el.textContent.trim();
    el.textContent = "";
    const sr = document.createElement("span");
    sr.className = "visually-hidden";
    sr.textContent = text;
    el.appendChild(sr);
    const out = [];
    text.split(" ").forEach((w, i) => {
      if (i) el.appendChild(document.createTextNode(" "));
      const mk = document.createElement("span");
      mk.className = "mk";
      mk.setAttribute("aria-hidden", "true");
      const mc = document.createElement("span");
      mc.className = "mc";
      mc.textContent = w;
      mk.appendChild(mc);
      el.appendChild(mk);
      out.push(mc);
    });
    return out;
  }

  /* offscreen text → point cloud (flat [x,y,...] in CSS px) */
  function sampleText(w, h, draw, step) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    const g = c.getContext("2d", { willReadFrequently: true });
    g.fillStyle = "#fff";
    draw(g);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const pts = [];
    let row = 0;
    for (let y = 0; y < c.height; y += step, row++) {
      for (let x = row % 2 ? step * 0.5 : 0; x < c.width; x += step) {
        if (d[((y | 0) * c.width + (x | 0)) * 4 + 3] > 150) pts.push(x, y);
      }
    }
    return pts;
  }
  function thin(pts, k) {
    const m = pts.length / 2;
    if (m <= k) return pts;
    const out = new Array(k * 2);
    for (let j = 0; j < k; j++) {
      const i = Math.floor((j * m) / k);
      out[j * 2] = pts[i * 2];
      out[j * 2 + 1] = pts[i * 2 + 1];
    }
    return out;
  }

  /* ======================================================================
     HERO FIELD
     ====================================================================== */
  function createHero() {
    const canvas = document.getElementById("hero-field");
    const ctx = canvas.getContext("2d");
    const hero = canvas.closest(".hero");
    const copy = hero.querySelector(".hero-copy");
    const nameEl = hero.querySelector(".hero-name");
    const WORDS = ["Agents", "Gateway", "Infra", "Tools"];

    let dpr = 1, cssW = 0, cssH = 0, W = 0, H = 0, N = 0;
    let X, Y, VX, VY, TX, TY, SX, SY, HAS, KK, G, A, S, ACC, DL;
    let atlasW, atlasA, fieldIdx = [], barIdx = 0, colonIdx = 0;
    let mode = "idle"; // intro | live | static
    let introT0 = 0;
    let formStr = 1, formT0 = 0;
    let wordIdx = 0, lastSwap = 0;
    let fall = 0, fallTarget = 0;
    let copyRect = null;
    let raf = 0, visible = true, last = 0, built = false;
    const ptr = { x: -1e5, y: -1e5, vx: 0, vy: 0, on: false };
    let introHooks = null;

    function compact() { return cssW < 700; }

    function alloc(n) {
      N = n;
      X = new Float32Array(n); Y = new Float32Array(n);
      VX = new Float32Array(n); VY = new Float32Array(n);
      TX = new Float32Array(n); TY = new Float32Array(n);
      SX = new Float32Array(n); SY = new Float32Array(n);
      HAS = new Uint8Array(n); KK = new Float32Array(n);
      G = new Uint16Array(n); A = new Float32Array(n);
      S = new Float32Array(n); ACC = new Uint8Array(n); DL = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        X[i] = hash(i * 3.1 + 1) * W;
        Y[i] = hash(i * 7.7 + 2) * H;
        G[i] = fieldIdx[(hash(i * 11.3) * fieldIdx.length) | 0];
        A[i] = lerp(0.16, 0.5, hash(i * 23.1));
        S[i] = compact() ? lerp(0.34, 0.66, hash(i * 17.9)) : lerp(0.42, 0.9, hash(i * 17.9));
        ACC[i] = hash(i * 41.9) > 0.9 ? 1 : 0;
        KK[i] = lerp(0.6, 1.35, hash(i * 5.3));
        DL[i] = hash(i * 9.1);
      }
    }

    function wordRegion() {
      if (compact()) return { x: cssW * 0.07, y: cssH * 0.14, w: cssW * 0.86, h: cssH * 0.22, align: "center" };
      return { x: cssW * 0.5, y: cssH * 0.14, w: cssW * 0.44, h: cssH * 0.4, align: "right" };
    }

    const wordCache = new Map();
    function wordPoints(word) {
      const key = word + "|" + Math.round(cssW) + "x" + Math.round(cssH) + "@" + dpr;
      if (wordCache.has(key)) return wordCache.get(key);
      const pts = sampleWord(word);
      wordCache.set(key, pts);
      return pts;
    }
    function sampleWord(word) {
      const r = wordRegion();
      const fam = '"Cabinet Grotesk", "Geist", sans-serif';
      kernCtx.font = `800 100px ${fam}`;
      const mw = kernCtx.measureText(word).width || 1;
      const fs = Math.min((r.w * 100) / mw, r.h / 0.8);
      const tw = (mw * fs) / 100;
      const step = compact() ? 2.4 : 3.4;
      const pts = sampleText(r.w, r.h, (g) => {
        g.font = `800 ${fs}px ${fam}`;
        g.textBaseline = "alphabetic";
        const x = r.align === "right" ? r.w - tw : (r.w - tw) / 2;
        g.fillText(word, x, (r.h + fs * 0.7) / 2);
      }, step);
      for (let i = 0; i < pts.length; i += 2) { pts[i] = (pts[i] + r.x) * dpr; pts[i + 1] = (pts[i + 1] + r.y) * dpr; }
      return pts;
    }

    function namePoints() {
      const marks = nameEl.querySelectorAll(".mk");
      const cr = canvas.getBoundingClientRect();
      const fs = parseFloat(getComputedStyle(nameEl).fontSize);
      const out = [];
      const fam = '"Noto Serif SC", "Noto Serif CJK SC", "Songti SC", serif';
      marks.forEach((mk) => {
        const r = mk.getBoundingClientRect();
        const ch = mk.textContent;
        const pts = sampleText(r.width + 8, r.height + 8, (g) => {
          g.font = `900 ${fs}px ${fam}`;
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText(ch, (r.width + 8) / 2, (r.height + 8) / 2 - fs * 0.03);
        }, compact() ? 2.6 : 3);
        for (let i = 0; i < pts.length; i += 2) {
          out.push((pts[i] + r.left - cr.left - 4) * dpr, (pts[i + 1] + r.top - cr.top - 4) * dpr);
        }
      });
      return out;
    }

    // first K particles (sorted by x) → points (sorted by x): morphs sweep instead of tangling
    function assign(pts, frac) {
      const k = Math.min(Math.floor(N * frac), pts.length / 2);
      const p = thin(pts, k);
      const pi = [];
      for (let j = 0; j < k; j++) pi.push(j);
      pi.sort((a, b) => p[a * 2] - p[b * 2]);
      const qi = [];
      for (let i = 0; i < k; i++) qi.push(i);
      qi.sort((a, b) => X[a] - X[b]);
      HAS.fill(0);
      for (let j = 0; j < k; j++) {
        const i = qi[j];
        const q = pi[j];
        TX[i] = p[q * 2];
        TY[i] = p[q * 2 + 1];
        HAS[i] = 1;
      }
      return k;
    }

    function setWord(i, kick) {
      wordIdx = i % WORDS.length;
      assign(wordPoints(WORDS[wordIdx]), compact() ? 0.74 : 0.7);
      if (kick) {
        formStr = 0;
        formT0 = performance.now();
        for (let n = 0; n < N; n++) {
          if (!HAS[n]) continue;
          VX[n] += (hash(n * 3 + wordIdx) - 0.5) * 6 * dpr;
          VY[n] += (hash(n * 5 + wordIdx) - 0.5) * 6 * dpr;
        }
      }
    }

    function measure() {
      const r = canvas.getBoundingClientRect();
      cssW = Math.max(1, r.width);
      cssH = Math.max(1, r.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const nw = Math.round(cssW * dpr), nh = Math.round(cssH * dpr);
      if (canvas.width !== nw) canvas.width = nw;
      if (canvas.height !== nh) canvas.height = nh;
      W = nw; H = nh;
      if (copy) {
        const a = copy.getBoundingClientRect();
        copyRect = { x: (a.left - r.left - 20) * dpr, y: (a.top - r.top - 10) * dpr, w: (a.width + 40) * dpr, h: (a.height + 20) * dpr };
      }
    }

    function build() {
      measure();
      atlasW = makeAtlas(20, COLOR_TEXT, dpr);
      atlasA = makeAtlas(20, COLOR_ACC, dpr);
      fieldIdx = Array.from(FIELD).map((c) => atlasW.map.get(c)).filter((v) => v != null);
      barIdx = atlasW.map.get("|");
      colonIdx = atlasW.map.get(":");
      const area = cssW * cssH;
      const n = REDUCE
        ? Math.round(clamp(area * 0.0012, 600, 1600))
        : compact()
          ? Math.round(clamp(area * 0.0036, 900, 1300))
          : Math.round(clamp(area * 0.0018, 1500, 2400));
      alloc(n);
      setWord(wordIdx, false);
      if (mode !== "intro") for (let i = 0; i < N; i++) if (HAS[i]) { X[i] = TX[i]; Y[i] = TY[i]; }
      built = true;
    }

    function resize() {
      const ow = cssW, oh = cssH;
      measure();
      if (!built || mode === "intro") return;
      if (Math.abs(ow - cssW) < 2 && Math.abs(oh - cssH) < 120) { setWord(wordIdx, false); if (REDUCE) drawStatic(); return; }
      build();
      if (REDUCE) drawStatic();
    }

    /* ---- intro: scatter → name → release into the field ---- */
    const CONVERGE = 820, RELEASE = 1000;
    function startIntro(hooks) {
      introHooks = hooks || {};
      const k = assign(namePoints(), 0.94);
      for (let i = 0; i < N; i++) {
        // start spread over the whole viewport (a little beyond), so the gather reads on screen
        SX[i] = (hash(i * 1.7) * 1.2 - 0.1) * W;
        SY[i] = (hash(i * 2.9) * 1.2 - 0.1) * H;
        X[i] = SX[i]; Y[i] = SY[i];
        VX[i] = VY[i] = 0;
      }
      mode = "intro";
      introT0 = performance.now();
      window.__folio.introPoints = k;
      kick();
      return k;
    }
    function releaseIntro(now) {
      mode = "live";
      let cx = 0, cy = 0, c = 0;
      for (let i = 0; i < N; i++) if (HAS[i]) { cx += X[i]; cy += Y[i]; c++; }
      cx /= c || 1; cy /= c || 1;
      for (let i = 0; i < N; i++) {
        const dx = X[i] - cx, dy = Y[i] - cy;
        VX[i] = dx * 0.018 + (hash(i * 4.4) - 0.5) * 5 * dpr;
        VY[i] = dy * 0.03 - hash(i * 6.6) * 7 * dpr;
      }
      setWord(0, false);
      formStr = 0;
      formT0 = now + 120;
      lastSwap = now + 1200;
    }
    function skipIntro() {
      if (mode !== "intro") return;
      releaseIntro(performance.now());
      for (let i = 0; i < N; i++) {
        if (HAS[i]) { X[i] = TX[i] + (hash(i) - 0.5) * 40 * dpr; Y[i] = TY[i] + (hash(i * 2) - 0.5) * 40 * dpr; }
        else { X[i] = hash(i * 3.1 + 1) * W; Y[i] = hash(i * 7.7 + 2) * H; }
        VX[i] = VY[i] = 0;
      }
      formStr = 0.4;
    }

    function introStep(now) {
      const e = now - introT0;
      for (let i = 0; i < N; i++) {
        const local = clamp((e - DL[i] * 260) / (CONVERGE - 200), 0, 1);
        const k = expoOut(local);
        if (HAS[i]) {
          const a = hash(i * 8.8) * 6.283 + (1 - k) * 2.4;
          const rad = (1 - k) * (40 + hash(i * 3.3) * 120) * dpr;
          X[i] = lerp(SX[i], TX[i], k) + Math.cos(a) * rad;
          Y[i] = lerp(SY[i], TY[i], k) + Math.sin(a) * rad;
        } else {
          X[i] = lerp(SX[i], hash(i * 3.1 + 1) * W, k * 0.6);
          Y[i] = lerp(SY[i], hash(i * 7.7 + 2) * H, k * 0.6);
        }
      }
      if (introHooks && introHooks.progress) introHooks.progress(clamp(0.18 + (e / RELEASE) * 0.82, 0, 1));
      if (e >= RELEASE - 60 && introHooks && !introHooks._revealed) {
        introHooks._revealed = true;
        introHooks.reveal && introHooks.reveal();
      }
      if (e >= RELEASE) releaseIntro(now);
    }

    /* ---- live physics ---- */
    function physics(dtf, now) {
      const t = now * 0.001;
      if (formStr < 1) formStr = clamp((now - formT0) / 1100, 0, 1);
      const fs = sstep(0, 1, formStr) * (1 - fall);
      const R = (compact() ? 110 : 170) * dpr;
      const R2 = R * R;
      const pvx = ptr.vx, pvy = ptr.vy;
      const dampF = Math.pow(0.86, dtf);
      const dampFree = Math.pow(lerp(0.965, 0.94, fall), dtf);
      const flowAmp = 0.05 * dpr * dtf;
      const g = fall * 0.55 * dpr * dtf;
      const on = ptr.on;
      const id = 1 / dpr;
      for (let i = 0; i < N; i++) {
        let vx = VX[i], vy = VY[i];
        const x = X[i], y = Y[i];
        if (HAS[i] && fs > 0.001) {
          const k = 0.02 * KK[i] * fs * dtf;
          vx += (TX[i] - x) * k;
          vy += (TY[i] - y) * k;
          vx *= dampF; vy *= dampF;
          vy += g;
        } else {
          const ang = (Math.sin(x * 0.0019 * id + t * 0.35) + Math.cos(y * 0.0024 * id - t * 0.27) + Math.sin((x + y) * 0.0011 * id + t * 0.18)) * 1.7;
          vx += Math.cos(ang) * flowAmp;
          vy += Math.sin(ang) * flowAmp + g;
          vx *= dampFree; vy *= dampFree;
        }
        if (on) {
          const dx = x - ptr.x, dy = y - ptr.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R2 && d2 > 1) {
            const d = Math.sqrt(d2);
            let f = 1 - d / R;
            f *= f;
            vx += ((dx / d) * 2.6 * dpr + pvx * 0.09) * f * dtf;
            vy += ((dy / d) * 2.6 * dpr + pvy * 0.09) * f * dtf;
          }
        }
        let nx = x + vx * dtf, ny = y + vy * dtf;
        if (!HAS[i] || fall > 0.05) {
          if (nx < -30) nx = W + 30; else if (nx > W + 30) nx = -30;
          if (ny > H + 30) { ny = -30; if (HAS[i]) nx = TX[i] + (hash(i + t) - 0.5) * 60 * dpr; }
          else if (ny < -60) ny = H + 30;
        }
        X[i] = nx; Y[i] = ny; VX[i] = vx; VY[i] = vy;
      }
      // re-form the sculpture into the next word while the hero is at rest
      if (fall < 0.02 && now - lastSwap > 4600) {
        lastSwap = now;
        setWord(wordIdx + 1, true);
      }
      ptr.vx *= 0.85; ptr.vy *= 0.85;
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const fast = 3.2 * dpr, mid = 1.6 * dpr;
      const cr = copyRect;
      const intro = mode === "intro";
      const ie = intro ? clamp((performance.now() - introT0) / CONVERGE, 0, 1) : 1;
      const fr = formStr * (1 - fall);
      const sculptS = compact() ? 0.27 : 0.36;
      for (let i = 0; i < N; i++) {
        const x = X[i], y = Y[i];
        if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
        let a = A[i];
        let s = S[i];
        let gi = G[i];
        if (HAS[i]) {
          if (intro) { a = lerp(0.3, 0.95, ie); s = lerp(0.6, 0.36 + DL[i] * 0.1, ie); }
          else { a = lerp(a, 0.62 + DL[i] * 0.3, fr); s = lerp(s, sculptS + DL[i] * 0.1, fr); }
        } else if (cr && !intro && x > cr.x && y > cr.y && x < cr.x + cr.w && y < cr.y + cr.h) {
          a *= 0.16;
        }
        const vy = VY[i];
        if (vy > fast) { gi = barIdx; a = Math.min(1, a * 1.15); }
        else if (vy > mid && fall > 0.1) gi = colonIdx;
        if (a < 0.02) continue;
        ctx.globalAlpha = a;
        blit(ctx, ACC[i] ? atlasA : atlasW, gi, x, y, s);
      }
      ctx.globalAlpha = 1;
    }

    function drawStatic() {
      for (let i = 0; i < N; i++) if (HAS[i]) { X[i] = TX[i]; Y[i] = TY[i]; }
      formStr = 1;
      draw();
    }

    function frame(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      const dtf = clamp((now - (last || now - 16.7)) / 16.667, 0.3, 3);
      last = now;
      fall += (fallTarget - fall) * clamp(0.1 * dtf, 0, 1);
      if (mode === "intro") introStep(now);
      else physics(dtf, now);
      draw();
      raf = requestAnimationFrame(frame);
    }
    function kick() {
      if (REDUCE || !built) return;
      if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); }
    }

    function onMove(e) {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * dpr, y = (e.clientY - r.top) * dpr;
      if (ptr.on) { ptr.vx = lerp(ptr.vx, x - ptr.x, 0.5); ptr.vy = lerp(ptr.vy, y - ptr.y, 0.5); }
      ptr.x = x; ptr.y = y;
      ptr.on = e.pointerType === "mouse" || e.pressure > 0 || e.type === "pointerdown";
    }
    function onLeave() { ptr.on = false; }

    if (!REDUCE) {
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerdown", onMove, { passive: true });
      window.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") ptr.on = false; }, { passive: true });
      document.addEventListener("pointerleave", onLeave);
      window.addEventListener("blur", onLeave);
    }
    const io = new IntersectionObserver((en) => {
      visible = en.some((x) => x.isIntersecting);
      if (visible) kick();
    }, { threshold: 0 });
    io.observe(canvas);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
    let rt = 0;
    new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(resize, 150); }).observe(canvas);
    // a late webfont changes the sculpture metrics: re-sample once it lands
    if (document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener("loadingdone", () => {
        wordCache.clear();
        if (!built || mode === "intro") return;
        setWord(wordIdx, false);
        if (REDUCE) drawStatic();
      });
    }

    return {
      build() { build(); if (REDUCE) { mode = "static"; drawStatic(); } },
      startIntro,
      skipIntro,
      live() {
        if (REDUCE) { mode = "static"; drawStatic(); return; }
        // repeat visits: a short converge from scatter into the sculpture
        for (let i = 0; i < N; i++) {
          X[i] = hash(i * 3.1 + 1) * W; Y[i] = hash(i * 7.7 + 2) * H;
          VX[i] = (hash(i * 2.2) - 0.5) * 4 * dpr; VY[i] = (hash(i * 4.2) - 0.5) * 4 * dpr;
        }
        mode = "live"; formStr = 0; formT0 = performance.now() + 200; lastSwap = performance.now() + 1500;
        kick();
      },
      setScroll(p) { fallTarget = sstep(0.04, 0.7, p); },
      refreshCopy() { measure(); },
      get mode() { return mode; },
      get count() { return N; },
    };
  }

  /* ======================================================================
     STORY FIELD — readable formations, scrubbed morphs
     ====================================================================== */
  function createStory() {
    const canvas = document.getElementById("story-field");
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    let dpr = 1, cssW = 0, cssH = 0, W = 0, H = 0;
    let atlasW, atlasA, A_ADV = 8.4, LH = 20;
    let F = [];
    let N = 0, PX, PY, init = false;
    let Tt = -1, Ts = -1;
    let raf = 0, visible = false, last = 0;
    let fieldIdx = [];
    let onStep = null, onRail = null;
    const ca = { x: 0, y: 0, c: 0, acc: 0, al: 0 };
    const cb = { x: 0, y: 0, c: 0, acc: 0, al: 0 };

    function ci(ch) { const v = atlasW.map.get(ch); return v == null ? atlasW.map.get("·") : v; }

    function textCells(lines, opt) {
      const cells = [];
      lines.forEach((ln, r) => {
        const L = typeof ln === "string" ? { t: ln } : ln;
        const rng = (list) => (list || []).map((s) => { const k = L.t.indexOf(s); return k >= 0 ? [k, k + s.length] : null; }).filter(Boolean);
        const accR = rng(L.acc), dimR = rng(L.dim);
        for (let i = 0; i < L.t.length; i++) {
          const ch = L.t[i];
          if (ch === " ") continue;
          const acc = accR.some(([a, b]) => i >= a && i < b);
          const dim = dimR.some(([a, b]) => i >= a && i < b);
          cells.push({
            x: opt.x + i * A_ADV, y: opt.y + r * LH, c: ci(ch), ch,
            acc: acc ? 1 : 0, al: dim ? 0.42 : L.al != null ? L.al : 0.92, tag: L.tag,
          });
        }
      });
      return cells;
    }
    function boxLines(title, rows, width) {
      const out = [{ t: "┌─ " + title + " " + "─".repeat(Math.max(0, width - title.length - 5)) + "┐", al: 0.5, acc: [title] }];
      rows.forEach((r) => {
        const o = typeof r === "string" ? { t: r } : r;
        out.push(Object.assign({}, o, { t: "│ " + o.t + " ".repeat(Math.max(0, width - o.t.length - 3)) + "│" }));
      });
      out.push({ t: "└" + "─".repeat(width - 2) + "┘", al: 0.5 });
      return out;
    }
    function bez(p0, p1, p2, p3, t) {
      const u = 1 - t;
      return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
    }
    function curveCells(x0, y0, x1, y1, spacing, path, u0) {
      const samples = [];
      let px = x0, py = y0, len = 0;
      for (let s = 0; s <= 200; s++) {
        const t = s / 200;
        const x = bez(x0, lerp(x0, x1, 0.55), lerp(x0, x1, 0.45), x1, t);
        const y = bez(y0, y0, y1, y1, t);
        if (s) len += Math.hypot(x - px, y - py);
        samples.push([x, y, len]);
        px = x; py = y;
      }
      const out = [];
      let acc = 0;
      for (const [x, y, l] of samples) {
        if (l >= acc) { out.push({ x, y, c: ci("·"), ch: "·", acc: 0, al: 0.5, flow: u0 + l / len, path }); acc += spacing; }
      }
      return out;
    }

    function place(cells) {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      cells.forEach((c) => { x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x); y1 = Math.max(y1, c.y); });
      const rx0 = cssW * 0.36, rx1 = cssW * 0.86, ry0 = cssH * 0.11, ry1 = cssH * 0.58;
      const dx = rx0 + (rx1 - rx0 - (x1 - x0)) / 2 - x0;
      const dy = ry0 + (ry1 - ry0 - (y1 - y0)) / 2 - y0;
      cells.forEach((c) => {
        c.x = Math.round((c.x + dx) * dpr);
        c.y = Math.round((c.y + dy) * dpr);
        if (c.x0 != null) c.x0 = Math.round((c.x0 + dx) * dpr);
      });
      cells.sort((a, b) => a.x - b.x || a.y - b.y);
      return cells;
    }

    function buildFormations() {
      const f0 = textCells([
        { t: "claude code ─────────────────▸ localhost", acc: ["▸"], tag: "wire" },
        "",
        { t: "POST /v1/messages", acc: ["POST"] },
        { t: "anthropic-version: 2023-06-01", al: 0.5 },
        { t: "content-type: application/json", al: 0.5 },
        "",
        "{",
        '  "model": "claude-sonnet-4",',
        { t: '  "stream": true,', acc: ["true"] },
        '  "max_tokens": 8192,',
        { t: '  "system": "You are Claude Code…",', dim: ["You are Claude Code…"] },
        '  "messages": [ … 38 turns ],',
        { t: '  "tools": ["Read", "Edit", "Bash", "mcp__*"]', acc: ['"Read"', '"Edit"', '"Bash"'] },
        "}",
      ], { x: 0, y: 0 });

      // gateway: five requests funnel into CSwitch, four upstreams fan out
      const g = [];
      const bw = 24;
      const bx = 240, by = 130;
      g.push(...textCells(boxLines("CSwitch", [
        { t: "anthropic-compatible", al: 0.6 },
        { t: "map   sonnet → *", acc: ["→"] },
        { t: "dir   isolated", al: 0.75 },
      ], bw), { x: bx, y: by }));
      const boxL = bx - A_ADV * 0.6, boxR = bx + (bw - 0.4) * A_ADV, boxCy = by + 2 * LH;
      ["edit", "chat", "bash", "plan", "mcp"].forEach((w, i) => {
        const y = 10 + i * 66;
        g.push(...textCells([{ t: w, al: 0.55 }], { x: 0, y }));
        g.push(...curveCells(w.length * A_ADV + 12, y, boxL - 8, boxCy - 16 + i * 8, 10, i, 0));
      });
      ["model·a", "model·b", "model·c", "model·d"].forEach((w, i) => {
        const y = 30 + i * 80;
        g.push(...curveCells(boxR + 10, boxCy - 12 + i * 8, boxR + 150, y, 10, 10 + i, 1));
        g.push(...textCells([{ t: w, acc: ["·"] }], { x: boxR + 162, y }));
      });

      // model streams: tokens type out of each lane head
      const lanes = [
        '{"type":"content_block_delta","text":"Refactor the router…"}',
        "tool_use  Edit(src/router.ts)  →  ok",
        "thinking…  map claude-* → upstream, keep the cache warm",
        "usage  in 18.2k · out 1.4k · 84 tok/s",
      ];
      const f2 = textCells([{ t: "stream · one session · any upstream", al: 0.5 }], { x: 0, y: 0 });
      lanes.forEach((s, li) => {
        const y = (2 + li * 2) * LH;
        f2.push(...textCells([{ t: "model·" + "abcd"[li] + "  ▸", acc: ["▸"], al: 0.7 }], { x: 0, y }));
        const x0 = 12 * A_ADV;
        const row = textCells([s], { x: x0, y });
        let j = 0;
        row.forEach((c) => { c.lane = li; c.j = Math.round((c.x - x0) / A_ADV); c.n = s.length; c.al = 0.88; c.x0 = x0; j++; });
        f2.push(...row, { x: x0, y, c: ci("▍"), ch: "▍", acc: 1, al: 1, lane: li, head: 1, n: s.length, j: 0, x0 });
      });

      const f3 = textCells([
        { t: "kero-web · tailscale · iPhone / iPad / Mac", al: 0.5 },
        "",
        { t: "● main   claude-code   dispatch → 5 sessions", acc: ["●", "main"] },
        { t: "│", al: 0.45 },
        { t: "├─▸ sub-1  codex        refactor gateway   | running", acc: ["| running"], dim: ["├─▸"], tag: "spin" },
        { t: "├─▸ sub-2  claude-code  write tests        ◦ waiting", dim: ["├─▸"], tag: "pulse" },
        { t: "├─▸ sub-3  claude-code  docs pass          ✓ ready", acc: ["✓ ready"], dim: ["├─▸"] },
        { t: "├─▸ sub-4  codex        migrate config     ✕ blocked", dim: ["├─▸"] },
        { t: "└─▸ sub-5  claude-code  e2e on mac         ! failed", dim: ["└─▸"] },
        "",
        { t: "approvals  2 pending  ·  push → iPhone", acc: ["2 pending"], al: 0.7 },
      ], { x: 0, y: 0 });

      const f4 = textCells(boxLines("otty", [
        { t: "$ claude --resume", acc: ["$"] },
        { t: "● session restored · 142 turns", acc: ["●"] },
        { t: "hook  pre_tool_use   ✓  Edit src/pty.rs", acc: ["✓"], dim: ["hook"] },
        { t: "hook  post_tool_use  ✓  cargo test  38 passed", acc: ["✓"], dim: ["hook"] },
        { t: "lifecycle  idle → running → waiting", al: 0.7 },
        { t: "$ ▍", acc: ["$", "▍"], tag: "cursor" },
      ], 52), { x: 0, y: 0 });

      F = [place(f0), place(g), place(f2), place(f3), place(f4)];
    }

    function alloc() {
      const n = Math.max.apply(null, F.map((f) => f.length)) + 260;
      if (n !== N) { N = n; PX = new Float32Array(N); PY = new Float32Array(N); init = false; }
    }

    // where particle i sits inside formation f at time t
    function cellAt(f, i, t, out) {
      if (f < 0) {
        const sp = (60 + hash(i * 3.7) * 120) * dpr;
        out.x = hash(i * 1.3 + 7) * W;
        out.y = ((hash(i * 2.1 + 3) * H * 1.3 + t * sp) % (H * 1.3)) - H * 0.15;
        out.c = hash(i * 5.5) > 0.45 ? atlasW.map.get("|") : atlasW.map.get(":");
        out.acc = hash(i * 6.1) > 0.92 ? 1 : 0;
        out.al = 0.3;
        return;
      }
      const cells = F[f];
      if (i >= cells.length) {
        out.x = hash(i * 1.3 + 7) * W + Math.sin(t * 0.3 + i) * 10 * dpr;
        out.y = hash(i * 2.1 + 3) * H + Math.cos(t * 0.25 + i * 0.7) * 10 * dpr;
        out.c = fieldIdx[(hash(i * 4.4) * fieldIdx.length) | 0];
        out.acc = 0;
        out.al = 0.1;
        return;
      }
      const c = cells[i];
      out.x = c.x; out.y = c.y; out.c = c.c; out.acc = c.acc; out.al = c.al;
      if (REDUCE) return;
      if (c.flow != null) {
        let pp = (c.flow * 2 - t * 0.55 + (c.path % 10) * 0.17) % 1;
        if (pp < 0) pp += 1;
        if (pp < 0.05) { out.acc = 1; out.al = 1; out.c = ci("•"); }
        else if (pp < 0.12) out.al = 0.8;
      }
      if (c.lane != null) {
        const span = c.n + 26;
        const v = (t * (14 + c.lane * 5) + c.lane * 17) % span;
        const shown = Math.min(c.n, Math.floor(v));
        if (c.head) {
          out.x = Math.round(c.x0 + shown * A_ADV * dpr);
          out.al = shown >= c.n ? (Math.floor(t * 2.4) % 2 ? 1 : 0.15) : 1;
        } else if (c.j >= shown) {
          out.x = Math.round(c.x0 + shown * A_ADV * dpr);
          out.al = 0;
        }
      }
      if (c.tag === "spin" && c.ch === "|") out.c = ci("|/-\\"[Math.floor(t * 8) % 4]);
      if (c.tag === "pulse") out.al = c.al * (0.55 + 0.45 * Math.sin(t * 3));
      if (c.tag === "cursor" && c.ch === "▍") out.al = Math.floor(t * 1.8) % 2 ? 1 : 0.1;
      if (c.tag === "wire" && c.ch === "─") {
        let p = (c.x / dpr * 0.11 - t * 9) % 7;
        if (p < 0) p += 7;
        if (p < 1) { out.acc = 1; out.al = 1; }
      }
    }

    function measure() {
      const r = canvas.getBoundingClientRect();
      cssW = Math.max(1, r.width);
      cssH = Math.max(1, r.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.width = Math.round(cssW * dpr);
      H = canvas.height = Math.round(cssH * dpr);
    }
    function build() {
      measure();
      if (cssW < 50 || cssH < 50) return;
      const px = cssW < 1200 ? 14 : cssW < 1600 ? 16 : 17;
      atlasW = makeAtlas(px, COLOR_TEXT, dpr);
      atlasA = makeAtlas(px, COLOR_ACC, dpr);
      A_ADV = atlasW.adv / dpr;
      LH = Math.round(px * 1.45);
      fieldIdx = Array.from(FIELD).map((c) => atlasW.map.get(c)).filter((v) => v != null);
      buildFormations();
      alloc();
      draw(performance.now(), true);
    }

    function draw(now, snap) {
      if (!atlasW || !N) return;
      const t = now * 0.001;
      ctx.clearRect(0, 0, W, H);
      const T = Ts;
      let fa, fb, m;
      if (T < 0) { fa = -1; fb = 0; m = sstep(0.2, 1, T + 1); }
      else {
        const k = Math.floor(T), fr = T - k;
        if (k >= 4) { fa = 4; fb = 4; m = 0; }
        else if (fr < 0.58) { fa = k; fb = k; m = 0; }
        else { fa = k; fb = k + 1; m = (fr - 0.58) / 0.42; }
      }
      const follow = snap || !init ? 1 : 0.3;
      const nf = fieldIdx.length;
      const tick = Math.floor(t * 18);
      for (let i = 0; i < N; i++) {
        cellAt(fa, i, t, ca);
        let x = ca.x, y = ca.y, c = ca.c, acc = ca.acc, al = ca.al;
        if (m > 0 && fb !== fa) {
          const local = clamp((m - (i / N) * 0.32) / 0.68, 0, 1);
          if (local > 0) {
            cellAt(fb, i, t, cb);
            const e = cubicInOut(local);
            x = lerp(ca.x, cb.x, e);
            y = lerp(ca.y, cb.y, e) + Math.sin(local * Math.PI) * (hash(i * 9.9) - 0.5) * 140 * dpr;
            al = lerp(ca.al, cb.al, e);
            if (local >= 1) { c = cb.c; acc = cb.acc; }
            else {
              c = fieldIdx[(hash(i * 7 + tick) * nf) | 0];
              acc = hash(i * 13.1) > 0.86 ? 1 : 0;
              al = Math.max(al, 0.32);
            }
          }
        }
        if (follow >= 1) { PX[i] = x; PY[i] = y; }
        else { PX[i] += (x - PX[i]) * follow; PY[i] += (y - PY[i]) * follow; }
        if (al < 0.02) continue;
        ctx.globalAlpha = al;
        blit(ctx, acc ? atlasA : atlasW, c, Math.round(PX[i]), Math.round(PY[i]), 1);
      }
      init = true;
      ctx.globalAlpha = 1;
    }

    function frame(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      const dtf = clamp((now - (last || now - 16.7)) / 16.667, 0.3, 3);
      last = now;
      Ts += (Tt - Ts) * clamp(0.14 * dtf, 0, 1);
      if (Math.abs(Tt - Ts) < 0.0005) Ts = Tt;
      draw(now, false);
      if (onRail) onRail(Ts);
      raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && visible && !document.hidden && !REDUCE && atlasW) { last = 0; raf = requestAnimationFrame(frame); } }

    const io = new IntersectionObserver((en) => {
      visible = en.some((x) => x.isIntersecting);
      if (visible) kick();
    }, { threshold: 0 });
    io.observe(canvas);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
    let rt = 0, built = false;
    new ResizeObserver(() => { if (!built) return; clearTimeout(rt); rt = setTimeout(build, 150); }).observe(canvas);

    return {
      build() { built = true; build(); kick(); },
      setT(v) {
        Tt = clamp(v, -1, 4);
        if (onStep) onStep(Tt < 0 ? 0 : Math.min(4, Math.floor(Tt + 0.22)));
        kick();
      },
      onStep(fn) { onStep = fn; },
      onRail(fn) { onRail = fn; },
      get T() { return Ts; },
    };
  }

  /* ======================================================================
     WORK STAGE
     ====================================================================== */
  function createWork(getLenis) {
    const names = Array.from(document.querySelectorAll(".work-name"));
    const media = document.getElementById("work-media");
    const frameEl = document.getElementById("work-frame");
    const stage = document.querySelector(".work-stage");
    const indicator = document.querySelector(".work-indicator");
    const counter = document.getElementById("work-counter");
    const year = document.getElementById("work-year");
    const desc = document.getElementById("work-desc");
    const tags = document.getElementById("work-tags");
    const link = document.getElementById("work-link");
    const priv = document.getElementById("work-private");
    if (!media || !names.length) return null;

    PROJECTS.forEach((p) => { const i = new Image(); i.src = p.src; });

    // per-letter roll on the index names
    names.forEach((btn) => {
      const t = btn.textContent.trim();
      btn.setAttribute("aria-label", t);
      btn.textContent = "";
      Array.from(t).forEach((ch, i) => {
        const o = document.createElement("span");
        o.className = "ch";
        o.style.setProperty("--i", i);
        o.setAttribute("aria-hidden", "true");
        const n = document.createElement("span");
        n.textContent = ch;
        o.appendChild(n);
        btn.appendChild(o);
      });
    });

    let current = 0;
    let layer = media.querySelector(".wm-layer");
    let slotP = 0.5;

    function moveIndicator(i, instant) {
      if (!indicator) return;
      const b = names[i];
      const h = b.offsetHeight * 0.56;
      const y = b.offsetTop + (b.offsetHeight - h) / 2;
      if (instant || REDUCE || !HAS_GSAP) {
        if (HAS_GSAP) gsap.set(indicator, { y, height: h });
        else { indicator.style.height = h + "px"; indicator.style.transform = `translateY(${y}px)`; }
        return;
      }
      gsap.to(indicator, { y, height: h, duration: 0.65, ease: "expo.out", overwrite: "auto" });
      gsap.fromTo(indicator, { scaleY: 1 }, { scaleY: 1.7, duration: 0.18, ease: "power2.out", yoyo: true, repeat: 1 });
    }

    function setMeta(p) {
      year.innerHTML = `<time datetime="${p.year}">${p.year}</time>`;
      desc.textContent = p.desc;
      tags.textContent = p.tags;
      if (p.private) {
        link.hidden = true;
        link.removeAttribute("href");
        priv.hidden = false;
        media.dataset.cursor = "未开源";
      } else {
        link.hidden = false;
        link.href = p.href;
        link.textContent = "在 GitHub 上看";
        priv.hidden = true;
        media.dataset.cursor = "查看";
      }
    }

    function applyParallax() {
      if (REDUCE || !HAS_GSAP || !layer) return;
      gsap.set(layer.querySelector(".wm-par"), { yPercent: (0.5 - slotP) * 7 });
    }

    function setWork(i, instant) {
      i = clamp(i, 0, PROJECTS.length - 1);
      names.forEach((b, n) => {
        b.classList.toggle("is-active", n === i);
        b.setAttribute("aria-current", n === i ? "true" : "false");
      });
      if (i === current && !instant) return;
      const dir = i >= current ? 1 : -1;
      current = i;
      const p = PROJECTS[i];
      moveIndicator(i, instant);
      if (counter) counter.textContent = String(i + 1).padStart(2, "0");

      if (instant || REDUCE || !HAS_GSAP) {
        setMeta(p);
        layer.querySelector("img").src = p.src;
        return;
      }

      const metaEls = [year, desc, tags, p.private ? priv : link];
      gsap.to([year, desc, tags, link, priv], {
        y: -8, opacity: 0, duration: 0.16, ease: "power2.in", overwrite: true,
        onComplete() {
          setMeta(p);
          gsap.fromTo(metaEls, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "expo.out", stagger: 0.05, overwrite: true });
        },
      });
      if (counter) gsap.fromTo(counter, { yPercent: 60 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: "expo.out" });

      // media: clip-path wipe in the scroll direction, inner scale settles
      const old = layer;
      const nl = document.createElement("div");
      nl.className = "wm-layer";
      nl.innerHTML = `<div class="wm-par"><img alt="" width="1280" height="800" decoding="async" src="${p.src}"></div>`;
      media.appendChild(nl);
      layer = nl;
      const img = nl.querySelector("img");
      gsap.fromTo(nl, { clipPath: dir > 0 ? "inset(100% 0% 0% 0%)" : "inset(0% 0% 100% 0%)" },
        { clipPath: "inset(0% 0% 0% 0%)", duration: 0.95, ease: "expo.inOut" });
      gsap.fromTo(img, { scale: 1.22 }, { scale: 1, duration: 1.4, ease: "expo.out" });
      if (old) {
        gsap.to(old.querySelector("img"), { scale: 1.06, yPercent: -6 * dir, opacity: 0.35, duration: 0.95, ease: "expo.inOut" });
        gsap.delayedCall(1.0, () => { if (old.parentNode && old !== layer) old.remove(); });
      }
      const all = media.querySelectorAll(".wm-layer");
      for (let k = 0; k < all.length - 3; k++) all[k].remove();
      applyParallax();
    }

    names.forEach((btn, i) => {
      btn.addEventListener("click", () => {
        const target = document.getElementById("work-" + i);
        const L = getLenis();
        if (target) {
          const y = target.getBoundingClientRect().top + window.scrollY + 4;
          if (L) L.scrollTo(y, { duration: 1.2 });
          else window.scrollTo({ top: y, behavior: REDUCE ? "auto" : "smooth" });
        }
        setWork(i);
      });
      btn.addEventListener("keydown", (e) => {
        let n = -1;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") n = Math.min(names.length - 1, i + 1);
        else if (e.key === "ArrowUp" || e.key === "ArrowLeft") n = Math.max(0, i - 1);
        else if (e.key === "Home") n = 0;
        else if (e.key === "End") n = names.length - 1;
        if (n < 0) return;
        e.preventDefault();
        names[n].focus();
        names[n].click();
      });
    });
    media.addEventListener("click", () => { if (!PROJECTS[current].private && link.href) link.click(); });

    // pointer tilt (≤3.5°) on a spring, fine pointers only
    if (FINE && !REDUCE && stage && frameEl) {
      let tx = 0, ty = 0, rx = 0, ry = 0, vx = 0, vy = 0, sheen = 0, sh = 0, tr = 0;
      const step = () => {
        tr = 0;
        vx = (vx + (tx - rx) * 0.09) * 0.78;
        vy = (vy + (ty - ry) * 0.09) * 0.78;
        rx += vx; ry += vy;
        sh += (sheen - sh) * 0.15;
        frameEl.style.transform = `rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg)`;
        media.style.setProperty("--sheen", sh.toFixed(3));
        if (Math.abs(tx - rx) + Math.abs(ty - ry) + Math.abs(vx) + Math.abs(vy) + Math.abs(sheen - sh) > 0.002) tr = requestAnimationFrame(step);
      };
      const go = () => { if (!tr) tr = requestAnimationFrame(step); };
      stage.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "mouse") return;
        const r = frameEl.getBoundingClientRect();
        const nx = clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5);
        const ny = clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5);
        tx = -ny * 7; ty = nx * 7;
        sheen = 1;
        go();
      });
      stage.addEventListener("pointerleave", () => { tx = 0; ty = 0; sheen = 0; go(); });
    }

    setWork(0, true);
    window.addEventListener("resize", () => moveIndicator(current, true));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => moveIndicator(current, true));
    return {
      setWork,
      setSlot(p) { slotP = p; applyParallax(); },
      get current() { return current; },
    };
  }

  /* ======================================================================
     CURSOR · MAGNETIC · SCRAMBLE
     ====================================================================== */
  function createCursor() {
    if (!FINE || REDUCE) return;
    const el = document.querySelector(".cursor");
    if (!el) return;
    const dot = el.querySelector(".cursor-dot");
    const ring = el.querySelector(".cursor-ring");
    const label = el.querySelector(".cursor-label");
    root.classList.add("has-cursor");
    el.classList.add("is-hidden");
    let mx = -100, my = -100, dx = -100, dy = -100, rx = -100, ry = -100, raf = 0, seen = false;
    const step = () => {
      raf = 0;
      dx += (mx - dx) * 0.55; dy += (my - dy) * 0.55;
      rx += (mx - rx) * 0.17; ry += (my - ry) * 0.17;
      dot.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;
      ring.style.transform = `translate3d(${rx.toFixed(2)}px, ${ry.toFixed(2)}px, 0)`;
      if (Math.abs(mx - rx) + Math.abs(my - ry) > 0.1) raf = requestAnimationFrame(step);
    };
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      mx = e.clientX; my = e.clientY;
      if (!seen) { seen = true; dx = rx = mx; dy = ry = my; }
      el.classList.remove("is-hidden");
      if (!raf) raf = requestAnimationFrame(step);
    }, { passive: true });
    document.addEventListener("pointerleave", () => el.classList.add("is-hidden"));
    window.addEventListener("blur", () => el.classList.add("is-hidden"));
    window.addEventListener("pointerdown", () => el.classList.add("is-down"));
    window.addEventListener("pointerup", () => el.classList.remove("is-down"));
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest && e.target.closest("[data-cursor], a, button");
      if (!t) { el.classList.remove("is-link", "is-label"); return; }
      const lab = t.getAttribute("data-cursor");
      if (lab) { label.textContent = lab; el.classList.add("is-label"); el.classList.remove("is-link"); }
      else { el.classList.add("is-link"); el.classList.remove("is-label"); }
    });
  }

  function magnetic() {
    if (!FINE || REDUCE || !HAS_GSAP) return;
    document.querySelectorAll(".magnetic").forEach((el) => {
      const big = el.classList.contains("scramble");
      const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
      const k = big ? 0.06 : 0.3, cap = big ? 10 : 8;
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        xTo(clamp((e.clientX - (r.left + r.width / 2)) * k, -cap, cap));
        yTo(clamp((e.clientY - (r.top + r.height / 2)) * k * 1.3, -cap, cap));
      });
      el.addEventListener("pointerleave", () => { xTo(0); yTo(0); });
    });
  }

  function createScramble() {
    const a = document.querySelector(".scramble");
    const span = a && a.querySelector(".scramble-text");
    if (!span) return null;
    const text = span.textContent;
    span.textContent = "";
    const cells = Array.from(text).map((ch) => {
      const s = document.createElement("span");
      s.className = "sc";
      s.textContent = ch;
      span.appendChild(s);
      return s;
    });
    function lock() {
      cells.forEach((c, i) => { c.style.width = ""; c.textContent = text[i]; });
      const ws = cells.map((c) => c.getBoundingClientRect().width);
      cells.forEach((c, i) => { c.style.width = ws[i].toFixed(2) + "px"; });
    }
    let raf = 0;
    function run(dur) {
      if (REDUCE) return;
      cancelAnimationFrame(raf);
      const t0 = performance.now();
      const per = (dur || 560) / cells.length;
      const tick = (now) => {
        const e = now - t0;
        const f = Math.floor(e / 45);
        let done = true;
        for (let i = 0; i < cells.length; i++) {
          const c = cells[i];
          const want = e >= 80 + i * per || text[i] === "@" || text[i] === "." ? text[i] : SCRAMBLE[(hash(i * 31 + f) * SCRAMBLE.length) | 0];
          if (want !== text[i]) done = false;
          if (c.textContent !== want) c.textContent = want;
        }
        if (!done) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    a.addEventListener("pointerenter", () => run(560));
    a.addEventListener("focus", () => run(560));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(lock); else lock();
    let rt = 0;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(lock, 150); });
    return { run, lock };
  }

  /* ======================================================================
     BOOT
     ====================================================================== */
  window.__folio = { projects: PROJECTS, intro: { state: "none" } };

  if (!HAS_GSAP) {
    root.classList.remove("pre-reveal", "intro-on", "intro-hide");
    const h = createHero();
    window.__folio.hero = h;
    Promise.all([loadFont('900 100px "Noto Serif SC"', "徐元山", 1500), loadFont('800 100px "Cabinet Grotesk"', "Agents", 1500)])
      .then(() => { h.build(); h.live(); });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const lenis = !REDUCE && typeof Lenis !== "undefined" ? new Lenis({ autoRaf: false, lerp: 0.085, smoothWheel: true }) : null;
  if (lenis) {
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  window.__folio.lenis = lenis;
  window.__folio.scroll = { lenis };

  const introOn = root.classList.contains("intro-on");
  if (introOn && lenis) lenis.stop();

  const heroName = document.querySelector(".hero-name");
  const heroLatin = document.querySelector(".hero-latin");
  const nameChars = splitChars(heroName);
  const latinWords = splitWords(heroLatin);
  const role = document.querySelector(".hero-role");
  const lede = document.querySelector(".hero-lede");
  const scrollCue = document.querySelector(".hero-scroll");
  const header = document.querySelector(".site-header");

  if (!REDUCE) {
    gsap.set(nameChars, { yPercent: 115 });
    gsap.set(latinWords, { yPercent: 115 });
    gsap.set([role, lede, scrollCue], { opacity: 0, y: 16 });
  }
  root.classList.remove("pre-reveal");

  const hero = createHero();
  const story = mqDesktop.matches && !REDUCE ? createStory() : null;
  const work = createWork(() => lenis);
  const scramble = createScramble();
  Object.assign(window.__folio, { hero, story, work, scramble });
  createCursor();
  magnetic();

  function revealHero(fast) {
    if (REDUCE) return null;
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.to(nameChars, { yPercent: 0, duration: fast ? 0.95 : 1.25, stagger: 0.075 }, 0)
      .to(latinWords, { yPercent: 0, duration: 1.0, stagger: 0.08 }, 0.18)
      .to(role, { opacity: 1, y: 0, duration: 0.9 }, 0.12)
      .to(lede, { opacity: 1, y: 0, duration: 0.9 }, 0.32)
      .to(scrollCue, { opacity: 1, y: 0, duration: 0.8 }, 0.5)
      .fromTo(header.children, { yPercent: -120, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, stagger: 0.06 }, 0.25);
    return tl;
  }

  /* intro controller */
  const intro = document.getElementById("intro");
  const introCount = document.getElementById("intro-count");
  const skipBtn = document.getElementById("intro-skip");
  let introDone = !introOn;
  const hooks = {
    progress(p) { if (introCount) introCount.textContent = String(Math.round(p * 100)).padStart(3, "0"); },
    reveal() {
      root.classList.remove("intro-hide");
      revealHero(false);
      setTimeout(endIntro, 450);
    },
  };
  function endIntro() {
    if (introDone) return;
    introDone = true;
    window.__folio.intro.state = "done";
    removeSkip();
    gsap.to(intro, {
      opacity: 0, duration: 0.3, ease: "power2.out",
      onComplete() {
        root.classList.remove("intro-on");
        intro.style.opacity = "";
        if (lenis) lenis.start();
        ScrollTrigger.refresh();
      },
    });
  }
  function onSkip(e) {
    if (introDone) return;
    if (e && e.type === "keydown" && (e.key === "Tab" || e.key === "Shift")) return;
    if (window.__folio.intro.state === "playing") hero.skipIntro();
    else window.__folio.intro.skipped = true;
    root.classList.remove("intro-hide");
    if (!hooks._revealed) { hooks._revealed = true; revealHero(true); }
    hooks.progress(1);
    endIntro();
  }
  function removeSkip() {
    window.removeEventListener("wheel", onSkip);
    window.removeEventListener("touchstart", onSkip);
    window.removeEventListener("keydown", onSkip);
  }
  if (introOn) {
    try { sessionStorage.setItem("xys-intro", "1"); } catch (e) { /* private mode */ }
    window.__folio.intro.state = "fonts";
    if (skipBtn) skipBtn.addEventListener("click", onSkip);
    window.addEventListener("wheel", onSkip, { passive: true });
    window.addEventListener("touchstart", onSkip, { passive: true });
    window.addEventListener("keydown", onSkip);
    let fake = 0;
    const ft = setInterval(() => {
      if (window.__folio.intro.state !== "fonts") { clearInterval(ft); return; }
      fake = Math.min(17, fake + 3);
      hooks.progress(fake / 100);
    }, 90);
  }

  Promise.all([
    loadFont('900 100px "Noto Serif SC"', "徐元山", 1400),
    loadFont('800 100px "Cabinet Grotesk"', "AgentsGatewayInfraTools", 1400),
    loadFont('500 16px "Geist Mono"', "01<>", 1000),
  ]).then(() => {
    root.classList.add("fonts-ready");
    hero.build();
    if (story) story.build();
    if (scramble) scramble.lock();
    if (introOn && !introDone) {
      window.__folio.intro.state = "playing";
      window.__folio.intro.t0 = performance.now();
      hero.startIntro(hooks);
    } else {
      hero.live();
      if (!introOn) revealHero(true);
    }
    hero.refreshCopy();
    initScroll();
  });

  /* ---- scroll choreography ---- */
  function initScroll() {
    const steps = Array.from(document.querySelectorAll(".story-step"));
    const railItems = Array.from(document.querySelectorAll(".story-rail-list li"));
    const railFill = document.querySelector(".story-rail-fill");
    const stepSplits = steps.map((s) => ({
      kicker: s.querySelector(".story-kicker"),
      chars: REDUCE ? [] : splitChars(s.querySelector(".story-word"), { kern: true }),
      text: s.querySelector(".story-text"),
    }));

    ScrollTrigger.create({
      trigger: ".hero", start: "top top", end: "bottom top",
      onUpdate(self) { hero.setScroll(self.progress); },
    });
    if (!REDUCE) {
      gsap.to(".hero-copy", {
        yPercent: -14, opacity: 0.2, ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
      });
    }

    if (lenis) {
      let lastY = 0;
      lenis.on("scroll", (l) => {
        const y = l.scroll;
        if (y < 120 || y < lastY - 2) header.classList.remove("is-hidden");
        else if (y > lastY + 2) header.classList.add("is-hidden");
        lastY = y;
      });
    }

    let active = -1;
    function showStep(i, instant) {
      if (i === active) return;
      const prev = active;
      active = i;
      railItems.forEach((li, n) => { li.classList.toggle("is-active", n === i); li.classList.toggle("is-done", n < i); });
      const dir = prev < 0 || i > prev ? 1 : -1;
      if (prev >= 0) {
        const p = stepSplits[prev];
        gsap.to(p.chars, { yPercent: -110 * dir, duration: 0.32, ease: "power3.in", stagger: 0.012, overwrite: true });
        gsap.to([p.kicker, p.text], {
          opacity: 0, y: -10 * dir, duration: 0.25, ease: "power2.in", overwrite: true,
          onComplete() { if (active !== prev) steps[prev].classList.remove("is-active"); },
        });
      }
      const s = stepSplits[i];
      steps[i].classList.add("is-active");
      const d = instant ? 0 : 0.18;
      gsap.fromTo(s.chars, { yPercent: 115 * dir }, { yPercent: 0, duration: instant ? 0.01 : 0.95, delay: d, ease: "expo.out", stagger: instant ? 0 : 0.035, overwrite: true });
      gsap.fromTo(s.kicker, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.6, delay: d, ease: "expo.out", overwrite: true });
      gsap.fromTo(s.text, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.75, delay: d + 0.12, ease: "expo.out", overwrite: true });
    }

    if (story) {
      steps.forEach((s) => s.classList.remove("is-active"));
      story.onStep((i) => showStep(i));
      let lastFill = -1;
      story.onRail((T) => {
        const f = clamp(T / 4, 0, 1);
        if (railFill && Math.abs(f - lastFill) > 0.0005) { railFill.style.transform = `scaleY(${f.toFixed(4)})`; lastFill = f; }
      });
      ScrollTrigger.create({
        trigger: ".story", start: "top bottom", end: "bottom bottom",
        onUpdate(self) {
          const vh = window.innerHeight;
          const total = self.trigger.offsetHeight;
          const s = self.progress * total;
          story.setT(s < vh ? s / vh - 1 : clamp((s - vh) / ((total - vh) * 0.9), 0, 1) * 4);
        },
      });
      showStep(0, true);
    } else if (!REDUCE) {
      steps.forEach((st, n) => {
        const s = stepSplits[n];
        gsap.set(s.chars, { yPercent: 115 });
        gsap.set([s.kicker, s.text], { opacity: 0, y: 14 });
        ScrollTrigger.create({
          trigger: st, start: "top 85%", once: true,
          onEnter() {
            gsap.to(s.chars, { yPercent: 0, duration: 0.9, ease: "expo.out", stagger: 0.03 });
            gsap.to([s.kicker, s.text], { opacity: 1, y: 0, duration: 0.7, ease: "expo.out", stagger: 0.08, delay: 0.1 });
          },
        });
      });
    }

    if (work && mqDesktop.matches) {
      let lastI = 0;
      ScrollTrigger.create({
        trigger: ".work-desktop", start: "top top", end: "bottom bottom",
        onUpdate(self) {
          const v = self.progress * PROJECTS.length;
          const i = Math.min(PROJECTS.length - 1, Math.floor(v + 0.0001));
          if (i !== lastI) { lastI = i; work.setWork(i); }
          work.setSlot(clamp(v - i, 0, 1));
        },
      });
    }

    // mobile cards: scroll-linked media reveal
    document.querySelectorAll(".work-cards > li").forEach((li) => {
      const img = li.querySelector("img");
      if (!img) return;
      const wrap = document.createElement("div");
      wrap.className = "card-media";
      img.parentNode.insertBefore(wrap, img);
      wrap.appendChild(img);
      if (REDUCE || mqDesktop.matches) return;
      gsap.fromTo(wrap, { clipPath: "inset(14% 8% 14% 8%)" }, {
        clipPath: "inset(0% 0% 0% 0%)", ease: "none",
        scrollTrigger: { trigger: wrap, start: "top 95%", end: "top 45%", scrub: 0.6 },
      });
      gsap.fromTo(img, { scale: 1.2 }, {
        scale: 1, ease: "none",
        scrollTrigger: { trigger: wrap, start: "top 95%", end: "top 35%", scrub: 0.6 },
      });
      const txt = Array.from(li.querySelectorAll(".work-year, h3, p"));
      gsap.set(txt, { opacity: 0, y: 16 });
      ScrollTrigger.create({ trigger: wrap, start: "top 70%", once: true,
        onEnter() { gsap.to(txt, { opacity: 1, y: 0, duration: 0.7, ease: "expo.out", stagger: 0.06 }); } });
    });

    document.querySelectorAll(".reveal-title").forEach((h) => {
      const chars = splitChars(h);
      if (REDUCE) return;
      gsap.set(chars, { yPercent: 115 });
      ScrollTrigger.create({ trigger: h, start: "top 88%", once: true,
        onEnter() { gsap.to(chars, { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: 0.07 }); } });
    });
    const count = document.querySelector(".section-count");
    if (count && !REDUCE) {
      gsap.set(count, { opacity: 0, x: 12 });
      ScrollTrigger.create({ trigger: count, start: "top 88%", once: true,
        onEnter() { gsap.to(count, { opacity: 1, x: 0, duration: 0.8, ease: "expo.out", delay: 0.2 }); } });
    }

    const rows = document.querySelectorAll(".skill-wall li");
    rows.forEach((li, n) => {
      const rule = document.createElement("span");
      rule.className = "skill-rule";
      rule.setAttribute("aria-hidden", "true");
      li.prepend(rule);
      let ruleB = null;
      if (n === rows.length - 1) {
        ruleB = document.createElement("span");
        ruleB.className = "skill-rule skill-rule-b";
        ruleB.setAttribute("aria-hidden", "true");
        li.appendChild(ruleB);
      }
      const disp = li.querySelector(".skill-display");
      let inner = null;
      if (disp) {
        inner = document.createElement("span");
        inner.className = "sd-in";
        while (disp.firstChild) inner.appendChild(disp.firstChild);
        disp.appendChild(inner);
      }
      if (REDUCE) return;
      const lab = li.querySelector(".skill-label");
      const note = li.querySelector(".skill-note");
      const rules = [rule, ruleB].filter(Boolean);
      gsap.set(rules, { scaleX: 0 });
      if (inner) gsap.set(inner, { yPercent: 105 });
      gsap.set([lab, note].filter(Boolean), { opacity: 0, y: 10 });
      ScrollTrigger.create({ trigger: li, start: "top 86%", once: true,
        onEnter() {
          const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
          tl.to(rules, { scaleX: 1, duration: 1.2 }, 0)
            .to(lab, { opacity: 1, y: 0, duration: 0.6 }, 0.1);
          if (inner) tl.to(inner, { yPercent: 0, duration: 1.0 }, 0.12);
          if (note) tl.to(note, { opacity: 1, y: 0, duration: 0.7 }, 0.3);
        } });
    });

    if (!REDUCE) {
      [".education p", ".contact-list li", ".footer-note"].forEach((sel) => {
        const els = document.querySelectorAll(sel);
        if (!els.length) return;
        gsap.set(els, { opacity: 0, y: 14 });
        ScrollTrigger.create({ trigger: els[0], start: "top 95%", once: true,
          onEnter() { gsap.to(els, { opacity: 1, y: 0, duration: 0.8, ease: "expo.out", stagger: 0.07 }); } });
      });
      const cta = document.querySelector(".contact-cta");
      if (cta) {
        gsap.set(cta, { opacity: 0, y: 24 });
        ScrollTrigger.create({ trigger: cta, start: "top 92%", once: true,
          onEnter() { gsap.to(cta, { opacity: 1, y: 0, duration: 0.9, ease: "expo.out" }); if (scramble) scramble.run(900); } });
      }
    }

    if (lenis) {
      document.querySelectorAll('a[href^="#"]:not(.skip-link)').forEach((a) => {
        a.addEventListener("click", (e) => {
          const id = a.getAttribute("href");
          if (id === "#") return;
          const t = id === "#top" ? 0 : document.querySelector(id);
          if (t === null) return;
          e.preventDefault();
          lenis.scrollTo(t, { duration: 1.3 });
          if (t && id !== "#top") {
            if (!t.hasAttribute("tabindex")) t.setAttribute("tabindex", "-1");
            t.focus({ preventScroll: true });
          }
        });
      });
    }

    ScrollTrigger.refresh();
  }
})();
