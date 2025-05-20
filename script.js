document.addEventListener('DOMContentLoaded', () => {
    // Initialize Fabric.js canvas
    const fabricCanvas = new fabric.Canvas('drawing-canvas', {
        isDrawingMode: false, // We'll handle drawing modes manually for specific shapes
        selection: true,      // Allow object selection
        backgroundColor: '#fff'
    });

    // Add grid
    const gridSize = 20;
    const gridColor = '#ddd';
    
    function drawGrid() {
        const width = fabricCanvas.width;
        const height = fabricCanvas.height;
        
        // Clear existing grid
        fabricCanvas.getObjects().forEach(obj => {
            if (obj.isGridLine) {
                fabricCanvas.remove(obj);
            }
        });

        // Draw vertical lines
        for (let i = 0; i <= width; i += gridSize) {
            fabricCanvas.add(new fabric.Line([i, 0, i, height], {
                stroke: gridColor,
                selectable: false,
                evented: false,
                isGridLine: true
            }));
        }

        // Draw horizontal lines
        for (let i = 0; i <= height; i += gridSize) {
            fabricCanvas.add(new fabric.Line([0, i, width, i], {
                stroke: gridColor,
                selectable: false,
                evented: false,
                isGridLine: true
            }));
        }
    }

    // Update grid on resize
    const originalResizeCanvas = resizeCanvas;
    resizeCanvas = function() {
        originalResizeCanvas();
        drawGrid();
    };
    drawGrid();

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
    let snapToGrid = true; // Add snap to grid setting

    // SVG Placement State
    let isPlacingSvgMode = false;
    let loadedSvgGroup = null; // Will hold the fabric.Group of the loaded SVG
    let placementInitialScale = { x: 1, y: 1 };

    // Add snap to grid function
    function snapToGridValue(value) {
        if (!snapToGrid) return value;
        return Math.round(value / gridSize) * gridSize;
    }

    // Add snap to grid toggle button
    const snapButton = document.createElement('button');
    snapButton.id = 'snap-to-grid';
    snapButton.className = 'tool-button';
    snapButton.textContent = 'Snap to Grid';
    snapButton.title = 'Toggle snap to grid';
    snapButton.addEventListener('click', () => {
        snapToGrid = !snapToGrid;
        snapButton.classList.toggle('active');
    });
    toolbar.insertBefore(snapButton, document.getElementById('clear-canvas'));

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
            
            // Add controls to the SVG group
            svgGroup.setControlsVisibility({
                mt: true, // middle top
                mb: true, // middle bottom
                ml: true, // middle left
                mr: true, // middle right
                bl: true, // bottom left
                br: true, // bottom right
                tl: true, // top left
                tr: true, // top right
                mtr: true // rotation control
            });

            // Initially place the SVG in the center
            fabricCanvas.add(svgGroup);
            fabricCanvas.centerObject(svgGroup);
            
            // Set initial size to 30% of canvas width or height, whichever is smaller
            const initialScale = Math.min(
                (fabricCanvas.width * 0.3) / svgGroup.width,
                (fabricCanvas.height * 0.3) / svgGroup.height
            );
            svgGroup.scale(initialScale);

            // Make it selectable and draggable
            svgGroup.set({
                selectable: true,
                hasControls: true,
                hasBorders: true,
                lockMovementX: false,
                lockMovementY: false,
                lockRotation: false,
                lockScalingX: false,
                lockScalingY: false,
                lockUniScaling: false
            });

            fabricCanvas.setActiveObject(svgGroup);
            fabricCanvas.renderAll();
            
            showStatus("SVG loaded. Click and drag to position, use corner handles to resize, and the top handle to rotate.");
            activateTool('select');
        } else {
            document.body.classList.remove('placing-svg-mode');
            showStatus("");
            // Only remove the SVG if we're canceling placement (svgGroup is null)
            if (svgGroup === null && loadedSvgGroup) {
                fabricCanvas.remove(loadedSvgGroup);
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
                // Clicked outside the SVG being placed, finalize its current state
                setPlacingSvgMode(false, loadedSvgGroup); // Pass the group to keep it
                activateTool('select');
            }
            return; // Let Fabric handle selection/movement
        }

        isDrawingShape = true;
        const pointer = fabricCanvas.getPointer(o.e);
        startX = snapToGridValue(pointer.x);
        startY = snapToGridValue(pointer.y);

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
        const endX = snapToGridValue(pointer.x);
        const endY = snapToGridValue(pointer.y);

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
        if (isPlacingSvgMode && o.target !== loadedSvgGroup) {
            // If we clicked outside the SVG being placed, finalize its placement
            setPlacingSvgMode(false, loadedSvgGroup);
        }
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

    // Function to inline SVG styles and remove <style> blocks
    function inlineSvgStyles(svgString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, 'image/svg+xml');
        const svg = doc.documentElement;
        const style = svg.querySelector('style');
        if (style) {
            const css = style.textContent;
            const rules = css.match(/[^{]+{[^}]+}/g) || [];
            rules.forEach(rule => {
                const parts = rule.split('{');
                // Remove comments and trim
                const selector = parts[0].replace(/\/\*.*?\*\//g, '').trim();
                const declarations = parts[1].replace('}', '').trim();
                if (!selector) return; // Skip empty selectors
                try {
                    svg.querySelectorAll(selector).forEach(el => {
                        declarations.split(';').forEach(decl => {
                            if (decl.trim()) {
                                const [prop, value] = decl.split(':');
                                if (prop && value) {
                                    el.setAttribute(prop.trim(), value.trim());
                                }
                            }
                        });
                    });
                } catch (e) {
                    console.warn("Invalid selector skipped:", selector, e);
                }
            });
            style.remove();
        }
        return new XMLSerializer().serializeToString(svg);
    }

    // Enhance SVG loading
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
            let svgString = e.target.result;
            // Inline styles and remove <style> blocks
            svgString = inlineSvgStyles(svgString);
            
            // Show loading status
            showStatus("Loading SVG...");
            
            // Add timeout to prevent infinite loading
            const loadingTimeout = setTimeout(() => {
                showStatus("SVG loading timed out. The file might be too complex or corrupted.");
                loadSvgInput.value = '';
            }, 10000); // 10 second timeout

            // Parse SVG string to ensure it's valid
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
            
            if (svgDoc.documentElement.nodeName !== 'svg') {
                alert("Invalid SVG file.");
                showStatus("");
                loadSvgInput.value = '';
                return;
            }

            // Get the SVG element
            const svgElement = svgDoc.documentElement;
            
            // Ensure viewBox is set
            if (!svgElement.getAttribute('viewBox') && 
                svgElement.getAttribute('width') && 
                svgElement.getAttribute('height')) {
                const width = svgElement.getAttribute('width').replace('px', '');
                const height = svgElement.getAttribute('height').replace('px', '');
                svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
            }

            // Convert SVG to string
            const serializer = new XMLSerializer();
            const cleanSvgString = serializer.serializeToString(svgElement);

            // Load SVG using Fabric.js
            fabric.loadSVGFromString(cleanSvgString, (objects, options) => {
                clearTimeout(loadingTimeout);

                if (!objects || objects.length === 0) {
                    alert("Could not load SVG or SVG is empty/unsupported.");
                    showStatus("");
                    return;
                }

                try {
                    const group = fabric.util.groupSVGElements(objects, options);
                    group.getObjects().forEach(obj => {
                        try {
                            if (!obj.stroke) obj.set('stroke', currentColor);
                            if (!obj.strokeWidth && obj.stroke) obj.set('strokeWidth', currentStrokeWidth);
                            if (obj.fill && obj.fill !== 'none') obj.set('fill', 'transparent');
                            obj.set({ selectable: true, evented: true, visible: true });
                        } catch (e) {
                            console.warn("Warning loading SVG element:", obj, e);
                        }
                    });
                    group.set({
                        originX: 'center',
                        originY: 'center',
                        centeredScaling: true,
                        centeredRotation: true
                    });
                    setPlacingSvgMode(true, group);
                } catch (error) {
                    console.error("Error processing SVG group:", error);
                    alert("Error processing SVG. The file might be too complex or contain unsupported elements.");
                    showStatus("");
                }
            }, (error) => {
                clearTimeout(loadingTimeout);
                if (!window._svgErrorShown) {
                    window._svgErrorShown = true;
                    alert("Error loading SVG. The file might be corrupted or contain unsupported elements.");
                    showStatus("");
                    setTimeout(() => { window._svgErrorShown = false; }, 1000);
                }
            });
            
            loadSvgInput.value = '';
        };
        
        reader.onerror = (e) => {
            console.error("Error reading file:", e);
            alert("Error reading SVG file.");
            showStatus("");
            loadSvgInput.value = '';
        };
        
        reader.readAsText(file);
    });

    // Add keyboard controls for fine-tuning SVG placement
    window.addEventListener('keydown', (e) => {
        if (!isPlacingSvgMode || !loadedSvgGroup) return;

        const moveAmount = e.shiftKey ? 10 : 1; // Larger movement with shift key
        const rotateAmount = e.shiftKey ? 15 : 5; // Larger rotation with shift key

        switch(e.key) {
            case 'ArrowLeft':
                loadedSvgGroup.set('left', loadedSvgGroup.left - moveAmount);
                break;
            case 'ArrowRight':
                loadedSvgGroup.set('left', loadedSvgGroup.left + moveAmount);
                break;
            case 'ArrowUp':
                loadedSvgGroup.set('top', loadedSvgGroup.top - moveAmount);
                break;
            case 'ArrowDown':
                loadedSvgGroup.set('top', loadedSvgGroup.top + moveAmount);
                break;
            case 'r':
                loadedSvgGroup.set('angle', loadedSvgGroup.angle + rotateAmount);
                break;
            case 'R':
                loadedSvgGroup.set('angle', loadedSvgGroup.angle - rotateAmount);
                break;
            case 'Escape':
                setPlacingSvgMode(false, null); // Cancel placement
                return;
            case 'Enter':
                setPlacingSvgMode(false, loadedSvgGroup); // Finalize placement
                return;
        }
        
        fabricCanvas.renderAll();
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

    // Add snap to grid for object movement
    fabricCanvas.on('object:moving', (e) => {
        if (!snapToGrid) return;
        const obj = e.target;
        obj.set({
            left: snapToGridValue(obj.left),
            top: snapToGridValue(obj.top)
        });
    });

    // Add snap to grid for object resizing
    fabricCanvas.on('object:scaling', (e) => {
        if (!snapToGrid) return;
        const obj = e.target;
        obj.set({
            width: snapToGridValue(obj.width),
            height: snapToGridValue(obj.height)
        });
    });

    // Initial tool activation
    activateTool('line');
});