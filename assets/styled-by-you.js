/* "Styled By You" slider.
 *
 * An endless marquee, built on two ideas:
 *
 * 1. Position comes from a JS-driven `transform: translateX()`, never the
 *    track's native scrolling — scrollLeft gets clamped at the end of the
 *    content, which silently freezes the slider. The transform goes on the
 *    track, and the clipping `overflow: hidden` on its parent
 *    `.styled-by-you__viewport` — never on the same element, since `overflow`
 *    clips to the element's own box and a transform drags that box along with
 *    the content (which leaves slides bleeding out one side and blank space
 *    on the other).
 * 2. The strip is made endless by *recycling*, not by pre-duplicating a fixed
 *    number of laps: as soon as the leftmost slide has scrolled fully out of
 *    sight it is moved to the end of the track and its width is subtracted
 *    from the offset. Those two cancel out exactly, so nothing visibly moves —
 *    meaning there is no "rewind to the start" jump, and the strip can never
 *    run past its own content into blank space no matter how wide the screen.
 */
(function () {
  const ARROW_PIXELS_PER_SECOND = 900;
  const MAX_FRAME_SECONDS = 0.05;
  const TOUCH_AXIS_LOCK_THRESHOLD = 8;

  function initSlider(section) {
    if (section.dataset.styledByYouReady === "true") return;

    // This section is a mobile-only addition and is display: none from 1000px
    // up. Bail out while it's hidden rather than cloning slides and starting
    // an animation loop nobody can see; initAll runs again on resize.
    if (!section.offsetParent) return;

    section.dataset.styledByYouReady = "true";

    // The markup ships the file in data-src so a hidden desktop page never
    // downloads it. Now that the section is on screen, hand it over.
    section.querySelectorAll("video[data-src]").forEach((video) => {
      video.src = video.dataset.src;
      video.removeAttribute("data-src");
    });

    const viewport = section.querySelector(".styled-by-you__viewport");
    const track = section.querySelector(".styled-by-you__track");
    const prevBtn = section.querySelector(".styled-by-you__arrow--prev");
    const nextBtn = section.querySelector(".styled-by-you__arrow--next");
    if (!viewport || !track) return;

    // The slides as authored — kept as the template list to clone from, in
    // order, so the repeated copies stay in the configured sequence. Each one
    // is tagged with its position in that sequence, which is what keeps the
    // repeats evenly spaced (see `isSeamless`).
    const sourceSlides = Array.from(track.children);
    if (!sourceSlides.length) return;
    sourceSlides.forEach((slide, index) => {
      slide.dataset.sbySlide = index;
    });

    const slideIndexOf = (slide) =>
      slide ? Number(slide.dataset.sbySlide) : -1;

    // Appends whichever slide comes *after* the one currently at the end of
    // the track — not the next entry of a running counter — so the sequence
    // continues unbroken even when `fill` runs again after recycling has
    // already rotated the ring.
    const appendClone = () => {
      const nextIndex =
        (slideIndexOf(track.lastElementChild) + 1) % sourceSlides.length;
      const clone = sourceSlides[nextIndex].cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone
        .querySelectorAll("img, video, button, a")
        .forEach((el) => el.setAttribute("tabindex", "-1"));
      track.appendChild(clone);
    };

    // Width of one slide plus the gap after it. Every slide is the same fixed
    // size, so one measurement covers them all.
    let step = 0;

    const measure = () => {
      const slide = track.firstElementChild;
      if (!slide) return;
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      step = slide.getBoundingClientRect().width + gap;
    };

    // Total width of the laid-out slides. Measured from offsetLeft /
    // offsetWidth rather than scrollWidth or getBoundingClientRect, because
    // those are affected by the track's transform (or by its overflow being
    // visible) and would report a moving target.
    const getContentWidth = () => {
      const first = track.firstElementChild;
      const last = track.lastElementChild;
      if (!first || !last) return 0;
      return last.offsetLeft + last.offsetWidth - first.offsetLeft;
    };

    // The track is a ring — the last slide sits next to the first one again
    // once it wraps. That join is only invisible if it continues the
    // sequence, i.e. the ring holds a whole number of laps. Stop a lap short
    // and the seam puts a video back on screen a slide or two after itself:
    // with 5 videos in a 7-slide ring you would read 4,0,1,0,1 across the
    // join.
    const isSeamless = () => {
      const first = track.firstElementChild;
      const last = track.lastElementChild;
      if (!first || !last) return true;
      return (
        (slideIndexOf(last) + 1) % sourceSlides.length === slideIndexOf(first)
      );
    };

    // Clone slides until the track holds more than one screenful — then round
    // up to finish the lap, so the ring stays seamless. Re-run on
    // resize/load: `step` is 0 until the stylesheet lands and gives the
    // slides their real width, and a wider viewport needs more copies.
    // Only ever tops up, never removes.
    const fill = () => {
      measure();
      if (step <= 0) return;
      const target = viewport.clientWidth + step * 2;
      let guard = 0;
      while ((getContentWidth() < target || !isSeamless()) && guard < 200) {
        appendClone();
        guard += 1;
      }
    };

    fill();
    window.addEventListener("resize", fill);
    window.addEventListener("load", fill);

    // How far the strip has travelled, applied as a negative translateX.
    // Recycling keeps it inside [0, step), so it never grows unbounded.
    let offset = 0;

    const applyOffset = () => {
      track.style.transform = `translateX(${-offset}px)`;
    };

    // Move slides between the two ends of the track to match how far we have
    // travelled. Each move is paired with an equal change to the offset, so
    // it is a visual no-op — this is what makes the loop seamless in both
    // directions.
    const recycle = () => {
      if (step <= 0) return;
      let guard = 0;
      while (offset >= step && track.firstElementChild && guard < 100) {
        track.appendChild(track.firstElementChild);
        offset -= step;
        guard += 1;
      }
      guard = 0;
      while (offset < 0 && track.lastElementChild && guard < 100) {
        track.insertBefore(track.lastElementChild, track.firstElementChild);
        offset += step;
        guard += 1;
      }
    };

    const moveBy = (delta) => {
      offset += delta;
      recycle();
      applyOffset();
    };

    // --- Arrows ---
    // Queue up a one-slide nudge and let the animation loop below ease it
    // out, rather than snapping the transform. Sharing that loop means an
    // arrow press and a drag can never fight over the offset in the same
    // frame.
    let pendingDelta = 0;

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        pendingDelta -= step || viewport.clientWidth;
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        pendingDelta += step || viewport.clientWidth;
      });
    }

    // --- Play/pause: every video autoplays (muted, looping) as soon as it is
    // on the page — including clones `fill` appends later, since the <video>
    // carries the `autoplay` attribute itself rather than relying on JS to
    // start each one. The play button is just a manual pause/resume toggle
    // per video; there is no "only one plays" exclusivity to manage since
    // none of them have sound. `play`, `pause` and `ended` do not bubble, so
    // listen in the capture phase.
    const markPlaying = (video) => {
      const slide = video.closest(".styled-by-you__slide");
      if (slide) slide.classList.add("is-playing");
    };

    const markPaused = (video) => {
      const slide = video.closest(".styled-by-you__slide");
      if (slide) slide.classList.remove("is-playing");
    };

    track.addEventListener("play", (event) => markPlaying(event.target), true);
    track.addEventListener("pause", (event) => markPaused(event.target), true);
    track.addEventListener("ended", (event) => markPaused(event.target), true);

    // --- Drag (mouse + touch) ---
    // Tracked incrementally (delta since the last move event) rather than
    // against a start position, because `recycle` rewrites `offset` mid-drag
    // and any absolute reference would drift.
    let isDown = false;
    let isDragging = false;
    let startX = 0;
    let lastX = 0;

    const startDrag = (clientX) => {
      isDown = true;
      isDragging = false;
      startX = clientX;
      lastX = clientX;
      pendingDelta = 0;
    };

    const moveDrag = (clientX) => {
      if (!isDown) return;
      if (Math.abs(clientX - startX) > 3) isDragging = true;
      moveBy(lastX - clientX);
      lastX = clientX;
    };

    const endDrag = () => {
      isDown = false;
    };

    track.addEventListener("mousedown", (e) => startDrag(e.pageX));
    window.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      moveDrag(e.pageX);
    });
    window.addEventListener("mouseup", endDrag);

    // A touch swipe could mean "drag the strip" or "scroll the page" — only
    // one can win. The axis is decided once, from the first few pixels of
    // movement, then locked for the rest of the gesture: horizontal takes
    // over the strip and blocks page scroll via preventDefault, vertical
    // leaves the strip alone and lets the page scroll normally.
    let startY = 0;
    let touchAxis = null;

    track.addEventListener(
      "touchstart",
      (e) => {
        startDrag(e.touches[0].clientX);
        startY = e.touches[0].clientY;
        touchAxis = null;
      },
      { passive: true },
    );
    track.addEventListener(
      "touchmove",
      (e) => {
        const touch = e.touches[0];
        if (touchAxis === null) {
          const deltaX = Math.abs(touch.clientX - startX);
          const deltaY = Math.abs(touch.clientY - startY);
          if (Math.max(deltaX, deltaY) < TOUCH_AXIS_LOCK_THRESHOLD) return;
          touchAxis = deltaX > deltaY ? "x" : "y";
        }
        if (touchAxis === "y") return;
        e.preventDefault();
        moveDrag(touch.clientX);
      },
      { passive: false },
    );
    track.addEventListener("touchend", endDrag);

    track.addEventListener("dragstart", (e) => e.preventDefault());
    track.addEventListener("click", (event) => {
      if (isDragging) {
        event.preventDefault();
        return;
      }
      const slide = event.target.closest(".styled-by-you__slide");
      if (!slide) return;
      const video = slide.querySelector("video");
      if (!video) return;

      if (event.target.closest(".styled-by-you__play")) {
        video.play();
      } else if (event.target === video) {
        if (video.paused) video.play();
        else video.pause();
      }
    });

    // --- Arrow scroll ---
    // No automatic drift — the strip only moves when the customer drags it or
    // presses an arrow. The rAF loop still runs so arrow presses animate
    // smoothly (`pendingDelta`) instead of jumping instantly.
    let lastFrameTime = null;

    const stepArrowScroll = (timestamp) => {
      // The section is thrown away and rebuilt when it is edited in the theme
      // editor; stop the loop with it rather than animating a detached node.
      if (!track.isConnected) return;

      const elapsedSeconds =
        lastFrameTime === null
          ? 0
          : Math.min((timestamp - lastFrameTime) / 1000, MAX_FRAME_SECONDS);
      lastFrameTime = timestamp;

      // The slides have no width until the stylesheet lands, which leaves
      // `step` at 0 and the strip frozen — keep retrying until they do rather
      // than giving up on the one attempt at startup.
      if (step <= 0) fill();

      if (pendingDelta !== 0) {
        const direction = pendingDelta > 0 ? 1 : -1;
        const distance = Math.min(
          Math.abs(pendingDelta),
          ARROW_PIXELS_PER_SECOND * elapsedSeconds,
        );
        pendingDelta -= direction * distance;
        if (Math.abs(pendingDelta) < 0.5) pendingDelta = 0;
        moveBy(direction * distance);
      }

      requestAnimationFrame(stepArrowScroll);
    };

    requestAnimationFrame(stepArrowScroll);
  }

  const initAll = (root) => {
    (root || document)
      .querySelectorAll(".styled-by-you")
      .forEach((section) => initSlider(section));
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initAll());
  } else {
    initAll();
  }

  // Crossing down over the breakpoint (or rotating a tablet) reveals the
  // section, and it still needs wiring up then.
  window.addEventListener("resize", () => initAll());

  // Theme editor: a section is re-rendered from scratch on every settings
  // change, so the fresh markup needs wiring up again.
  document.addEventListener("shopify:section:load", (event) => {
    initAll(event.target);
  });
})();
