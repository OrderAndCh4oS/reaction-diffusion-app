const store = window.location.pathname;
const inputEls = document.querySelectorAll('input');
const selectEls = document.querySelectorAll('select');
const codeBoxes = document.querySelectorAll('.codeToggle');
const sliders = {};
const defaultValues = {};
let firstTime = true,
    restoring=false

function RunMain() {
    if (typeof Main === 'function' && !restoring) Main();
}

(function () {
    let resizeTimeout;

    window.addEventListener('resize', resizeThrottler, false);

    function resizeThrottler() {
        // ignore resize events as long as an calcIt execution is in the queue
        if (!resizeTimeout) {
            resizeTimeout = setTimeout(function () {
                resizeTimeout = null;
                RunMain();
                // The calcIt will execute at a rate of 15fps
            }, 66);
        }
    }
}());

(function () {
    function setUpInput(input) {
        switch (input.type) {
            case 'checkbox':
            case 'radio':
                input.addEventListener('change', RunMain);
                defaultValues[input.id] = input.checked
                break;
            case 'range':
                sliders[input.id] = new LogSlider({ id: input.id, callback: RunMain });
                defaultValues[input.id] = input.value;
                break
            default:
                input.addEventListener('change', RunMain);
                defaultValues[input.id] = input.value;
        }
    }

    function setUpSelect(selector) {
        selector.addEventListener('change', RunMain);
        defaultValues[selector.id] = selector.options[selector.selectedIndex].value;
    }

    function updateCodeToggleText(toggle) {
        if (toggle.nextElementSibling.classList.contains('show')) {
            toggle.innerHTML = 'Hide Code';
        } else {
            toggle.innerHTML = 'Show Code';
        }
    }

    function setUpToggle(toggle) {
        updateCodeToggleText(toggle);
        toggle.addEventListener('click', function () {
            toggle.nextElementSibling.classList.toggle('show');
            updateCodeToggleText(toggle);
        });
    }

    inputEls.forEach(setUpInput);
    selectEls.forEach(setUpSelect);
    codeBoxes.forEach(setUpToggle);

    let storedSettings = window.localStorage.getItem(store);
    if (storedSettings) {
        for (const inputData of storedSettings.split('\n')) {
            const [name, value] = inputData.split(':');
            const input = document.getElementById(name);
            if (!input) continue;
            switch (input.type) {
                case 'checkbox':
                case 'radio':
                    input.checked = value === 'true';
                    break;
                case 'range':
                    sliders[name].value = value;
                    break;
                default:
                    input.value = value;
            }
        }
    }
}());

function saveSettings() {
    if (window.localStorage) {
        const selectors = [
            ...document.querySelectorAll('input'),
            ...document.querySelectorAll('select'),
        ];
        const serialisedInputs = selectors.reduce(function (str, item) {
            switch (item.type) {
                case 'checkbox':
                case 'radio':
                    str += item.id + ':' + item.checked + '\n';
                    break;
                case 'range':
                    str += item.id + ':' + sliders[item.id].value + '\n';
                    break;
                default:
                    str += item.id + ':' + item.value + '\n';
            }
            return str;
        }, '');
        window.localStorage.setItem(store, serialisedInputs);
    }
}

function restoreDefaultValues() {
    restoring=true
    window.localStorage.removeItem(store);

    function resetInput(input) {
        switch (input.type) {
            case 'checkbox':
            case 'radio':
                input.checked = defaultValues[input.id]
                break;
            case 'range':
                sliders[input.id].inputValue = defaultValues[input.id];
                break
            default:
                input.value = defaultValues[input.id];
        }
    }

    function resetSelect(select) {
        select.value = defaultValues[select.id];
    }

    inputEls.forEach(resetInput);
    selectEls.forEach(resetSelect);
    restoring=false
    RunMain();
}

const resetButton = document.getElementById('ResetInputs');
if (resetButton) resetButton.addEventListener('click', restoreDefaultValues)

Chart.plugins.register({
    // Needed to set Chart background to white
    beforeDraw: function (chartInstance, easing) {
        const ctx = chartInstance.chart.ctx;
        ctx.fillStyle = 'white'; // your chart color here
        const chartArea = chartInstance.chartArea;
        ctx.fillRect(chartArea.left, chartArea.top,
            chartArea.right - chartArea.left,
            chartArea.bottom - chartArea.top);
    },
});

