const HOLD_MS = 1000;
const FADE_MS = 1000;
const BAR = 14;
const MIN_THUMB = 28;
const STEP_MIN = 40;
const REPEAT_DELAY = 400;
const REPEAT_EVERY = 50;

type Axis = "x" | "y";

type AxisEls = {
  root: HTMLDivElement;
  dec: HTMLButtonElement;
  inc: HTMLButtonElement;
  track: HTMLDivElement;
  thumb: HTMLDivElement;
  hover: boolean;
  holdTimer: number | null;
  fadeTimer: number | null;
};

type Drag = {
  axis: Axis;
  startPointer: number;
  startScroll: number;
  range: number;
  maxScroll: number;
};

type HostCtl = {
  host: HTMLElement;
  y: AxisEls;
  x: AxisEls;
  dragging: Drag | null;
  pressAxis: Axis | null;
  pressTimer: number | null;
  pressRepeat: number | null;
  ro: ResizeObserver;
  off: () => void;
};

function stillInsideBar(
  bar: HTMLElement,
  related: EventTarget | null,
): boolean {
  return related instanceof Node && bar.contains(related);
}

function barIsShown(bar: AxisEls): boolean {
  return bar.root.style.display === "flex";
}

function nodeOnBar(bar: AxisEls, node: EventTarget | null): boolean {
  return node instanceof Node && bar.root.contains(node);
}

function isRoot(el: HTMLElement): boolean {
  return el === document.documentElement;
}

function skipEl(el: HTMLElement): boolean {
  if (el.closest("#mill-scroll-root")) return true;
  const tag = el.tagName;
  return (
    tag === "SCRIPT" ||
    tag === "STYLE" ||
    tag === "LINK" ||
    tag === "META" ||
    tag === "BR" ||
    tag === "IFRAME" ||
    tag === "SVG" ||
    tag === "PATH" ||
    tag === "IMG"
  );
}

function overflowOpen(value: string): boolean {
  return value === "auto" || value === "scroll";
}

function isPotentialScroller(el: HTMLElement): boolean {
  if (skipEl(el)) return false;
  if (isRoot(el)) return true;
  const s = getComputedStyle(el);
  return overflowOpen(s.overflowY) || overflowOpen(s.overflowX);
}

function canOverflow(el: HTMLElement, axis: Axis): boolean {
  if (isRoot(el)) {
    return axis === "y"
      ? el.scrollHeight > el.clientHeight + 1
      : el.scrollWidth > el.clientWidth + 1;
  }
  const s = getComputedStyle(el);
  const o = axis === "y" ? s.overflowY : s.overflowX;
  if (!overflowOpen(o)) return false;
  return axis === "y"
    ? el.scrollHeight > el.clientHeight + 1
    : el.scrollWidth > el.clientWidth + 1;
}

function intersect(a: DOMRect, b: DOMRect): DOMRect | null {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  if (right - left < 2 || bottom - top < 2) return null;
  return new DOMRect(left, top, right - left, bottom - top);
}

