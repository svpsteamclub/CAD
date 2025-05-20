document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    const toolbar = document.querySelector('.toolbar');
    const colorPicker = document.getElementById('color-picker');
    const strokeWidthPicker = document.getElementById('stroke-width-picker'); // New
    const loadSvgInput = document.getElementById('load-svg-input'); // New
    const loadSvgButton = document.getElementById('load-svg-button'); // New

    let currentTool = 'line';
    let isDrawing = false;
    let startX, startY;
    let shapes = [];
    let currentColor = '#000000';
    let currentStrokeWidth = 2; // New

    function resizeCanvas() {
        const toolbarHeight = toolbar.offsetHeight + 20;
        canvas.width = window.innerWidth * 0.95;
        canvas.height = (window.innerHeight - toolbarHeight) * 0.95;
        redrawShapes();
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const toolButtons = document.querySelectorAll('.tool-button');
    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            toolButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentTool = button.dataset.tool;
        });
    });

    colorPicker.addEventListener('input', (e) => {
        currentColor = e.target.value;
    });

    // --- Stroke Width Picker ---
    strokeWidthPicker.addEventListener('input', (e) => {
        currentStrokeWidth = parseInt(e.target.value, 10);
        if (currentStrokeWidth < 1) currentStrokeWidth = 1;
        if (currentStrokeWidth > 50) currentStrokeWidth = 50; // Max limit
    });


    function getMousePos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;
        if (evt.touches && evt.touches.length > 0) {
            clientX = evt.touches[0].clientX;
            clientY = evt.touches[0].clientY;
        } else {
            clientX = evt.clientX;
            clientY = evt.clientY;
        }
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    function startDrawing(e) {
        e.preventDefault();
        isDrawing = true;
        const pos = getMousePos(canvas, e);
        startX = pos.x;
        startY = pos.y;
    }

    function draw(e) {
        e.preventDefault();
        if (!isDrawing) return;

        const pos = getMousePos(canvas, e);
        redrawShapes();

        ctx.beginPath();
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentStrokeWidth; // Use currentStrokeWidth

        switch (currentTool) {
            case 'line':
                ctx.moveTo(startX, startY);
                ctx.lineTo(pos.x, pos.y);
                break;
            case 'rect':
                ctx.rect(startX, startY, pos.x - startX, pos.y - startY);
                break;
            case 'circle':
                const radius = Math.sqrt(Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2));
                ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
                break;
        }
        ctx.stroke();
    }

    function stopDrawing(e) {
        e.preventDefault();
        if (!isDrawing) return;
        isDrawing = false;
        const pos = getMousePos(canvas, e.changedTouches ? e.changedTouches[0] : e);

        let shapeData = {
            tool: currentTool,
            color: currentColor,
            lineWidth: currentStrokeWidth, // Store lineWidth
            x1: startX,
            y1: startY
        };

        if (currentTool === 'line') {
            shapeData.x2 = pos.x;
            shapeData.y2 = pos.y;
        } else if (currentTool === 'rect') {
            shapeData.width = pos.x - startX;
            shapeData.height = pos.y - startY;
        } else if (currentTool === 'circle') {
            shapeData.radius = Math.sqrt(Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2));
        }
        shapes.push(shapeData);
        redrawShapes();
    }

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', () => {
      if (isDrawing) {
        isDrawing = false;
        redrawShapes();
      }
    });

    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', () => { isDrawing = false; redrawShapes(); });

    function redrawShapes() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        shapes.forEach(shape => {
            ctx.beginPath();
            ctx.strokeStyle = shape.color;
            ctx.lineWidth = shape.lineWidth || 2; // Use shape's lineWidth or default

            switch (shape.tool) {
                case 'line':
                    ctx.moveTo(shape.x1, shape.y1);
                    ctx.lineTo(shape.x2, shape.y2);
                    break;
                case 'rect':
                    ctx.rect(shape.x1, shape.y1, shape.width, shape.height);
                    break;
                case 'circle':
                    ctx.arc(shape.x1, shape.y1, shape.radius, 0, 2 * Math.PI);
                    break;
            }
            ctx.stroke();
        });
    }

    document.getElementById('clear-canvas').addEventListener('click', () => {
        shapes = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    document.getElementById('save-svg').addEventListener('click', () => {
        let svgContent = `<svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">\n`;
        svgContent += `  <rect width="100%" height="100%" fill="#fff"/>\n`;

        shapes.forEach(shape => {
            const strokeW = shape.lineWidth || 2; // Use shape's lineWidth or default
            switch (shape.tool) {
                case 'line':
                    svgContent += `  <line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" stroke="${shape.color}" stroke-width="${strokeW}"/>\n`;
                    break;
                case 'rect':
                    let x = shape.x1;
                    let y = shape.y1;
                    let w = shape.width;
                    let h = shape.height;
                    if (w < 0) { x = shape.x1 + w; w = -w; }
                    if (h < 0) { y = shape.y1 + h; h = -h; }
                    svgContent += `  <rect x="${x}" y="${y}" width="${w}" height="${h}" stroke="${shape.color}" stroke-width="${strokeW}" fill="none"/>\n`;
                    break;
                case 'circle':
                    svgContent += `  <circle cx="${shape.x1}" cy="${shape.y1}" r="${shape.radius}" stroke="${shape.color}" stroke-width="${strokeW}" fill="none"/>\n`;
                    break;
            }
        });

        svgContent += '</svg>';

        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'drawing.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // --- Load SVG ---
    loadSvgButton.addEventListener('click', () => {
        loadSvgInput.click(); // Trigger the hidden file input
    });

    loadSvgInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        if (file.type !== "image/svg+xml") {
            alert("Please select an SVG file.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const svgString = e.target.result;
            parseAndLoadSVG(svgString);
            loadSvgInput.value = ''; // Reset file input for same file selection
        };
        reader.onerror = (e) => {
            console.error("Error reading file:", e);
            alert("Error reading SVG file.");
        };
        reader.readAsText(file);
    });

    function parseAndLoadSVG(svgString) {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
        const svgElement = svgDoc.documentElement;

        if (svgElement.tagName.toLowerCase() !== 'svg' || svgDoc.getElementsByTagName("parsererror").length > 0) {
            console.error("Invalid SVG file or parsing error.");
            alert("Could not parse SVG file. It might be invalid or contain errors.");
            return;
        }

        // Optional: Clear existing shapes or append? For now, let's clear.
        shapes = [];

        // Attempt to match SVG viewBox or width/height to canvas size if needed (more advanced)
        // For now, we assume coordinates are absolute and fit.

        Array.from(svgElement.children).forEach(element => {
            let shapeData = null;
            const stroke = element.getAttribute('stroke') || currentColor; // Default to current if not specified
            const strokeWidth = parseFloat(element.getAttribute('stroke-width')) || currentStrokeWidth; // Default

            // Ignore fill for now, or set to 'none' if desired
            // const fill = element.getAttribute('fill');

            switch (element.tagName.toLowerCase()) {
                case 'line':
                    shapeData = {
                        tool: 'line',
                        color: stroke,
                        lineWidth: strokeWidth,
                        x1: parseFloat(element.getAttribute('x1')),
                        y1: parseFloat(element.getAttribute('y1')),
                        x2: parseFloat(element.getAttribute('x2')),
                        y2: parseFloat(element.getAttribute('y2'))
                    };
                    break;
                case 'rect':
                    // SVG rect can have negative width/height if x/y are not top-left.
                    // Our system expects x1,y1 to be top-left and positive width/height for drawing.
                    // However, our save function already handles negative width/height for rect.
                    // For loading, we'll store them as is from SVG and let redraw/save handle normalization.
                    let x = parseFloat(element.getAttribute('x')) || 0;
                    let y = parseFloat(element.getAttribute('y')) || 0;
                    let w = parseFloat(element.getAttribute('width'));
                    let h = parseFloat(element.getAttribute('height'));

                    shapeData = {
                        tool: 'rect',
                        color: stroke,
                        lineWidth: strokeWidth,
                        x1: x,
                        y1: y,
                        width: w,
                        height: h
                    };
                    break;
                case 'circle':
                    shapeData = {
                        tool: 'circle',
                        color: stroke,
                        lineWidth: strokeWidth,
                        x1: parseFloat(element.getAttribute('cx')), // Our x1 is SVG's cx
                        y1: parseFloat(element.getAttribute('cy')), // Our y1 is SVG's cy
                        radius: parseFloat(element.getAttribute('r'))
                    };
                    break;
                // TODO: Add support for ellipse, polyline, polygon, path (path is complex)
            }

            if (shapeData) {
                // Basic validation: check for NaN coordinates
                let valid = true;
                for (const key in shapeData) {
                    if (typeof shapeData[key] === 'number' && isNaN(shapeData[key])) {
                        valid = false;
                        console.warn("Skipping shape due to NaN attribute:", element.tagName, key, element);
                        break;
                    }
                }
                if (valid) {
                    shapes.push(shapeData);
                }
            } else {
                console.log("Unsupported SVG element:", element.tagName);
            }
        });

        redrawShapes();
        alert("SVG loaded successfully!");
    }
});