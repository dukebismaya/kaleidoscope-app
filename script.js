let symmetrySegments = 6;
let currentPenColor;
let strokeThickness = 4;
let currentShape = 'line';

let isDarkMode = true;
const darkBgColor = [30, 30, 30];
const lightBgColor = [240, 240, 240];
let bgColor = darkBgColor;

let drawingBuffer;
let canvasContainer;
let cursorBuffer;

let prevMouseX = -1;
let prevMouseY = -1;

let frameRateValue = 0;
let lastDrawTime = 0;
let fpsUpdateInterval = 500;
let lastFpsUpdate = 0;
let fpsCounter;
let needsRedraw = true;

let lastDrawEvent = 0;
const drawThrottleInterval = 10;

const colorPalettes = [
    ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766', '#F6EFA6'],
    ['#F7B267', '#F79D65', '#F4845F', '#F27059', '#F25C54'],
    ['#2E294E', '#541388', '#F1E9DA', '#FFD400', '#D90368'],
    ['#1A535C', '#4ECDC4', '#F7FFF7', '#FF6B6B', '#FFE66D'],
    ['#5D5C61', '#379683', '#7395AE', '#ADD8E6', '#B1A296']
];
let currentPaletteIndex = 0;
let colorIndexInPalette = 0;
let usePaletteColor = true;

let enableGlobalRotation = false;
let globalRotationAngle = 0;
const rotationSpeed = 0.0005;

let cachedWidth = 0;
let cachedHeight = 0;
let cachedCenterX = 0;
let cachedCenterY = 0;
let cachedAngle = 0;

let bgAnimOffset = 0;
const bgAnimSpeed = 0.002;

let layers = [];
let currentLayerIndex = 0;
const maxLayers = 5;

let historyStack = [];
let historyIndex = -1;
const maxHistorySize = 20;

function setupDrawingBuffer(buffer, width, height) {
    buffer.background(bgColor[0], bgColor[1], bgColor[2]);
    buffer.strokeCap(ROUND);
    buffer.strokeJoin(ROUND);
}

function initLayers() {
    layers = [];
    for (let i = 0; i < 1; i++) {
        addNewLayer();
    }
    currentLayerIndex = 0;
    updateLayerButtons();
}

function smoothScrollTo(element, targetElement) {
    if (!element || !targetElement) return;
    
    const targetPosition = targetElement.offsetTop;
    element.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
    });
}

function addNewLayer() {
    if (layers.length >= maxLayers) return;
    
    let newBuffer = createGraphics(width, height);
    setupDrawingBuffer(newBuffer);
    
    layers.push({
        buffer: newBuffer,
        visible: true,
        opacity: 1.0,
        name: `Layer ${layers.length + 1}`
    });
    
    currentLayerIndex = layers.length - 1;
    drawingBuffer = layers[currentLayerIndex].buffer;
    
    updateLayerButtons();
    
    setTimeout(() => {
        const layerList = document.getElementById('layer-controls');
        const newRow = layerList.lastElementChild;
        if (layerList && newRow) {
            smoothScrollTo(layerList, newRow);
        }
    }, 50);
    
    saveToHistory();
}

function deleteCurrentLayer() {
    if (layers.length <= 1) return;
    
    layers.splice(currentLayerIndex, 1);
    currentLayerIndex = Math.min(currentLayerIndex, layers.length - 1);
    drawingBuffer = layers[currentLayerIndex].buffer;
    
    updateLayerButtons();
    saveToHistory();
}

function selectLayer(index) {
    if (index >= 0 && index < layers.length) {
        currentLayerIndex = index;
        drawingBuffer = layers[currentLayerIndex].buffer;
        updateLayerButtons();
        needsRedraw = true;
    }
}

function toggleLayerVisibility(index) {
    if (index >= 0 && index < layers.length) {
        const wasVisible = layers[index].visible;
        layers[index].visible = !wasVisible;
        
        // If we're hiding the current active layer, switch to a visible one
        if (wasVisible && index === currentLayerIndex) {
            ensureVisibleActiveLayer();
        }
        
        updateLayerButtons();
        needsRedraw = true;
    }
}

function updateLayerOpacity(index, opacity) {
    if (index >= 0 && index < layers.length) {
        // Only update if the opacity actually changed
        if (layers[index].opacity !== opacity) {
            layers[index].opacity = opacity;
            needsRedraw = true; // Only set redraw flag when needed
        }
    }
}


