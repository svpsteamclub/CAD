document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    const toolbar = document.querySelector('.toolbar');
    const colorPicker = document.getElementById('color-picker');

    let currentTool = 'line';
    let isDrawing = false;
    let startX, startY;
    let shapes = []; // To store drawn shapes for redraw and SVG export
    let currentColor = '#000000';

    // Set canvas size
    function resizeCanvas() {
        // Make canvas slightly smaller than window to avoid scrollbars and fit toolbar
        const toolbarHeight = toolbar.offsetHeight + 20; // 20 for margins
        canvas.width = window.innerWidth * 0.95;
        canvas.height = (window.innerHeight - toolbarHeight) * 0.95;
        redrawShapes(); // Redraw existing shapes on resize
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); // Initial size

    // --- Tool Selection ---
    const toolButtons = document.querySelectorAll('.tool-button');
    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            toolButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentTool = button.dataset.tool;
        });
    });

    // --- Color Picker ---
    colorPicker.addEventListener('input', (e) => {
        currentColor = e.target.value;
    });

    // --- Drawing Event Handlers ---
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
        e.preventDefault(); // Prevent default touch actions like scrolling
        isDrawing = true;
        const pos = getMousePos(canvas, e);
        startX = pos.x;
        startY = pos.y;
    }

    function draw(e) {
        e.preventDefault();
        if (!isDrawing) return;

        const pos = getMousePos(canvas, e);
        redrawShapes(); // Clear and redraw previous shapes

        ctx.beginPath();
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 2; // You can make this configurable

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
        const pos = getMousePos(canvas, e.changedTouches ? e.changedTouches[0] : e); // Handle touchend

        // Add the completed shape to our shapes array
        let shapeData = { tool: currentTool, color: currentColor, x1: startX, y1: startY };
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
        redrawShapes(); // Final redraw to ensure it's crisp
    }

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', () => { // Stop drawing if mouse leaves canvas
      if (isDrawing) {
        // Manually create an event-like object for stopDrawing if needed or just stop
        const pseudoEvent = { preventDefault: () => {}, clientX: -1, clientY: -1 }; // Dummy event
         // To correctly save the shape, we need the last known position
        // This is tricky with mouseout. For simplicity, we'll discard if mouseout happens mid-draw.
        // A better solution would be to save up to the canvas boundary or the last mousemove pos.
        isDrawing = false;
        redrawShapes(); // Redraw committed shapes
      }
    });


    // Touch events
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', () => { isDrawing = false; redrawShapes(); });


    // --- Redraw all stored shapes ---
    function redrawShapes() {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas

        shapes.forEach(shape => {
            ctx.beginPath();
            ctx.strokeStyle = shape.color;
            ctx.lineWidth = 2;

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

    // --- Clear Canvas ---
    document.getElementById('clear-canvas').addEventListener('click', () => {
        shapes = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    // --- Save SVG ---
    document.getElementById('save-svg').addEventListener('click', () => {
        let svgContent = `<svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">\n`;
        svgContent += `  <rect width="100%" height="100%" fill="#fff"/>\n`; // Background

        shapes.forEach(shape => {
            switch (shape.tool) {
                case 'line':
                    svgContent += `  <line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" stroke="${shape.color}" stroke-width="2"/>\n`;
                    break;
                case 'rect':
                    // SVG rect draws from top-left. Handle negative width/height if drawn backwards.
                    let x = shape.x1;
                    let y = shape.y1;
                    let w = shape.width;
                    let h = shape.height;
                    if (w < 0) { x = shape.x1 + w; w = -w; }
                    if (h < 0) { y = shape.y1 + h; h = -h; }
                    svgContent += `  <rect x="${x}" y="${y}" width="${w}" height="${h}" stroke="${shape.color}" stroke-width="2" fill="none"/>\n`;
                    break;
                case 'circle':
                    svgContent += `  <circle cx="${shape.x1}" cy="${shape.y1}" r="${shape.radius}" stroke="${shape.color}" stroke-width="2" fill="none"/>\n`;
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