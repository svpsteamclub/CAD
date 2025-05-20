document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    const toolbar = document.querySelector('.toolbar');
    const colorPicker = document.getElementById('color-picker');
    const strokeWidthPicker = document.getElementById('stroke-width-picker');
    const loadSvgInput = document.getElementById('load-svg-input');
    const loadSvgButton = document.getElementById('load-svg-button');
    const statusMessage = document.getElementById('status-message');

    let currentTool = 'line';
    let isDrawing = false;
    let startX, startY;
    let shapes = [];
    let currentColor = '#000000';
    let currentStrokeWidth = 2;

    let isPlacingSvgMode = false;
    let loadedSvgObject = null;
    let placementAnchorPos = null;
    let isDraggingForPlacement = false;

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

    function resizeCanvas() {
        const toolbarHeight = toolbar.offsetHeight + 20;
        canvas.width = window.innerWidth * 0.95;
        canvas.height = (window.innerHeight - toolbarHeight) * 0.95;
        redrawShapes();
        if (isPlacingSvgMode && isDraggingForPlacement && placementAnchorPos && loadedSvgObject) {
            // If resizing while placement is active, redraw preview (using a dummy currentMousePos for now)
            // This is a simplification; a more robust solution would store the last mouse pos.
            // For now, just ensure the canvas is cleared and permanent shapes are redrawn.
        }
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const toolButtons = document.querySelectorAll('.tool-button');
    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (isPlacingSvgMode) return;
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

    function handleMouseDown(e) {
        e.preventDefault();
        const pos = getMousePos(canvas, e);

        if (isPlacingSvgMode) {
            if (!loadedSvgObject) return;
            placementAnchorPos = { x: pos.x, y: pos.y };
            isDraggingForPlacement = true;
            showStatus("Drag to size, release to place.");
        } else {
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
            redrawShapes();
            drawPlacementPreview(currentPos);
        } else {
            if (!isDrawing) return;
            const pos = getMousePos(canvas, e);
            redrawShapes();

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
            setPlacingSvgMode(false);
        } else {
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
            // For now, we don't cancel automatically. User must release mouse button.
        } else {
            if (isDrawing) {
                isDrawing = false;
                redrawShapes();
            }
        }
    }

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseout', handleMouseOut);

    canvas.addEventListener('touchstart', handleMouseDown);
    canvas.addEventListener('touchmove', handleMouseMove);
    canvas.addEventListener('touchend', handleMouseUp);
    canvas.addEventListener('touchcancel', () => {
        if (isPlacingSvgMode) {
            // If a touch is cancelled, consider resetting placement mode or handling appropriately
            // For simplicity, we currently let touchend handle finalization.
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

    function drawPlacementPreview(currentMousePos) {
        if (!loadedSvgObject || !placementAnchorPos) return;

        const targetWidth = Math.abs(currentMousePos.x - placementAnchorPos.x);
        if (targetWidth < 1 && loadedSvgObject.originalWidth > 0) return;

        let scale = 1;
        if (loadedSvgObject.originalWidth > 0) {
            scale = targetWidth / loadedSvgObject.originalWidth;
        } else {
            const targetHeight = Math.abs(currentMousePos.y - placementAnchorPos.y);
            if (loadedSvgObject.originalHeight > 0) {
                scale = targetHeight / loadedSvgObject.originalHeight;
            } else {
                 scale = 1; // Default scale if SVG has no dimensions
            }
        }
        if (scale <= 0) scale = 0.001; // Prevent zero/negative scale

        const actualAnchorX = (currentMousePos.x < placementAnchorPos.x) ? currentMousePos.x : placementAnchorPos.x;
        const actualAnchorY = (currentMousePos.y < placementAnchorPos.y) ? currentMousePos.y : placementAnchorPos.y;
        // More precise placement logic based on how aspect ratio scaling works:
        // If dragging left/up, the opposite corner (from anchor) moves, so placementAnchorPos is still the reference for top-left
        // but the width/height calculation influences the scale.
        // The current `actualAnchorX` and `actualAnchorY` try to make the dragged rect fill the space.
        // Let's simplify the anchor for preview to be consistent, and let scale handle size.
        // The starting point for drawing the scaled SVG relative to `placementAnchorPos` needs to be adjusted if dragging up/left
        // to maintain the aspect ratio correctly.

        let previewAnchorX = placementAnchorPos.x;
        let previewAnchorY = placementAnchorPos.y;
        const scaledWidth = loadedSvgObject.originalWidth * scale;
        const scaledHeight = loadedSvgObject.originalHeight * scale;

        if (currentMousePos.x < placementAnchorPos.x) {
            previewAnchorX = placementAnchorPos.x - scaledWidth;
        }
        if (currentMousePos.y < placementAnchorPos.y) {
            previewAnchorY = placementAnchorPos.y - scaledHeight;
        }


        ctx.save();
        // ctx.strokeStyle = 'rgba(0,0,255,0.5)'; // Global preview stroke for testing

        loadedSvgObject.originalShapes.forEach(shape => {
            ctx.beginPath();
            ctx.strokeStyle = shape.color || 'rgba(0,0,255,0.5)'; // Use shape's color or fallback
            ctx.lineWidth = Math.max(1, (shape.lineWidth || 2) * scale); // Ensure lineWidth is at least 1

            const normX = (val) => (val - loadedSvgObject.originalMinX);
            const normY = (val) => (val - loadedSvgObject.originalMinY);

            switch (shape.tool) {
                case 'line':
                    ctx.moveTo(previewAnchorX + normX(shape.x1) * scale, previewAnchorY + normY(shape.y1) * scale);
                    ctx.lineTo(previewAnchorX + normX(shape.x2) * scale, previewAnchorY + normY(shape.y2) * scale);
                    break;
                case 'rect':
                    ctx.rect(
                        previewAnchorX + normX(shape.x) * scale,
                        previewAnchorY + normY(shape.y) * scale,
                        shape.width * scale,
                        shape.height * scale
                    );
                    break;
                case 'circle':
                    ctx.arc(
                        previewAnchorX + normX(shape.cx) * scale,
                        previewAnchorY + normY(shape.cy) * scale,
                        shape.r * scale,
                        0, 2 * Math.PI
                    );
                    break;
            }
            ctx.stroke();
        });
        ctx.restore();
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
        if (scale <= 0) scale = 0.001;

        let finalAnchorX = placementAnchorPos.x;
        let finalAnchorY = placementAnchorPos.y;
        const scaledWidth = loadedSvgObject.originalWidth * scale;
        const scaledHeight = loadedSvgObject.originalHeight * scale;

        if (finalMousePos.x < placementAnchorPos.x) {
            finalAnchorX = placementAnchorPos.x - scaledWidth;
        }
        if (finalMousePos.y < placementAnchorPos.y) {
            finalAnchorY = placementAnchorPos.y - scaledHeight;
        }

        loadedSvgObject.originalShapes.forEach(shape => {
            const newShape = {
                tool: shape.tool,
                color: shape.color,
                lineWidth: Math.max(1, (shape.lineWidth || 2) * scale)
            };

            const normX = (val) => (val - loadedSvgObject.originalMinX);
            const normY = (val) => (val - loadedSvgObject.originalMinY);

            switch (shape.tool) {
                case 'line':
                    newShape.x1 = finalAnchorX + normX(shape.x1) * scale;
                    newShape.y1 = finalAnchorY + normY(shape.y1) * scale;
                    newShape.x2 = finalAnchorX + normX(shape.x2) * scale;
                    newShape.y2 = finalAnchorY + normY(shape.y2) * scale;
                    break;
                case 'rect':
                    newShape.x1 = finalAnchorX + normX(shape.x) * scale;
                    newShape.y1 = finalAnchorY + normY(shape.y) * scale;
                    newShape.width = shape.width * scale;
                    newShape.height = shape.height * scale;
                    break;
                case 'circle':
                    newShape.x1 = finalAnchorX + normX(shape.cx) * scale;
                    newShape.y1 = finalAnchorY + normY(shape.cy) * scale;
                    newShape.radius = shape.r * scale;
                    break;
            }
            shapes.push(newShape);
        });
        redrawShapes();
    }

    loadSvgButton.addEventListener('click', () => {
        if (isPlacingSvgMode) {
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

    function parseFloatAttr(element, attrName, defaultValue = NaN) {
        const valStr = element.getAttribute(attrName);
        if (valStr === null) {
            if ((attrName === 'x' || attrName === 'y') && element.tagName.toLowerCase() === 'rect') return 0;
            if ((attrName === 'cx' || attrName === 'cy' || attrName === 'r') && element.tagName.toLowerCase() === 'circle') return 0; // SVG spec default 0 for cx,cy,r
            console.warn(`Attribute '${attrName}' missing on <${element.tagName}>. Using default/NaN.`);
            return defaultValue;
        }
        const val = parseFloat(valStr);
        if (isNaN(val)) {
            console.error(`Attribute '${attrName}' on <${element.tagName}> has non-numeric value: "${valStr}". Using NaN.`);
            return NaN;
        }
        return val;
    }

    function processSvgElement(element, shapesArray, bounds) {
        let shapeData = null;
        const stroke = element.getAttribute('stroke') || '#000000';
        let strokeWidth = parseFloatAttr(element, 'stroke-width', 2);
        if (isNaN(strokeWidth) || strokeWidth <= 0) strokeWidth = 2;

        console.log(`Processing SVG element: <${element.tagName.toLowerCase()}>`);

        let elMinX = Infinity, elMinY = Infinity, elMaxX = -Infinity, elMaxY = -Infinity;
        let hasNaN = false;

        switch (element.tagName.toLowerCase()) {
            case 'line':
                const x1 = parseFloatAttr(element, 'x1');
                const y1 = parseFloatAttr(element, 'y1');
                const x2 = parseFloatAttr(element, 'x2');
                const y2 = parseFloatAttr(element, 'y2');
                if ([x1, y1, x2, y2].some(isNaN)) { hasNaN = true; break; }
                shapeData = { tool: 'line', color: stroke, lineWidth: strokeWidth, x1, y1, x2, y2 };
                elMinX = Math.min(x1, x2); elMaxX = Math.max(x1, x2);
                elMinY = Math.min(y1, y2); elMaxY = Math.max(y1, y2);
                break;
            case 'rect':
                const x = parseFloatAttr(element, 'x');
                const y = parseFloatAttr(element, 'y');
                const width = parseFloatAttr(element, 'width');
                const height = parseFloatAttr(element, 'height');
                if ([x, y, width, height].some(isNaN)) { hasNaN = true; break; }
                shapeData = { tool: 'rect', color: stroke, lineWidth: strokeWidth, x, y, width, height };
                elMinX = width < 0 ? x + width : x; elMaxX = width < 0 ? x : x + width;
                elMinY = height < 0 ? y + height : y; elMaxY = height < 0 ? y : y + height;
                break;
            case 'circle':
                const cx = parseFloatAttr(element, 'cx');
                const cy = parseFloatAttr(element, 'cy');
                const r = parseFloatAttr(element, 'r');
                if ([cx, cy, r].some(isNaN)) { hasNaN = true; break; }
                if (r < 0) { console.error(`Circle 'r' is negative on <${element.tagName}>.`); hasNaN = true; break; }
                shapeData = { tool: 'circle', color: stroke, lineWidth: strokeWidth, cx, cy, r };
                elMinX = cx - r; elMaxX = cx + r;
                elMinY = cy - r; elMaxY = cy + r;
                break;
            case 'g':
                console.log("Found <g> element, processing its children...");
                Array.from(element.children).forEach(child => {
                    processSvgElement(child, shapesArray, bounds);
                });
                return;
            default:
                console.log(`Unsupported SVG element type: <${element.tagName.toLowerCase()}>. Skipping.`);
        }

        if (hasNaN) {
            console.warn(`Skipping <${element.tagName.toLowerCase()}> due to missing/invalid essential attributes.`);
            return;
        }

        if (shapeData) {
            shapesArray.push(shapeData);
            bounds.minX = Math.min(bounds.minX, elMinX);
            bounds.minY = Math.min(bounds.minY, elMinY);
            bounds.maxX = Math.max(bounds.maxX, elMaxX);
            bounds.maxY = Math.max(bounds.maxY, elMaxY);
            console.log("Successfully processed and added shape:", shapeData);
        }
    }

    function prepareSvgForPlacement(svgString) {
        console.log("Attempting to parse SVG string...");
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
        const svgElement = svgDoc.documentElement;

        const parserError = svgDoc.getElementsByTagName("parsererror");
        if (svgElement.tagName.toLowerCase() !== 'svg' || (parserError && parserError.length > 0)) {
            const errorDetails = parserError.length > 0 ? parserError[0].textContent : "Root element not <svg>";
            console.error("SVG parsing error:", errorDetails);
            alert(`Could not parse SVG file. Error: ${errorDetails.substring(0,100)}...`);
            return;
        }

        let tempShapes = [];
        let bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

        console.log("Starting SVG element processing on children of <svg>...");
        Array.from(svgElement.children).forEach(element => {
            processSvgElement(element, tempShapes, bounds);
        });

        console.log(`Finished SVG processing. Found ${tempShapes.length} supported shapes.`);
        console.log("Calculated original bounds:", JSON.stringify(bounds));

        if (tempShapes.length === 0) {
            alert("No supported shapes (line, rect, circle) found in SVG. Check console for details.");
            return;
        }

        loadedSvgObject = {
            originalShapes: tempShapes,
            originalMinX: bounds.minX === Infinity ? 0 : bounds.minX,
            originalMinY: bounds.minY === Infinity ? 0 : bounds.minY,
            originalWidth: (bounds.maxX === -Infinity || bounds.minX === Infinity) ? 0 : bounds.maxX - bounds.minX,
            originalHeight: (bounds.maxY === -Infinity || bounds.minY === Infinity) ? 0 : bounds.maxY - bounds.minY,
        };

        if (loadedSvgObject.originalWidth <= 0 && loadedSvgObject.originalHeight <= 0 && tempShapes.length > 0) {
             console.warn("SVG content has zero effective width/height. Using default 10x10 for placement.");
             loadedSvgObject.originalWidth = Math.max(1, loadedSvgObject.originalWidth); // Ensure at least 1 if calculated as 0 but has shapes
             loadedSvgObject.originalHeight = Math.max(1, loadedSvgObject.originalHeight);
             if (loadedSvgObject.originalWidth <=0) loadedSvgObject.originalWidth = 10;
             if (loadedSvgObject.originalHeight <=0) loadedSvgObject.originalHeight = 10;
        } else {
             loadedSvgObject.originalWidth = Math.max(0, loadedSvgObject.originalWidth);
             loadedSvgObject.originalHeight = Math.max(0, loadedSvgObject.originalHeight);
        }


        console.log("Prepared loadedSvgObject for placement:", loadedSvgObject);
        setPlacingSvgMode(true);
    }


    document.getElementById('clear-canvas').addEventListener('click', () => {
        if (isPlacingSvgMode) {
            setPlacingSvgMode(false);
        }
        shapes = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    document.getElementById('save-svg').addEventListener('click', () => {
        let svgContent = `<svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">\n`;
        svgContent += `  <rect width="100%" height="100%" fill="#fff"/>\n`; // Background

        shapes.forEach(shape => {
            const strokeW = shape.lineWidth || 2;
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
});