function updateLayerButtons() {
    const layerContainer = document.getElementById('layer-controls');
    if (!layerContainer) return;
    
    const newContainer = layerContainer.cloneNode(false);
    layerContainer.parentNode.replaceChild(newContainer, layerContainer);
    
    newContainer.innerHTML = '';
    
    for (let idx = 0; idx < layers.length; idx++) {
        const layer = layers[idx];
        const layerRow = document.createElement('div');
        layerRow.className = 'layer-row';
        
        const layerBtn = document.createElement('button');
        layerBtn.textContent = idx === currentLayerIndex ? 
            `✏️ ${layer.name}` : layer.name;
        layerBtn.className = idx === currentLayerIndex ? 'layer-button active-layer' : 'layer-button';
        if (idx === currentLayerIndex && !layer.visible) {
            layerBtn.classList.add('hidden-active-layer');
        }
        layerBtn.onclick = function() {
            selectLayer(idx);
            needsRedraw = true;
        };
        
        // Visibility toggle
        const visibilityBtn = document.createElement('button');
        visibilityBtn.className = 'layer-visibility';
        visibilityBtn.innerHTML = layer.visible ? '👁️' : '👁️‍🗨️';
        visibilityBtn.title = layer.visible ? 'Hide Layer' : 'Show Layer';
        visibilityBtn.onclick = function() {
            toggleLayerVisibility(idx);
            needsRedraw = true;
        };
        
        // Opacity slider
        const opacityControl = document.createElement('input');
        opacityControl.type = 'range';
        opacityControl.min = '0';
        opacityControl.max = '100';
        opacityControl.value = layer.opacity * 100;
        opacityControl.className = 'layer-opacity';
        opacityControl.title = 'Layer Opacity';
        opacityControl.oninput = function() {
            updateLayerOpacity(idx, this.value / 100);
        };
        
        layerRow.appendChild(visibilityBtn);
        layerRow.appendChild(layerBtn);
        layerRow.appendChild(opacityControl);
        newContainer.appendChild(layerRow);
    }
}

function ensureVisibleActiveLayer() {
    // If current layer is not visible, switch to the first visible layer
    if (!layers[currentLayerIndex].visible) {
        const visibleLayerIndex = layers.findIndex(layer => layer.visible);
        if (visibleLayerIndex >= 0) {
            selectLayer(visibleLayerIndex);
            return true;
        } else {
            // If no layers are visible, make the current one visible
            layers[currentLayerIndex].visible = true;
            updateLayerButtons();
            return true;
        }
    }
    return false;
}

function mousePressed() {
    if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
        if (!layers[currentLayerIndex].visible) {
            ensureVisibleActiveLayer();
            if (!layers[currentLayerIndex].visible) {
                return false;
            }
        }
        
        if (usePaletteColor) {
            nextColorFromPalette();
        }
        prevMouseX = mouseX;
        prevMouseY = mouseY;
        if (currentShape === 'circle') {
            drawKaleidoscopeShape(drawingBuffer, mouseX, mouseY, mouseX, mouseY, mouseX, mouseY, 
                currentShape, currentPenColor, strokeThickness);
        }
    }
}

function interpolatePoints(x1, y1, x2, y2, maxDistance) {
    const distance = dist(x1, y1, x2, y2);
    if (distance <= maxDistance) {
        return [[x2, y2]]; // Return just the end point if close enough
    }
    
    // Calculate how many points to add
    const steps = ceil(distance / maxDistance);
    const points = [];
    
    // Create interpolated points
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const x = lerp(x1, x2, t);
        const y = lerp(y1, y2, t);
        points.push([x, y]);
    }
    
    return points;
}

function mouseDragged() {
    const now = millis();
    const targetThrottle = frameRateValue < 30 ? 16 : 8;

    if (now - lastDrawEvent < targetThrottle) {
        return false;
    }
    lastDrawEvent = now;
    
    if (!drawingBuffer || drawingBuffer.width <= 0 || drawingBuffer.height <= 0) {
        return false;
    }

    if (!layers[currentLayerIndex].visible) {
        ensureVisibleActiveLayer();
        if (!layers[currentLayerIndex].visible) {
            return false;
        }
    }
    
    if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height && mouseIsPressed) {
        // Only interpolate for line and curve
        if (currentShape !== 'circle' && prevMouseX !== -1 && prevMouseY !== -1) {
            // Interpolate between prev and current if moving too fast
            const points = interpolatePoints(prevMouseX, prevMouseY, mouseX, mouseY, 5);
            
            let lastX = prevMouseX;
            let lastY = prevMouseY;
            
            // Draw all the interpolated points
            points.forEach(([x, y]) => {
                drawKaleidoscopeShape(drawingBuffer, x, y, lastX, lastY, 
                    prevMouseX, prevMouseY, currentShape, currentPenColor, strokeThickness);
                lastX = x;
                lastY = y;
            });
            
            prevMouseX = mouseX;
            prevMouseY = mouseY;
        } else {
            drawKaleidoscopeShape(drawingBuffer, mouseX, mouseY, pmouseX, pmouseY, 
                prevMouseX, prevMouseY, currentShape, currentPenColor, strokeThickness);
            prevMouseX = mouseX;
            prevMouseY = mouseY;
        }
    }
    return false;
}

