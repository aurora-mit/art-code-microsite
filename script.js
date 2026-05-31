const canvas = document.getElementById('canvas');
const coordsEl = document.getElementById('coords');

const CANVAS_W = 4000;
const CANVAS_H = 3000;

const TITLE_CX = CANVAS_W / 2;
const TITLE_CY = CANVAS_H / 2;
const TITLE_PAD_W = 100;
const TITLE_PAD_H = 100;

function inTitleZone(x, y, w, h) {
    return x < TITLE_CX + TITLE_PAD_W &&
        x + w > TITLE_CX - TITLE_PAD_W &&
        y < TITLE_CY + TITLE_PAD_H &&
        y + h > TITLE_CY - TITLE_PAD_H;
}

// central region for member plots
const PLOT_W = 2600;
const PLOT_H = 1800;
const PLOT_X = (CANVAS_W - PLOT_W) / 2;
const PLOT_Y = (CANVAS_H - PLOT_H) / 2;

let pan = { x: -100, y: -60 };
let zoom = 1;
let dragging = false;
let dragStart = { x: 0, y: 0 };
let panStart = { x: 0, y: 0 };

function applyTransform() {
    canvas.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
    canvas.style.transformOrigin = '0 0';
    coordsEl.textContent = `${Math.round(-pan.x / zoom)}, ${Math.round(-pan.y / zoom)}`;
}

// dragging and resizing .plot elements
let dragPlot = null;
let dragPlotStart = { x: 0, y: 0 };
let dragPlotOrigin = { x: 0, y: 0 };

let resizePlot = null;
let resizeStart = { x: 0, y: 0 };
let resizeOrigin = { w: 0, h: 0 };
let resizeMin = { w: 80, h: 60 };

document.addEventListener('mousedown', e => {
    if (e.target.closest('input, button, select, textarea, label')) return;

    if (e.target.classList.contains('resize-handle')) {
        resizePlot = e.target.closest('.plot');
        canvas.appendChild(resizePlot); // bring to front
        resizePlot.style.zIndex = 2; // above #title (z-index 1)
        resizeStart = { x: e.clientX, y: e.clientY };
        resizeOrigin = { w: resizePlot.offsetWidth, h: resizePlot.offsetHeight };
        const sw = resizePlot.style.width;
        const sh = resizePlot.style.height;
        resizePlot.style.width = 'min-content';
        resizePlot.style.height = 'min-content';
        resizeMin = { w: resizePlot.offsetWidth, h: resizePlot.offsetHeight };
        resizePlot.style.width = sw;
        resizePlot.style.height = sh;
        document.body.classList.add('is-dragging');
        return;
    }

    const plot = e.target.closest('.plot');
    if (plot) {
        dragPlot = plot;
        canvas.appendChild(plot); // bring to front
        plot.style.zIndex = 2; // above #title (z-index 1)
        dragPlotStart = { x: e.clientX, y: e.clientY };
        dragPlotOrigin = { x: parseInt(plot.style.left), y: parseInt(plot.style.top) };
        document.body.classList.add('is-dragging');
        e.preventDefault();
        return;
    }

    dragging = true;
    document.body.classList.add('is-dragging');
    dragStart = { x: e.clientX, y: e.clientY };
    panStart = { ...pan };
});
document.addEventListener('mousemove', e => {
    if (resizePlot) {
        const dw = (e.clientX - resizeStart.x) / zoom;
        const dh = (e.clientY - resizeStart.y) / zoom;
        resizePlot.style.width = Math.max(resizeMin.w, resizeOrigin.w + dw) + 'px';
        resizePlot.style.height = Math.max(resizeMin.h, resizeOrigin.h + dh) + 'px';
        return;
    }
    if (dragPlot) {
        const dx = (e.clientX - dragPlotStart.x) / zoom;
        const dy = (e.clientY - dragPlotStart.y) / zoom;
        dragPlot.style.left = (dragPlotOrigin.x + dx) + 'px';
        dragPlot.style.top = (dragPlotOrigin.y + dy) + 'px';
        return;
    }
    if (!dragging) return;
    pan.x = panStart.x + (e.clientX - dragStart.x);
    pan.y = panStart.y + (e.clientY - dragStart.y);
    applyTransform();
});
document.addEventListener('mouseup', e => {
    if (dragPlot) {
        const dx = e.clientX - dragPlotStart.x;
        const dy = e.clientY - dragPlotStart.y;
        if (Math.hypot(dx, dy) < 5) {
            const link = dragPlot.querySelector('a');
            if (link) window.location.href = link.href;
        }
    }
    if (resizePlot) {
        // rebase so future slider scaling stays proportional to the new size
        const mult = (typeof widthMult === 'function') ? widthMult() : 1;
        const w = parseFloat(resizePlot.style.width);
        if (!isNaN(w) && mult > 0) resizePlot.dataset.baseW = (w / mult).toString();
    }
    dragging = false;
    dragPlot = null;
    resizePlot = null;
    document.body.classList.remove('is-dragging');
});

