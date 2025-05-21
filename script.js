
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

function setupDrawingBuffer(buffer, w, h) {
    if (!buffer) return;
    buffer.strokeCap(ROUND);
    buffer.angleMode(RADIANS);
    buffer.background(bgColor[0], bgColor[1], bgColor[2]);
}

function setup() {
    canvasContainer = document.getElementById('canvas-container');
    fpsCounter = document.getElementById('fps-counter');

    if (!fpsCounter) {
        fpsCounter = document.createElement('div');
        fpsCounter.id = 'fps-counter';
        canvasContainer.appendChild(fpsCounter);
    }

    let containerW = canvasContainer.offsetWidth;
    let containerH = canvasContainer.offsetHeight;

    let canvasW = max(1, containerW);
    let canvasH = max(1, containerH);

    let cnv = createCanvas(canvasW, canvasH);
    cnv.parent('canvas-container');

    document.getElementById('defaultCanvas0').classList.add('drawing-cursor');

    cursorBuffer = createGraphics(50, 50);

    drawingBuffer = createGraphics(canvasW, canvasH);
    setupDrawingBuffer(drawingBuffer, canvasW, canvasH);

    cachedWidth = canvasW;
    cachedHeight = canvasH;
    cachedCenterX = cachedWidth / 2;
    cachedCenterY = cachedHeight / 2;
    updateCachedAngle();

    setRandomPalette();
    updateActiveSymmetryButton();
    updateActiveShapeButton();

    frameRate(60);
}

function updateCachedAngle() {
    let effectiveSymmetry = (symmetrySegments === 1) ? 1 : symmetrySegments;
    cachedAngle = (effectiveSymmetry > 1) ? (TWO_PI / effectiveSymmetry) : 0;
}

let cursorNeedsUpdate = true;
let lastCursorX = 0;
let lastCursorY = 0;
let lastCursorUpdateTime = 0;

function draw() {
    const now = millis();

    if (now - lastFpsUpdate > fpsUpdateInterval) {
        frameRateValue = frameRate();
        if (fpsCounter) {
            fpsCounter.textContent = `FPS: ${frameRateValue.toFixed(1)}`;
        }
        lastFpsUpdate = now;
    }

    if (!needsRedraw && !enableGlobalRotation && now - lastDrawTime < 100) {
        if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
            background(bgColor[0], bgColor[1], bgColor[2]);
            image(drawingBuffer, 0, 0);
            updateCursor();
        }
        return;
    }

    lastDrawTime = now;
    needsRedraw = false;

    if (!drawingBuffer || drawingBuffer.width <= 0 || drawingBuffer.height <= 0) {
        background(50);
        return;
    }

    if (enableGlobalRotation) {
        background(bgColor[0], bgColor[1], bgColor[2]);
        push();
        translate(cachedCenterX, cachedCenterY);
        rotate(globalRotationAngle);
        image(drawingBuffer, -cachedWidth / 2, -cachedHeight / 2);
        pop();
        globalRotationAngle += rotationSpeed;
        needsRedraw = true;
    } else {
        bgAnimOffset += bgAnimSpeed;

        let t = bgAnimOffset;
        let bgR = map(sin(t), -1, 1, bgColor[0] * 0.85, bgColor[0] * 1.05);
        let bgG = map(sin(t + PI / 1.5), -1, 1, bgColor[1] * 0.85, bgColor[1] * 1.05);
        let bgB = map(sin(t + PI / 3), -1, 1, bgColor[2] * 0.85, bgColor[2] * 1.05);
        background(constrain(bgR, 0, 255), constrain(bgG, 0, 255), constrain(bgB, 0, 255));
        image(drawingBuffer, 0, 0);
    }

    if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
        updateCursor();
    }
}

