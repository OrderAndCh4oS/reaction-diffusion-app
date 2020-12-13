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
let lastGrid = null;
let lastTime = 0;
let worker = getWorker();

function getWorker() {
    return new Worker('apps/reaction-diffusion.webworker.v1.js');
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
        worker.terminate();
        worker = new Worker('apps/reaction-diffusion.webworker.v1.js');
        generateButtonState.setIsGenerating(false);
    });
    restoreDefaultValues();
    Main(true);
};

function draw(result) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    for(let x = 1; x < result.length - 1; x++) {
        for(let y = 1; y < result[x].length - 1; y++) {
            context.fillStyle = `rgb(${result[x][y].a * 255}, ${result[x][y].a * 255}, ${(1 -
                result[x][y].b) * 255})`;
            context.fillRect(x, y, 1, 1);
        }
    }
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
    worker.postMessage({
        type: 'start',
        data,
    });
}

worker.onmessage = function(event) {
    switch(event.data.type) {
        case 'iter':
            iterationTrackerEl.value = event.data.str;
            break;
        case 'grid':
            draw(event.data.grid);
            lastTime = event.data.currentTime;
            lastGrid = event.data.grid;
            if(event.data.status === 'complete')
                generateButtonState.setIsGenerating(false);
            break;
        case 'message':
            console.log('Message', event.data.message);
            break;
        default:
            console.log('Unhandled Webworker message type', event);
    }
};