document.addEventListener('wheel', e => {
    e.preventDefault();
    const newZoom = Math.min(2.5, Math.max(0.3, zoom - e.deltaY * 0.001));
    pan.x = e.clientX - (newZoom / zoom) * (e.clientX - pan.x);
    pan.y = e.clientY - (newZoom / zoom) * (e.clientY - pan.y);
    zoom = newZoom;
    applyTransform();
}, { passive: false });

let touchStart = null;
let pinchStart = null;

document.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStart = {
            dist: Math.hypot(dx, dy),
            zoom,
            midX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
            midY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
            pan: { ...pan }
        };
        touchStart = null;
    } else if (e.touches.length === 1) {
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        panStart = { ...pan };
        pinchStart = null;
    }
});

document.addEventListener('touchmove', e => {
    e.preventDefault();
    if (pinchStart && e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const newZoom = Math.min(2.5, Math.max(0.3, pinchStart.zoom * (dist / pinchStart.dist)));
        pan.x = pinchStart.midX - (newZoom / pinchStart.zoom) * (pinchStart.midX - pinchStart.pan.x);
        pan.y = pinchStart.midY - (newZoom / pinchStart.zoom) * (pinchStart.midY - pinchStart.pan.y);
        zoom = newZoom;
        applyTransform();
    } else if (touchStart && e.touches.length === 1) {
        pan.x = panStart.x + (e.touches[0].clientX - touchStart.x);
        pan.y = panStart.y + (e.touches[0].clientY - touchStart.y);
        applyTransform();
    }
}, { passive: false });

document.addEventListener('touchend', e => {
    if (e.touches.length < 2) pinchStart = null;
    if (e.touches.length === 0) touchStart = null;
});

let degrees = ['135deg', '90deg', 'to top', 'to left', '45deg', '180deg'];
let endColors = ['#ffffff', '#d0d0d08d', 'transparent', '#0055ff2c'];
let formats = [
    (deg, accent, end) => `linear-gradient(${deg}, ${accent}, ${end})`,
    (deg, accent, end) => `linear-gradient(${deg}, ${end}, ${accent}, ${end})`,
];
let widths = [320, 400, 480, 560, 640];
let heights = [240, 300, 360, 420, 480];

function buildPlot(member, x, y) {
    const plot = document.createElement('div');
    plot.className = 'plot';
    plot.style.left = x + 'px';
    plot.style.top = y + 'px';
    if (member.accent) {
        let randDeg = degrees[Math.floor(Math.random() * degrees.length)];
        let randCol = endColors[Math.floor(Math.random() * endColors.length)];
        let randFmt = formats[Math.floor(Math.random() * formats.length)];
        plot.dataset.gradient = randFmt(randDeg, member.accent, randCol);
        plot.style.setProperty('--accent', member.accent);
    }
    const baseW = widths[Math.floor(Math.random() * widths.length)];
    plot.style.width = baseW + 'px';
    plot.dataset.baseW = baseW;
    plot.style.height = heights[Math.floor(Math.random() * heights.length)] + 'px';
    plot.style.setProperty('--mass', (0.5 + Math.random()).toFixed(2));
    plot.innerHTML = `<a href="m/${member.slug}/"><span class="p-name">${member.name}</span><em class="p-title">${member.tagline}</em>`;
    if (member.image) {
        plot.innerHTML += `<img class="p-content" src="${member.image}" style="padding-left: 25px; max-width: 66%; max-height: 66%;" alt="${member.name}">`;
    }
    plot.innerHTML += `</a><div class="resize-handle"></div>`;
    return plot;
}

