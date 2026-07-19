// Mitti & Bean — shared interaction layer (no dependencies, lightweight)
(function () {
  "use strict";

  // ---- Header scroll state ----
  var header = document.querySelector(".site-header");
  var onScroll = function () {
    if (!header) return;
    if (window.scrollY > 24) header.classList.add("scrolled");
    else header.classList.remove("scrolled");
  };
  document.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ---- Mobile nav toggle ----
  var toggle = document.querySelector(".nav-toggle");
  var panel = document.querySelector(".mobile-panel");
  if (toggle && panel) {
    var closeMenu = function () {
      toggle.classList.remove("open");
      panel.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    };
    var openMenu = function () {
      toggle.classList.add("open");
      panel.classList.add("open");
      toggle.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    };
    toggle.addEventListener("click", function () {
      var isOpen = panel.classList.contains("open");
      if (isOpen) closeMenu();
      else openMenu();
    });
    panel.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMenu);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  // ---- Scroll reveal (text fade, image mask-wipe, timeline draw-line — one observer, three treatments) ----
  var revealEls = document.querySelectorAll(".reveal, .reveal-mask, .timeline-track");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  // ---- Count-up numerals — triggers once when the stat scrolls into view ----
  var countEls = document.querySelectorAll("[data-count-to]");
  var prefersReducedGlobal = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (countEls.length) {
    var animateCount = function (el) {
      var target = parseFloat(el.getAttribute("data-count-to"));
      var suffix = el.getAttribute("data-count-suffix") || "";
      var decimals = el.getAttribute("data-count-decimals") ? parseInt(el.getAttribute("data-count-decimals"), 10) : 0;
      if (isNaN(target)) return;
      if (prefersReducedGlobal) {
        el.textContent = target.toFixed(decimals) + suffix;
        return;
      }
      var startTime = null;
      var duration = 1100;
      var step = function (ts) {
        if (startTime === null) startTime = ts;
        var elapsed = ts - startTime;
        var t = Math.min(elapsed / duration, 1);
        var eased = 1 - Math.pow(1 - t, 3); // ease-out-cubic, matches --ease-settle's feel
        var current = target * eased;
        el.textContent = current.toFixed(decimals) + suffix;
        if (t < 1) window.requestAnimationFrame(step);
      };
      window.requestAnimationFrame(step);
    };
    if ("IntersectionObserver" in window) {
      var countIo = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              animateCount(entry.target);
              countIo.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.6 }
      );
      countEls.forEach(function (el) { countIo.observe(el); });
    } else {
      countEls.forEach(function (el) {
        el.textContent = el.getAttribute("data-count-to") + (el.getAttribute("data-count-suffix") || "");
      });
    }
  }

  // ---- Magnetic primary buttons — a few px of pull toward the cursor, spring back on leave ----
  var magneticBtns = document.querySelectorAll(".btn-magnetic");
  if (magneticBtns.length && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    magneticBtns.forEach(function (btn) {
      var maxPull = 7;
      btn.addEventListener("mousemove", function (e) {
        var rect = btn.getBoundingClientRect();
        var relX = (e.clientX - rect.left) / rect.width - 0.5;
        var relY = (e.clientY - rect.top) / rect.height - 0.5;
        btn.style.transform = "translate(" + (relX * maxPull * 2).toFixed(1) + "px, " + (relY * maxPull * 2).toFixed(1) + "px)";
      });
      btn.addEventListener("mouseleave", function () {
        btn.style.transform = "translate(0, 0)";
      });
    });
  }

  // ---- Hero scroll-scrub effect: actual video frames advance/reverse with scroll ----
  var heroSection = document.querySelector(".hero");
  var heroVideo = document.querySelector(".hero-photo");
  var heroCopy = document.querySelector(".hero-copy");
  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (heroSection && heroVideo) {
    heroVideo.muted = true;
    heroVideo.playsInline = true;

    // Scrubbing is now enabled on every screen size (including mobile) —
    // per user request, prioritizing the effect over the mobile-data tradeoff.
    var scrubEnabled = true;
    var videoDuration = 0;
    var videoPrimed = false;   // becomes true once we've forced a first real frame paint
    var seeking = false;       // true while a seek is in flight
    var pendingTime = null;    // latest requested time, applied as soon as the current seek resolves
    var intensity = prefersReduced ? 0.25 : 1; // reduced-motion still responds, just across a narrower slice
    var heroTicking = false;

    var applyPendingSeek = function () {
      if (pendingTime === null || seeking || !videoPrimed) return;
      var t = pendingTime;
      pendingTime = null;
      if (Math.abs(heroVideo.currentTime - t) < 0.03) return;
      seeking = true;
      try {
        heroVideo.currentTime = t;
      } catch (e) {
        seeking = false;
      }
    };
    heroVideo.addEventListener("seeked", function () {
      seeking = false;
      applyPendingSeek();
    });

    var updateHero = function () {
      var rect = heroSection.getBoundingClientRect();
      var heroHeight = heroSection.offsetHeight || 1;
      // 0 = hero fully in view at top of page, 1 = hero has scrolled fully past
      var progress = Math.min(Math.max(-rect.top / heroHeight, 0), 1);

      if (scrubEnabled && videoDuration > 0) {
        pendingTime = progress * videoDuration * intensity;
        applyPendingSeek();
      }

      if (heroCopy) {
        heroCopy.style.transform = "translateY(" + (progress * -36 * intensity).toFixed(1) + "px)";
        heroCopy.style.opacity = String(Math.max(1 - progress * 1.4 * intensity, prefersReduced ? 0.85 : 0));
      }
      heroTicking = false;
    };

    // Safari/iOS in particular will happily accept a currentTime change but never repaint
    // the visible frame until the video has actually played at least once. A near-instant
    // play → pause "primes" the decoder so every seek after this reliably repaints.
    var primeVideo = function () {
      if (!scrubEnabled || videoPrimed) return;
      var playAttempt = heroVideo.play();
      var finishPriming = function () {
        heroVideo.pause();
        videoPrimed = true;
        applyPendingSeek();
      };
      if (playAttempt && typeof playAttempt.then === "function") {
        playAttempt.then(finishPriming).catch(function () {
          // Autoplay blocked by the browser — seeking still works fine without priming
          // on most engines, so just proceed.
          videoPrimed = true;
          applyPendingSeek();
        });
      } else {
        finishPriming();
      }
    };

    var armScrub = function () {
      if (!scrubEnabled) return;
      videoDuration = heroVideo.duration || 0;
      if (videoDuration > 0) {
        heroVideo.preload = "auto"; // worth fetching full video data now for smooth seeking
        primeVideo();
        updateHero();
      }
    };
    heroVideo.addEventListener("loadedmetadata", armScrub);
    if (heroVideo.readyState >= 1) armScrub();

    document.addEventListener(
      "scroll",
      function () {
        if (!heroTicking) {
          window.requestAnimationFrame(updateHero);
          heroTicking = true;
        }
      },
      { passive: true }
    );
    window.addEventListener("resize", updateHero, { passive: true });
    updateHero();
  }

  // ---- Footer year ----
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---- Menu filter (menu.html only) ----
  var filterBar = document.querySelector(".menu-filters");
  if (filterBar) {
    var buttons = filterBar.querySelectorAll("button");
    var items = document.querySelectorAll("[data-category]");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        var cat = btn.getAttribute("data-filter");
        items.forEach(function (item) {
          var show = cat === "all" || item.getAttribute("data-category") === cat;
          item.style.display = show ? "" : "none";
        });
      });
    });
  }

  // ---- Reservation / order form (visual only — no backend) ----
  var form = document.querySelector(".res-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = form.querySelector(".form-status");
      if (status) {
        status.textContent = "Thank you — we'll get back to you within a day.";
        status.classList.add("in");
      }
      form.reset();
    });
  }
  // ---- Founder portrait cursor-tilt (about.html only) ----
  var founderPortrait = document.querySelector(".founder-portrait");
  if (founderPortrait && !prefersReduced) {
    var tiltMax = 4; // degrees — a whisper, not a gimbal
    founderPortrait.addEventListener("mousemove", function (e) {
      var rect = founderPortrait.getBoundingClientRect();
      var px = (e.clientX - rect.left) / rect.width;
      var py = (e.clientY - rect.top) / rect.height;
      var rotY = (px - 0.5) * tiltMax * 2;
      var rotX = (0.5 - py) * tiltMax * 2;
      founderPortrait.style.transform =
        "perspective(1400px) rotateX(" + rotX.toFixed(2) + "deg) rotateY(" + rotY.toFixed(2) + "deg)";
    });
    founderPortrait.addEventListener("mouseleave", function () {
      founderPortrait.style.transform = "perspective(1400px) rotateX(0deg) rotateY(0deg)";
    });
  }

  // ---- Timeline cursor-glow (about.html only) — a warm light that follows the
  // cursor down "The Bean's Journey", instead of a static illustration ----
  var timelineTrack = document.querySelector(".timeline-track");
  if (timelineTrack && !prefersReduced) {
    var glow = document.createElement("div");
    glow.className = "timeline-glow";
    glow.setAttribute("aria-hidden", "true");
    timelineTrack.appendChild(glow);
    timelineTrack.addEventListener("mousemove", function (e) {
      var rect = timelineTrack.getBoundingClientRect();
      var y = e.clientY - rect.top;
      glow.style.transform = "translateY(" + y.toFixed(1) + "px)";
    });
  }
})();
