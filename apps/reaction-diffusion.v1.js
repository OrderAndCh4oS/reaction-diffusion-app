'use strict';

const size = 250;

const generateButton = document.getElementById('GenerateButton');
const canvas = document.getElementById('reaction-diffusion-canvas');
const context = canvas.getContext('2d');
canvas.style.width = size + 'px';
canvas.style.height = size + 'px';
const scale = window.devicePixelRatio;
canvas.width = size * scale;
canvas.height = size * scale;
context.scale(scale, scale);

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

const generateButtonState = makeGenerateButtonState(generateButton, 'Generate',
    `Processing<span class="loading"></span>`);

const round = (value, precision) => {
    const multiplier = Math.pow(10, precision || 0);
    return Math.round(value * multiplier) / multiplier;
};

//One universal basic required here to get things going once loaded
window.onload = function() {
    //We need to set up buttons in this onload section
    generateButton.addEventListener('click', function() {
        Main(true);
    });
    restoreDefaultValues(); //Un-comment this if you want to start with defaults
    Main(true);
};

function drawResult(result) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    for(let x = 1; x < result.length - 1; x++) {
        for(let y = 1; y < result[x].length - 1; y++) {
            context.fillStyle = `rgb(${result[x][y].a * 255}, ${result[x][y].a * 255}, ${(1 -
                result[x][y].b) * 255})`;
            context.fillRect(x, y, 1, 1);
        }
    }
}

//It does no calculations itself, it merely sets them up, sends off variables, gets results and, if necessary, plots them.
function Main(generate = false) {
    //Save settings every time you calculate, so they're always ready on a reload
    saveSettings();

    //Send all the inputs as a structured object
    //If you need to convert to, say, SI units, do it here!
    const inputs = {
        diffusionRateA: round(sliders.SlideDiffusionRateA.value, 2),
        diffusionRateB: round(sliders.SlideDiffusionRateB.value, 2),
        feedRate: round(sliders.SlideFeedRate.value, 4),
        killRate: round(sliders.SlideKillRate.value, 4),
        deltaTime: round(sliders.SlideDeltaTime.value, 2),
        iterations: round(sliders.SlideIterations.value),
    };

    if(!generate) return;

    generateButtonState.setIsGenerating(true);

    setTimeout(function() {
        CalcIt(inputs).then(result => {
            if(!result) {
                return;
            }

            drawResult(result);

            generateButtonState.setIsGenerating(false);
        });
    }, 50);
}

//Here's the app calculation
//The inputs are just the names provided - their order in the curly brackets is unimportant!
//By convention the input values are provided with the correct units within Main
async function CalcIt({diffusionRateA, diffusionRateB, feedRate, killRate, deltaTime, iterations}) {

    const gridWidth = size;
    const gridHeight = size;

    function initGridCellBox(x, y) {
        if((x >= 40 * 2.5 && x <= 60 * 2.5) && (y >= 40 * 2.5 && y <= 60 * 2.5)) {
            return {a: 0, b: 1};
        }
        return {a: 1, b: 0};
    }

    let gridFrom = [...Array(gridWidth)].map(
        (_, x) => [...Array(gridHeight)].map((_, y) => initGridCellBox(x, y)));
    let gridTo = [...Array(gridWidth)].map(
        (_, x) => [...Array(gridHeight)].map((_, y) => ({a: 1, b: 0})));

    const killPlusFeed = killRate + feedRate;

    const laplacianMatrix = [
        [0.05, 0.2, 0.05],
        [0.2, -1, 0.2],
        [0.05, 0.2, 0.05],
    ];

    function getA(a, aDiffusion, b) {
        return a + ((diffusionRateA * aDiffusion) - (a * b * b) + (feedRate * (1 - a))) * deltaTime;
    }

    function getB(b, bDiffusion, a) {
        return b + (((diffusionRateB * bDiffusion) + (a * b * b)) - ((killPlusFeed) * b)) *
            deltaTime;
    }

    function update() {
        for(let x = 0; x < gridFrom.length; x++) {
            const top = x > 0 ? x - 1 : gridFrom.length - 1;
            const bottom = x < gridFrom.length - 1 ? x + 1 : 0;
            for(let y = 0; y < gridFrom[x].length; y++) {
                const left = y > 0 ? y - 1 : gridFrom[x].length - 1;
                const right = y < gridFrom[x].length - 1 ? y + 1 : 0;

                let aDiffusion = gridFrom[top][left]['a'] * laplacianMatrix[0][0];
                aDiffusion += gridFrom[top][y]['a'] * laplacianMatrix[0][1];
                aDiffusion += gridFrom[top][right]['a'] * laplacianMatrix[0][2];
                aDiffusion += gridFrom[x][left]['a'] * laplacianMatrix[1][0];
                aDiffusion += gridFrom[x][y]['a'] * laplacianMatrix[1][1];
                aDiffusion += gridFrom[x][right]['a'] * laplacianMatrix[1][2];
                aDiffusion += gridFrom[bottom][left]['a'] * laplacianMatrix[2][0];
                aDiffusion += gridFrom[bottom][y]['a'] * laplacianMatrix[2][1];
                aDiffusion += gridFrom[bottom][right]['a'] * laplacianMatrix[2][2];

                let bDiffusion = gridFrom[top][left]['b'] * laplacianMatrix[0][0];
                bDiffusion += gridFrom[top][y]['b'] * laplacianMatrix[0][1];
                bDiffusion += gridFrom[top][right]['b'] * laplacianMatrix[0][2];
                bDiffusion += gridFrom[x][left]['b'] * laplacianMatrix[1][0];
                bDiffusion += gridFrom[x][y]['b'] * laplacianMatrix[1][1];
                bDiffusion += gridFrom[x][right]['b'] * laplacianMatrix[1][2];
                bDiffusion += gridFrom[bottom][left]['b'] * laplacianMatrix[2][0];
                bDiffusion += gridFrom[bottom][y]['b'] * laplacianMatrix[2][1];
                bDiffusion += gridFrom[bottom][right]['b'] * laplacianMatrix[2][2];

                const a = gridFrom[x][y].a;
                const b = gridFrom[x][y].b;

                gridTo[x][y].a = getA(a, aDiffusion, b);
                gridTo[x][y].b = getB(b, bDiffusion, a);
            }
        }
        gridFrom = [...gridTo];
    }

    return new Promise(resolve => {
        function recursiveUpdate(i) {
            if(i > 0 && i % 100 !== 0) {
                update();
                recursiveUpdate(i-1)
                return;
            }
            if(i > 0) {
                requestAnimationFrame(function() {
                    drawResult(gridFrom);
                    update();
                    recursiveUpdate(i-1);
                });
                return;
            }
            drawResult(gridFrom);
            resolve(gridFrom);
        }
        recursiveUpdate(iterations);
    });
}