function clipHostRect(host: HTMLElement): DOMRect | null {
  if (!host.isConnected) return null;
  if (host.closest("[hidden]")) return null;
  let cur: DOMRect | null = host.getBoundingClientRect();
  let n = host.parentElement;
  while (n && n !== document.documentElement) {
    const s = getComputedStyle(n);
    if (s.overflowX !== "visible" || s.overflowY !== "visible") {
      cur = intersect(cur, n.getBoundingClientRect());
      if (!cur) return null;
    }
    n = n.parentElement;
  }
  cur = intersect(
    cur,
    new DOMRect(0, 0, window.innerWidth, window.innerHeight),
  );
  if (!cur) return null;

  const chrome = document.querySelector(".chrome");
  if (chrome instanceof HTMLElement && !chrome.contains(host)) {
    const cr = chrome.getBoundingClientRect();
    cur = intersect(
      cur,
      new DOMRect(0, cr.bottom, window.innerWidth, window.innerHeight - cr.bottom),
    );
    if (!cur) return null;
  }

  const inspector = document.querySelector(".dev-inspector");
  if (
    inspector instanceof HTMLElement &&
    !inspector.contains(host) &&
    getComputedStyle(inspector).position === "fixed"
  ) {
    const ir = inspector.getBoundingClientRect();
    if (ir.height > 8) {
      cur = intersect(cur, new DOMRect(0, 0, window.innerWidth, ir.top));
      if (!cur) return null;
    }
  }

  const hist = document.querySelector(".hist-layer");
  if (
    hist instanceof HTMLElement &&
    !hist.contains(host) &&
    !isRoot(host)
  ) {
    return null;
  }

  return cur;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function makeAxis(axis: Axis): AxisEls {
  const root = el("div", `mill-bar mill-bar-${axis}`);
  const dec = el("button", "mill-bar-arrow mill-bar-dec");
  const inc = el("button", "mill-bar-arrow mill-bar-inc");
  const track = el("div", "mill-bar-track");
  const thumb = el("div", "mill-bar-thumb");
  dec.type = "button";
  inc.type = "button";
  dec.tabIndex = -1;
  inc.tabIndex = -1;
  track.append(thumb);
  root.append(dec, track, inc);
  return {
    root,
    dec,
    inc,
    track,
    thumb,
    hover: false,
    holdTimer: null,
    fadeTimer: null,
  };
}

function stepSize(host: HTMLElement, axis: Axis): number {
  const view = axis === "y" ? host.clientHeight : host.clientWidth;
  return Math.max(STEP_MIN, Math.round(view * 0.12));
}

function pageSize(host: HTMLElement, axis: Axis): number {
  const view = axis === "y" ? host.clientHeight : host.clientWidth;
  return Math.max(stepSize(host, axis), view - 24);
}

function applyScroll(host: HTMLElement, axis: Axis, delta: number): void {
  if (axis === "y") host.scrollTop += delta;
  else host.scrollLeft += delta;
}

export function startMillScrollbars(layer: HTMLElement): () => void {
  const hosts = new Map<HTMLElement, HostCtl>();
  let dragging: HostCtl | null = null;
  let armed: HostCtl | null = null;
  let scanTok = 0;
  let layoutTok = 0;
  let lastPtrX = Number.NaN;
  let lastPtrY = Number.NaN;

  function requestScan(): void {
    if (scanTok) return;
    scanTok = window.requestAnimationFrame(() => {
      scanTok = 0;
      scan();
    });
  }

  function requestLayout(): void {
    if (layoutTok) return;
    layoutTok = window.requestAnimationFrame(() => {
      layoutTok = 0;
      for (const ctl of hosts.values()) layout(ctl);
    });
  }

  function clearPress(ctl: HostCtl): void {
    if (ctl.pressTimer != null) {
      window.clearTimeout(ctl.pressTimer);
      ctl.pressTimer = null;
    }
    if (ctl.pressRepeat != null) {
      window.clearInterval(ctl.pressRepeat);
      ctl.pressRepeat = null;
    }
  }

  function clearHide(bar: AxisEls): void {
    if (bar.holdTimer != null) {
      window.clearTimeout(bar.holdTimer);
      bar.holdTimer = null;
    }
    if (bar.fadeTimer != null) {
      window.clearTimeout(bar.fadeTimer);
      bar.fadeTimer = null;
    }
  }

  function pointInStripRect(bar: AxisEls, x: number, y: number): boolean {
    if (!barIsShown(bar)) return false;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const r = bar.root.getBoundingClientRect();
    return x >= r.left && x < r.right && y >= r.top && y < r.bottom;
  }

  // Stay host is the 14px box, not elementFromPoint (can lag) and not bar.hover.
  function pointerOnStrip(
    bar: AxisEls,
    x: number = lastPtrX,
    y: number = lastPtrY,
  ): boolean {
    return pointInStripRect(bar, x, y);
  }

  function axisHeld(ctl: HostCtl, axis: Axis): boolean {
    return ctl.dragging?.axis === axis || ctl.pressAxis === axis;
  }

  function hideArmed(bar: AxisEls): boolean {
    return bar.holdTimer != null || bar.fadeTimer != null;
  }

  function barLit(bar: AxisEls): boolean {
    return (
      bar.root.classList.contains("is-on") ||
      bar.root.classList.contains("is-fade")
    );
  }

  function eventOnStrip(
    bar: AxisEls,
    target: EventTarget | null,
    x: number,
    y: number,
  ): boolean {
    return nodeOnBar(bar, target) && pointInStripRect(bar, x, y);
  }

  // 3ade3c2 failed here: leaveStrip no-op'd when hover was already false, and
  // scheduleHide aborted while lastPtr still sat on the gutter. A trusted pane
  // click then left is-on with no hold/fade. Unpin looks at is-on, not hover.
  function unpinAxis(
    ctl: HostCtl,
    axis: Axis,
    opts?: { force?: boolean },
  ): void {
    const bar = ctl[axis];
    bar.hover = false;
    if (axisHeld(ctl, axis)) return;
    if (!opts?.force && pointerOnStrip(bar)) return;
    if (hideArmed(bar)) return;
    if (!barLit(bar)) return;
    scheduleHide(ctl, axis, { force: true });
  }

  function reconcileFromPoint(
    x: number,
    y: number,
    target: EventTarget | null,
    opts?: { forceOff?: boolean },
  ): void {
    lastPtrX = x;
    lastPtrY = y;
    for (const ctl of hosts.values()) {
      for (const axis of ["y", "x"] as const) {
        const bar = ctl[axis];
        const inside = opts?.forceOff
          ? eventOnStrip(bar, target, x, y)
          : pointerOnStrip(bar, x, y);
        if (inside) {
          bar.hover = true;
          reveal(ctl, axis);
        } else {
          unpinAxis(ctl, axis, { force: opts?.forceOff });
        }
      }
    }
  }

  function reconcileFromTarget(target: EventTarget | null): void {
    for (const ctl of hosts.values()) {
      for (const axis of ["y", "x"] as const) {
        if (nodeOnBar(ctl[axis], target)) {
          ctl[axis].hover = true;
          reveal(ctl, axis);
        } else {
          unpinAxis(ctl, axis, { force: true });
        }
      }
    }
  }

  function setBar(bar: AxisEls, on: boolean, fade: boolean): void {
    bar.root.classList.toggle("is-on", on);
    bar.root.classList.toggle("is-fade", fade);
  }

  function reveal(ctl: HostCtl, axis: Axis): void {
    const bar = ctl[axis];
    clearHide(bar);
    setBar(bar, true, false);
  }

  function stillOnStrip(ctl: HostCtl, axis: Axis): boolean {
    return ctl[axis].hover && pointerOnStrip(ctl[axis]);
  }

  function startFade(ctl: HostCtl, axis: Axis): void {
    if (axisHeld(ctl, axis)) return;
    // Hover is the live pin. Do not let a gutter lastPtr abort fade after a
    // pane click (that was 3ade3c2's leftover stick).
    if (stillOnStrip(ctl, axis)) {
      reveal(ctl, axis);
      return;
    }
    const bar = ctl[axis];
    setBar(bar, false, true);
    bar.fadeTimer = window.setTimeout(() => {
      bar.fadeTimer = null;
      if (axisHeld(ctl, axis)) return;
      if (stillOnStrip(ctl, axis)) {
        reveal(ctl, axis);
        return;
      }
      setBar(bar, false, false);
    }, FADE_MS);
  }

  function scheduleHide(
    ctl: HostCtl,
    axis: Axis,
    opts?: { force?: boolean },
  ): void {
    if (axisHeld(ctl, axis)) return;
    if (!opts?.force && pointerOnStrip(ctl[axis])) return;
    const bar = ctl[axis];
    clearHide(bar);
    bar.holdTimer = window.setTimeout(() => {
      bar.holdTimer = null;
      startFade(ctl, axis);
    }, HOLD_MS);
  }

  function flashFromScroll(ctl: HostCtl): void {
    for (const axis of ["y", "x"] as const) {
      if (!barIsShown(ctl[axis])) continue;
      reveal(ctl, axis);
      if (axisHeld(ctl, axis) || stillOnStrip(ctl, axis)) continue;
      scheduleHide(ctl, axis, { force: true });
    }
  }

  function layout(ctl: HostCtl): void {
    const host = ctl.host;
    const yNeed = canOverflow(host, "y");
    const xNeed = canOverflow(host, "x");
    const r = yNeed || xNeed ? clipHostRect(host) : null;
    if (!r) {
      ctl.y.root.style.display = "none";
      ctl.x.root.style.display = "none";
      return;
    }

    const yH = xNeed ? r.height - BAR : r.height;
    const xW = yNeed ? r.width - BAR : r.width;

    if (yNeed && yH >= BAR * 2) {
      ctl.y.root.style.width = `${BAR}px`;
      ctl.y.root.style.top = `${r.top}px`;
      ctl.y.root.style.left = `${r.right - BAR}px`;
      ctl.y.root.style.height = `${yH}px`;
      ctl.y.root.style.display = "flex";
      const trackH = ctl.y.track.clientHeight;
      const max = host.scrollHeight - host.clientHeight;
      const thumbH = Math.min(
        trackH,
        Math.max(MIN_THUMB, (host.clientHeight / host.scrollHeight) * trackH),
      );
      const range = Math.max(0, trackH - thumbH);
      const top = max <= 0 || range <= 0 ? 0 : (host.scrollTop / max) * range;
      ctl.y.thumb.style.height = `${thumbH}px`;
      ctl.y.thumb.style.transform = `translateY(${top}px)`;
    } else {
      ctl.y.root.style.display = "none";
    }

    if (xNeed && xW >= BAR * 2) {
      ctl.x.root.style.height = `${BAR}px`;
      ctl.x.root.style.left = `${r.left}px`;
      ctl.x.root.style.top = `${r.bottom - BAR}px`;
      ctl.x.root.style.width = `${xW}px`;
      ctl.x.root.style.display = "flex";
      const trackW = ctl.x.track.clientWidth;
      const max = host.scrollWidth - host.clientWidth;
      const thumbW = Math.min(
        trackW,
        Math.max(MIN_THUMB, (host.clientWidth / host.scrollWidth) * trackW),
      );
      const range = Math.max(0, trackW - thumbW);
      const left = max <= 0 || range <= 0 ? 0 : (host.scrollLeft / max) * range;
      ctl.x.thumb.style.width = `${thumbW}px`;
      ctl.x.thumb.style.transform = `translateX(${left}px)`;
    } else {
      ctl.x.root.style.display = "none";
    }
  }

  function beginPress(ctl: HostCtl, axis: Axis, fn: () => void): void {
    clearPress(ctl);
    ctl.pressAxis = axis;
    armed = ctl;
    fn();
    reveal(ctl, axis);
    ctl.pressTimer = window.setTimeout(() => {
      ctl.pressTimer = null;
      ctl.pressRepeat = window.setInterval(fn, REPEAT_EVERY);
    }, REPEAT_DELAY);
  }

  function bindAxis(ctl: HostCtl, axis: Axis, els: AxisEls): void {
    const host = ctl.host;
    const onBarEnter = (e: PointerEvent): void => {
      lastPtrX = e.clientX;
      lastPtrY = e.clientY;
      els.hover = true;
      reveal(ctl, axis);
    };
    const onBarLeave = (e: PointerEvent): void => {
      if (stillInsideBar(els.root, e.relatedTarget)) return;
      lastPtrX = e.clientX;
      lastPtrY = e.clientY;
      // Leave is proof the pointer is off this strip, even if clientX/Y sits
      // on the boundary or lastPtr still points at the gutter.
      unpinAxis(ctl, axis, { force: true });
    };
    // Stay host is this 14px strip only — never the overflow pane / Inspector body.
    els.root.addEventListener("pointerenter", onBarEnter);
    els.root.addEventListener("pointerleave", onBarLeave);
    els.root.addEventListener(
      "wheel",
      (e) => {
        lastPtrX = e.clientX;
        lastPtrY = e.clientY;
        els.hover = true;
        e.preventDefault();
        host.scrollTop += e.deltaY;
        host.scrollLeft += e.deltaX;
        reveal(ctl, axis);
      },
      { passive: false },
    );
    els.root.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    const nudge = (dir: 1 | -1): void => {
      applyScroll(host, axis, dir * stepSize(host, axis));
      layout(ctl);
    };

    els.dec.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      els.dec.setPointerCapture(e.pointerId);
      beginPress(ctl, axis, () => nudge(-1));
    });
    els.inc.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      els.inc.setPointerCapture(e.pointerId);
      beginPress(ctl, axis, () => nudge(1));
    });

    const pageToward = (client: number): void => {
      const box = els.thumb.getBoundingClientRect();
      const before = axis === "y" ? client < box.top : client < box.left;
      const after = axis === "y" ? client > box.bottom : client > box.right;
      if (!before && !after) return;
      applyScroll(host, axis, (before ? -1 : 1) * pageSize(host, axis));
      layout(ctl);
    };

    els.track.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).closest(".mill-bar-thumb")) return;
      e.preventDefault();
      e.stopPropagation();
      els.track.setPointerCapture(e.pointerId);
      const point = axis === "y" ? e.clientY : e.clientX;
      beginPress(ctl, axis, () => pageToward(point));
    });

    els.thumb.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      els.thumb.setPointerCapture(e.pointerId);
      const trackBox = els.track.getBoundingClientRect();
      const thumbBox = els.thumb.getBoundingClientRect();
      const range =
        axis === "y"
          ? Math.max(0, trackBox.height - thumbBox.height)
          : Math.max(0, trackBox.width - thumbBox.width);
      const maxScroll =
        axis === "y"
          ? host.scrollHeight - host.clientHeight
          : host.scrollWidth - host.clientWidth;
      ctl.dragging = {
        axis,
        startPointer: axis === "y" ? e.clientY : e.clientX,
        startScroll: axis === "y" ? host.scrollTop : host.scrollLeft,
        range,
        maxScroll,
      };
      dragging = ctl;
      armed = ctl;
      reveal(ctl, axis);
    });
  }

  function attach(host: HTMLElement): HostCtl {
    const ctl: HostCtl = {
      host,
      y: makeAxis("y"),
      x: makeAxis("x"),
      dragging: null,
      pressAxis: null,
      pressTimer: null,
      pressRepeat: null,
      ro: new ResizeObserver(() => layout(ctl)),
      off: () => {},
    };
    layer.append(ctl.y.root, ctl.x.root);
    bindAxis(ctl, "y", ctl.y);
    bindAxis(ctl, "x", ctl.x);

    const onScroll = (): void => {
      layout(ctl);
      flashFromScroll(ctl);
    };

    host.addEventListener("scroll", onScroll, { passive: true });
    ctl.ro.observe(host);
    ctl.off = () => {
      host.removeEventListener("scroll", onScroll);
    };
    layout(ctl);
    return ctl;
  }

  function detach(ctl: HostCtl): void {
    clearHide(ctl.y);
    clearHide(ctl.x);
    clearPress(ctl);
    ctl.ro.disconnect();
    ctl.off();
    ctl.y.root.remove();
    ctl.x.root.remove();
    hosts.delete(ctl.host);
  }

  function scan(): void {
    const found = new Set<HTMLElement>();
    found.add(document.documentElement);
    const walk = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
    );
    let node = walk.nextNode();
    while (node) {
      const elNode = node as HTMLElement;
      if (isPotentialScroller(elNode) && elNode !== document.body) {
        found.add(elNode);
      }
      node = walk.nextNode();
    }
    for (const elNode of found) {
      if (!hosts.has(elNode)) hosts.set(elNode, attach(elNode));
    }
    for (const [elNode, ctl] of hosts) {
      if (!found.has(elNode) || !elNode.isConnected) detach(ctl);
    }
    for (const ctl of hosts.values()) layout(ctl);
  }

  const onWinScroll = (e: Event): void => {
    const t = e.target;
    let ctl: HostCtl | undefined;
    if (t === document || t === document.documentElement) {
      ctl = hosts.get(document.documentElement);
    } else if (t instanceof HTMLElement) {
      ctl = hosts.get(t);
    }
    if (ctl) {
      layout(ctl);
      flashFromScroll(ctl);
    }
    requestLayout();
  };

  const onPointerDownDoc = (e: PointerEvent): void => {
    // Trusted click: e.target is the pane or the 14px strip — not a leftover
    // hover flag, not lastPtr still parked on the gutter.
    reconcileFromPoint(e.clientX, e.clientY, e.target, { forceOff: true });
  };

  const onClickDoc = (e: MouseEvent): void => {
    reconcileFromPoint(e.clientX, e.clientY, e.target, { forceOff: true });
  };

  const onFocusInDoc = (e: FocusEvent): void => {
    reconcileFromTarget(e.target);
  };

  const onPointerMove = (e: PointerEvent): void => {
    reconcileFromPoint(e.clientX, e.clientY, e.target);
    if (!dragging?.dragging) return;
    const d = dragging.dragging;
    const delta =
      (d.axis === "y" ? e.clientY : e.clientX) - d.startPointer;
    const next =
      d.range <= 0 || d.maxScroll <= 0
        ? d.startScroll
        : d.startScroll + (delta / d.range) * d.maxScroll;
    if (d.axis === "y") dragging.host.scrollTop = next;
    else dragging.host.scrollLeft = next;
    layout(dragging);
  };

  const onPointerUp = (e: PointerEvent): void => {
    const ctl = armed ?? dragging;
    lastPtrX = e.clientX;
    lastPtrY = e.clientY;
    if (!ctl) {
      reconcileFromPoint(e.clientX, e.clientY, e.target, { forceOff: true });
      return;
    }
    const axis = ctl.dragging?.axis ?? ctl.pressAxis;
    clearPress(ctl);
    ctl.pressAxis = null;
    ctl.dragging = null;
    armed = null;
    dragging = null;
    if (!axis) return;
    const bar = ctl[axis];
    bar.hover = pointerOnStrip(bar);
    if (bar.hover) reveal(ctl, axis);
    else unpinAxis(ctl, axis, { force: true });
  };

  const mo = new MutationObserver(() => requestScan());
  mo.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "hidden", "open"],
  });

  window.addEventListener("scroll", onWinScroll, true);
  window.addEventListener("resize", requestLayout);
  window.addEventListener("pointerdown", onPointerDownDoc, true);
  window.addEventListener("click", onClickDoc, true);
  window.addEventListener("focusin", onFocusInDoc, true);
  window.addEventListener("pointermove", onPointerMove, true);
  window.addEventListener("pointerup", onPointerUp, true);
  window.addEventListener("pointercancel", onPointerUp, true);
  window.addEventListener("lostpointercapture", onPointerUp);
  window.visualViewport?.addEventListener("resize", requestLayout);
  window.visualViewport?.addEventListener("scroll", requestLayout);

  scan();

  return () => {
    mo.disconnect();
    window.removeEventListener("scroll", onWinScroll, true);
    window.removeEventListener("resize", requestLayout);
    window.removeEventListener("pointerdown", onPointerDownDoc, true);
    window.removeEventListener("click", onClickDoc, true);
    window.removeEventListener("focusin", onFocusInDoc, true);
    window.removeEventListener("pointermove", onPointerMove, true);
    window.removeEventListener("pointerup", onPointerUp, true);
    window.removeEventListener("pointercancel", onPointerUp, true);
    window.removeEventListener("lostpointercapture", onPointerUp);
    window.visualViewport?.removeEventListener("resize", requestLayout);
    window.visualViewport?.removeEventListener("scroll", requestLayout);
    if (scanTok) window.cancelAnimationFrame(scanTok);
    if (layoutTok) window.cancelAnimationFrame(layoutTok);
    for (const ctl of [...hosts.values()]) detach(ctl);
  };
}
