'use strict';

function makeIterationTracker() {
    let startTime;
    let iteration;
    let currentTime;
    return {
        increment: () => {
            iteration++;
            if(iteration % 10 === 0) {
                const secs = (performance.now() - startTime) / 1000;
                currentTime = secs;
                const iterationsPerSec = iteration / secs;
                postMessage({
                    type: 'iter',
                    str: `t=${secs.toFixed(1)}s Itn=${iteration} IPS=${iterationsPerSec.toFixed(1)}`,
                });
            }
        },
        start: (continueFromLast, lastTime) => {
            iteration = 0;
            currentTime = 0;
            const now = performance.now();
            startTime = continueFromLast ? performance.now() - lastTime : now;
        },
        get: () => currentTime,
    };
}

const iterationTracker = makeIterationTracker();

function initGridCellBox(x, y) {
    if((x >= 40 * 2.5 && x <= 60 * 2.5) && (y >= 40 * 2.5 && y <= 60 * 2.5)) {
        return {a: 0, b: 1};
    }
    return {a: 1, b: 0};
}

function run(eventData) {
    const {size, diffusionRateA, diffusionRateB, feedRate, killRate, deltaTime, continueFrom, lastTime, lastGrid, iterations, drawEveryNIterations} = eventData;
    console.log(eventData);

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

                const gridCell0 = gridFrom[top][left];
                const gridCell1 = gridFrom[top][y];
                const gridCell2 = gridFrom[top][right];
                const gridCell3 = gridFrom[x][left];
                const gridCell4 = gridFrom[x][y];
                const gridCell5 = gridFrom[x][right];
                const gridCell6 = gridFrom[bottom][left];
                const gridCell7 = gridFrom[bottom][y];
                const gridCell8 = gridFrom[bottom][right];
                const midCellA = gridCell4.a;
                const midCellB = gridCell4.b;

                let aDiffusion = gridCell0.a * laplacian0;
                aDiffusion += gridCell1.a * laplacian1;
                aDiffusion += gridCell2.a * laplacian2;
                aDiffusion += gridCell3.a * laplacian3;
                aDiffusion += midCellA * laplacian4;
                aDiffusion += gridCell5.a * laplacian5;
                aDiffusion += gridCell6.a * laplacian6;
                aDiffusion += gridCell7.a * laplacian7;
                aDiffusion += gridCell8.a * laplacian8;

                let bDiffusion = gridCell0.b * laplacian0;
                bDiffusion += gridCell1.b * laplacian1;
                bDiffusion += gridCell2.b * laplacian2;
                bDiffusion += gridCell3.b * laplacian3;
                bDiffusion += midCellB * laplacian4;
                bDiffusion += gridCell5.b * laplacian5;
                bDiffusion += gridCell6.b * laplacian6;
                bDiffusion += gridCell7.b * laplacian7;
                bDiffusion += gridCell8.b * laplacian8;

                const a = midCellA;
                const b = midCellB;

                gridTo[x][y].a = getA(a, aDiffusion, b);
                gridTo[x][y].b = getB(b, bDiffusion, a);
            }
        }
        [gridTo, gridFrom] = [gridFrom, gridTo];
    }

    iterationTracker.start(continueFrom, lastTime);

    for(let i = 0; i < iterations; i++) {
        if(i % drawEveryNIterations === 0) {
            postMessage({
                type: 'grid',
                currentTime: iterationTracker.get(),
                grid: gridFrom,
            });
        }
        update();
        iterationTracker.increment();
    }
    postMessage({type: 'complete'});
}

onmessage = function(event) {
    switch(event.data.type) {
        case 'start':
            console.log('start');
            run(event.data.data);
            break;
        default:
            console.log('Unhandled event type', event);
    }
};

