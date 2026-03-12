/* ============================================================
   QUALITY ROOTS — VAULT CRACK DEAL REVEAL
   animation.js — GSAP Animation Engine
   Canvas: 1920×1080 | Non-interactive video rendering
   ============================================================ */

'use strict';

// ─── Plugin Registration ──────────────────────────────────────
gsap.registerPlugin(SplitText, DrawSVGPlugin, ScrambleTextPlugin, CustomEase, MotionPathPlugin);

// Custom eases
CustomEase.create("priceCrash", "M0,0 C0,0 0.15,1.45 0.38,1.22 C0.55,1.06 0.72,1 1,1");

// ─── Constants ────────────────────────────────────────────────
const PRODUCTS_PER_CYCLE = 1;
const EXIT_START         = 7.5;
const CYCLE_END          = 9.1;

// ─── State ────────────────────────────────────────────────────
let PRODUCTS        = [];
let splitInstance   = null;
let livingTweens    = [];   // independent tweens started during living phase

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Build hexagon polygon points string (pointed-top orientation).
 */
function hexPoints(cx, cy, r) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    return `${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`;
  }).join(' ');
}

/**
 * Build the complete hex frame SVG injected around the product image.
 */
function buildHexSVG() {
  const cx = 318, cy = 318;
  const rO = 295, rI = 260;
  const outerPts = hexPoints(cx, cy, rO);
  const innerPts = hexPoints(cx, cy, rI);

  const dotMarkup = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = (cx + rO * Math.cos(angle)).toFixed(2);
    const y = (cy + rO * Math.sin(angle)).toFixed(2);
    return `<circle class="hex-dot" cx="${x}" cy="${y}" r="4.5" fill="#8DC63F" opacity="0.65"/>`;
  }).join('');

  return `<svg class="hex-frame" viewBox="0 0 636 636" xmlns="http://www.w3.org/2000/svg">
    <polygon id="hex-outer" points="${outerPts}"
      stroke="#8DC63F" stroke-width="2.8" fill="none" opacity="0.7"/>
    <polygon id="hex-inner" points="${innerPts}"
      stroke="#8DC63F" stroke-width="1.2" fill="none"
      stroke-dasharray="10 7" opacity="0.42"/>
    ${dotMarkup}
  </svg>`;
}

/**
 * Build subtle geometric accent lines over the scene.
 */
function buildGeoAccents() {
  return `<svg class="geo-accents" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
    <line id="geo-top"    x1="110" y1="52"   x2="680" y2="52"   stroke="#8DC63F" stroke-width="1"   opacity="0.22"/>
    <line id="geo-bot"    x1="110" y1="978"  x2="680" y2="978"  stroke="#8DC63F" stroke-width="1"   opacity="0.22"/>
    <line id="geo-diag1"  x1="110" y1="445"  x2="165" y2="390"  stroke="#8DC63F" stroke-width="1.5" opacity="0.18"/>
    <line id="geo-diag2"  x1="110" y1="465"  x2="175" y2="405"  stroke="#8DC63F" stroke-width="1"   opacity="0.12"/>
    <line id="geo-vert"   x1="960" y1="55"   x2="960" y2="975"  stroke="#8DC63F" stroke-width="1.5" opacity="0.13"/>
    <line id="geo-horiz"  x1="975" y1="513"  x2="1895" y2="513" stroke="#8DC63F" stroke-width="1"   opacity="0.10"/>
  </svg>`;
}

/**
 * Format a price value (numeric or string) as "$X" or "$X.XX".
 */
function formatPrice(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return String(val);
  return '$' + (n % 1 === 0 ? String(n) : n.toFixed(2));
}

/**
 * Kill all living-phase independent tweens.
 */
function killLivingTweens() {
  livingTweens.forEach(t => t && t.kill());
  livingTweens = [];
}

// ─── Product Loading ──────────────────────────────────────────