try{
    hljs.initHighlightingOnLoad();
} catch {}


//It's a lot of work to plot anything and it seems all very bothersome setting it up
//But doing it this way is MUCH easier than doing it unstructured as I'd done before
//With luck, you'll not have to tweak PlotIt if you've provided all the right inputs
function plotIt(plots, canvas) {
    Chart.defaults.global.animation.duration = 0;
    const data = [], labels = [], borderDash = [], borderWidth = [], lineTension = [], isFilled = [];
    for (let i = 0; i < plots.plotData.length; i++) {
        data.push(plots.plotData[i]);
        labels.push(plots.lineLabels[i]);
        if (plots.dottedLine && plots.dottedLine[i]) { borderDash.push([10, 5]) } else { borderDash.push([]) }
        if (plots.borderWidth && plots.borderWidth[i]) { borderWidth.push(plots.borderWidth[i]) } else { borderWidth.push(3) }
        if (plots.isStraight && plots.isStraight[i]) { lineTension.push(0) } else { lineTension.push() }
        if (plots.isFilled && plots.isFilled[i]) { isFilled.push(true) } else { isFilled.push(false) }
    }
    let xLabel, yLabel, y2Label;
    const xInfo = plots.xLabel;
    const yInfo = plots.yLabel;
    const y2Info = plots.y2Label;
    xLabel = plots.xLabel.replace('&', ' ');
    yLabel = plots.yLabel.replace('&', ' ');
    y2Label = plots.y2Label;
    if (y2Label) y2Label = y2Label.replace('&', ' ');
    const logLinX = plots.logX ? 'logarithmic' : 'linear';
    const logLinY = plots.logY ? 'logarithmic' : 'linear';
    const minX = plots.xMinMax[0];
    const maxX = plots.xMinMax[1];
    const minY = plots.yMinMax[0];
    const maxY = plots.yMinMax[1];
    const minY2 = plots.y2MinMax[0];
    const maxY2 = plots.y2MinMax[1];
    const theXSigFigs = plots.xSigFigs ? plots.xSigFigs : 'F2';
    const theYSigFigs = plots.ySigFigs ? plots.ySigFigs : 'F2';
    const legendPosition = plots.legendPosition;
    let showLegend = true
    if (plots.hideLegend) showLegend = false
    const theData = [];
    let yAxisL1R2 = plots.yAxisL1R2
    //Most plots are just the left axis, so users don't need to bother to provide the 1 values
    if (yAxisL1R2.length === 0) {
        for (let i = 0; i < plots.plotData.length; i++) {
            yAxisL1R2.push(1)
        }
    }
    let theColors = []
    //The user can provide them, otherwise use these
    if (plots.colors) {
        theColors = plots.colors
    } else {
        theColors = ['#edc240', '#afd8f8', '#cb4b4b', '#4da74d', '#9440ed', 'red', 'green', 'blue', 'orange', 'cyan', 'magenta'];
    }
    const xPre = xInfo.split('&'), yPre = yInfo.split('&');
    const showY2 = !!y2Label
    const theXPrefix = 'At ' + xPre[0] + ' = ', theXPostfix = ' ' + xPre[1];
    if (showY2) { yPre[0] = "y"; yPre[1] = "" } //Too hard to show different labels for 2 Y axes
    const theYPrefix = yPre[0] + ' = ', theYPostfix = ' ' + yPre[1];
    for (let i = 0; i < data.length; i++) {
        theData.push({
            label: labels[i],
            borderColor: theColors[i],
            backgroundColor: theColors[i],
            borderWidth: borderWidth[i],
            borderDash: borderDash[i],
            data: data[i],
            lineTension: lineTension[i],
            showLine: true,
            pointRadius: 0,
            yAxisID: "y-axis-" + yAxisL1R2[i],
            fill:isFilled[i]
        });
    }

    const config = {
        type: 'scatter',
        data: {
            datasets: theData,
        },
        options: {
            responsive: true,
            legend: { position: legendPosition, display: showLegend },
            maintainAspectRatio: false,
            tooltips: {
                callbacks: {
                    label: function (tooltipItem, data) {
                        let label = data.datasets[tooltipItem.datasetIndex].label ||
                            '';

                        if (label) {
                            label += ': ';
                        }
                        label += theXPrefix + myFormat(tooltipItem.xLabel, theXSigFigs) + theXPostfix + ', ' +
                            theYPrefix + myFormat(tooltipItem.yLabel, theYSigFigs) + theYPostfix;
                        return label;
                    },
                },
                mode: 'nearest',
                intersect: false,
            },
            hover: {
                mode: 'nearest',
                intersect: true,
            },
            scales: {
                xAxes: [
                    {
                        type: logLinX,
                        ticks: {
                            min: minX, max: maxX,
                        },
                        display: true,
                        scaleLabel: {
                            display: true,
                            labelString: xLabel,
                        },
                    }],
                yAxes: [
                    {
                        ticks: { min: minY, max: maxY },
                        type: logLinY,
                        display: true,
                        position: 'left',
                        scaleLabel: {
                            display: true,
                            labelString: yLabel,
                        },
                        id: 'y-axis-1'
                    },
                    {
                        ticks: { min: minY2, max: maxY2 },
                        type: logLinY,
                        display: showY2,
                        position: 'right',
                        scaleLabel: {
                            display: true,
                            labelString: y2Label,
                        },
                        // grid line settings
                        gridLines: {
                            drawOnChartArea: false, // only want the grid lines for one axis to show up
                        },
                        id: 'y-axis-2'
                    }
                ],
            },
        },
    };
    const ctx = document.getElementById(canvas).getContext('2d');
    if (plots.inText) { //This puts text into x,y coordinates on the graph
        let ctxw = ctx.canvas.clientWidth, ctxh = ctx.canvas.clientHeight
        let inText = plots.inText, xofs = 0.055, xdiv = 108, yofs = 104, ydiv = 128
        Chart.helpers.extend(Chart.controllers.scatter.prototype, {
            draw: function () {
                myScatterExtend.apply(this, arguments);
                this.chart.chart.ctx.textAlign = "center"
                for (let i = 0; i < inText.length; i++) {
                    if (inText[i].fillStyle) {
                        this.chart.chart.ctx.fillStyle = inText[i].fillStyle
                    } else {
                        this.chart.chart.ctx.fillStyle = "black"
                    }
                    let fSize = "15px "
                    if (inText[i].fontSize) {
                        fSize = inText[i].fontSize + "px "
                    }
                    let fType = "Calibri"
                    if (inText[i].fontType) {
                        fType = inText[i].fontType
                    }
                    this.chart.chart.ctx.font = fSize + fType;
                    this.chart.chart.ctx.fillText(inText[i].txt, (xofs + inText[i].xp / xdiv) * ctxw, (yofs - inText[i].yp) / ydiv * ctxh)
                }

            }
        });
    }
    //Chart.js has a curious requirement to be destroyed each time
    //If you have multiple graphs you need to call them, say, canvas0, canvas1 etc.
    //Though the first or only canvas can just be called canvas, without the 0
    let id = 0;
    if (!isNaN(canvas.slice(-1))) id = Number(canvas.slice(-1));
    if (!window.myLine) window.myLine = Array(10);
    if (window.myLine[id]) window.myLine[id].destroy();
    window.myLine[id] = new Chart(ctx, config);
    if (plots.inText && firstTime){//Fixes a bug with Chart.js and text positioning
        firstTime=false
        plotIt(plots, canvas)
    }
}

let myScatterExtend = Chart.controllers.scatter.prototype.draw;

function myFormat(label, formatCode) {
    //We have a variety of format choices
    //Just a number is the default for Fixed, F3, P3, E3 do Fixed, Precision and Exponential
    const lVal = parseFloat(label);
    if (!isNaN(formatCode)) formatCode = formatCode.toFixed(0)
    let fCU = formatCode.toUpperCase()
    if (fCU.includes('P')) {
        fCU = fCU.replace('P', '')
        return lVal.toPrecision(parseInt(fCU))
    }
    if (fCU.includes('E')) {
        fCU = fCU.replace('E', '')
        return lVal.toExponential(parseInt(fCU))
    }
    fCU = fCU.replace('F', '')
    return lVal.toFixed(parseInt(fCU))
}