function updateCursor() {
    const now = performance.now();

    if (!cursorNeedsUpdate &&
        now - lastCursorUpdateTime < 16 &&
        Math.abs(mouseX - lastCursorX) < 8 &&
        Math.abs(mouseY - lastCursorY) < 8) {
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

    let r = red(penColor);
    let g = green(penColor);
    let b = blue(penColor);
    let baseA = alpha(penColor);

    let alphaOffset = (x * 0.01) % 100;
    let strokeOffset = (y * 0.01) % 100;

    let alphaPulse = 0.85 + sin(frameCount * 0.25 + alphaOffset) * 0.15;
    let dynamicA = baseA * alphaPulse;
    dynamicA = constrain(dynamicA, 0, 255);
    let drawingColor = color(r, g, b, dynamicA);

    buffer.stroke(drawingColor);
    if (shapeType === 'circle') {
        buffer.fill(drawingColor);
    } else {
        buffer.noFill();
    }

    let swPulse = 1.0 + sin(frameCount * 0.15 + strokeOffset) * 0.2;
    let dynamicStrokeWeight = thickness * swPulse;
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

function drawShapeSegment(buffer, x, y, px, py, ppx, ppy, shapeType, dynaStrokeWeight) {
    switch (shapeType) {
        case 'line':
            if (px !== -1 && py !== -1) {
                buffer.line(px, py, x, y);
            }
            break;
        case 'curve':
            buffer.noFill();
            if (ppx !== -1 && ppy !== -1 && px !== -1 && py !== -1) {
                buffer.beginShape();
                buffer.vertex(ppx, ppy);
                buffer.quadraticVertex(px, py, x, y);
                buffer.endShape();
            } else if (px !== -1 && py !== -1) {
                buffer.line(px, py, x, y);
            }
            break;
        case 'circle':
            buffer.ellipse(x, y, dynaStrokeWeight * 1.5, dynaStrokeWeight * 1.5);
            break;
    }
}

function mouseDragged() {
    const now = millis();

    if (now - lastDrawEvent < drawThrottleInterval) {
        return false;
    }
    lastDrawEvent = now;

    if (!drawingBuffer || drawingBuffer.width <= 0 || drawingBuffer.height <= 0) {
        return false;
    }

    if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height && mouseIsPressed) {
        drawKaleidoscopeShape(drawingBuffer, mouseX, mouseY, pmouseX, pmouseY, prevMouseX, prevMouseY, currentShape, currentPenColor, strokeThickness);

        prevMouseX = pmouseX;
        prevMouseY = pmouseY;
    }
    return false;
}

function mousePressed() {
    if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
        if (usePaletteColor) {
            nextColorFromPalette();
        }
        prevMouseX = mouseX;
        prevMouseY = mouseY;

        if (currentShape === 'circle') {
            drawKaleidoscopeShape(drawingBuffer, mouseX, mouseY, mouseX, mouseY, mouseX, mouseY, currentShape, currentPenColor, strokeThickness);
        }
    }
}

function mouseReleased() {
    prevMouseX = -1;
    prevMouseY = -1;
}

function windowResized() {
    let containerW = canvasContainer.offsetWidth;
    let containerH = canvasContainer.offsetHeight;

    let newW = max(1, containerW);
    let newH = max(1, containerH);

    if (newW !== cachedWidth || newH !== cachedHeight) {
        resizeCanvas(newW, newH);

        let oldBufferImage;
        if (drawingBuffer && drawingBuffer.width > 0 && drawingBuffer.height > 0) {
            oldBufferImage = drawingBuffer.get();
        }

        if (drawingBuffer) {
            drawingBuffer.remove();
        }

        drawingBuffer = createGraphics(newW, newH);
        setupDrawingBuffer(drawingBuffer, newW, newH);

        if (oldBufferImage && oldBufferImage.width > 0 && oldBufferImage.height > 0) {
            drawingBuffer.image(oldBufferImage, 0, 0, newW, newH, 0, 0, oldBufferImage.width, oldBufferImage.height);
        }

        cachedWidth = newW;
        cachedHeight = newH;
        cachedCenterX = cachedWidth / 2;
        cachedCenterY = cachedHeight / 2;

        needsRedraw = true;
    }
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

window.clearUserCanvas = function () {
    if (drawingBuffer && drawingBuffer.width > 0 && drawingBuffer.height > 0) {
        drawingBuffer.background(bgColor[0], bgColor[1], bgColor[2]);
        needsRedraw = true;
    }
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

window.setRandomPalette = function () {
    usePaletteColor = true;
    currentPaletteIndex = floor(random(colorPalettes.length));
    colorIndexInPalette = 0;
    nextColorFromPalette();
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
    needsRedraw = true;
};
