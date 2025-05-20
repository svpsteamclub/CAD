document.addEventListener('DOMContentLoaded', () => {
    // Initialize Fabric.js canvas
    const fabricCanvas = new fabric.Canvas('drawing-canvas', {
        isDrawingMode: false, // We'll handle drawing modes manually for specific shapes
        selection: true,      // Allow object selection
        backgroundColor: '#fff'
    });

    const toolbar = document.querySelector('.toolbar');
    const colorPicker = document.getElementById('color-picker');
    const strokeWidthPicker = document.getElementById('stroke-width-picker');
    const loadSvgInput = document.getElementById('load-svg-input');
    const loadSvgButton = document.getElementById('load-svg-button');
    const statusMessage = document.getElementById('status-message');

    let currentTool = 'line'; // 'line', 'rect', 'circle', 'select' (default Fabric mode)
    let isDrawingShape = false; // Flag for drawing our custom shapes
    let startX, startY;
    let currentShape = null; // Holds the fabric object being drawn

    let currentColor = '#000000';
    let currentStrokeWidth = 2;

    // SVG Placement State
    let isPlacingSvgMode = false;
    let loadedSvgGroup = null; // Will hold the fabric.Group of the loaded SVG
    let placementInitialScale = { x: 1, y: 1 };

    function showStatus(message) {
        statusMessage.textContent = message;
        statusMessage.style.display = message ? 'block' : 'none';
    }

    function setPlacingSvgMode(active, svgGroup = null) {
        isPlacingSvgMode = active;
        loadedSvgGroup = svgGroup;
        fabricCanvas.discardActiveObject(); // Deselect any active object

        if (active && svgGroup) {
            document.body.classList.add('placing-svg-mode');
            // Initially place the SVG slightly off-center and small for user to position
            fabricCanvas.add(svgGroup);
            fabricCanvas.centerObject(svgGroup);
            svgGroup.scaleToWidth(fabricCanvas.width * 0.3); // Initial small size
            if (svgGroup.isContainedWithinObject(fabricCanvas) === false) { // if aspect ratio makes it too tall
                 svgGroup.scaleToHeight(fabricCanvas.height * 0.3);
            }

            fabricCanvas.setActiveObject(svgGroup); // Make it selectable
            fabricCanvas.renderAll();
            showStatus("SVG loaded. Click and drag to position, use handles to resize/rotate.");
            // Switch to selection tool implicitly
            activateTool('select');
        } else {
            document.body.classList.remove('placing-svg-mode');
            showStatus("");
            if (svgGroup && !active) { // If canceling placement
                fabricCanvas.remove(svgGroup);
            }
            loadedSvgGroup = null;
        }
    }


    function resizeCanvas() {
        const canvasEl = document.getElementById('drawing-canvas');
        const toolbarHeight = toolbar.offsetHeight + 20; // Approx height of toolbar + margin
        const newWidth = window.innerWidth * 0.95;
        const newHeight = (window.innerHeight - toolbarHeight) * 0.95;

        fabricCanvas.setWidth(newWidth);
        fabricCanvas.setHeight(newHeight);
        fabricCanvas.calcOffset(); // Recalculate canvas offsets for mouse positioning
        fabricCanvas.renderAll();
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); // Initial size

    // --- Tool Selection ---
    const toolButtons = document.querySelectorAll('.tool-button');
    function activateTool(toolName) {
        toolButtons.forEach(btn => btn.classList.remove('active'));
        const activeButton = document.getElementById(`tool-${toolName}`);
        if (activeButton) {
            activeButton.classList.add('active');
        }
        currentTool = toolName;

        if (currentTool === 'select') {
            fabricCanvas.isDrawingMode = false; // Turn off freehand drawing
            fabricCanvas.selection = true; // Allow object selection
            fabricCanvas.defaultCursor = 'default';
            fabricCanvas.getObjects().forEach(obj => obj.set({selectable: true, evented: true}));
        } else {
            fabricCanvas.isDrawingMode = false; // Ensure freehand is off
            fabricCanvas.selection = false; // Disable object selection while drawing new shapes
            fabricCanvas.defaultCursor = 'crosshair';
            fabricCanvas.getObjects().forEach(obj => obj.set({selectable: false, evented: false}));
        }
        fabricCanvas.discardActiveObject().renderAll(); // Deselect any active objects
    }

    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (isPlacingSvgMode) { // Finalize SVG placement before changing tool
                if(loadedSvgGroup) fabricCanvas.setActiveObject(loadedSvgGroup); // Ensure it's active to be "kept"
                setPlacingSvgMode(false); // Exit placement mode, keeping the SVG
            }
            activateTool(button.dataset.tool);
        });
    });
    activateTool('line'); // Default tool

    // --- Color and Stroke Width ---
    colorPicker.addEventListener('input', (e) => {
        currentColor = e.target.value;
        if (fabricCanvas.getActiveObject()) {
            const activeObj = fabricCanvas.getActiveObject();
            // For complex groups (like SVGs), iterate if needed
            if (activeObj.isType('group')) {
                activeObj.getObjects().forEach(obj => {
                    if (obj.stroke) obj.set('stroke', currentColor);
                });
            } else {
                 if (activeObj.stroke) activeObj.set('stroke', currentColor);
            }
            fabricCanvas.renderAll();
        }
    });

    strokeWidthPicker.addEventListener('input', (e) => {
        currentStrokeWidth = parseInt(e.target.value, 10);
        if (currentStrokeWidth < 1) currentStrokeWidth = 1;
        if (currentStrokeWidth > 50) currentStrokeWidth = 50;
        if (fabricCanvas.getActiveObject()) {
            const activeObj = fabricCanvas.getActiveObject();
             if (activeObj.isType('group')) {
                activeObj.getObjects().forEach(obj => {
                     if (obj.strokeWidth) obj.set('strokeWidth', currentStrokeWidth);
                });
            } else {
                if (activeObj.strokeWidth) activeObj.set('strokeWidth', currentStrokeWidth);
            }
            fabricCanvas.renderAll();
        }
    });

    // --- Drawing Event Handlers (using Fabric's canvas events) ---
    fabricCanvas.on('mouse:down', (o) => {
        if (currentTool === 'select' || isPlacingSvgMode) {
             if (isPlacingSvgMode && o.target !== loadedSvgGroup) {
                // Clicked outside the SVG being placed, finalize its current state.
                setPlacingSvgMode(false, loadedSvgGroup); // keep the group
                activateTool('select'); // Switch to select tool
            }
            return; // Let Fabric handle selection/movement
        }

        isDrawingShape = true;
        const pointer = fabricCanvas.getPointer(o.e);
        startX = pointer.x;
        startY = pointer.y;

        switch (currentTool) {
            case 'line':
                const points = [startX, startY, startX, startY];
                currentShape = new fabric.Line(points, {
                    stroke: currentColor,
                    strokeWidth: currentStrokeWidth,
                    selectable: false, evented: false
                });
                break;
            case 'rect':
                currentShape = new fabric.Rect({
                    left: startX,
                    top: startY,
                    width: 0,
                    height: 0,
                    stroke: currentColor,
                    strokeWidth: currentStrokeWidth,
                    fill: 'transparent', // Or a fill color
                    selectable: false, evented: false
                });
                break;
            case 'circle':
                currentShape = new fabric.Circle({
                    left: startX,
                    top: startY,
                    radius: 0,
                    stroke: currentColor,
                    strokeWidth: currentStrokeWidth,
                    fill: 'transparent',
                    selectable: false, evented: false,
                    originX: 'left', originY: 'top' // Important for radius calc
                });
                break;
        }
        if (currentShape) {
            fabricCanvas.add(currentShape);
        }
    });

    fabricCanvas.on('mouse:move', (o) => {
        if (!isDrawingShape || !currentShape || currentTool === 'select') return;

        const pointer = fabricCanvas.getPointer(o.e);
        const endX = pointer.x;
        const endY = pointer.y;

        switch (currentTool) {
            case 'line':
                currentShape.set({ x2: endX, y2: endY });
                break;
            case 'rect':
                let width = endX - startX;
                let height = endY - startY;
                currentShape.set({
                    width: Math.abs(width),
                    height: Math.abs(height),
                    left: width > 0 ? startX : endX,
                    top: height > 0 ? startY : endY
                });
                break;
            case 'circle':
                const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)) / 2;
                // Circle's left/top in Fabric is its center if originX/Y is 'center'
                // If origin is 'left'/'top', then left/top is the bounding box corner.
                // For drawing by dragging a diameter:
                let circleLeft = Math.min(startX, endX);
                let circleTop = Math.min(startY, endY);
                let diameterX = Math.abs(endX - startX);
                let diameterY = Math.abs(endY - startY);
                let circleRadius = Math.min(diameterX, diameterY) / 2; // Make it a circle within the rect

                currentShape.set({
                    left: startX, // Use startX, startY as one corner of bounding box
                    top: startY,
                    // For a circle, radius is from center. Simpler to set width/height of bounding box
                    // then derive radius. But Fabric's Circle takes radius directly.
                    // Let's use simpler radius calculation based on distance from start for now.
                    radius: Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2))
                });
                // Correction for circle, as it's drawn from top-left of its bounding box if origin is left/top
                // The currentShape is already at startX, startY. We just update its radius.
                // To draw from center, we'd set originX/Y to 'center' and calculate radius from center.
                // For drawing by dragging corner to corner (like a rect containing the circle):
                // currentShape.set({
                //     left: (startX + endX) / 2, // Center X
                //     top: (startY + endY) / 2,  // Center Y
                //     radius: Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)) / 2,
                //     originX: 'center', originY: 'center'
                // });

                // To draw from a center point outwards (like the old canvas circle):
                // This means startX,startY IS the center.
                // currentShape.set({
                //    radius: Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2))
                // });
                // BUT if you set left/top and radius, and origin is left/top, it works like this:
                // The startX, startY is the top-left of the circle's bounding box.
                let w = endX - startX;
                let h = endY - startY;
                currentShape.set({
                    radius: Math.sqrt(w*w + h*h) / 2, // Radius is half the diagonal
                    // Adjust origin to make it feel like drawing a diameter
                    originX: w < 0 ? 'right' : 'left',
                    originY: h < 0 ? 'bottom' : 'top',
                    left: Math.min(startX, endX), // This is incorrect for how radius works with origin
                    top: Math.min(startY, endY),   // This is incorrect for how radius works with origin
                });
                 // Simplest for drag-draw circle (like a line representing diameter):
                 // Treat (startX, startY) as center, and drag to set radius.
                 // For this, we need to set originX/Y to 'center' during creation.
                 // Let's adjust circle creation and drawing.
                 // If currentShape.originX is 'left':
                 currentShape.set({ radius: Math.sqrt(Math.pow(endX - currentShape.left, 2) + Math.pow(endY - currentShape.top, 2))});
                 // This is still tricky due to how fabric circle is defined by left, top, radius, and origin.
                 // For a drag from corner to corner bounding box feel:
                 // We need to re-create the circle or update its position and radius carefully.
                 // Let's go back to the previous simple circle from center for now.
                 // (This means Line and Rect tools are intuitive, Circle needs more thought for drag-draw behavior)

                 // Reverting to simpler circle drawing, assuming startX,startY is center:
                 // (Need to change circle creation for this to work intuitively)
                 // currentShape.set({ radius: Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)) });

                break;
        }
        fabricCanvas.renderAll();
    });

    fabricCanvas.on('mouse:up', (o) => {
        if (isDrawingShape && currentShape) {
            currentShape.set({
                selectable: true, // Make it selectable after drawing
                evented: true
            });
            if (currentTool === 'circle' && currentShape.radius < (currentStrokeWidth / 2) + 1) {
                 fabricCanvas.remove(currentShape); // Remove tiny circles (likely accidental clicks)
            } else if (currentTool === 'rect' && (currentShape.width < 2 || currentShape.height < 2)) {
                 fabricCanvas.remove(currentShape); // Remove tiny rects
            } else if (currentTool === 'line' && (Math.abs(currentShape.x1 - currentShape.x2) < 2 && Math.abs(currentShape.y1 - currentShape.y2) < 2)) {
                 fabricCanvas.remove(currentShape); // Remove tiny lines
            }


            currentShape = null;
        }
        isDrawingShape = false;
        // If not drawing, and we were in placement mode, this mouse:up might be to deselect the SVG.
        // The mouse:down handler should have already finalized placement.
        // No, if in placement mode, fabric handles object interaction.

        // After drawing or placing an SVG, switch back to select tool
        if (currentTool !== 'select' && !isPlacingSvgMode) {
            // Delay slightly to ensure the drawn object is registered before switching tool
            // setTimeout(() => activateTool('select'), 50);
        }
    });

    // --- Load SVG ---
    loadSvgButton.addEventListener('click', () => {
        if (isPlacingSvgMode) {
            setPlacingSvgMode(false, loadedSvgGroup); // Finalize if already placing
            activateTool('select');
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
            fabric.loadSVGFromString(svgString, (objects, options) => {
                if (!objects || objects.length === 0) {
                    alert("Could not load SVG or SVG is empty/unsupported.");
                    return;
                }
                // `objects` is an array of fabric objects from the SVG
                // `options` contains original width/height if available in SVG
                const group = fabric.util.groupSVGElements(objects, options);

                // Apply current stroke color/width to loaded SVG elements if they don't have their own
                group.getObjects().forEach(obj => {
                    if (!obj.stroke) obj.set('stroke', currentColor); // if SVG element had no stroke, apply current
                    if (!obj.strokeWidth && obj.stroke) obj.set('strokeWidth', currentStrokeWidth); // if had stroke but no width
                    if (obj.fill && obj.fill !== 'none' && obj.fill !== 'transparent' && !obj.stroke) {
                        // If it has a fill but no stroke, give it a default stroke for visibility
                        obj.set('stroke', currentColor);
                        obj.set('strokeWidth', 1); // small stroke
                    }
                    obj.set('fill', 'transparent'); // Make all fills transparent for CAD-like behavior
                });


                setPlacingSvgMode(true, group);
            });
            loadSvgInput.value = '';
        };
        reader.onerror = (e) => {
            console.error("Error reading file:", e);
            alert("Error reading SVG file.");
            loadSvgInput.value = '';
        };
        reader.readAsText(file);
    });


    // --- Clear and Save ---
    document.getElementById('clear-canvas').addEventListener('click', () => {
        if (isPlacingSvgMode) {
            setPlacingSvgMode(false, null); // Cancel placement and remove preview
        }
        fabricCanvas.clear(); // Fabric's clear method
        fabricCanvas.backgroundColor = '#fff'; // Reset background if clear removed it
        fabricCanvas.renderAll();
    });

    document.getElementById('save-svg').addEventListener('click', () => {
        if (isPlacingSvgMode) {
            setPlacingSvgMode(false, loadedSvgGroup); // Finalize SVG before saving
            activateTool('select');
        }
        // Ensure all objects are not actively being drawn
        if (currentShape) {
            fabricCanvas.remove(currentShape);
            currentShape = null;
            isDrawingShape = false;
        }

        const svgData = fabricCanvas.toSVG({
            suppressPreamble: true, //  Don't include XML declaration
            width: fabricCanvas.width,
            height: fabricCanvas.height,
            viewBox: {
                x: 0,
                y: 0,
                width: fabricCanvas.width,
                height: fabricCanvas.height
            }
        });

        // Add a white background rect to the SVG string manually if needed
        // because fabricCanvas.backgroundColor doesn't always translate to a <rect> in toSVG()
        // depending on how you want the SVG to behave.
        // For now, let's assume the SVG viewer will handle background.
        // Or, add a white rect as the first object on the canvas if a visual bg is always needed in the SVG file.

        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'drawing.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // --- Keyboard delete ---
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const activeObject = fabricCanvas.getActiveObject();
            if (activeObject) {
                if (activeObject.type === 'activeSelection') { // Group selection
                    activeObject.forEachObject(obj => fabricCanvas.remove(obj));
                }
                fabricCanvas.remove(activeObject);
                fabricCanvas.discardActiveObject();
                fabricCanvas.renderAll();
            }
        }
    });

    // Initial tool activation
    activateTool('line');
});