function saveToHistory() {
    if (historyIndex < historyStack.length - 1) {
        historyStack = historyStack.slice(0, historyIndex + 1);
    }
    
    // Create a deep copy of the layer state
    const layerState = layers.map(layer => {
        // Create a proper copy of the image data
        let imgCopy = null;
        if (layer.buffer) {
            imgCopy = layer.buffer.get();
        }
        
        return {
            imageData: imgCopy,
            visible: layer.visible,
            opacity: layer.opacity,
            name: layer.name
        };
    });
    
    // Push current state to history
    historyStack.push({
        layers: layerState,
        currentIndex: currentLayerIndex
    });
    
    historyIndex++;
    
    // Limit history size
    if (historyStack.length > maxHistorySize) {
        historyStack.shift();
        historyIndex--;
    }
    
    console.log(`Saved to history: ${historyIndex} of ${historyStack.length}`);
}

function applyHistoryState(state) {
    if (!state || !state.layers) {
        console.warn("Invalid history state");
        return;
    }
    
    // Restore layer count
    while (layers.length < state.layers.length) {
        let newBuffer = createGraphics(width, height);
        setupDrawingBuffer(newBuffer, width, height);
        
        layers.push({
            buffer: newBuffer,
            visible: true,
            opacity: 1.0,
            name: `Layer ${layers.length + 1}`
        });
    }
    
    while (layers.length > state.layers.length) {
        const removed = layers.pop();
        if (removed && removed.buffer) {
            removed.buffer.remove();
        }
    }
    
    // Restore each layer
    for (let idx = 0; idx < state.layers.length; idx++) {
        const layerState = state.layers[idx];
        if (layers[idx].buffer) {
            layers[idx].buffer.clear();
            layers[idx].buffer.background(bgColor[0], bgColor[1], bgColor[2]);
            
            if (layerState.imageData) {
                layers[idx].buffer.image(layerState.imageData, 0, 0);
            }
        }
        
        layers[idx].visible = layerState.visible;
        layers[idx].opacity = layerState.opacity;
        layers[idx].name = layerState.name;
    }
    
    currentLayerIndex = Math.min(state.currentIndex, layers.length - 1);
    drawingBuffer = layers[currentLayerIndex].buffer;
    
    updateLayerButtons();
    needsRedraw = true; // Important! Force a redraw
}

window.undoAction = function() {
    if (historyIndex > 0) {
        console.log(`Undoing: ${historyIndex} to ${historyIndex-1}`);
        historyIndex--;
        applyHistoryState(historyStack[historyIndex]);
    } else {
        console.log("Nothing to undo");
    }
}

window.redoAction = function() {
    if (historyIndex < historyStack.length - 1) {
        console.log(`Redoing: ${historyIndex} to ${historyIndex+1}`);
        historyIndex++;
        applyHistoryState(historyStack[historyIndex]);
    } else {
        console.log("Nothing to redo");
    }
}


function updateCachedAngle() {
    let effectiveSymmetry = (symmetrySegments === 1) ? 1 : symmetrySegments;
    cachedAngle = (effectiveSymmetry > 1) ? (TWO_PI / effectiveSymmetry) : 0;
}