// pinned UI controls that plots should not cover
const PINNED_IDS = ['checkboxes', 'form-search', 'slider-v', 'slider'];
function uiObstacleRects() {
    const pad = 30;
    return PINNED_IDS.map(id => document.getElementById(id))
        .filter(el => el && el.style.left)
        .map(el => ({
            x: parseFloat(el.style.left) - pad,
            y: parseFloat(el.style.top) - pad,
            w: el.offsetWidth + pad * 2,
            h: el.offsetHeight + pad * 2,
        }));
}

// Shared placement function used by both init and reshuffle
function placePlots(plots, mult, obstacles = []) {
    const PAD = 20;
    const placed = [];

    // Add title zone as a pre-placed obstacle
    placed.push({
        x: TITLE_CX - TITLE_PAD_W,
        y: TITLE_CY - TITLE_PAD_H,
        w: TITLE_PAD_W * 2,
        h: TITLE_PAD_H * 2
    });

    // keep plots clear of the pinned UI controls
    for (const o of obstacles) placed.push(o);

    function fits(x, y, w, h) {
        if (x < PLOT_X || y < PLOT_Y || x + w > PLOT_X + PLOT_W || y + h > PLOT_Y + PLOT_H) return false;
        return !placed.some(p =>
            x < p.x + p.w + PAD && x + w + PAD > p.x &&
            y < p.y + p.h + PAD && y + h + PAD > p.y
        );
    }

    plots.forEach((plot, i) => {
        // pick random size
        let baseW = widths[Math.floor(Math.random() * widths.length)];
        let baseH = heights[Math.floor(Math.random() * heights.length)];
        let w = baseW * mult;
        let h = baseH;

        plot.style.setProperty('--mass', (0.5 + Math.random()).toFixed(2));

        // try progressively smaller sizes if needed
        const sizeOptions = [
            [baseW, baseH],
            [widths[1], heights[1]],
            [widths[0], heights[0]],
        ];

        let x, y, placed_ok = false;

        outer:
        for (const [sw, sh] of sizeOptions) {
            w = sw * mult;
            h = sh;
            baseW = sw;
            baseH = sh;

            // Stratified random: divide plot region into a coarse grid of
            // candidate anchor points, shuffle them, then try each with jitter
            const STRIDE = 80;
            const anchorCols = Math.floor(PLOT_W / STRIDE);
            const anchorRows = Math.floor(PLOT_H / STRIDE);
            const anchors = [];
            for (let r = 0; r < anchorRows; r++) {
                for (let c = 0; c < anchorCols; c++) {
                    anchors.push([
                        PLOT_X + c * STRIDE + Math.random() * STRIDE,
                        PLOT_Y + r * STRIDE + Math.random() * STRIDE
                    ]);
                }
            }
            // shuffle anchors
            for (let k = anchors.length - 1; k > 0; k--) {
                const j = Math.floor(Math.random() * (k + 1));
                [anchors[k], anchors[j]] = [anchors[j], anchors[k]];
            }

            // only test a reasonable number of candidates
            const limit = Math.min(anchors.length, 120);
            for (let k = 0; k < limit; k++) {
                let cx = anchors[k][0];
                let cy = anchors[k][1];
                cx = Math.min(cx, PLOT_X + PLOT_W - w);
                cy = Math.min(cy, PLOT_Y + PLOT_H - h);
                if (fits(cx, cy, w, h)) {
                    x = cx; y = cy;
                    baseW = sw; baseH = sh;
                    placed_ok = true;
                    break outer;
                }
            }
        }

        // last resort: place at a grid position ignoring overlaps
        if (!placed_ok) {
            const cols = Math.ceil(Math.sqrt(plots.length));
            const col = i % cols;
            const row = Math.floor(i / cols);
            w = widths[0] * mult;
            h = heights[0];
            baseW = widths[0];
            x = PLOT_X + col * (PLOT_W / cols);
            y = PLOT_Y + row * (PLOT_H / Math.ceil(plots.length / cols));
            x = Math.min(x, PLOT_X + PLOT_W - w);
            y = Math.min(y, PLOT_Y + PLOT_H - h);
        }

        plot.dataset.baseW = baseW;
        plot.style.width = w + 'px';
        plot.style.height = h + 'px';
        plot.style.left = x + 'px';
        plot.style.top = y + 'px';
        placed.push({ x, y, w, h });
    });
}

