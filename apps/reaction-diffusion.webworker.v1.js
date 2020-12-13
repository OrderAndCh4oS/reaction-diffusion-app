'use strict';

function makeIterationTracker() {
    let startTime;
    let iterations;
    let currentTime;
    return {
        increment: () => {
            iterations++;
            if(iterations % 10 === 0) {
                const secs = (performance.now() - startTime) / 1000;
                currentTime = secs;
                const iterationsPerSec = iterations / secs;
                postMessage({
                    type: 'iter',
                    str: `t=${secs.toFixed(1)}s Itn=${iterations} IPS=${iterationsPerSec.toFixed(1)}`,
                });
            }
        },
        start: (continueFromLast, iterationData) => {
            if (continueFromLast && iterationData) {
                iterations = iterationData.iterations;
            } else {
                iterations = 0;
            }
            currentTime = 0;
            const now = performance.now();
            startTime = continueFromLast ? now - (iterationData.currentTime * 1000) : now;
        },
        get: () => ({iterations, currentTime}),
    };
}

const iterationTracker = makeIterationTracker();

function distanceTo(aX, aY, bX, bY) {
    const dX = aX - bX;
    const dY = aY - bY;

    return Math.sqrt((dX * dX) + (dY * dY));
}

function initGridCellBox(size, x, y) {
    if((x >= (size * 0.4) && x <= (size * 0.6)) && (y >= (size * 0.4) && y <= (size * 0.6))) {
        return {a: 0, b: 1};
    }
    return {a: 1, b: 0};
}

function initGridCellCircle(size, x, y) {
    const mid = ~~(size * 0.5);
    const d = distanceTo(mid, mid, x, y);
    if(d < size * 0.15) {
        return {a: 0, b: 1};
    }
    return {a: 1, b: 0};
}
function makeBlobInit(size, count, radius) {
    const blobs = [];
    const innerScale = 1 - radius * 2.5;
    for(let i = 0; i < count; i++) {
        const x = (Math.random() * ~~(size * innerScale)) + ~~(size * radius);
        const y = (Math.random() * ~~(size * innerScale)) + ~~(size * radius);
        blobs.push({x, y});
    }

    return function initGridCellBlob(size, x, y) {
        for(const blob of blobs) {
            const d = distanceTo(blob.x, blob.y, x, y);
            if(d < size * radius) {
                return {a: 0, b: 1};
            }
        }

        return {a: 1, b: 0};
    }
}


function run(eventData) {
    const {size, shape, diffusionRateA, diffusionRateB, feedRate, killRate, deltaTime, continueFrom, iterationData, lastGrid, iterations, drawEveryNIterations} = eventData;

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
    let shapeFunction;

    switch(shape) {
        case 'box':
            shapeFunction = initGridCellBox
            break;
        case 'circle':
            shapeFunction = initGridCellCircle
            break;
        case 'five-large-blobs':
            shapeFunction = makeBlobInit(size, 5, 0.125);
            break;
        case 'nine-medium-blobs':
            shapeFunction = makeBlobInit(size, 9, 0.075);
            break;
        case 'twelve-small-blobs':
            shapeFunction = makeBlobInit(size, 12, 0.066);
            break;
        case 'fifteen-tiny-blobs':
            shapeFunction = makeBlobInit(size, 15, 0.04);
            break;
        default:
            throw new Error('Unhandled shape');
    }

    if(continueFrom && lastGrid) {
        gridFrom = lastGrid;
    } else {
        gridFrom = [...Array(gridWidth)].map((_, x) => [...Array(gridHeight)].map((_, y) => shapeFunction(size, x, y)));
    }

    gridTo = [...Array(gridWidth)].map(
        (_, x) => [...Array(gridHeight)].map((_, y) => ({a: null, b: null}))
    );

    const killPlusFeed = killRate + feedRate;

    function getA(a, aDiffusion, b) {
        return a + ((diffusionRateA * aDiffusion) - (a * b * b) + (feedRate * (1 - a))) * deltaTime;
    }

    function getB(b, bDiffusion, a) {
        return b + (((diffusionRateB * bDiffusion) + (a * b * b)) - ((killPlusFeed) * b)) * deltaTime;
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

                const a = gridCell4.a;
                const b = gridCell4.b;

                let aDiffusion = gridCell0.a * laplacian0;
                aDiffusion += gridCell1.a * laplacian1;
                aDiffusion += gridCell2.a * laplacian2;
                aDiffusion += gridCell3.a * laplacian3;
                aDiffusion += a * laplacian4;
                aDiffusion += gridCell5.a * laplacian5;
                aDiffusion += gridCell6.a * laplacian6;
                aDiffusion += gridCell7.a * laplacian7;
                aDiffusion += gridCell8.a * laplacian8;

                let bDiffusion = gridCell0.b * laplacian0;
                bDiffusion += gridCell1.b * laplacian1;
                bDiffusion += gridCell2.b * laplacian2;
                bDiffusion += gridCell3.b * laplacian3;
                bDiffusion += b * laplacian4;
                bDiffusion += gridCell5.b * laplacian5;
                bDiffusion += gridCell6.b * laplacian6;
                bDiffusion += gridCell7.b * laplacian7;
                bDiffusion += gridCell8.b * laplacian8;

                gridTo[x][y].a = getA(a, aDiffusion, b);
                gridTo[x][y].b = getB(b, bDiffusion, a);
            }
        }
        [gridTo, gridFrom] = [gridFrom, gridTo];
    }

    iterationTracker.start(continueFrom, iterationData);

    for(let i = 0; i <= iterations; i++) {
        if(i % drawEveryNIterations === 0 || i === iterations - 1) {
            postMessage({
                type: 'grid',
                iterationData: iterationTracker.get(),
                grid: gridFrom,
            });
        }
        update();
        iterationTracker.increment();
    }
    postMessage({type: 'complete'});
    close();
}

onmessage = function(event) {
    const data = JSON.parse(event.data.data)
    switch(event.data.type) {
        case 'start':
            run(data);
            break;
        default:
            console.log('Unhandled event type', event);
    }
};