function updateCursor() {
    const now = performance.now();

    if (!cursorNeedsUpdate &&
        now - lastCursorUpdateTime < 8 &&
        Math.abs(mouseX - lastCursorX) < 5 &&
        Math.abs(mouseY - lastCursorY) < 5) {
        push();
        translate(mouseX - 25, mouseY - 25);
        image(cursorBuffer, 0, 0);
        pop();
        return;
    }

    lastCursorUpdateTime = now;
    lastCursorX = mouseX;
    lastCursorY = mouseY;

    if (cursorNeedsUpdate) {
        if (!cursorBuffer || cursorBuffer.width !== 50) {
            if (cursorBuffer) cursorBuffer.remove();
            cursorBuffer = createGraphics(50, 50);
        }

        cursorBuffer.clear();
        cursorBuffer.noFill();
        cursorBuffer.stroke(255, 255, 255, 200);
        cursorBuffer.strokeWeight(1);

        let cursorSize = strokeThickness * 0.75;
        cursorSize = constrain(cursorSize, 5, 25);

        cursorBuffer.ellipse(25, 25, cursorSize, cursorSize);

        if (currentPenColor) {
            try {
                cursorBuffer.fill(red(currentPenColor), green(currentPenColor), blue(currentPenColor));
            } catch (e) {
                cursorBuffer.fill(255, 0, 0);
            }
        } else {
            cursorBuffer.fill(255, 0, 0);
        }

        switch (currentShape) {
            case 'line':
                cursorBuffer.strokeWeight(2);
                cursorBuffer.line(20, 25, 30, 25);
                break;
            case 'curve':
                cursorBuffer.strokeWeight(2);
                cursorBuffer.beginShape();
                cursorBuffer.vertex(20, 27);
                cursorBuffer.quadraticVertex(25, 20, 30, 27);
                cursorBuffer.endShape();
                break;
            case 'circle':
                cursorBuffer.ellipse(25, 25, 6, 6);
                break;
        }

        cursorNeedsUpdate = false;
    }

    push();
    translate(mouseX - 25, mouseY - 25);
    image(cursorBuffer, 0, 0);
    pop();
}

function drawKaleidoscopeShape(buffer, x, y, px, py, ppx, ppy, shapeType, penColor, thickness) {
    if (!buffer || buffer.width <= 0 || buffer.height <= 0) return;
    
    if (shapeType !== 'circle' && 
        dist(x, y, px, py) < 0.5 && 
        frameRateValue < 30) {
        return;
    }
    
    const simplifyEffects = frameRateValue < 30;
    
    let r = red(penColor);
    let g = green(penColor);
    let b = blue(penColor);
    let baseA = alpha(penColor);
    
    let drawingColor;
    
    if (simplifyEffects) {
        drawingColor = color(r, g, b, baseA);
    } else {
        let alphaOffset = (x * 0.01) % 100;
        let strokeOffset = (y * 0.01) % 100;
        
        let alphaPulse = 0.85 + sin(frameCount * 0.25 + alphaOffset) * 0.15;
        let dynamicA = baseA * alphaPulse;
        dynamicA = constrain(dynamicA, 0, 255);
        drawingColor = color(r, g, b, dynamicA);
    }
    
    buffer.stroke(drawingColor);
    if (shapeType === 'circle') {
        buffer.fill(drawingColor);
    } else {
        buffer.noFill();
    }
    
    let dynamicStrokeWeight;
    
    if (simplifyEffects) {
        dynamicStrokeWeight = thickness;
    } else {
        let strokeOffset = (y * 0.01) % 100;
        let swPulse = 1.0 + sin(frameCount * 0.15 + strokeOffset) * 0.2;
        dynamicStrokeWeight = thickness * swPulse;
    }
    
    dynamicStrokeWeight = max(1, dynamicStrokeWeight);
    buffer.strokeWeight(dynamicStrokeWeight);

    buffer.push();
    buffer.translate(cachedCenterX, cachedCenterY);

    let effectiveSymmetry = (symmetrySegments === 1) ? 1 : symmetrySegments;

    let angle = cachedAngle;

    let cx = x - cachedCenterX;
    let cy = y - cachedCenterY;
    let cpx = px - cachedCenterX;
    let cpy = py - cachedCenterY;
    let cppx = ppx - cachedCenterX;
    let cppy = ppy - cachedCenterY;

    for (let i = 0; i < effectiveSymmetry; i++) {
        buffer.push();
        if (effectiveSymmetry > 1) {
            buffer.rotate(i * angle);
        }

        drawShapeSegment(buffer, cx, cy, cpx, cpy, cppx, cppy, shapeType, dynamicStrokeWeight);

        if (effectiveSymmetry > 1) {
            buffer.scale(1, -1);
            drawShapeSegment(buffer, cx, cy, cpx, cpy, cppx, cppy, shapeType, dynamicStrokeWeight);
        }

        buffer.pop();
    }
    buffer.pop();

    needsRedraw = true;
}


window.setSymmetry = function (segments) {
    symmetrySegments = segments;
    updateActiveSymmetryButton();
    updateCachedAngle();
    needsRedraw = true;
}

function updateActiveSymmetryButton() {
    const buttons = [1, 4, 6, 8, 10, 12];
    buttons.forEach(s => {
        const btn = document.getElementById(`symBtn${s}`);
        if (btn) {
            btn.classList.toggle('active-symmetry', s === symmetrySegments);
        }
    });
}

