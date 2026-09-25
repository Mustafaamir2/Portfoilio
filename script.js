/* =====================================================================
   NOVA WEAVER — interaction layer
   Responsive-aware. Auto-detects desktop / tablet / mobile and adjusts.
   ===================================================================== */
(function () {
  "use strict";

  var doc = document;
  var body = doc.body;

  /* ------------------------------------------------------------------
     Breakpoint queries (kept in sync with CSS)
     ------------------------------------------------------------------ */
  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var coarseQuery = window.matchMedia("(pointer: coarse)");
  var tabletQuery = window.matchMedia("(max-width: 1024px)");
  var mobileQuery = window.matchMedia("(max-width: 860px)");
  var smallQuery  = window.matchMedia("(max-width: 640px)");

  var state = {
    reduced: motionQuery.matches,
    coarse: coarseQuery.matches,
    tablet: tabletQuery.matches,
    mobile: mobileQuery.matches,
    small: smallQuery.matches,
    pointer: { x: 0.5, y: 0.5 },
    pointerPx: { x: 0, y: 0 },
    scrollY: window.scrollY || 0
  };

  function onQueryChange(query, handler) {
    if (typeof query.addEventListener === "function") query.addEventListener("change", handler);
    else if (typeof query.addListener === "function") query.addListener(handler);
  }

  onQueryChange(motionQuery, function (e) { state.reduced = e.matches; });
  onQueryChange(coarseQuery, function (e) { state.coarse = e.matches; });
  onQueryChange(tabletQuery, function (e) { state.tablet = e.matches; });
  onQueryChange(mobileQuery, function (e) {
    state.mobile = e.matches;
    if (e.matches) closeMenu();
  });
  onQueryChange(smallQuery, function (e) { state.small = e.matches; });

  /* ------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------ */
  function $(s, scope) { return (scope || doc).querySelector(s); }
  function $$(s, scope) {
    return Array.prototype.slice.call((scope || doc).querySelectorAll(s));
  }
  function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function throttleFrame(fn) {
    var queued = false, lastArgs;
    return function () {
      lastArgs = arguments;
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; fn.apply(null, lastArgs); });
    };
  }

  function prefersStillness() { return state.reduced; }

  /* ------------------------------------------------------------------
     Shared animation loop
     ------------------------------------------------------------------ */
  var tickers = [];
  var looping = false;

  function addTicker(fn) {
    tickers.push(fn);
    startLoop();
    return function remove() {
      var i = tickers.indexOf(fn);
      if (i > -1) tickers.splice(i, 1);
    };
  }

  function startLoop() {
    if (looping) return;
    looping = true;
    requestAnimationFrame(frame);
  }

  var lastTime = 0;
  function frame(now) {
    var delta = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
    lastTime = now;
    for (var i = 0; i < tickers.length; i++) tickers[i](delta, now / 1000);
    if (tickers.length) requestAnimationFrame(frame);
    else looping = false;
  }

  doc.addEventListener("visibilitychange", function () {
    if (!doc.hidden) { lastTime = 0; startLoop(); }
  });

  window.addEventListener("pointermove", function (e) {
    state.pointerPx.x = e.clientX;
    state.pointerPx.y = e.clientY;
    state.pointer.x = e.clientX / window.innerWidth;
    state.pointer.y = e.clientY / window.innerHeight;
  }, { passive: true });

  window.addEventListener("scroll", throttleFrame(function () {
    state.scrollY = window.scrollY;
  }), { passive: true });

  /* ------------------------------------------------------------------
     Mobile menu — open / close state
     ------------------------------------------------------------------ */
  var mobileMenuEl = $("#mobile-menu");
  var menuToggleEl = $("#menu-toggle");
  var mobileLinks  = $$("[data-mobile-link]");
  var lastFocusedBeforeMenu = null;

  function openMenu() {
    if (!state.mobile) return;
    lastFocusedBeforeMenu = doc.activeElement;
    body.classList.add("menu-open");
    body.classList.add("no-scroll");
    if (mobileMenuEl) mobileMenuEl.setAttribute("aria-hidden", "false");
    if (menuToggleEl) {
      menuToggleEl.setAttribute("aria-expanded", "true");
      menuToggleEl.setAttribute("aria-label", "Close menu");
    }
    window.setTimeout(function () {
      if (mobileLinks[0]) mobileLinks[0].focus({ preventScroll: true });
    }, 120);
  }

  function closeMenu() {
    if (!body.classList.contains("menu-open")) return;
    body.classList.remove("menu-open");
    body.classList.remove("no-scroll");
    if (mobileMenuEl) mobileMenuEl.setAttribute("aria-hidden", "true");
    if (menuToggleEl) {
      menuToggleEl.setAttribute("aria-expanded", "false");
      menuToggleEl.setAttribute("aria-label", "Open menu");
    }
    if (lastFocusedBeforeMenu && lastFocusedBeforeMenu.focus) {
      lastFocusedBeforeMenu.focus({ preventScroll: true });
      lastFocusedBeforeMenu = null;
    }
  }

  function toggleMenu() {
    if (body.classList.contains("menu-open")) closeMenu();
    else openMenu();
  }

  if (menuToggleEl) {
    menuToggleEl.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu();
    });
  }

  mobileLinks.forEach(function (link) {
    link.addEventListener("click", function (e) {
      var id = link.getAttribute("href");
      if (!id || id === "#") { closeMenu(); return; }
      var target = doc.querySelector(id);
      if (!target) { closeMenu(); return; }

      e.preventDefault();
      closeMenu();

      window.setTimeout(function () {
        target.scrollIntoView({
          behavior: prefersStillness() ? "auto" : "smooth",
          block: "start"
        });
        target.setAttribute("tabindex", "-1");
        window.setTimeout(function () {
          target.focus({ preventScroll: true });
        }, 520);
      }, 180);
    });
  });

  if (mobileMenuEl) {
    mobileMenuEl.addEventListener("click", function (e) {
      if (e.target === mobileMenuEl) closeMenu();
    });
  }

  doc.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && body.classList.contains("menu-open")) {
      closeMenu();
      if (menuToggleEl) menuToggleEl.focus({ preventScroll: true });
    }
  });

  window.addEventListener("resize", throttleFrame(function () {
    if (!state.mobile && body.classList.contains("menu-open")) closeMenu();
  }));

  /* ------------------------------------------------------------------
     Intro curtain
     ------------------------------------------------------------------ */
  (function curtain() {
    var el = $("#curtain");
    if (!el) return;
    var bar = $(".curtain-bar i", el);
    var progress = 0, done = false;

    function step() {
      if (done) return;
      progress = Math.min(progress + (0.06 + Math.random() * 0.1), 0.92);
      if (bar) bar.style.width = (progress * 100).toFixed(1) + "%";
      setTimeout(step, 130);
    }
    step();

    function finish() {
      if (done) return;
      done = true;
      if (bar) bar.style.width = "100%";
      window.setTimeout(function () {
        el.classList.add("is-done");
        body.classList.remove("is-loading");
        body.classList.add("is-ready");
        window.setTimeout(revealInView, 60);
      }, prefersStillness() ? 0 : 320);
    }

    if (doc.readyState === "complete") window.setTimeout(finish, 260);
    else window.addEventListener("load", function () { window.setTimeout(finish, 260); });
    window.setTimeout(finish, 4200);
  })();

  /* ------------------------------------------------------------------
     Cursor (desktop only)
     ------------------------------------------------------------------ */
  (function cursor() {
    var el = $(".cursor");
    if (!el || state.coarse || state.mobile || prefersStillness()) {
      if (el) el.remove();
      return;
    }

    /* Flag the body so CSS can hide the native arrow while this custom
       cursor (futuristic AI hand + glow halo) is the one on screen. */
    body.classList.add("has-custom-cursor");

    var dot  = $(".cursor-dot", el);
    var halo = $(".cursor-halo", el);
    var hand = $(".cursor-hand", el);

    var pos  = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    var slow = { x: pos.x, y: pos.y };
    var live = false;

    window.addEventListener("pointermove", function (e) {
      pos.x = e.clientX;
      pos.y = e.clientY;
      if (!live) { live = true; el.classList.add("is-live"); }
    }, { passive: true });

    doc.addEventListener("pointerleave", function () {
      live = false;
      el.classList.remove("is-live");
    });

    var hoverSel = 'a, button, [data-magnetic], .skill, .project-card, input, textarea';
    doc.addEventListener("pointerover", function (e) {
      if (e.target.closest && e.target.closest(hoverSel)) el.classList.add("is-hover");
    });
    doc.addEventListener("pointerout", function (e) {
      if (e.target.closest && e.target.closest(hoverSel)) el.classList.remove("is-hover");
    });

    addTicker(function () {
      slow.x = lerp(slow.x, pos.x, 0.12);
      slow.y = lerp(slow.y, pos.y, 0.12);

      /* The glow halo trails the pointer smoothly (unchanged behaviour). */
      if (halo) halo.style.transform =
        "translate3d(" + slow.x + "px," + slow.y + "px,0) translate(-50%,-50%)";

      /* The AI hand tracks the pointer exactly — its CSS offset aligns
         the index fingertip with the real pointer position. */
      if (hand) hand.style.transform =
        "translate3d(" + pos.x + "px," + pos.y + "px,0)";

      /* The legacy dot is hidden via CSS but we keep its transform in
         case it is re-enabled later. */
      if (dot) dot.style.transform =
        "translate3d(" + pos.x + "px," + pos.y + "px,0) translate(-50%,-50%)";
    });
  })();

  /* ------------------------------------------------------------------
     Magnetic buttons (desktop only)
     ------------------------------------------------------------------ */
  (function magnetic() {
    if (state.coarse || state.mobile || prefersStillness()) return;

    $$("[data-magnetic]").forEach(function (el) {
      var target = { x: 0, y: 0 }, current = { x: 0, y: 0 }, stop = null;
      var strength = parseFloat(el.getAttribute("data-magnetic")) || 0.32;

      function run() {
        if (stop) return;
        stop = addTicker(function () {
          current.x = lerp(current.x, target.x, 0.18);
          current.y = lerp(current.y, target.y, 0.18);
          el.style.transform = "translate3d(" + current.x.toFixed(2) + "px," + current.y.toFixed(2) + "px,0)";
          if (!target.x && !target.y && Math.abs(current.x) < 0.05 && Math.abs(current.y) < 0.05) {
            el.style.transform = "";
            if (stop) { stop(); stop = null; }
          }
        });
      }

      el.addEventListener("pointerenter", run);
      el.addEventListener("pointermove", function (e) {
        var box = el.getBoundingClientRect();
        target.x = (e.clientX - (box.left + box.width / 2)) * strength;
        target.y = (e.clientY - (box.top + box.height / 2)) * strength;
        run();
      });
      el.addEventListener("pointerleave", function () { target.x = 0; target.y = 0; });
    });
  })();

  /* ------------------------------------------------------------------
     Tilt (desktop only)
     ------------------------------------------------------------------ */
  (function tilt() {
    if (state.coarse || state.tablet || prefersStillness()) return;

    $$("[data-tilt]").forEach(function (el) {
      var max = parseFloat(el.getAttribute("data-tilt-strength")) || 10;
      var target = { x: 0, y: 0 }, current = { x: 0, y: 0 }, stop = null;

      function run() {
        if (stop) return;
        stop = addTicker(function () {
          current.x = lerp(current.x, target.x, 0.12);
          current.y = lerp(current.y, target.y, 0.12);
          el.style.setProperty("--rx", current.x.toFixed(2) + "deg");
          el.style.setProperty("--ry", current.y.toFixed(2) + "deg");
          if (!target.x && !target.y && Math.abs(current.x) < 0.02 && Math.abs(current.y) < 0.02) {
            el.style.setProperty("--rx", "0deg");
            el.style.setProperty("--ry", "0deg");
            if (stop) { stop(); stop = null; }
          }
        });
      }

      function move(e) {
        var box = el.getBoundingClientRect();
        var px = (e.clientX - box.left) / box.width - 0.5;
        var py = (e.clientY - box.top) / box.height - 0.5;
        target.x = clamp(-py * max * 2, -max, max);
        target.y = clamp(px * max * 2, -max, max);
        run();
      }

      el.addEventListener("pointerenter", move);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", function () { target.x = 0; target.y = 0; });
    });
  })();

  /* ------------------------------------------------------------------
     Reveal & split text
     ------------------------------------------------------------------ */
  function splitHeading(el) {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = "true";

    var index = 0, pieces = [];

    function wrap(node) {
      var span = doc.createElement("span");
      span.className = "word";
      span.style.setProperty("--wd", (index * 0.055).toFixed(3) + "s");
      index++;
      span.appendChild(node);
      return span;
    }

    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          pieces.push({ space: /^\s+$/.test(part), text: part, node: null });
        });
      } else if (node.nodeName === "BR") {
        pieces.push({ br: true, node: node.cloneNode() });
      } else {
        pieces.push({ space: false, node: node.cloneNode(true) });
      }
    });

    while (pieces.length && pieces[0].space) pieces.shift();
    while (pieces.length && pieces[pieces.length - 1].space) pieces.pop();

    var fragment = doc.createDocumentFragment();
    pieces.forEach(function (piece, i) {
      if (piece.br) { fragment.appendChild(piece.node); return; }
      if (piece.space) {
        if (pieces[i - 1] && pieces[i - 1].br) return;
        if (pieces[i + 1] && pieces[i + 1].br) return;
        fragment.appendChild(doc.createTextNode(" "));
        return;
      }
      fragment.appendChild(wrap(piece.node || doc.createTextNode(piece.text)));
    });

    el.innerHTML = "";
    el.appendChild(fragment);
  }

  var revealTargets = $$("[data-reveal], [data-split]");
  revealTargets.forEach(function (el) {
    if (el.hasAttribute("data-split")) splitHeading(el);
    var delay = parseFloat(el.getAttribute("data-delay"));
    if (delay) el.style.setProperty("--delay", delay + "s");
  });

  function show(el) { el.classList.add("is-visible"); }

  var revealObserver = null;
  if ("IntersectionObserver" in window) {
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        show(entry.target);
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.12 });
    revealTargets.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealTargets.forEach(show);
  }

  function revealInView() {
    revealTargets.forEach(function (el) {
      if (el.classList.contains("is-visible")) return;
      var box = el.getBoundingClientRect();
      if (box.top < window.innerHeight * 0.92 && box.bottom > 0) {
        show(el);
        if (revealObserver) revealObserver.unobserve(el);
      }
    });
  }

  /* ------------------------------------------------------------------
     Profile card flip
     ------------------------------------------------------------------ */
  (function profileCard() {
    var card = $("#profile-card");
    if (!card) return;

    function setFlipped(f) {
      card.classList.toggle("is-flipped", f);
      card.setAttribute("aria-pressed", f ? "true" : "false");
    }

    card.addEventListener("click", function () {
      setFlipped(!card.classList.contains("is-flipped"));
    });
    card.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
      e.preventDefault();
      setFlipped(!card.classList.contains("is-flipped"));
    });
  })();

  /* ------------------------------------------------------------------
     Desktop navigation — Dynamic Island behaviour
     ------------------------------------------------------------------ */
  (function navigation() {
    var shell = $("#nav");
    var list = $("#nav-list");
    var links = $$(".nav-link");
    var indicator = $(".nav-indicator");
    if (!shell || !list) return;

    var SCROLL_TRIGGER = 60;
    var RE_OPEN_AT     = 30;

    function moveIndicator(link) {
      if (!indicator || state.mobile || !link) return;
      indicator.style.width = link.offsetWidth + "px";
      indicator.style.transform = "translateX(" + link.parentElement.offsetLeft + "px)";
      indicator.style.opacity = "1";
    }
    function activeLink() {
      return links.filter(function (l) { return l.classList.contains("is-active"); })[0];
    }
    links.forEach(function (link) {
      link.addEventListener("pointerenter", function () { moveIndicator(link); });
    });
    list.addEventListener("pointerleave", function () { moveIndicator(activeLink()); });

    var sections = links
      .map(function (l) { return doc.getElementById(l.getAttribute("data-nav")); })
      .filter(Boolean);

    function setActive(id) {
      links.forEach(function (l) {
        l.classList.toggle("is-active", l.getAttribute("data-nav") === id);
      });
      moveIndicator(activeLink());
    }

    if ("IntersectionObserver" in window && sections.length) {
      var visible = {};
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          visible[entry.target.id] = entry.isIntersecting ? entry.intersectionRatio : 0;
        });
        var best = null, bestRatio = 0;
        Object.keys(visible).forEach(function (id) {
          if (visible[id] > bestRatio) { bestRatio = visible[id]; best = id; }
        });
        if (best) setActive(best);
      }, { threshold: [0.12, 0.3, 0.6], rootMargin: "-20% 0px -35% 0px" });
      sections.forEach(function (s) { obs.observe(s); });
    }

    function isDesktop() { return !state.mobile; }

    function expandIsland() {
      shell.classList.remove("is-collapsed");
      window.setTimeout(function () { moveIndicator(activeLink()); }, 220);
    }
    function collapseIsland() { shell.classList.add("is-collapsed"); }

    window.addEventListener("scroll", throttleFrame(function () {
      if (!isDesktop()) return;
      var y = window.scrollY;
      if (y <= RE_OPEN_AT) expandIsland();
      else if (y > SCROLL_TRIGGER) {
        if (!shell.matches(":hover") && !shell.contains(doc.activeElement)) collapseIsland();
      }
    }), { passive: true });

    if (isDesktop()) {
      shell.addEventListener("pointerenter", function () {
        if (window.scrollY > RE_OPEN_AT) expandIsland();
      });
      shell.addEventListener("pointerleave", function () {
        if (window.scrollY > SCROLL_TRIGGER) collapseIsland();
      });
      shell.addEventListener("focusin", function () {
        if (window.scrollY > RE_OPEN_AT) expandIsland();
      });
      shell.addEventListener("focusout", function (e) {
        if (shell.contains(e.relatedTarget)) return;
        if (window.scrollY > SCROLL_TRIGGER) collapseIsland();
      });
    }

    window.addEventListener("resize", throttleFrame(function () {
      if (state.mobile) {
        shell.classList.remove("is-collapsed");
      } else if (window.scrollY > SCROLL_TRIGGER) {
        collapseIsland();
      } else {
        expandIsland();
      }
    }));

    window.setTimeout(function () { moveIndicator(activeLink()); }, 700);

    $$('a[href^="#"]').forEach(function (link) {
      if (link.hasAttribute("data-mobile-link")) return;
      link.addEventListener("click", function (e) {
        var id = link.getAttribute("href");
        if (!id || id === "#") return;
        var target = doc.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({
          behavior: prefersStillness() ? "auto" : "smooth",
          block: "start"
        });
        target.setAttribute("tabindex", "-1");
        window.setTimeout(function () { target.focus({ preventScroll: true }); }, 520);
      });
    });

    var toTop = $("#to-top");
    if (toTop) {
      toTop.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: prefersStillness() ? "auto" : "smooth" });
      });
    }
  })();

  /* ------------------------------------------------------------------
     Scroll progress & parallax
     ------------------------------------------------------------------ */
  (function scrollFx() {
    var bar = $(".scroll-progress span");
    var parallaxItems = $$("[data-parallax]");

    function update() {
      var max = doc.documentElement.scrollHeight - window.innerHeight;
      var progress = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      if (bar) bar.style.transform = "scaleX(" + progress.toFixed(4) + ")";

      if (!prefersStillness() && !state.mobile) {
        parallaxItems.forEach(function (el) {
          var amount = parseFloat(el.getAttribute("data-parallax")) || 0.05;
          var box = el.getBoundingClientRect();
          var centre = box.top + box.height / 2 - window.innerHeight / 2;
          el.style.transform = "translate3d(0," + (-centre * amount).toFixed(2) + "px,0)";
        });
      }
    }
    window.addEventListener("scroll", throttleFrame(update), { passive: true });
    window.addEventListener("resize", throttleFrame(update));
    update();
  })();

  /* ------------------------------------------------------------------
     Counters
     ------------------------------------------------------------------ */
  (function counters() {
    var items = $$("[data-count]");
    if (!items.length) return;

    function run(el) {
      var target = parseInt(el.getAttribute("data-count"), 10) || 0;
      if (prefersStillness()) { el.textContent = String(target); return; }
      var started = null, duration = 1400;
      var stop = addTicker(function (delta, now) {
        if (started === null) started = now;
        var t = clamp((now - started) * 1000 / duration, 0, 1);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = String(Math.round(target * eased));
        if (t >= 1 && stop) stop();
      });
    }

    if (!("IntersectionObserver" in window)) { items.forEach(run); return; }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        run(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    items.forEach(function (el) { obs.observe(el); });
  })();

  /* ------------------------------------------------------------------
     Work gallery
     ------------------------------------------------------------------ */
  (function gallery() {
    var rail = $("#gallery");
    var track = $("#gallery-track");
    var fill = $("#gallery-rail-fill");
    var prev = $("#work-prev");
    var next = $("#work-next");
    if (!rail || !track) return;

    var cards = $$(".project", track);
    var current = 0;

    function perspective() {
      var railBox = rail.getBoundingClientRect();
      var centre = railBox.left + railBox.width / 2;
      var half = railBox.width / 2;
      var closest = 0, closestDistance = Infinity;

      cards.forEach(function (item, i) {
        var box = item.getBoundingClientRect();
        var itemCentre = box.left + box.width / 2;
        var distance = itemCentre - centre;
        var p = clamp(distance / half, -1, 1);
        var card = item.firstElementChild;
        if (card) card.style.setProperty("--p", p.toFixed(4));
        if (Math.abs(distance) < closestDistance) {
          closestDistance = Math.abs(distance);
          closest = i;
        }
      });

      current = closest;
      var scrollable = rail.scrollWidth - rail.clientWidth;
      if (fill) {
        var ratio = scrollable > 0 ? rail.scrollLeft / scrollable : 0;
        var width = 100 / Math.max(cards.length, 1);
        fill.style.width = width + "%";
        fill.style.transform = "translateX(" + (ratio * (100 - width) / width * 100).toFixed(2) + "%)";
      }
      if (prev) prev.disabled = rail.scrollLeft <= 2;
      if (next) next.disabled = rail.scrollLeft >= scrollable - 2;
    }

    rail.addEventListener("scroll", throttleFrame(perspective), { passive: true });
    window.addEventListener("resize", throttleFrame(perspective));

    function goTo(index) {
      var item = cards[clamp(index, 0, cards.length - 1)];
      if (!item) return;
      var left = item.offsetLeft - (rail.clientWidth - item.offsetWidth) / 2;
      rail.scrollTo({ left: left, behavior: prefersStillness() ? "auto" : "smooth" });
    }

    if (prev) prev.addEventListener("click", function () { goTo(current - 1); });
    if (next) next.addEventListener("click", function () { goTo(current + 1); });

    rail.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(current + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goTo(current - 1); }
      else if (e.key === "Home") { e.preventDefault(); goTo(0); }
      else if (e.key === "End") { e.preventDefault(); goTo(cards.length - 1); }
    });

    var dragging = false, moved = 0, startX = 0, startScroll = 0, pointerId = null;

    rail.addEventListener("pointerdown", function (e) {
      if (state.coarse) return;
      if (e.target.closest("button, a")) return;
      dragging = true; moved = 0; pointerId = e.pointerId;
      startX = e.clientX; startScroll = rail.scrollLeft;
      rail.classList.add("is-dragging");
    });

    rail.addEventListener("pointermove", function (e) {
      if (!dragging || e.pointerId !== pointerId) return;
      var dx = e.clientX - startX;
      moved = Math.abs(dx);
      if (moved > 4 && rail.setPointerCapture) {
        try { rail.setPointerCapture(pointerId); } catch (err) {}
      }
      rail.scrollLeft = startScroll - dx;
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      rail.classList.remove("is-dragging");
      if (pointerId !== null && rail.releasePointerCapture) {
        try { rail.releasePointerCapture(pointerId); } catch (err) {}
      }
      pointerId = null;
      if (moved > 30) goTo(current);
    }

    rail.addEventListener("pointerup", endDrag);
    rail.addEventListener("pointercancel", endDrag);
    rail.addEventListener("click", function (e) {
      if (moved > 8) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    rail.addEventListener("wheel", function (e) {
      if (state.coarse || e.ctrlKey) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      var scrollable = rail.scrollWidth - rail.clientWidth;
      var atStart = rail.scrollLeft <= 1;
      var atEnd = rail.scrollLeft >= scrollable - 1;
      if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return;
      e.preventDefault();
      rail.scrollLeft += e.deltaY;
    }, { passive: false });

    perspective();
    window.setTimeout(perspective, 400);
  })();

  /* ------------------------------------------------------------------
     Case study overlay
     ------------------------------------------------------------------ */
  (function caseStudy() {
    var overlay = $("#case-overlay");
    var panel = $("#case-panel");
    var content = $("#case-content");
    var closeBtn = $("#case-close");
    var heading = $("#case-heading");
    if (!overlay || !panel || !content) return;

    var lastFocus = null;

    function focusables() {
      return $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', panel)
        .filter(function (el) { return el.offsetParent !== null; });
    }

    function open(project) {
      var template = $("template[data-case]", project);
      if (!template) return;
      lastFocus = doc.activeElement;

      while (content.firstChild) content.removeChild(content.firstChild);
      if (heading) {
        var title = $(".project-title", project);
        heading.textContent = title ? title.textContent + " — case study" : "Project case study";
        content.appendChild(heading);
      }
      content.appendChild(template.content.cloneNode(true));

      overlay.hidden = false;
      body.classList.add("no-scroll");
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { overlay.classList.add("is-open"); });
      });
      panel.scrollTop = 0;
      panel.focus({ preventScroll: true });
    }

    function close() {
      if (overlay.hidden) return;
      overlay.classList.remove("is-open");
      body.classList.remove("no-scroll");
      window.setTimeout(function () {
        overlay.hidden = true;
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      }, prefersStillness() ? 0 : 420);
    }

    $$("[data-open]").forEach(function (button) {
      button.addEventListener("click", function () {
        var project = button.closest("[data-project]");
        if (project) open(project);
      });
    });

    if (closeBtn) closeBtn.addEventListener("click", close);
    $$("[data-case-close]", overlay).forEach(function (el) {
      el.addEventListener("click", close);
    });

    doc.addEventListener("keydown", function (e) {
      if (overlay.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      var items = focusables();
      if (!items.length) { e.preventDefault(); panel.focus(); return; }
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (doc.activeElement === first || doc.activeElement === panel)) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && doc.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });
  })();

  /* ------------------------------------------------------------------
     Skills constellation
     ------------------------------------------------------------------ */
  (function constellation() {
    var wrap = $("#constellation");
    var svg = $("#constellation-lines");
    var skills = $$("[data-skill]");
    if (!wrap || !svg || !skills.length) return;

    var lines = [];

    function build() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      lines = [];
      if (state.mobile) return;

      var box = wrap.getBoundingClientRect();
      svg.setAttribute("viewBox", "0 0 " + box.width + " " + box.height);

      var points = skills.map(function (skill) {
        var b = skill.getBoundingClientRect();
        return {
          el: skill,
          x: b.left + b.width / 2 - box.left,
          y: b.top + b.height / 2 - box.top
        };
      });

      var threshold = Math.max(box.width, box.height) * 0.42;
      for (var i = 0; i < points.length; i++) {
        for (var j = i + 1; j < points.length; j++) {
          var dx = points[i].x - points[j].x;
          var dy = points[i].y - points[j].y;
          if (Math.sqrt(dx * dx + dy * dy) > threshold) continue;
          var line = doc.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", points[i].x.toFixed(1));
          line.setAttribute("y1", points[i].y.toFixed(1));
          line.setAttribute("x2", points[j].x.toFixed(1));
          line.setAttribute("y2", points[j].y.toFixed(1));
          svg.appendChild(line);
          lines.push({ node: line, a: points[i].el, b: points[j].el });
        }
      }
    }

    function light(skill, on) {
      lines.forEach(function (line) {
        if (line.a === skill || line.b === skill) line.node.classList.toggle("is-lit", on);
      });
    }

    skills.forEach(function (skill) {
      skill.addEventListener("pointerenter", function () { light(skill, true); });
      skill.addEventListener("pointerleave", function () { light(skill, false); });
      skill.addEventListener("focus", function () {
        skill.classList.add("is-active");
        light(skill, true);
      });
      skill.addEventListener("blur", function () {
        skill.classList.remove("is-active");
        light(skill, false);
      });
      skill.addEventListener("click", function () {
        skills.forEach(function (o) { if (o !== skill) o.classList.remove("is-active"); });
        skill.classList.toggle("is-active");
      });
    });

    build();
    window.addEventListener("resize", throttleFrame(build));
    window.addEventListener("load", build);
  })();

  /* ------------------------------------------------------------------
     Experience timeline
     ------------------------------------------------------------------ */
  (function timeline() {
    var list = $("#timeline");
    var fill = $("#timeline-fill");
    if (!list || !fill) return;
    var items = $$(".tl-item", list);

    function update() {
      var box = list.getBoundingClientRect();
      var start = window.innerHeight * 0.85;
      var progress = clamp((start - box.top) / (box.height + start - window.innerHeight * 0.4), 0, 1);
      fill.style.transform = "scaleY(" + progress.toFixed(4) + ")";

      items.forEach(function (item) {
        var b = item.getBoundingClientRect();
        item.classList.toggle("is-visible", b.top < window.innerHeight * 0.78);
      });
    }

    window.addEventListener("scroll", throttleFrame(update), { passive: true });
    window.addEventListener("resize", throttleFrame(update));
    update();
  })();

  /* ------------------------------------------------------------------
     Testimonial carousel
     ------------------------------------------------------------------ */
  (function carousel() {
    var root = $("#carousel");
    var track = $("#carousel-track");
    var dotsWrap = $("#carousel-dots");
    var prev = $("#quote-prev");
    var next = $("#quote-next");
    if (!root || !track) return;

    var cards = $$("[data-quote]", track);
    if (!cards.length) return;

    var index = 0, timer = null, dots = [];

    cards.forEach(function (card, i) {
      var dot = doc.createElement("button");
      dot.type = "button";
      dot.setAttribute("role", "tab");
      dot.setAttribute("aria-label", "Testimonial " + (i + 1) + " of " + cards.length);
      dot.addEventListener("click", function () { go(i, true); });
      if (dotsWrap) dotsWrap.appendChild(dot);
      dots.push(dot);
    });

    function render() {
      var spread = state.small ? 18 : state.mobile ? 24 : state.tablet ? 34 : 48;
      cards.forEach(function (card, i) {
        var offset = i - index;
        var count = cards.length;
        if (offset > count / 2) offset -= count;
        if (offset < -count / 2) offset += count;

        var abs = Math.abs(offset);
        card.style.setProperty("--tx", (offset * spread) + "%");
        card.style.setProperty("--tz", (-abs * (state.mobile ? 160 : 240)) + "px");
        card.style.setProperty("--ry", (offset * (state.mobile ? -16 : -24)) + "deg");
        card.style.setProperty("--sc", String(1 - abs * 0.1));
        card.style.setProperty("--op", String(abs > 1 ? 0 : 1 - abs * 0.74));
        card.style.zIndex = String(10 - abs);
        card.setAttribute("aria-hidden", offset === 0 ? "false" : "true");
      });
      dots.forEach(function (dot, i) {
        dot.setAttribute("aria-selected", i === index ? "true" : "false");
      });
    }

    function go(next_, manual) {
      index = (next_ + cards.length) % cards.length;
      render();
      if (manual) restart();
    }

    function restart() {
      if (timer) window.clearInterval(timer);
      if (prefersStillness()) return;
      timer = window.setInterval(function () { go(index + 1); }, 6500);
    }

    if (prev) prev.addEventListener("click", function () { go(index - 1, true); });
    if (next) next.addEventListener("click", function () { go(index + 1, true); });

    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1, true); }
      if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1, true); }
    });

    root.addEventListener("pointerenter", function () { if (timer) window.clearInterval(timer); });
    root.addEventListener("pointerleave", restart);

    var startX = null;
    root.addEventListener("pointerdown", function (e) { startX = e.clientX; });
    root.addEventListener("pointerup", function (e) {
      if (startX === null) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 44) go(index + (dx < 0 ? 1 : -1), true);
      startX = null;
    });

    window.addEventListener("resize", throttleFrame(render));
    render();
    restart();
  })();

  /* ------------------------------------------------------------------
     Contact form
     ------------------------------------------------------------------ */
  (function contactForm() {
    var form = $("#contact-form");
    if (!form) return;
    var status = $("#form-status");
    var button = $(".btn-send", form);

    var rules = {
      name: function (v) {
        if (!v.trim()) return "Please tell me your name.";
        if (v.trim().length < 2) return "That looks a little short.";
        return "";
      },
      email: function (v) {
        if (!v.trim()) return "An email address lets me reply.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())) return "Please check the email format.";
        return "";
      },
      details: function (v) {
        if (!v.trim()) return "A sentence or two about the project is plenty.";
        if (v.trim().length < 12) return "A little more detail helps me answer properly.";
        return "";
      }
    };

    function validateField(field) {
      var rule = rules[field.name];
      if (!rule) return true;
      var message = rule(field.value);
      var wrapper = field.closest(".field");
      var error = wrapper ? $(".field-error", wrapper) : null;
      if (wrapper) wrapper.classList.toggle("has-error", !!message);
      if (error) error.textContent = message;
      field.setAttribute("aria-invalid", message ? "true" : "false");
      return !message;
    }

    $$("input, textarea", form).forEach(function (field) {
      field.addEventListener("blur", function () { validateField(field); });
      field.addEventListener("input", function () {
        var wrapper = field.closest(".field");
        if (wrapper && wrapper.classList.contains("has-error")) validateField(field);
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fields = $$("input, textarea", form);
      var valid = true, firstInvalid = null;
      fields.forEach(function (field) {
        var ok = validateField(field);
        if (!ok && !firstInvalid) firstInvalid = field;
        valid = valid && ok;
      });

      if (!valid) {
        if (status) {
          status.classList.remove("is-success");
          status.textContent = "Almost there — a couple of fields need a look.";
        }
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      if (button) {
        button.disabled = true;
        var label = $("span", button);
        if (label) label.textContent = "Sending…";
      }
      if (status) {
        status.classList.remove("is-success");
        status.textContent = "Sending your message…";
      }

      window.setTimeout(function () {
        var data = new FormData(form);
        var subject = encodeURIComponent("New project inquiry from " + (data.get("name") || ""));
        var lines = [
          "Name: " + (data.get("name") || ""),
          "Email: " + (data.get("email") || ""),
          "",
          data.get("details") || ""
        ].join("\n");

        if (status) {
          status.classList.add("is-success");
          status.textContent = "Thank you — your email client is opening with the details ready to send.";
        }
        if (button) {
          button.disabled = false;
          var span = $("span", button);
          if (span) span.textContent = "Send inquiry";
        }
        form.reset();
        window.location.href = "mailto:hello@novaweaver.studio?subject=" + subject + "&body=" + encodeURIComponent(lines);
      }, 700);
    });
  })();

  /* ------------------------------------------------------------------
     WebGL scenes (Three.js)
     ------------------------------------------------------------------ */
  (function webgl() {
    if (typeof window.THREE === "undefined") return;
    var THREE = window.THREE;

    function makeEnvironment(renderer) {
      var canvas = doc.createElement("canvas");
      canvas.width = 512;
      canvas.height = 256;
      var ctx = canvas.getContext("2d");

      var sky = ctx.createLinearGradient(0, 0, 0, 256);
      sky.addColorStop(0, "#ffffff");
      sky.addColorStop(0.45, "#efe8ff");
      sky.addColorStop(0.75, "#cdb9ff");
      sky.addColorStop(1, "#6c4ab6");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, 512, 256);

      function blot(x, y, r, colour) {
        var glow = ctx.createRadialGradient(x, y, 0, x, y, r);
        glow.addColorStop(0, colour);
        glow.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      blot(120, 70, 110, "rgba(255,255,255,0.95)");
      blot(390, 110, 90, "rgba(214,238,255,0.8)");
      blot(300, 230, 120, "rgba(184,156,255,0.6)");

      var texture = new THREE.CanvasTexture(canvas);
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.encoding = THREE.sRGBEncoding;

      var pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      var env = pmrem.fromEquirectangular(texture).texture;
      pmrem.dispose();
      texture.dispose();
      return env;
    }

    function makeSprite() {
      var canvas = doc.createElement("canvas");
      canvas.width = canvas.height = 64;
      var ctx = canvas.getContext("2d");
      var grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.35, "rgba(255,255,255,0.75)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      var texture = new THREE.CanvasTexture(canvas);
      texture.encoding = THREE.sRGBEncoding;
      return texture;
    }

    function makeRenderer(canvas) {
      var renderer;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas: canvas,
          alpha: true,
          antialias: !state.coarse && !state.mobile,
          powerPreference: "high-performance"
        });
      } catch (err) { return null; }
      if (!renderer.getContext()) return null;
      var cap = state.mobile ? 1 : state.coarse ? 1.5 : 2;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
      renderer.setClearAlpha(0);
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      return renderer;
    }

    function fit(renderer, camera, canvas) {
      var w = canvas.clientWidth || 1;
      var h = canvas.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }

    function whenVisible(canvas, onChange) {
      if (!("IntersectionObserver" in window)) { onChange(true); return; }
      var obs = new IntersectionObserver(function (entries) {
        onChange(entries[0].isIntersecting);
      }, { rootMargin: "120px" });
      obs.observe(canvas);
    }

    var sprite = null;

    /* HERO SCENE */
    (function heroScene() {
      var canvas = $("#hero-canvas");
      if (!canvas) return;
      var renderer = makeRenderer(canvas);
      if (!renderer) return;

      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 0, 6.4);
      scene.environment = makeEnvironment(renderer);

      var world = new THREE.Group();
      scene.add(world);

      var backdropCanvas = doc.createElement("canvas");
      backdropCanvas.width = backdropCanvas.height = 256;
      var bctx = backdropCanvas.getContext("2d");
      var bgrad = bctx.createRadialGradient(128, 110, 10, 128, 128, 140);
      bgrad.addColorStop(0, "#ffffff");
      bgrad.addColorStop(0.45, "#efe9ff");
      bgrad.addColorStop(1, "#d6c8ff");
      bctx.fillStyle = bgrad;
      bctx.fillRect(0, 0, 256, 256);
      var backdropTexture = new THREE.CanvasTexture(backdropCanvas);
      backdropTexture.encoding = THREE.sRGBEncoding;
      var backdrop = new THREE.Mesh(
        new THREE.PlaneGeometry(26, 26),
        new THREE.MeshBasicMaterial({ map: backdropTexture, transparent: true, opacity: 0.55, depthWrite: false })
      );
      backdrop.position.z = -7;
      scene.add(backdrop);

      var sphereSeg = state.mobile ? 40 : state.coarse ? 48 : 96;
      var orbMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, metalness: 0, roughness: 0.04,
        transmission: 1, thickness: 1.7, ior: 1.46,
        clearcoat: 1, clearcoatRoughness: 0.06,
        attenuationColor: new THREE.Color(0xc8b6ff),
        attenuationDistance: 2.4, envMapIntensity: 1.15, transparent: true
      });
      if ("iridescence" in orbMaterial) {
        orbMaterial.iridescence = 0.55;
        orbMaterial.iridescenceIOR = 1.32;
      }

      var orb = new THREE.Mesh(new THREE.SphereGeometry(1.45, sphereSeg, sphereSeg), orbMaterial);
      world.add(orb);

      var core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.62, 0),
        new THREE.MeshPhysicalMaterial({
          color: 0x8a67d6, metalness: 0.92, roughness: 0.18,
          envMapIntensity: 1.4, flatShading: true
        })
      );
      world.add(core);

      var innerShell = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.95, 1),
        new THREE.MeshBasicMaterial({ color: 0xb89cff, wireframe: true, transparent: true, opacity: 0.35 })
      );
      world.add(innerShell);

      var rings = new THREE.Group();
      var ringMaterial = new THREE.MeshStandardMaterial({
        color: 0xc8b6ff, emissive: 0x8a6ad0, emissiveIntensity: 0.55,
        metalness: 0.9, roughness: 0.22, transparent: true, opacity: 0.9
      });
      var torusSeg = state.mobile ? 60 : state.coarse ? 96 : 180;
      [
        { r: 2.15, t: 0.012, rx: Math.PI / 2.2, ry: 0.2 },
        { r: 2.55, t: 0.008, rx: Math.PI / 1.7, ry: -0.5 },
        { r: 2.95, t: 0.006, rx: Math.PI / 2.9, ry: 0.9 }
      ].forEach(function (spec) {
        var ring = new THREE.Mesh(
          new THREE.TorusGeometry(spec.r, spec.t, 8, torusSeg),
          ringMaterial.clone()
        );
        ring.rotation.set(spec.rx, spec.ry, 0);
        rings.add(ring);
      });
      world.add(rings);

      var shards = new THREE.Group();
      var shardGeoms = [
        new THREE.OctahedronGeometry(0.16, 0),
        new THREE.TetrahedronGeometry(0.18, 0),
        new THREE.IcosahedronGeometry(0.14, 0),
        new THREE.TorusGeometry(0.14, 0.04, 8, 28)
      ];
      var shardMat = new THREE.MeshPhysicalMaterial({
        color: 0xe9e1ff, metalness: 0.35, roughness: 0.12,
        clearcoat: 1, envMapIntensity: 1.5, transparent: true, opacity: 0.92
      });
      var shardCount = state.mobile ? 6 : state.coarse ? 9 : 16;
      for (var s = 0; s < shardCount; s++) {
        var mesh = new THREE.Mesh(shardGeoms[s % shardGeoms.length], shardMat.clone());
        var angle = (s / shardCount) * Math.PI * 2 + Math.random() * 0.4;
        var radius = 2.3 + Math.random() * 1.9;
        mesh.position.set(
          Math.cos(angle) * radius,
          (Math.random() - 0.5) * 3.4,
          Math.sin(angle) * radius * 0.7
        );
        mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        mesh.userData.spin = 0.15 + Math.random() * 0.35;
        mesh.userData.bob = 0.4 + Math.random() * 0.8;
        mesh.userData.phase = Math.random() * Math.PI * 2;
        mesh.userData.baseY = mesh.position.y;
        shards.add(mesh);
      }
      world.add(shards);

      var particleCount = state.mobile ? 150 : state.coarse ? 320 : 850;
      var positions = new Float32Array(particleCount * 3);
      var speeds = new Float32Array(particleCount);
      for (var p = 0; p < particleCount; p++) {
        positions[p * 3] = (Math.random() - 0.5) * 16;
        positions[p * 3 + 1] = (Math.random() - 0.5) * 11;
        positions[p * 3 + 2] = (Math.random() - 0.5) * 9 - 1;
        speeds[p] = 0.05 + Math.random() * 0.14;
      }
      var particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      sprite = sprite || makeSprite();
      var particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({
        size: 0.055, map: sprite, color: 0x9a7fe0,
        transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true
      }));
      scene.add(particles);

      scene.add(new THREE.HemisphereLight(0xffffff, 0xd9ccff, 0.85));
      var key = new THREE.DirectionalLight(0xffffff, 1.5);
      key.position.set(4, 6, 5);
      scene.add(key);
      var rim = new THREE.DirectionalLight(0xc8b6ff, 0.9);
      rim.position.set(-5, -2, -4);
      scene.add(rim);
      var cursorLight = new THREE.PointLight(0xb89cff, 2.4, 14, 2);
      cursorLight.position.set(0, 0, 3.4);
      scene.add(cursorLight);

      var shadowTex = (function () {
        var c = doc.createElement("canvas");
        c.width = c.height = 128;
        var x = c.getContext("2d");
        var g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
        g.addColorStop(0, "rgba(70,47,128,0.55)");
        g.addColorStop(0.55, "rgba(70,47,128,0.18)");
        g.addColorStop(1, "rgba(70,47,128,0)");
        x.fillStyle = g;
        x.fillRect(0, 0, 128, 128);
        return new THREE.CanvasTexture(c);
      })();
      var shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 6),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.4, depthWrite: false })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = -2.25;
      scene.add(shadow);

      var drag = { active: false, x: 0, y: 0, vx: 0, vy: 0, id: null };
      var aim = { x: 0, y: 0 };
      var eased = { x: 0, y: 0 };
      var heroSection = $(".hero");

      function pointerDown(e) {
        if (e.target.closest && e.target.closest("a, button, input, textarea, header")) return;
        drag.active = true; drag.id = e.pointerId;
        drag.x = e.clientX; drag.y = e.clientY;
      }
      function pointerMove(e) {
        if (!drag.active || e.pointerId !== drag.id) return;
        drag.vy += (e.clientX - drag.x) * 0.00035;
        drag.vx += (e.clientY - drag.y) * 0.00028;
        drag.x = e.clientX; drag.y = e.clientY;
      }
      function pointerUp() { drag.active = false; drag.id = null; }

      if (heroSection) {
        heroSection.addEventListener("pointerdown", pointerDown);
        window.addEventListener("pointermove", pointerMove, { passive: true });
        window.addEventListener("pointerup", pointerUp);
        window.addEventListener("pointercancel", pointerUp);
      }

      fit(renderer, camera, canvas);
      window.addEventListener("resize", throttleFrame(function () { fit(renderer, camera, canvas); }));

      var visible = true;
      whenVisible(canvas, function (v) { visible = v; });
      body.classList.add("webgl-ready");

      if (prefersStillness()) {
        world.rotation.set(0.2, 0.4, 0);
        renderer.render(scene, camera);
        return;
      }

      var elapsed = 0;
      addTicker(function (delta) {
        if (!visible || doc.hidden) return;
        elapsed += delta;

        aim.x = (state.pointer.y - 0.5) * 0.5;
        aim.y = (state.pointer.x - 0.5) * 0.9;
        eased.x = lerp(eased.x, aim.x, 0.035);
        eased.y = lerp(eased.y, aim.y, 0.035);

        drag.vx *= 0.94;
        drag.vy *= 0.94;

        world.rotation.x = eased.x + drag.vx * 6;
        world.rotation.y = eased.y + elapsed * 0.14 + drag.vy * 6;

        core.rotation.x = -elapsed * 0.35;
        core.rotation.y = elapsed * 0.28;
        core.position.y = Math.sin(elapsed * 0.9) * 0.08;

        innerShell.rotation.y = -elapsed * 0.18;
        innerShell.rotation.z = elapsed * 0.1;

        rings.children.forEach(function (ring, i) {
          ring.rotation.z = elapsed * (0.12 + i * 0.05) * (i % 2 ? -1 : 1);
        });

        shards.children.forEach(function (shard) {
          shard.rotation.x += delta * shard.userData.spin;
          shard.rotation.y += delta * shard.userData.spin * 0.7;
          shard.position.y = shard.userData.baseY + Math.sin(elapsed * shard.userData.bob + shard.userData.phase) * 0.22;
        });

        var array = particleGeometry.attributes.position.array;
        for (var i = 0; i < particleCount; i++) {
          array[i * 3 + 1] += speeds[i] * delta;
          if (array[i * 3 + 1] > 5.5) array[i * 3 + 1] = -5.5;
        }
        particleGeometry.attributes.position.needsUpdate = true;
        particles.rotation.y = elapsed * 0.02;

        cursorLight.position.x = lerp(cursorLight.position.x, (state.pointer.x - 0.5) * 9, 0.06);
        cursorLight.position.y = lerp(cursorLight.position.y, -(state.pointer.y - 0.5) * 6, 0.06);

        var progress = clamp(state.scrollY / Math.max(window.innerHeight, 1), 0, 1);
        camera.position.z = 6.4 + progress * 1.6;
        camera.position.y = progress * 0.7;
        world.position.y = -progress * 0.6;
        camera.lookAt(0, world.position.y * 0.4, 0);

        renderer.render(scene, camera);
      });
    })();

    /* CONTACT ORB */
    (function contactScene() {
      var canvas = $("#contact-canvas");
      if (!canvas) return;
      var renderer = makeRenderer(canvas);
      if (!renderer) return;

      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(46, 1, 0.1, 60);
      camera.position.set(0, 0, 8);
      scene.environment = makeEnvironment(renderer);

      var orbMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xd3c2ff, metalness: 0.15, roughness: 0.16,
        clearcoat: 1, clearcoatRoughness: 0.12,
        envMapIntensity: 1.25, transparent: true, opacity: 0.72
      });
      if (!state.coarse && !state.mobile) {
        orbMaterial.transmission = 0.65;
        orbMaterial.thickness = 3.2;
        orbMaterial.ior = 1.32;
        orbMaterial.attenuationColor = new THREE.Color(0xb89cff);
        orbMaterial.attenuationDistance = 4;
      }

      var orbSeg = state.mobile ? 32 : state.coarse ? 40 : 84;
      var orb = new THREE.Mesh(new THREE.SphereGeometry(2.7, orbSeg, orbSeg), orbMaterial);
      scene.add(orb);

      var halo = new THREE.Mesh(
        new THREE.SphereGeometry(3.5, 40, 40),
        new THREE.MeshBasicMaterial({
          color: 0xc8b6ff, transparent: true, opacity: 0.18,
          side: THREE.BackSide, depthWrite: false
        })
      );
      scene.add(halo);

      var lattice = new THREE.Mesh(
        new THREE.IcosahedronGeometry(3.1, 1),
        new THREE.MeshBasicMaterial({ color: 0xb89cff, wireframe: true, transparent: true, opacity: 0.16 })
      );
      scene.add(lattice);

      var dustCount = state.mobile ? 80 : state.coarse ? 160 : 420;
      var dust = new Float32Array(dustCount * 3);
      for (var i = 0; i < dustCount; i++) {
        dust[i * 3] = (Math.random() - 0.5) * 18;
        dust[i * 3 + 1] = (Math.random() - 0.5) * 12;
        dust[i * 3 + 2] = (Math.random() - 0.5) * 10;
      }
      var dustGeometry = new THREE.BufferGeometry();
      dustGeometry.setAttribute("position", new THREE.BufferAttribute(dust, 3));
      sprite = sprite || makeSprite();
      var dustPoints = new THREE.Points(dustGeometry, new THREE.PointsMaterial({
        size: 0.07, map: sprite, color: 0x9a7fe0,
        transparent: true, opacity: 0.45, depthWrite: false
      }));
      scene.add(dustPoints);

      scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc0ff, 1));
      var key = new THREE.DirectionalLight(0xffffff, 1.2);
      key.position.set(3, 5, 6);
      scene.add(key);
      var follow = new THREE.PointLight(0xffffff, 2.2, 22, 2);
      follow.position.set(0, 0, 5);
      scene.add(follow);

      fit(renderer, camera, canvas);
      window.addEventListener("resize", throttleFrame(function () { fit(renderer, camera, canvas); }));

      var visible = false;
      whenVisible(canvas, function (v) {
        visible = v;
        if (v && prefersStillness()) renderer.render(scene, camera);
      });

      if (prefersStillness()) {
        renderer.render(scene, camera);
        return;
      }

      var elapsed = 0;
      var target = new THREE.Vector3();
      addTicker(function (delta) {
        if (!visible || doc.hidden) return;
        elapsed += delta;

        var box = canvas.getBoundingClientRect();
        var localX = clamp((state.pointerPx.x - box.left) / Math.max(box.width, 1), -0.5, 1.5) - 0.5;
        var localY = clamp((state.pointerPx.y - box.top) / Math.max(box.height, 1), -0.5, 1.5) - 0.5;

        target.set(localX * 2.6, -localY * 1.8 + Math.sin(elapsed * 0.5) * 0.25, 0);
        orb.position.lerp(target, 0.028);
        halo.position.copy(orb.position);
        lattice.position.copy(orb.position);

        orb.rotation.y = elapsed * 0.08;
        lattice.rotation.y = -elapsed * 0.05;
        lattice.rotation.x = elapsed * 0.03;
        halo.scale.setScalar(1 + Math.sin(elapsed * 0.8) * 0.02);

        follow.position.set(localX * 12, -localY * 8, 6);
        dustPoints.rotation.y = elapsed * 0.015;

        renderer.render(scene, camera);
      });
    })();
  })();

  var year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());
})();