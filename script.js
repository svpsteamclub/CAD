document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    const toolbar = document.querySelector('.toolbar');
    const colorPicker = document.getElementById('color-picker');
    const strokeWidthPicker = document.getElementById('stroke-width-picker');
    const loadSvgInput = document.getElementById('load-svg-input');
    const loadSvgButton = document.getElementById('load-svg-button');
    const statusMessage = document.getElementById('status-message'); // New

    let currentTool = 'line';
    let isDrawing = false; // For regular drawing
    let startX, startY;
    let shapes = [];
    let currentColor = '#000000';
    let currentStrokeWidth = 2;

    // --- SVG Placement State ---
    let isPlacingSvgMode = false;
    let loadedSvgObject = null; // { originalShapes: [], originalWidth, originalHeight, originalMinX, originalMinY }
    let placementAnchorPos = null; // {x, y} - first click position
    let isDraggingForPlacement = false; // True while dragging to size the SVG

    function showStatus(message) {
        statusMessage.textContent = message;
        statusMessage.style.display = message ? 'block' : 'none';
    }

    function setPlacingSvgMode(active) {
        isPlacingSvgMode = active;
        if (active) {
            document.body.classList.add('placing-svg-mode');
            showStatus("SVG loaded. Click and drag on canvas to place and size.");
        } else {
            document.body.classList.remove('placing-svg-mode');
            showStatus("");
            loadedSvgObject = null;
            placementAnchorPos = null;
            isDraggingForPlacement = false;
        }
    }

    // ... (resizeCanvas, tool selection, color/stroke pickers, getMousePos - largely unchanged) ...
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
            if (isPlacingSvgMode) return; // Don't change tool during SVG placement
            toolButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentTool = button.dataset.tool;
        });
    });

    colorPicker.addEventListener('input', (e) => {
        currentColor = e.target.value;
    });

    strokeWidthPicker.addEventListener('input', (e) => {
        currentStrokeWidth = parseInt(e.target.value, 10);
        if (currentStrokeWidth < 1) currentStrokeWidth = 1;
        if (currentStrokeWidth > 50) currentStrokeWidth = 50;
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


    // --- Drawing Event Handlers (Modified for Placement Mode) ---
    function handleMouseDown(e) {
        e.preventDefault();
        const pos = getMousePos(canvas, e);

        if (isPlacingSvgMode) {
            if (!loadedSvgObject) return;
            placementAnchorPos = { x: pos.x, y: pos.y };
            isDraggingForPlacement = true;
            showStatus("Drag to size, release to place.");
        } else { // Regular drawing
            isDrawing = true;
            startX = pos.x;
            startY = pos.y;
        }
    }

    function handleMouseMove(e) {
        e.preventDefault();
        if (isPlacingSvgMode) {
            if (!isDraggingForPlacement || !placementAnchorPos || !loadedSvgObject) return;
            const currentPos = getMousePos(canvas, e);
            redrawShapes(); // Redraw existing permanent shapes
            drawPlacementPreview(currentPos);
        } else { // Regular drawing
            if (!isDrawing) return;
            const pos = getMousePos(canvas, e);
            redrawShapes(); // Clear and redraw previous shapes for preview

            ctx.beginPath();
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = currentStrokeWidth;

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
    }

    function handleMouseUp(e) {
        e.preventDefault();
        if (isPlacingSvgMode) {
            if (!isDraggingForPlacement || !placementAnchorPos || !loadedSvgObject) return;
            const finalPos = getMousePos(canvas, e.changedTouches ? e.changedTouches[0] : e);
            finalizeSvgPlacement(finalPos);
            setPlacingSvgMode(false); // Exit placement mode
        } else { // Regular drawing
            if (!isDrawing) return;
            isDrawing = false;
            const pos = getMousePos(canvas, e.changedTouches ? e.changedTouches[0] : e);

            let shapeData = {
                tool: currentTool,
                color: currentColor,
                lineWidth: currentStrokeWidth,
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
    }

    function handleMouseOut(e) {
        if (isPlacingSvgMode) {
            // Optional: Cancel placement if mouse leaves canvas while dragging
            // if (isDraggingForPlacement) {
            //     setPlacingSvgMode(false);
            //     redrawShapes();
            //     showStatus("Placement cancelled.");
            // }
        } else {
            if (isDrawing) {
                isDrawing = false; // Stop drawing if mouse leaves
                redrawShapes(); // Redraw committed shapes
            }
        }
    }

    // Mouse events
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseout', handleMouseOut);

    // Touch events
    canvas.addEventListener('touchstart', handleMouseDown);
    canvas.addEventListener('touchmove', handleMouseMove);
    canvas.addEventListener('touchend', handleMouseUp);
    canvas.addEventListener('touchcancel', () => {
        if (isPlacingSvgMode) {
            // setPlacingSvgMode(false); // Or handle as needed
        } else {
            isDrawing = false;
        }
        redrawShapes();
    });


    function redrawShapes() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        shapes.forEach(shape => {
            ctx.beginPath();
            ctx.strokeStyle = shape.color;
            ctx.lineWidth = shape.lineWidth || 2;

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

    // --- SVG Placement Drawing ---
    function drawPlacementPreview(currentMousePos) {
        if (!loadedSvgObject || !placementAnchorPos) return;

        const targetWidth = Math.abs(currentMousePos.x - placementAnchorPos.x);
        if (targetWidth < 1) return; // Avoid division by zero or tiny scale

        let scale = 1;
        if (loadedSvgObject.originalWidth > 0) {
            scale = targetWidth / loadedSvgObject.originalWidth;
        } else { // Handle case where originalWidth is 0 (e.g. vertical line)
            const targetHeight = Math.abs(currentMousePos.y - placementAnchorPos.y);
            if (loadedSvgObject.originalHeight > 0) {
                scale = targetHeight / loadedSvgObject.originalHeight;
            } else {
                 scale = 1; // Or some default if both are 0
            }
        }
        if (scale <= 0) scale = 0.01; // Prevent zero or negative scale

        // Determine actual top-left for placement (handles dragging in any direction)
        const placeX = Math.min(placementAnchorPos.x, currentMousePos.x);
        const placeY = (currentMousePos.x < placementAnchorPos.x || currentMousePos.y < placementAnchorPos.y) && loadedSvgObject.originalWidth > 0 ?
                       placementAnchorPos.y - (loadedSvgObject.originalHeight * scale) * Math.sign(currentMousePos.x - placementAnchorPos.x) * Math.sign(loadedSvgObject.originalWidth) :
                       placementAnchorPos.y;
        // Simplified Y for now, assuming drag mostly right-down.
        // A more robust solution would consider all drag directions for the top-left corner.
        // For now, let's use placementAnchorPos.x and adjust based on width calculation.
        let actualAnchorX = placementAnchorPos.x;
        if(currentMousePos.x < placementAnchorPos.x) { // dragging left
            actualAnchorX = currentMousePos.x;
        }


        ctx.save(); // Save current context state
        ctx.strokeStyle = 'rgba(0,0,255,0.5)'; // Preview color

        loadedSvgObject.originalShapes.forEach(shape => {
            ctx.beginPath();
            ctx.strokeStyle = shape.color || 'rgba(0,0,255,0.5)'; // Use shape's color or preview
            ctx.lineWidth = (shape.lineWidth || 2) * scale; // Scale line width

            // Normalized coordinates are relative to originalMinX, originalMinY
            // We need to translate them to placementAnchorPos, then scale
            const normX = (val) => (val - loadedSvgObject.originalMinX);
            const normY = (val) => (val - loadedSvgObject.originalMinY);

            switch (shape.tool) {
                case 'line':
                    ctx.moveTo(actualAnchorX + normX(shape.x1) * scale, placementAnchorPos.y + normY(shape.y1) * scale);
                    ctx.lineTo(actualAnchorX + normX(shape.x2) * scale, placementAnchorPos.y + normY(shape.y2) * scale);
                    break;
                case 'rect':
                    ctx.rect(
                        actualAnchorX + normX(shape.x) * scale,
                        placementAnchorPos.y + normY(shape.y) * scale,
                        shape.width * scale,
                        shape.height * scale
                    );
                    break;
                case 'circle':
                    ctx.arc(
                        actualAnchorX + normX(shape.cx) * scale,
                        placementAnchorPos.y + normY(shape.cy) * scale,
                        shape.r * scale,
                        0, 2 * Math.PI
                    );
                    break;
            }
            ctx.stroke();
        });
        ctx.restore(); // Restore context state
    }

    function finalizeSvgPlacement(finalMousePos) {
        if (!loadedSvgObject || !placementAnchorPos) return;

        const targetWidth = Math.abs(finalMousePos.x - placementAnchorPos.x);
        let scale = 1;
        if (loadedSvgObject.originalWidth > 0) {
            scale = targetWidth / loadedSvgObject.originalWidth;
        } else {
            const targetHeight = Math.abs(finalMousePos.y - placementAnchorPos.y);
            if (loadedSvgObject.originalHeight > 0) {
                scale = targetHeight / loadedSvgObject.originalHeight;
            } else {
                scale = 1;
            }
        }
        if (scale <= 0) scale = 0.01;

        let actualAnchorX = placementAnchorPos.x;
        if(finalMousePos.x < placementAnchorPos.x) { // dragging left
            actualAnchorX = finalMousePos.x;
        }

        loadedSvgObject.originalShapes.forEach(shape => {
            const newShape = {
                tool: shape.tool,
                color: shape.color, // Retain original color
                lineWidth: (shape.lineWidth || 2) * scale // Scale lineWidth
            };

            const normX = (val) => (val - loadedSvgObject.originalMinX);
            const normY = (val) => (val - loadedSvgObject.originalMinY);

            switch (shape.tool) {
                case 'line':
                    newShape.x1 = actualAnchorX + normX(shape.x1) * scale;
                    newShape.y1 = placementAnchorPos.y + normY(shape.y1) * scale;
                    newShape.x2 = actualAnchorX + normX(shape.x2) * scale;
                    newShape.y2 = placementAnchorPos.y + normY(shape.y2) * scale;
                    break;
                case 'rect':
                    newShape.x1 = actualAnchorX + normX(shape.x) * scale; // Store as x1 for consistency
                    newShape.y1 = placementAnchorPos.y + normY(shape.y) * scale; // Store as y1
                    newShape.width = shape.width * scale;
                    newShape.height = shape.height * scale;
                    break;
                case 'circle':
                    newShape.x1 = actualAnchorX + normX(shape.cx) * scale; // Store as x1 (center)
                    newShape.y1 = placementAnchorPos.y + normY(shape.cy) * scale; // Store as y1 (center)
                    newShape.radius = shape.r * scale;
                    break;
            }
            shapes.push(newShape);
        });
        redrawShapes();
    }


    // --- SVG Loading and Parsing ---
    loadSvgButton.addEventListener('click', () => {
        if (isPlacingSvgMode) { // If already in placement mode, cancel it first
            setPlacingSvgMode(false);
            redrawShapes();
        }
        loadSvgInput.click();
    });

    loadSvgInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        if (file.type !== "image/svg+xml") {
            alert("Please select an SVG file.");
            loadSvgInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const svgString = e.target.result;
            prepareSvgForPlacement(svgString);
            loadSvgInput.value = '';
        };
        reader.onerror = (e) => {
            console.error("Error reading file:", e);
            alert("Error reading SVG file.");
            loadSvgInput.value = '';
        };
        reader.readAsText(file);
    });

    function prepareSvgForPlacement(svgString) {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
        const svgElement = svgDoc.documentElement;

        if (svgElement.tagName.toLowerCase() !== 'svg' || svgDoc.getElementsByTagName("parsererror").length > 0) {
            alert("Could not parse SVG file.");
            return;
        }

        let tempShapes = [];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        Array.from(svgElement.children).forEach(element => {
            let shapeData = null;
            const stroke = element.getAttribute('stroke') || '#000000';
            const strokeWidth = parseFloat(element.getAttribute('stroke-width')) || 2;
            let elMinX = Infinity, elMinY = Infinity, elMaxX = -Infinity, elMaxY = -Infinity;

            switch (element.tagName.toLowerCase()) {
                case 'line':
                    const x1 = parseFloat(element.getAttribute('x1'));
                    const y1 = parseFloat(element.getAttribute('y1'));
                    const x2 = parseFloat(element.getAttribute('x2'));
                    const y2 = parseFloat(element.getAttribute('y2'));
                    if ([x1,y1,x2,y2].some(isNaN)) break;
                    shapeData = { tool: 'line', color: stroke, lineWidth: strokeWidth, x1, y1, x2, y2 };
                    elMinX = Math.min(x1, x2); elMaxX = Math.max(x1, x2);
                    elMinY = Math.min(y1, y2); elMaxY = Math.max(y1, y2);
                    break;
                case 'rect':
                    const x = parseFloat(element.getAttribute('x')) || 0;
                    const y = parseFloat(element.getAttribute('y')) || 0;
                    const width = parseFloat(element.getAttribute('width'));
                    const height = parseFloat(element.getAttribute('height'));
                    if ([x,y,width,height].some(isNaN)) break;
                    shapeData = { tool: 'rect', color: stroke, lineWidth: strokeWidth, x, y, width, height };
                    elMinX = x; elMaxX = x + width;
                    elMinY = y; elMaxY = y + height;
                    if (width < 0) { elMinX = x + width; elMaxX = x; } // Handle negative width/height
                    if (height < 0) { elMinY = y + height; elMaxY = y; }
                    break;
                case 'circle':
                    const cx = parseFloat(element.getAttribute('cx'));
                    const cy = parseFloat(element.getAttribute('cy'));
                    const r = parseFloat(element.getAttribute('r'));
                    if ([cx,cy,r].some(isNaN) || r < 0) break;
                    shapeData = { tool: 'circle', color: stroke, lineWidth: strokeWidth, cx, cy, r };
                    elMinX = cx - r; elMaxX = cx + r;
                    elMinY = cy - r; elMaxY = cy + r;
                    break;
            }

            if (shapeData) {
                tempShapes.push(shapeData);
                minX = Math.min(minX, elMinX);
                minY = Math.min(minY, elMinY);
                maxX = Math.max(maxX, elMaxX);
                maxY = Math.max(maxY, elMaxY);
            }
        });

        if (tempShapes.length === 0) {
            alert("No supported shapes found in SVG.");
            return;
        }

        loadedSvgObject = {
            originalShapes: tempShapes,
            originalMinX: minX === Infinity ? 0 : minX,
            originalMinY: minY === Infinity ? 0 : minY,
            originalWidth: (maxX === -Infinity || minX === Infinity) ? 0 : maxX - minX,
            originalHeight: (maxY === -Infinity || minY === Infinity) ? 0 : maxY - minY,
        };

        if (loadedSvgObject.originalWidth <= 0 && loadedSvgObject.originalHeight <= 0 && tempShapes.length > 0) {
            // If all elements are points or have zero dimension, give a default small size for placement
             loadedSvgObject.originalWidth = 10;
             loadedSvgObject.originalHeight = 10;
        }


        setPlacingSvgMode(true);
    }

    // --- Clear and Save ---
    document.getElementById('clear-canvas').addEventListener('click', () => {
        if (isPlacingSvgMode) {
            setPlacingSvgMode(false); // Exit placement mode if active
        }
        shapes = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    document.getElementById('save-svg').addEventListener('click', () => {
        // ... (save SVG logic remains the same as before, ensuring it uses shape.lineWidth)
        let svgContent = `<svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">\n`;
        svgContent += `  <rect width="100%" height="100%" fill="#fff"/>\n`;

        shapes.forEach(shape => {
            const strokeW = shape.lineWidth || 2;
            switch (shape.tool) {
                case 'line':
                    svgContent += `  <line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" stroke="${shape.color}" stroke-width="${strokeW}"/>\n`;
                    break;
                case 'rect':
                    let x = shape.x1; // SVG rect x is top-left
                    let y = shape.y1; // SVG rect y is top-left
                    let w = shape.width;
                    let h = shape.height;
                    // Our internal rect might have x1,y1 as any corner. SVG needs positive w/h.
                    if (w < 0) { x = shape.x1 + w; w = -w; }
                    if (h < 0) { y = shape.y1 + h; h = -h; }
                    svgContent += `  <rect x="${x}" y="${y}" width="${w}" height="${h}" stroke="${shape.color}" stroke-width="${strokeW}" fill="none"/>\n`;
                    break;
                case 'circle': // Our x1,y1 is center for circle
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
});