window.clearUserCanvas = function () {
    if (drawingBuffer && drawingBuffer.width > 0 && drawingBuffer.height > 0) {
        drawingBuffer.background(bgColor[0], bgColor[1], bgColor[2]);
        saveToHistory();
        needsRedraw = true;
    }
}

window.clearAllLayers = function() {
    for (let i = 0; i < layers.length; i++) {
        if (layers[i].buffer) {
            layers[i].buffer.background(bgColor[0], bgColor[1], bgColor[2]);
        }
    }
    saveToHistory();
};

window.setRandomPalette = function () {
    usePaletteColor = true;
    currentPaletteIndex = floor(random(colorPalettes.length));
    colorIndexInPalette = 0;
    nextColorFromPalette();
    updateThemeColors();
    needsRedraw = true;
}

window.randomizePalette = function () {
    setRandomPalette();
}

window.selectCustomColor = function (hexColor) {
    usePaletteColor = false;
    currentPenColor = color(hexColor);
    currentPenColor.setAlpha(255);
    cursorNeedsUpdate = true;
    needsRedraw = true;
}

function colorToHex(c) {
    if (!c) return '#FF0000';

    let r = Math.round(red(c)).toString(16).padStart(2, '0');
    let g = Math.round(green(c)).toString(16).padStart(2, '0');
    let b = Math.round(blue(c)).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

window.nextColorFromPalette = function () {
    if (colorPalettes.length > 0 && colorPalettes[currentPaletteIndex].length > 0) {
        currentPenColor = color(colorPalettes[currentPaletteIndex][colorIndexInPalette]);
        currentPenColor.setAlpha(255);
        colorIndexInPalette = (colorIndexInPalette + 1) % colorPalettes[currentPaletteIndex].length;

        try {
            const picker = document.getElementById('colorPicker');
            if (picker) {
                picker.value = colorToHex(currentPenColor);
            }
        } catch (e) {
            console.log("Could not update color picker:", e);
        }
    } else {
        currentPenColor = color(random(255), random(255), random(255), 255);
    }
    usePaletteColor = true;
    cursorNeedsUpdate = true;
    needsRedraw = true;
}

window.changePenColor = function () {
    usePaletteColor = false;
    currentPenColor = color(random(255), random(255), random(255), 255);
    cursorNeedsUpdate = true;
    needsRedraw = true;
}

window.toggleBackground = function () {
    isDarkMode = !isDarkMode;
    bgColor = isDarkMode ? darkBgColor : lightBgColor;
    if (drawingBuffer && drawingBuffer.width > 0 && drawingBuffer.height > 0) {
        drawingBuffer.background(bgColor[0], bgColor[1], bgColor[2]);
        needsRedraw = true;
    }
}

window.updateStrokeWeight = function (value) {
    strokeThickness = parseFloat(value);
    document.getElementById('strokeWeightLabel').innerText = `Thickness: ${value}`;
    cursorNeedsUpdate = true;
    needsRedraw = true;
}

window.toggleGlobalRotation = function () {
    enableGlobalRotation = !enableGlobalRotation;
    needsRedraw = true;
}

window.generateRandomArt = function () {
    if (!drawingBuffer || drawingBuffer.width <= 0 || drawingBuffer.height <= 0) {
        console.error("Drawing buffer not ready for random art.");
        return;
    }

    clearUserCanvas();

    let artPalette = colorPalettes[floor(random(colorPalettes.length))];
    let artColorIndex = 0;

    let mainShapeChoices = ['line', 'curve', 'circle'];
    let mainShapeType = mainShapeChoices[floor(random(mainShapeChoices.length))];

    let numMajorElements = floor(random(mainShapeType === 'circle' ? 3 : 5, mainShapeType === 'circle' ? 8 : 12));

    drawingBuffer.push();

    for (let i = 0; i < numMajorElements; i++) {
        let elColor = color(artPalette[artColorIndex % artPalette.length]);
        elColor.setAlpha(random(180, 255));
        artColorIndex++;

        let elStrokeThickness = random(mainShapeType === 'circle' ? 5 : 3, mainShapeType === 'circle' ? 25 : 18);

        if (mainShapeType === 'line' || mainShapeType === 'curve') {
            let angle = (TWO_PI / numMajorElements) * i + random(-PI / 12, PI / 12);
            let startRadius = random(cachedWidth * 0.02, cachedWidth * 0.1);
            let endRadius = random(cachedWidth * 0.25, cachedWidth * 0.45);

            let x1 = cachedCenterX + cos(angle) * startRadius;
            let y1 = cachedCenterY + sin(angle) * startRadius;
            let x2 = cachedCenterX + cos(angle) * endRadius;
            let y2 = cachedCenterY + sin(angle) * endRadius;

            let ppx = x1;
            let ppy = y1;

            let mx = (x1 + x2) / 2;
            let my = (y1 + y2) / 2;
            let controlOffsetAngle = angle + (random() > 0.5 ? PI / 2 : -PI / 2);
            let controlOffsetDist = random(cachedWidth * 0.05, cachedWidth * 0.15);
            let px = mx + cos(controlOffsetAngle) * controlOffsetDist;
            let py = my + sin(controlOffsetAngle) * controlOffsetDist;

            let x = x2;
            let y = y2;

            drawKaleidoscopeShape(drawingBuffer, x, y, px, py, ppx, ppy, mainShapeType, elColor, elStrokeThickness);

        } else if (mainShapeType === 'circle') {
            let clusterAngle = (TWO_PI / numMajorElements) * i + random(-PI / 8, PI / 8);
            let clusterDist = random(cachedWidth * 0.1, cachedWidth * 0.35);
            let clusterX = cachedCenterX + cos(clusterAngle) * clusterDist;
            let clusterY = cachedCenterY + sin(clusterAngle) * clusterDist;

            let numCirclesInCluster = floor(random(1, 4));
            for (let j = 0; j < numCirclesInCluster; j++) {
                let circleAngleOffset = random(TWO_PI);
                let circleDistOffset = random(elStrokeThickness * 0.5, elStrokeThickness * 1.5);
                let x = clusterX + cos(circleAngleOffset) * circleDistOffset;
                let y = clusterY + sin(circleAngleOffset) * circleDistOffset;

                drawKaleidoscopeShape(drawingBuffer, x, y, x, y, x, y, 'circle', elColor, elStrokeThickness);

                if (j < numCirclesInCluster - 1) {
                    elColor = color(artPalette[artColorIndex % artPalette.length]);
                    elColor.setAlpha(random(150, 220));
                    artColorIndex++;
                    elStrokeThickness = random(max(2, elStrokeThickness * 0.5), elStrokeThickness * 0.8);
                }
            }
        }
    }

    let numMinorElements = floor(random(15, 35));
    let minorShapeChoices = ['line', 'curve', 'circle'];

    for (let k = 0; k < numMinorElements; k++) {
        let minorShapeType = minorShapeChoices[floor(random(minorShapeChoices.length))];
        let elColor = color(artPalette[artColorIndex % artPalette.length]);
        elColor.setAlpha(random(100, 200));
        artColorIndex++;
        let elStrokeThickness = random(1, 8);

        let rAngle = random(TWO_PI);
        let rDist = random(cachedWidth * 0.05, cachedWidth * 0.48);

        let x = cachedCenterX + cos(rAngle) * rDist;
        let y = cachedCenterY + sin(rAngle) * rDist;

        let len = random(cachedWidth * 0.02, cachedWidth * 0.1);
        let px = x - cos(rAngle) * len;
        let py = y - sin(rAngle) * len;
        let ppx = x - cos(rAngle) * len * 2 + random(-len * 0.5, len * 0.5);
        let ppy = y - sin(rAngle) * len * 2 + random(-len * 0.5, len * 0.5);

        if (minorShapeType === 'circle') {
            drawKaleidoscopeShape(drawingBuffer, x, y, x, y, x, y, 'circle', elColor, elStrokeThickness);
        } else {
            drawKaleidoscopeShape(drawingBuffer, x, y, px, py, ppx, ppy, minorShapeType, elColor, elStrokeThickness);
        }
    }

    drawingBuffer.pop();
    saveToHistory();
    needsRedraw = true;
};


function keyPressed() {
    // Check for Ctrl+Z (undo)
    if (keyCode === 90 && keyIsDown(CONTROL)) {
        undoAction();
        return false;
    }

    // Check for Ctrl+Y or Ctrl+Shift+Z (redo)
    if ((keyCode === 89 && keyIsDown(CONTROL)) || 
        (keyCode === 90 && keyIsDown(CONTROL) && keyIsDown(SHIFT))) {
        redoAction();
        return false;
    }

    return true;
}

window.addLayer = function() {
    addNewLayer();
    saveToHistory();
}

window.deleteLayer = function() {
    deleteCurrentLayer();
    saveToHistory();
}

function updateThemeColors() {
    const root = document.documentElement;
    if (colorPalettes.length > 0 && colorPalettes[currentPaletteIndex].length > 0) {
        const primaryColor = color(colorPalettes[currentPaletteIndex][0]);
        const accentColor = color(colorPalettes[currentPaletteIndex][1] || colorPalettes[currentPaletteIndex][0]);
        
        const primaryHex = colorToHex(primaryColor);
        const accentHex = colorToHex(accentColor);
        
        // Create a darker variant for primary
        const primaryDarkR = constrain(red(primaryColor) * 0.7, 0, 255);
        const primaryDarkG = constrain(green(primaryColor) * 0.7, 0, 255);
        const primaryDarkB = constrain(blue(primaryColor) * 0.7, 0, 255);
        const primaryDarkHex = `#${Math.round(primaryDarkR).toString(16).padStart(2, '0')}${Math.round(primaryDarkG).toString(16).padStart(2, '0')}${Math.round(primaryDarkB).toString(16).padStart(2, '0')}`;
        
        // Set the CSS variables
        root.style.setProperty('--primary', primaryHex);
        root.style.setProperty('--primary-dark', primaryDarkHex);
        root.style.setProperty('--accent', accentHex);
    }
}

window.setRandomPalette = function() {
    usePaletteColor = true;
    currentPaletteIndex = floor(random(colorPalettes.length));
    colorIndexInPalette = 0;
    nextColorFromPalette();
    updateThemeColors();
    needsRedraw = true;
}

function setup() {
    canvasContainer = document.getElementById('canvas-container');
    fpsCounter = document.getElementById('fps-counter');

    const footer = document.querySelector('.app-footer');
    fpsCounter = document.getElementById('fps-counter');

    if (!fpsCounter) {
        fpsCounter = document.createElement('div');
        fpsCounter.id = 'fps-counter';
        // canvasContainer.appendChild(fpsCounter);
        footer.appendChild(fpsCounter);
    }

    // Calculate available space more accurately
    const containerW = canvasContainer.clientWidth;
    const containerH = canvasContainer.clientHeight || window.innerHeight * 0.7;

    // Ensure we have reasonable dimensions
    let canvasW = max(600, containerW);
    let canvasH = max(400, containerH);

    let cnv = createCanvas(canvasW, canvasH);
    cnv.parent('canvas-container');

    document.getElementById('defaultCanvas0').classList.add('drawing-cursor');
    
    const canvasElement = document.getElementById('defaultCanvas0');
    if (canvasElement) {
        canvasElement.style.width = '100%';
        canvasElement.style.height = '100%';
    }

    cursorBuffer = createGraphics(50, 50);

    drawingBuffer = createGraphics(canvasW, canvasH);
    setupDrawingBuffer(drawingBuffer, canvasW, canvasH);

    cachedWidth = canvasW;
    cachedHeight = canvasH;
    cachedCenterX = cachedWidth / 2;
    cachedCenterY = cachedHeight / 2;
    updateCachedAngle();

    setRandomPalette();
    updateThemeColors();
    updateActiveSymmetryButton();
    updateActiveShapeButton();

    frameRate(60);


    saveToHistory();

    initLayers();
    
    drawingBuffer = layers[currentLayerIndex].buffer;
    
    windowResized();
}


let cursorNeedsUpdate = true;
let lastCursorX = 0;
let lastCursorY = 0;
let lastCursorUpdateTime = 0;

function draw() {
    const now = millis();

    // Only update FPS counter occasionally
    if (now - lastFpsUpdate > fpsUpdateInterval) {
        frameRateValue = frameRate();
        if (fpsCounter) {
            fpsCounter.textContent = `FPS: ${frameRateValue.toFixed(1)}`;
        }
        lastFpsUpdate = now;
    }

    // Skip redraws when nothing changed and not in rotation mode
    if (!needsRedraw && !enableGlobalRotation && now - lastDrawTime < 200) {
        if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
            updateCursor();
        }
        return;
    }

    // We're redrawing now, so reset the flag
    lastDrawTime = now;
    needsRedraw = false;

    if (!drawingBuffer || drawingBuffer.width <= 0 || drawingBuffer.height <= 0) {
        background(50);
        return;
    }

    if (enableGlobalRotation) {
        // Rotation mode rendering
        background(bgColor[0], bgColor[1], bgColor[2]);
        push();
        translate(cachedCenterX, cachedCenterY);
        rotate(globalRotationAngle);

        // Draw all visible layers with their opacity
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            if (layer.visible && layer.buffer) {
                push();
                tint(255, layer.opacity * 255);
                image(layer.buffer, -cachedWidth / 2, -cachedHeight / 2);
                pop();
            }
        }

        pop();
        globalRotationAngle += rotationSpeed;
        needsRedraw = true;
    } else {
        if (frameRateValue > 30) {
            bgAnimOffset += bgAnimSpeed;
            let t = bgAnimOffset;
            let bgR = map(sin(t), -1, 1, bgColor[0] * 0.85, bgColor[0] * 1.05);
            let bgG = map(sin(t + PI / 1.5), -1, 1, bgColor[1] * 0.85, bgColor[1] * 1.05);
            let bgB = map(sin(t + PI / 3), -1, 1, bgColor[2] * 0.85, bgColor[2] * 1.05);
            background(constrain(bgR, 0, 255), constrain(bgG, 0, 255), constrain(bgB, 0, 255));
        } else {
            background(bgColor[0], bgColor[1], bgColor[2]);
        }

        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            if (layer.visible && layer.buffer && layer.opacity > 0.01) {
                push();
                tint(255, layer.opacity * 255);
                image(layer.buffer, 0, 0);
                pop();
            }
        }
    }

    // Draw cursor if mouse is over canvas
    if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
        updateCursor();
    }
}