async function loadProducts() {
  try {
    const resp = await fetch('./products.json', { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    PRODUCTS = Array.isArray(data.products) ? data.products : [];
  } catch (err) {
    console.warn('[QR Template] Could not load products.json:', err.message);
    PRODUCTS = [];
  }
  initPersistentAnimations();
  startCycle();
}

function getBatch(batchIndex) {
  if (!PRODUCTS.length) return [];
  const start = (batchIndex * PRODUCTS_PER_CYCLE) % PRODUCTS.length;
  return Array.from({ length: PRODUCTS_PER_CYCLE }, (_, i) =>
    PRODUCTS[(start + i) % PRODUCTS.length]
  );
}

// ─── DOM Construction ─────────────────────────────────────────

function renderBatch(products) {
  // Tear down previous SplitText
  if (splitInstance) { splitInstance.revert(); splitInstance = null; }

  // Kill any living tweens from last cycle
  killLivingTweens();

  const container = document.getElementById('products-container');
  container.innerHTML = '';
  if (!products.length) return;

  const p            = products[0];
  const origPrice    = parseFloat(p.price);
  const discPrice    = p.discounted_price;
  const savingsPct   = Math.round((1 - discPrice / origPrice) * 100);
  const displayOrig  = formatPrice(origPrice);
  const displayDisc  = formatPrice(discPrice);

  const thcPart    = p.lab_thc_value > 0 ? `${p.lab_thc_value}${p.lab_thc_unit} THC` : '';
  const weightPart = (p.unit_weight && p.unit_weight_unit) ? `${p.unit_weight}${p.unit_weight_unit}` : '';
  const metaStr    = [thcPart, weightPart].filter(Boolean).join('  ·  ');

  const brandDisplay    = (p.brand || 'QUALITY ROOTS').toUpperCase();
  const categoryDisplay = (p.category || 'CANNABIS').toUpperCase();
  const strainDisplay   = p.strain_type ? p.strain_type.toUpperCase() : '';

  const el = document.createElement('div');
  el.className = 'product';

  el.innerHTML = `
    <div class="panel-glow"></div>
    <div class="product-divider"></div>

    <div class="product-left">

      <div class="product-category">${categoryDisplay}</div>

      <div class="product-brand">${brandDisplay}</div>

      <div class="product-name">${p.name || ''}</div>

      ${strainDisplay ? `<div class="product-strain">${strainDisplay}</div>` : '<div class="product-strain" style="display:none"></div>'}

      <div class="price-section-divider"></div>

      <div class="was-label">WAS</div>

      <div class="original-price-wrapper">
        <span class="original-price">${displayOrig}</span>
        <svg class="price-slash-svg" viewBox="0 0 220 100" preserveAspectRatio="none">
          <line id="price-slash-line"
            x1="-5" y1="92"
            x2="225" y2="4"
            stroke="#C0392B"
            stroke-width="7"
            stroke-linecap="round"/>
        </svg>
      </div>

      <div class="now-label">NOW ONLY</div>
      <div class="discounted-price">${displayDisc}</div>

      ${metaStr ? `<div class="thc-info">${metaStr}</div>` : ''}

      <div class="qr-watermark-text">✦ QUALITY ROOTS ✦</div>
    </div>

    <div class="product-right">
      <div class="product-image-wrapper">
        <div class="product-spotlight"></div>
        <img class="product-image"
          src="${p.image_url || ''}"
          alt="${p.name || ''}">
        ${buildHexSVG()}
        <div class="savings-badge">
          <span class="savings-pct">${savingsPct}%</span>
          <span class="savings-off">OFF</span>
        </div>
      </div>
    </div>

    ${buildGeoAccents()}
  `;

  container.appendChild(el);

  // Flash overlay (create once)
  if (!document.getElementById('flash-overlay')) {
    const flash = document.createElement('div');
    flash.id = 'flash-overlay';
    flash.style.cssText = 'position:absolute;inset:0;z-index:18;pointer-events:none;background:rgba(141,198,63,0)';
    document.getElementById('scene').appendChild(flash);
  }

  // Init SplitText after DOM insertion
  splitInstance = SplitText.create('.product-name', { type: 'words' });
}

// ─── Cycle Orchestration ──────────────────────────────────────

function startCycle() {
  animateCycle(0);
}

function animateCycle(batchIndex) {
  const batch = getBatch(batchIndex);
  renderBatch(batch);

  if (!batch.length) {
    gsap.delayedCall(2, () => animateCycle(batchIndex + 1));
    return;
  }

  // ── Initial states (set before timeline starts) ──
  gsap.set('#vine-tl, #vine-tr, #vine-bl, #vine-br', { drawSVG: '0%', opacity: 0.5 });
  gsap.set('#hex-outer, #hex-inner',                  { drawSVG: '0%', rotation: 0 });
  gsap.set('.hex-dot',                                { scale: 0, opacity: 0, transformOrigin: 'center center' });
  gsap.set('#price-slash-line',                       { drawSVG: '0%' });
  gsap.set('.geo-accents',                            { opacity: 0 });
  gsap.set('.product-divider',                        { opacity: 0, scaleY: 0, transformOrigin: 'top center' });
  gsap.set('.product-left',                           { x: -140, opacity: 0 });
  gsap.set('.product-image-wrapper',                  { y: -100, opacity: 0, scale: 0.82 });
  gsap.set('.savings-badge',                          { scale: 0, rotation: -45, opacity: 0 });
  gsap.set('.product-category',                       { opacity: 0 });
  gsap.set('.product-brand',                          { opacity: 0 });
  gsap.set('.product-name',                           { opacity: 0 });
  gsap.set('.product-strain',                         { x: -50, opacity: 0 });
  gsap.set('.price-section-divider',                  { scaleX: 0, opacity: 0, transformOrigin: 'left center' });
  gsap.set('.was-label',                              { opacity: 0, y: 14 });
  gsap.set('.original-price-wrapper',                 { x: -60, opacity: 0 });
  gsap.set('.now-label',                              { opacity: 0, y: 12 });
  gsap.set('.discounted-price',                       { y: -80, opacity: 0, scale: 1.18 });
  gsap.set('.thc-info',                               { opacity: 0 });
  gsap.set('.product-image',                          { y: 0 });

  // ── Master timeline ──
  const tl = gsap.timeline({
    onComplete: () => animateCycle(batchIndex + 1)
  });

  // ═══════════════════════════════════════════════════════════
  // PHASE 1: ENTRANCE  (0 → ~2.9s)
  // ═══════════════════════════════════════════════════════════

  // Vine paths draw in simultaneously
  tl.to('#vine-tl, #vine-tr, #vine-bl, #vine-br', {
    drawSVG: '65%',
    duration: 2.6,
    ease: 'power1.inOut',
    stagger: 0.1
  }, 0);

  // Geo accent lines
  tl.to('.geo-accents', { opacity: 1, duration: 0.45, ease: 'power1.out' }, 0.15);

  // Panel vertical divider slides down
  tl.to('.product-divider', { opacity: 1, scaleY: 1, duration: 0.95, ease: 'power2.inOut' }, 0.08);

  // Left panel sweeps in
  tl.to('.product-left', { x: 0, opacity: 1, duration: 0.82, ease: 'power3.out' }, 0);

  // Product image drops in from above
  tl.to('.product-image-wrapper', {
    y: 0, opacity: 1, scale: 1,
    duration: 0.98, ease: 'back.out(1.35)'
  }, 0.06);

  // Hex outer draws in
  tl.to('#hex-outer', { drawSVG: '100%', duration: 0.78, ease: 'power2.inOut' }, 0.16);

  // Hex inner draws in (slightly delayed)
  tl.to('#hex-inner', { drawSVG: '100%', duration: 1.05, ease: 'power2.inOut' }, 0.30);

  // Vertex dots pop in (staggered)
  tl.to('.hex-dot', {
    scale: 1, opacity: 0.65,
    stagger: 0.07, duration: 0.32,
    ease: 'back.out(2.0)',
    transformOrigin: 'center center'
  }, 0.52);

  // Category — ScrambleText decode
  tl.to('.product-category', { opacity: 1, duration: 0.01 }, 0.16);
  tl.to('.product-category', {
    duration: 0.58,
    ease: 'none',
    scrambleText: {
      text: '{original}',
      chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      speed: 0.6,
      revealDelay: 0.08
    }
  }, 0.16);

  // Brand — ScrambleText decode
  tl.to('.product-brand', { opacity: 1, duration: 0.01 }, 0.35);
  tl.to('.product-brand', {
    duration: 0.72,
    ease: 'none',
    scrambleText: {
      text: '{original}',
      chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      speed: 0.65,
      revealDelay: 0.12
    }
  }, 0.35);

  // Product name — words slide in
  tl.to('.product-name', { opacity: 1, duration: 0.01 }, 0.65);
  if (splitInstance && splitInstance.words && splitInstance.words.length) {
    tl.fromTo(splitInstance.words,
      { y: 34, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.07, duration: 0.52, ease: 'power2.out' },
      0.68
    );
  }

  // Strain badge slides in
  tl.to('.product-strain', { x: 0, opacity: 1, duration: 0.4, ease: 'power2.out' }, 0.95);

  // Price divider line grows
  tl.to('.price-section-divider', { scaleX: 1, opacity: 1, duration: 0.52, ease: 'power2.out' }, 1.08);

  // ═══════════════════════════════════════════════════════════
  // PHASE 2: PRICE REVEAL  (~1.3s → ~2.9s)
  // ═══════════════════════════════════════════════════════════

  // "WAS" fades up
  tl.to('.was-label', { opacity: 1, y: 0, duration: 0.32, ease: 'power2.out' }, 1.30);

  // Original price slides in
  tl.to('.original-price-wrapper', { x: 0, opacity: 1, duration: 0.44, ease: 'power2.out' }, 1.48);

  // Red slash draws across
  tl.to('#price-slash-line', { drawSVG: '100%', duration: 0.44, ease: 'power2.in' }, 1.86);
  // Simultaneously dim the original price
  tl.to('.original-price', { opacity: 0.35, duration: 0.44 }, 1.86);

  // "NOW ONLY" fades up
  tl.to('.now-label', { opacity: 1, y: 0, duration: 0.30, ease: 'power1.out' }, 2.08);

  // Scene flash
  tl.to('#flash-overlay', {
    backgroundColor: 'rgba(141,198,63,0.08)',
    duration: 0.14,
    ease: 'power1.out'
  }, 2.14);
  tl.to('#flash-overlay', {
    backgroundColor: 'rgba(141,198,63,0)',
    duration: 0.38,
    ease: 'power1.in'
  }, 2.28);

  // DISCOUNTED PRICE — elastic slam
  tl.to('.discounted-price', {
    y: 0,
    opacity: 1,
    scale: 1,
    duration: 0.82,
    ease: 'priceCrash'
  }, 2.16);

  // Savings badge spins in
  tl.to('.savings-badge', {
    scale: 1,
    rotation: 12,
    opacity: 1,
    duration: 0.65,
    ease: 'back.out(2.2)'
  }, 2.58);

  // THC / weight info
  tl.to('.thc-info', { opacity: 1, duration: 0.34, ease: 'power1.out' }, 2.76);

  // ═══════════════════════════════════════════════════════════
  // PHASE 3: LIVING MOMENT  (~2.9s → 7.5s)
  // ═══════════════════════════════════════════════════════════
  // All "breathing" animations run as INDEPENDENT tweens (outside timeline)
  // so they don't inflate the timeline's total duration.
  // They're tracked in `livingTweens[]` and killed at exit start.

  tl.call(() => {
    // Product image gentle float
    livingTweens.push(
      gsap.to('.product-image', {
        y: -14,
        duration: 2.85,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut'
      })
    );

    // Hex outer: slow clockwise rotation
    livingTweens.push(
      gsap.to('#hex-outer', {
        rotation: 360,
        duration: 28,
        ease: 'none',
        repeat: -1,
        transformOrigin: '318px 318px'
      })
    );

    // Hex inner: slow counter-clockwise rotation
    livingTweens.push(
      gsap.to('#hex-inner', {
        rotation: -360,
        duration: 42,
        ease: 'none',
        repeat: -1,
        transformOrigin: '318px 318px'
      })
    );

    // Savings badge heartbeat
    livingTweens.push(
      gsap.to('.savings-badge', {
        scale: 1.08,
        duration: 0.8,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
        delay: 0.3
      })
    );

    // Discounted price glow breathe
    livingTweens.push(
      gsap.to('.discounted-price', {
        textShadow: '0 0 120px rgba(141,198,63,0.88), 0 0 50px rgba(141,198,63,0.62), 0 0 14px rgba(141,198,63,0.4)',
        duration: 1.9,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
        delay: 0.5
      })
    );

    // Spotlight pulse
    livingTweens.push(
      gsap.to('.product-spotlight', {
        opacity: 0.7,
        duration: 2.4,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
        delay: 0.8
      })
    );

  }, null, 2.9);

  // Empty tween to hold timeline open through living phase
  tl.to({}, { duration: EXIT_START - 2.9 }, 2.9);

  // ═══════════════════════════════════════════════════════════
  // PHASE 4: EXIT  (EXIT_START → CYCLE_END)
  // ═══════════════════════════════════════════════════════════

  // Kill all living tweens at exit start
  tl.call(killLivingTweens, null, EXIT_START);

  // Top text elements sweep up and fade
  tl.to(['.product-category', '.product-brand'],
    { opacity: 0, y: -24, stagger: 0.055, duration: 0.38, ease: 'power2.in' },
    EXIT_START
  );
  tl.to('.product-name',
    { opacity: 0, y: -20, duration: 0.35, ease: 'power2.in' },
    EXIT_START + 0.06
  );
  tl.to('.product-strain',
    { opacity: 0, x: -45, duration: 0.30, ease: 'power2.in' },
    EXIT_START + 0.10
  );

  // Price elements cascade out
  tl.to(['.price-section-divider', '.was-label', '.original-price-wrapper'],
    { opacity: 0, stagger: 0.04, duration: 0.28, ease: 'power1.in' },
    EXIT_START + 0.10
  );
  tl.to(['.now-label', '.discounted-price', '.thc-info'],
    { opacity: 0, stagger: 0.04, duration: 0.30, ease: 'power1.in' },
    EXIT_START + 0.16
  );

  // Product image drops out
  tl.to('.product-image-wrapper',
    { y: 85, opacity: 0, scale: 0.87, duration: 0.62, ease: 'power2.in' },
    EXIT_START + 0.06
  );

  // Hex frame fades
  tl.to('.hex-frame',
    { opacity: 0, duration: 0.40, ease: 'power1.in' },
    EXIT_START + 0.08
  );

  // Savings badge pops off
  tl.to('.savings-badge',
    { scale: 0, rotation: 50, opacity: 0, duration: 0.28, ease: 'back.in(2.0)' },
    EXIT_START + 0.04
  );

  // Vines fade
  tl.to('#vine-tl, #vine-tr, #vine-bl, #vine-br',
    { opacity: 0, duration: 0.38, ease: 'power1.in' },
    EXIT_START + 0.20
  );

  // Geo accents out
  tl.to('.geo-accents', { opacity: 0, duration: 0.30, ease: 'power1.in' }, EXIT_START + 0.22);
  tl.to('.product-divider', { opacity: 0, duration: 0.28, ease: 'power1.in' }, EXIT_START + 0.24);

  // Ripple expand (transition wipe)
  tl.fromTo('#ripple-circle',
    { attr: { r: 80 }, opacity: 0 },
    { attr: { r: 1500 }, opacity: 0.25, duration: 0.80, ease: 'power2.out' },
    EXIT_START + 0.26
  );
  tl.to('#ripple-circle',
    { opacity: 0, duration: 0.35, ease: 'power1.in' },
    EXIT_START + 0.82
  );
  tl.fromTo('#ripple-circle-2',
    { attr: { r: 80 }, opacity: 0 },
    { attr: { r: 1250 }, opacity: 0.14, duration: 0.68, ease: 'power2.out' },
    EXIT_START + 0.40
  );
  tl.to('#ripple-circle-2',
    { opacity: 0, duration: 0.28, ease: 'power1.in' },
    EXIT_START + 0.88
  );

  // Left panel final sweep
  tl.to('.product-left',
    { x: -115, opacity: 0, duration: 0.48, ease: 'power2.in' },
    EXIT_START + 0.30
  );

  // Tail — ensure timeline reaches CYCLE_END before onComplete fires
  tl.to({}, { duration: 0.05 }, CYCLE_END - 0.05);
}

// ─── Persistent Animations (start once, loop forever) ─────────

function initTicker() {
  const inner = document.querySelector('.ticker-inner');
  if (!inner) return;

  // Short delay to allow the browser to measure rendered width
  gsap.delayedCall(0.15, () => {
    const totalW = inner.scrollWidth;
    // Content repeats 6× so half = 3×, which is a seamless loop point
    gsap.to(inner, {
      x: -(totalW / 2),
      duration: 26,
      ease: 'none',
      repeat: -1
    });
  });
}

function initCornerBrackets() {
  gsap.fromTo(
    '#bracket-tl, #bracket-tr, #bracket-bl, #bracket-br',
    { drawSVG: '0%' },
    { drawSVG: '100%', duration: 0.82, stagger: 0.1, ease: 'power2.inOut', delay: 0.25 }
  );
}

function initBrandWatermark() {
  gsap.to('#brand-watermark', {
    opacity: 1,
    duration: 1.2,
    ease: 'power2.out',
    delay: 0.4
  });
}

function initBackgroundBreathing() {
  gsap.to('#background', {
    scale: 1.03,
    duration: 16,
    yoyo: true,
    repeat: -1,
    ease: 'sine.inOut',
    transformOrigin: 'center center'
  });
}

function initPersistentAnimations() {
  initTicker();
  initCornerBrackets();
  initBrandWatermark();
  initBackgroundBreathing();
}

// ─── Bootstrap ────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', loadProducts);
