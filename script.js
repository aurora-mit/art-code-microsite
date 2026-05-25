const canvas = document.getElementById('canvas');
const coordsEl = document.getElementById('coords');

const CANVAS_W = 4000;
const CANVAS_H = 3000;

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
document.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        panStart = { ...pan };
    }
});
document.addEventListener('touchmove', e => {
    if (!touchStart || e.touches.length !== 1) return;
    e.preventDefault();
    pan.x = panStart.x + (e.touches[0].clientX - touchStart.x);
    pan.y = panStart.y + (e.touches[0].clientY - touchStart.y);
    applyTransform();
}, { passive: false });
document.addEventListener('touchend', () => { touchStart = null; });

let degrees = ['135deg', '90deg', 'to top', 'to left', '45deg', '180deg'];
let endColors = ['#ffffff', '#ff5af48d', 'transparent', '#0055ff78'];
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
        plot.style.background = randFmt(randDeg, member.accent, randCol);
        plot.style.setProperty('--accent', member.accent);
    }
    const baseW = widths[Math.floor(Math.random() * widths.length)];
    plot.style.width = baseW + 'px';
    plot.dataset.baseW = baseW;
    plot.style.height = heights[Math.floor(Math.random() * heights.length)] + 'px';
    plot.style.setProperty('--mass', (0.5 + Math.random()).toFixed(2));
    plot.innerHTML = `<a href="members/${member.slug}/">${member.name}<br><em>${member.tagline}</em>`;
    if (member.image) {
        plot.innerHTML += `<img src="${member.image}" style="padding-left: 25px; max-width: 66%; max-height: 66%;" alt="${member.name}">`;
    }
    plot.innerHTML += `</a><div class="resize-handle"></div>`;
    return plot;
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
    zoom = Math.max(0.3, Math.min(1, fitZoom));
    pan.x = window.innerWidth / 2 - (PLOT_X + PLOT_W / 2) * zoom;
    pan.y = window.innerHeight / 2 - (PLOT_Y + PLOT_H / 2) * zoom;

    // build grid inside the centered plot region
    const cols = Math.ceil(Math.sqrt(members.length));
    const rows = Math.ceil(members.length / cols);
    const cellW = PLOT_W / cols;
    const cellH = PLOT_H / rows;

    const placed = [];

    members.forEach((m, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const jitterX = Math.random() * Math.max(0, cellW - 480);
        const jitterY = Math.random() * Math.max(0, cellH - 360);
        let x = PLOT_X + col * cellW + jitterX;
        let y = PLOT_Y + row * cellH + jitterY;
        const plot = buildPlot(m, x, y);
        const w = parseInt(plot.style.width);
        const h = parseInt(plot.style.height);
        // keep the plot fully inside the centered region
        x = Math.min(x, PLOT_X + PLOT_W - w);
        y = Math.min(y, PLOT_Y + PLOT_H - h);
        plot.style.left = x + 'px';
        plot.style.top = y + 'px';
        canvas.appendChild(plot);
        placed.push({ x, y, w, h });
    });

    // avoid overlaps
    function overlaps(x, y, w, h) {
        const pad = 40;
        return placed.some(p =>
            x < p.x + p.w + pad && x + w + pad > p.x &&
            y < p.y + p.h + pad && y + h + pad > p.y
        );
    }

    // scatter html elements
    const scatteredEls = Array.from(document.querySelectorAll('.scattered'));
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
}

init();

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

// reshuffle existing plots: re-randomize sizes + masses, lay out in fresh grid
function reshufflePlots() {
    const plots = Array.from(document.querySelectorAll('.plot'));
    for (let i = plots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [plots[i], plots[j]] = [plots[j], plots[i]];
    }
    const mult = widthMult();
    plots.forEach(plot => {
        const baseW = widths[Math.floor(Math.random() * widths.length)];
        plot.dataset.baseW = baseW;
        plot.style.width = (baseW * mult) + 'px';
        plot.style.height = heights[Math.floor(Math.random() * heights.length)] + 'px';
        plot.style.setProperty('--mass', (0.5 + Math.random()).toFixed(2));
    });
    const cols = Math.ceil(Math.sqrt(plots.length));
    const rows = Math.ceil(plots.length / cols);
    const cellW = PLOT_W / cols;
    const cellH = PLOT_H / rows;
    plots.forEach((plot, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const w = parseInt(plot.style.width) || 400;
        const h = parseInt(plot.style.height) || 300;
        const jitterX = Math.random() * Math.max(0, cellW - w);
        const jitterY = Math.random() * Math.max(0, cellH - h);
        let x = PLOT_X + col * cellW + jitterX;
        let y = PLOT_Y + row * cellH + jitterY;
        x = Math.min(x, PLOT_X + PLOT_W - w);
        y = Math.min(y, PLOT_Y + PLOT_H - h);
        plot.style.left = x + 'px';
        plot.style.top = y + 'px';
    });
}

// title buttons: NEW INC -> reshuffle, Art and Code -> toggle about panel
const titleButtons = document.querySelectorAll('#title button');
titleButtons[0].addEventListener('click', reshufflePlots);
const aboutPanel = document.getElementById('about');
titleButtons[1].addEventListener('click', () => {
    const open = aboutPanel.classList.toggle('is-open');
    titleButtons[1].classList.toggle('is-active', open);
});