function drawShapeSegment(buffer, x, y, px, py, ppx, ppy, shapeType, dynaStrokeWeight) {
    switch (shapeType) {
        case 'line':
            if (px !== -1 && py !== -1) {
                buffer.line(px, py, x, y);
            } else {
                buffer.ellipse(x, y, dynaStrokeWeight * 0.5, dynaStrokeWeight * 0.5);
            }
            break;
            
        case 'curve':
            if (ppx !== -1 && ppy !== -1 && px !== -1 && py !== -1) {
                buffer.beginShape();
                buffer.vertex(ppx, ppy);
                buffer.quadraticVertex(px, py, x, y);
                buffer.endShape();
            } else if (px !== -1 && py !== -1) {
                buffer.line(px, py, x, y);
            } else {
                buffer.ellipse(x, y, dynaStrokeWeight * 0.5, dynaStrokeWeight * 0.5);
            }
            break;
            
        case 'circle':
            buffer.ellipse(x, y, dynaStrokeWeight * 1.5, dynaStrokeWeight * 1.5);
            break;
    }
}

function mouseReleased() {
    if (prevMouseX !== -1 && prevMouseY !== -1) {
        setTimeout(() => {
            saveToHistory();
        }, 10);
    }
    prevMouseX = -1;
    prevMouseY = -1;
}