async function init() {
    const members = await fetch('data.json').then(r => r.json());

    // shuffle people
    for (let i = members.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [members[i], members[j]] = [members[j], members[i]];
    }

    // frame band around the plot region
    const FRAME_GAP = 80;
    const FRAME_THICK = 380;

    const FIT_PAD = 60;
    const targetW = PLOT_W + 2 * FIT_PAD;
    const targetH = PLOT_H + 2 * FIT_PAD;
    const fitZoom = Math.min(window.innerWidth / targetW, window.innerHeight / targetH);
    zoom = Math.max(0.3, Math.min(window.innerWidth < 768 ? 0.5 : 1, fitZoom));
    pan.x = window.innerWidth / 2 - (PLOT_X + PLOT_W / 2) * zoom;
    pan.y = window.innerHeight / 2 - (PLOT_Y + PLOT_H / 2) * zoom;

    // build grid inside the centered plot region
    const cols = Math.ceil(Math.sqrt(members.length));
    const rows = Math.ceil(members.length / cols);
    const cellW = PLOT_W / cols;
    const cellH = PLOT_H / rows;

    const placed = [];
    const plotEls = [];
    members.forEach((m) => {
        const plot = buildPlot(m, 0, 0);
        canvas.appendChild(plot);
        plotEls.push(plot);
    });
    // pin controls to fixed spots
    const vx0 = -pan.x / zoom;     // left edge
    const vy0 = -pan.y / zoom;        // top edge
    const vw = window.innerWidth / zoom;
    const vh = window.innerHeight / zoom;
    const m = 50 / zoom;          // edge margin
    const mx = 30 / zoom;

    const pinned = new Set();
    function pin(id, left, top) {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.left = left(el.offsetWidth) + 'px';
        el.style.top = top(el.offsetHeight) + 'px';
        pinned.add(el);
    }
    pin('checkboxes', () => vx0 + mx, () => vy0 + m);
    pin('form-search', w => vx0 + vw - w - mx, h => vy0 + m);
    pin('slider-v', w => vx0 + vw - w - mx, h => vy0 + (vh - h) / 2);
    pin('slider', w => vx0 + (vw - w) / 2, h => vy0 + vh - h - m);

    // place plots
    placePlots(plotEls, 1, uiObstacleRects());

    // avoid overlaps
    function overlaps(x, y, w, h) {
        const pad = 40;
        return placed.some(p =>
            x < p.x + p.w + pad && x + w + pad > p.x &&
            y < p.y + p.h + pad && y + h + pad > p.y
        );
    }

    // scatter remaining html elements
    const scatteredEls = Array.from(document.querySelectorAll('.scattered'))
        .filter(el => !pinned.has(el));
    // shuffle order
    for (let i = scatteredEls.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [scatteredEls[i], scatteredEls[j]] = [scatteredEls[j], scatteredEls[i]];
    }
    const sides = ['top', 'right', 'bottom', 'left'];

    scatteredEls.forEach((el, i) => {
        const w = el.offsetWidth || 200;
        const h = el.offsetHeight || 40;
        const side = sides[i % sides.length];
        let x, y, attempts = 0;
        do {
            if (side === 'top') {
                x = PLOT_X + Math.random() * Math.max(0, PLOT_W - w);
                y = PLOT_Y - FRAME_GAP - h - Math.random() * FRAME_THICK;
            } else if (side === 'bottom') {
                x = PLOT_X + Math.random() * Math.max(0, PLOT_W - w);
                y = PLOT_Y + PLOT_H + FRAME_GAP + Math.random() * FRAME_THICK;
            } else if (side === 'left') {
                x = PLOT_X - FRAME_GAP - w - Math.random() * FRAME_THICK;
                y = PLOT_Y + Math.random() * Math.max(0, PLOT_H - h);
            } else {
                x = PLOT_X + PLOT_W + FRAME_GAP + Math.random() * FRAME_THICK;
                y = PLOT_Y + Math.random() * Math.max(0, PLOT_H - h);
            }
            attempts++;
        } while (overlaps(x, y, w, h) && attempts < 50);
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        placed.push({ x, y, w, h });
    });

    applyTransform();
    applyPlotView();
}

init();

// checkbox toggles
const viewChecks = Array.from(document.querySelectorAll('#checkboxes .check'));
function applyPlotView() {
    canvas.classList.toggle('hide-name', !viewChecks[0].checked);
    canvas.classList.toggle('hide-title', !viewChecks[1].checked);
    canvas.classList.toggle('hide-content', !viewChecks[2].checked);
    const gradientOn = viewChecks[3].checked;
    canvas.classList.toggle('no-gradient', !gradientOn);
    document.querySelectorAll('.plot').forEach(p => {
        p.style.background = gradientOn ? (p.dataset.gradient || '') : '';
    });
}
viewChecks.forEach(cb => cb.addEventListener('change', applyPlotView));

