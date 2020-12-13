'use strict';

const size = 250;
const generateButtonEl = document.getElementById('GenerateButton');
const stopButtonEl = document.getElementById('StopButton');
const iterationTrackerEl = document.getElementById('InputIterations');
const continueCheckboxEl = document.getElementById('ContinueCheckbox');

const canvas = document.getElementById('reaction-diffusion-canvas');
const context = canvas.getContext('2d');
canvas.style.width = size + 'px';
canvas.style.height = size + 'px';
const scale = window.devicePixelRatio;
canvas.width = size * scale;
canvas.height = size * scale;
context.scale(scale, scale);
const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
const data = new Uint32Array(imageData.data.buffer);

let lastGrid = null;
let lastTime = 0;
let worker = null;

function getWorker() {
    const worker = new Worker('apps/reaction-diffusion.webworker.v1.js');

    worker.onmessage = function(event) {
        switch(event.data.type) {
            case 'iter':
                iterationTrackerEl.value = event.data.str;
                break;
            case 'grid':
                draw(event.data.grid);
                lastTime = event.data.currentTime;
                lastGrid = event.data.grid;
                break;
            case 'complete':
                generateButtonState.setIsGenerating(false);
                break;
            case 'message':
                console.log('Message', event.data.message);
                break;
            default:
                console.log('Unhandled Webworker message type', event);
        }
    };

    return worker;
}

function makeGenerateButtonState(button, defaultInnerHtml, generatingInnerHtml) {
    let isGenerating = false;
    button.innerHTML = defaultInnerHtml;
    return ({
        setIsGenerating: (value) => {
            isGenerating = value;
            button.innerHTML = isGenerating ? generatingInnerHtml : defaultInnerHtml;
            button.disabled = isGenerating;
        },
        isGenerating,
    });
}

const generateButtonState = makeGenerateButtonState(
    generateButtonEl,
    'Generate',
    `Processing<span class="loading"></span>`,
);

const round = (value, precision) => {
    const multiplier = Math.pow(10, precision || 0);
    return Math.round(value * multiplier) / multiplier;
};

window.onload = function() {
    generateButtonEl.addEventListener('click', function() {
        Main(true);
    });
    stopButtonEl.addEventListener('click', function() {
        generateButtonState.setIsGenerating(false);
        worker.terminate();
    });
    restoreDefaultValues();
};

function draw(result) {
    let count = 0;
    for(let x = 0; x < canvas.width; x++) {
        for(let y = 0; y < canvas.height; y++) {
            count++;
            const resultX = ~~(x / scale); // ~~ bitwise floor
            const resultY = ~~(y / scale);
            const rg = (result[resultX][resultY].a * 255) & 0xff;
            const b = ((1 - result[resultX][resultY].b) * 255) & 0xff;

            data[x * canvas.width + y] = (255 << 24) |    // alpha
                (b << 16) |    // blue
                (rg << 8) |    // green
                rg;            // red;
        }
    }

    context.putImageData(imageData, 0, 0);
}

function Main(generate = false) {
    saveSettings();

    if(!generate) return;

    const data = {
        size,
        diffusionRateA: round(sliders.SlideDiffusionRateA.value, 2),
        diffusionRateB: round(sliders.SlideDiffusionRateB.value, 2),
        feedRate: round(sliders.SlideFeedRate.value, 4),
        killRate: round(sliders.SlideKillRate.value, 4),
        deltaTime: round(sliders.SlideDeltaTime.value, 2),
        continueFrom: continueCheckboxEl.checked,
        iterations: round(sliders.SlideIterations.value),
        drawEveryNIterations: round(sliders.SlideDrawEveryNIterations.value),
        lastTime,
        lastGrid,
    };

    generateButtonState.setIsGenerating(true);

    CalcIt(data);
}

function CalcIt(data) {
    if(!worker) {
        worker = getWorker();
    } else {
        worker.terminate();
        worker = getWorker();
    }
    worker.postMessage({
        type: 'start',
        data: JSON.stringify(data),
    });
}

