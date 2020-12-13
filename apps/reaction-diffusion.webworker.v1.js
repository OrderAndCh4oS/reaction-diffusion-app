'use strict';

let isRunning = false;

function makeIterationTracker() {
    let iteration = -1;
    let startTime;
    let currentTime = 0;
    return {
        increment: () => {
            iteration++;
            if(iteration % 10 === 0) {
                const secs = (performance.now() - startTime) / 1000;
                currentTime = secs;
                const iterationsPerSec = iteration / secs;
                postMessage({
                    type: 'iter',
                    str: `t=${secs.toFixed(1)}s Itn=${iteration} IPS=${iterationsPerSec.toFixed(
                        1)}`,
                });
            }
        },
        start: (continueFromLast, lastTime) => {
            const now = performance.now();
            startTime = continueFromLast ? performance.now() - lastTime : now;
            iteration = 0;
        },
        get: () => currentTime,
    };
}

function initGridCellBox(x, y) {
    if((x >= 40 * 2.5 && x <= 60 * 2.5) && (y >= 40 * 2.5 && y <= 60 * 2.5)) {
        return {a: 0, b: 1};
    }
    return {a: 1, b: 0};
}

function run(eventData) {
    const {size, diffusionRateA, diffusionRateB, feedRate, killRate, deltaTime, continueFrom, lastTime, lastGrid, iterations, drawEveryNIterations} = eventData;

    const iterationTracker = makeIterationTracker();

    const laplacian0 = 0.05;
    const laplacian1 = 0.2;
    const laplacian2 = 0.05;
    const laplacian3 = 0.2;
    const laplacian4 = -1;
    const laplacian5 = 0.2;
    const laplacian6 = 0.05;
    const laplacian7 = 0.2;
    const laplacian8 = 0.05;

    const gridWidth = size;
    const gridHeight = size;

    let gridFrom, gridTo;

    if(continueFrom && lastGrid) {
        gridFrom = lastGrid;
    } else {
        gridFrom = [...Array(gridWidth)].map(
            (_, x) => [...Array(gridHeight)].map((_, y) => initGridCellBox(x, y)));
    }

    gridTo = [...Array(gridWidth)].map(
        (_, x) => [...Array(gridHeight)].map((_, y) => ({a: null, b: null})));

    const killPlusFeed = killRate + feedRate;

    function getA(a, aDiffusion, b) {
        return a + ((diffusionRateA * aDiffusion) - (a * b * b) + (feedRate * (1 - a))) *
            deltaTime;
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

                let aDiffusion = gridFrom[top][left].a * laplacian0;
                aDiffusion += gridFrom[top][y].a * laplacian1;
                aDiffusion += gridFrom[top][right].a * laplacian2;
                aDiffusion += gridFrom[x][left].a * laplacian3;
                aDiffusion += gridFrom[x][y].a * laplacian4;
                aDiffusion += gridFrom[x][right].a * laplacian5;
                aDiffusion += gridFrom[bottom][left].a * laplacian6;
                aDiffusion += gridFrom[bottom][y].a * laplacian7;
                aDiffusion += gridFrom[bottom][right].a * laplacian8;

                let bDiffusion = gridFrom[top][left].b * laplacian0;
                bDiffusion += gridFrom[top][y].b * laplacian1;
                bDiffusion += gridFrom[top][right].b * laplacian2;
                bDiffusion += gridFrom[x][left].b * laplacian3;
                bDiffusion += gridFrom[x][y].b * laplacian4;
                bDiffusion += gridFrom[x][right].b * laplacian5;
                bDiffusion += gridFrom[bottom][left].b * laplacian6;
                bDiffusion += gridFrom[bottom][y].b * laplacian7;
                bDiffusion += gridFrom[bottom][right].b * laplacian8;

                const a = gridFrom[x][y].a;
                const b = gridFrom[x][y].b;

                gridTo[x][y].a = getA(a, aDiffusion, b);
                gridTo[x][y].b = getB(b, bDiffusion, a);
            }
        }
        [gridTo, gridFrom] = [gridFrom, gridTo];
    }

    iterationTracker.start(continueFrom, lastTime);
    for(let i = iterations - 1; i >= 0; i--) {
        if(i === 0) {
            isRunning = false;
            postMessage({
                type: 'grid',
                status: 'complete',
                currentTime: iterationTracker.get(),
                grid: gridFrom,
            });
            return;
        }
        if(i % drawEveryNIterations === 0) {
            postMessage({
                type: 'grid',
                status: 'running',
                currentTime: iterationTracker.get(),
                grid: gridFrom,
            });
        }
        update();
        iterationTracker.increment();
    }
}

onmessage = function(event) {
    switch(event.data.type) {
        case 'start':
            if(!isRunning) {
                isRunning = true;
                run(event.data.data);
            }
            break;
        default:
            console.log('Unhandled event type', event);
    }
};