// gravity with vertical slider
const gravitySlider = document.querySelector('#slider-v input');
gravitySlider.addEventListener('input', () => {
    const v = parseInt(gravitySlider.value, 10); // 0..100
    const offset = (50 - v) * 12; // top of slider (100) pulls up
    document.documentElement.style.setProperty('--gravity', offset + 'px');
});

// width with horizontal slider
const widthSlider = document.querySelector('#slider input');
function widthMult() {
    return Math.pow(2, (parseInt(widthSlider.value, 10) - 50) / 50);
}
function applyWidthMult() {
    const mult = widthMult();
    document.querySelectorAll('.plot').forEach(p => {
        const base = parseFloat(p.dataset.baseW);
        if (!isNaN(base)) p.style.width = (base * mult) + 'px';
    });
}
widthSlider.addEventListener('input', applyWidthMult);

// marquee
const searchForm = document.getElementById('form-search');
const searchInput = searchForm.querySelector('input');
const marqueeTrack = document.querySelector('#marquee .track');
const MARQUEE_SPEED = 80; // px/sec
function setMarquee(text) {
    marqueeTrack.replaceChildren();
    const txt = text.trim();
    if (!txt) return;

    const probe = document.createElement('span');
    probe.className = 'cell';
    probe.textContent = txt;
    marqueeTrack.appendChild(probe);
    const cellW = probe.offsetWidth || 120;

    const copies = Math.max(6, Math.ceil(window.innerWidth / cellW) + 2);
    for (let i = 1; i < copies; i++) {
        const cell = document.createElement('span');
        cell.className = 'cell';
        cell.textContent = txt;
        marqueeTrack.appendChild(cell);
    }

    document.documentElement.style.setProperty('--marquee-shift', `-${(100 / copies).toFixed(4)}%`);
    // constant px/sec regardless of cell size
    document.documentElement.style.setProperty('--marquee-duration', `${(cellW / MARQUEE_SPEED).toFixed(2)}s`);

    // restart animation
    marqueeTrack.style.animation = 'none';
    void marqueeTrack.offsetWidth;
    marqueeTrack.style.animation = '';
}
searchForm.addEventListener('submit', e => {
    e.preventDefault();
    setMarquee(searchInput.value);
});
setMarquee('art and code!');

// bottom marquee
(function () {
    const bottomTrack = document.querySelector('#marquee-bottom .track');
    const text = '[Website Title TBD]';

    const probe = document.createElement('span');
    probe.className = 'cell';
    probe.textContent = text;
    bottomTrack.appendChild(probe);
    const cellW = probe.offsetWidth || 120;

    const copies = Math.max(6, Math.ceil(window.innerWidth / cellW) + 2);
    for (let i = 1; i < copies; i++) {
        const cell = document.createElement('span');
        cell.className = 'cell';
        cell.textContent = text;
        bottomTrack.appendChild(cell);
    }

    document.documentElement.style.setProperty('--marquee-bottom-shift', `-${(100 / copies).toFixed(4)}%`);
    document.documentElement.style.setProperty('--marquee-bottom-duration', `${(cellW / MARQUEE_SPEED).toFixed(2)}s`);

    bottomTrack.style.animation = 'none';
    void bottomTrack.offsetWidth;
    bottomTrack.style.animation = 'marquee-bottom var(--marquee-bottom-duration, 2s) linear infinite';
})();

function reshufflePlots() {
    const plots = Array.from(document.querySelectorAll('.plot'));
    // shuffle order
    for (let i = plots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [plots[i], plots[j]] = [plots[j], plots[i]];
    }
    placePlots(plots, widthMult(), uiObstacleRects());
}

// title buttons: NEW INC -> reshuffle, Art and Code -> toggle about panel
const titleButtons = document.querySelectorAll('#title button');
titleButtons[0].addEventListener('click', reshufflePlots);
const aboutPanel = document.getElementById('about');
titleButtons[1].addEventListener('click', () => {
    const open = aboutPanel.classList.toggle('is-open');
    titleButtons[1].classList.toggle('is-active', open);
});