function windowResized() {
    const containerW = canvasContainer.clientWidth;
    const containerH = canvasContainer.clientHeight || window.innerHeight * 0.7;

    // Ensure we have reasonable dimensions
    let newW = max(600, containerW);
    let newH = max(400, containerH);

    // Only resize if dimensions changed significantly (avoids constant resizing)
    if (abs(newW - cachedWidth) > 10 || abs(newH - cachedHeight) > 10) {
        console.log(`Resizing canvas to ${newW}x${newH}`);
        resizeCanvas(newW, newH);

        // Update all layer buffers
        for (let i = 0; i < layers.length; i++) {
            let layer = layers[i];
            let oldBuffer = layer.buffer;
            
            layer.buffer = createGraphics(width, height);
            setupDrawingBuffer(layer.buffer);
            
            // Copy contents from old buffer if it exists
            if (oldBuffer) {
                layer.buffer.image(oldBuffer, 0, 0, width, height);
                oldBuffer.remove();
            }
        }
        
        drawingBuffer = layers[currentLayerIndex].buffer;

        cachedWidth = newW;
        cachedHeight = newH;
        cachedCenterX = cachedWidth / 2;
        cachedCenterY = cachedHeight / 2;

        needsRedraw = true;
    }
}

window.setShape = function (shape) {
    currentShape = shape;
    updateActiveShapeButton();
    cursorNeedsUpdate = true;
    needsRedraw = true;
}

function updateActiveShapeButton() {
    const shapes = ['line', 'curve', 'circle'];
    shapes.forEach(s => {
        const btnId = `shapeBtn${s.charAt(0).toUpperCase() + s.slice(1)}`;
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.classList.toggle('active-shape', s === currentShape);
        }
    });
}

window.saveUserCanvas = function () {
    if (enableGlobalRotation) {
        saveCanvas('kaleidoscope_rotated.png');
    } else {
        if (drawingBuffer && drawingBuffer.width > 0 && drawingBuffer.height > 0) {
            save(drawingBuffer, 'kaleidoscope.png');
        } else {
            console.error("Cannot save, drawing buffer is invalid.");
        }
    }
}
