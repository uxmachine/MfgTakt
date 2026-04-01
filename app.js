// ===== Default Stations =====
const DEFAULT_STATIONS = [
    { name: "Load & Fixture",      type: "manual",  cycleTime: 35, operators: 1 },
    { name: "Screw Driving",       type: "robotic", cycleTime: 22, operators: 0 },
    { name: "Adhesive Dispense",   type: "robotic", cycleTime: 28, operators: 0 },
    { name: "Press Fit",           type: "manual",  cycleTime: 40, operators: 1 },
    { name: "Soldering",          type: "robotic", cycleTime: 18, operators: 0 },
    { name: "Inspection & Test",   type: "manual",  cycleTime: 45, operators: 1 },
    { name: "Packaging",          type: "manual",  cycleTime: 30, operators: 1 },
];

// ===== DOM refs =====
const $ = (sel) => document.querySelector(sel);
const stationsBody = $("#stations-body");

// ===== Initialize =====
document.addEventListener("DOMContentLoaded", () => {
    DEFAULT_STATIONS.forEach((s) => addStationRow(s));
    $("#add-station-btn").addEventListener("click", () => addStationRow());
    $("#calculate-btn").addEventListener("click", calculate);

    // Auto-recalculate on any input change
    document.addEventListener("input", debounce(autoCalc, 400));
    document.addEventListener("change", debounce(autoCalc, 200));
});

let hasCalculated = false;
function autoCalc() {
    if (hasCalculated) calculate();
}

function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ===== Station Row Management =====
function addStationRow(data = {}) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td><input type="text" class="st-name" value="${data.name || ""}" placeholder="Station name"></td>
        <td>
            <select class="st-type">
                <option value="manual" ${data.type === "manual" ? "selected" : ""}>Manual</option>
                <option value="robotic" ${data.type === "robotic" ? "selected" : ""}>Robotic</option>
            </select>
        </td>
        <td><input type="number" class="st-cycle" min="1" value="${data.cycleTime || ""}" placeholder="sec"></td>
        <td><input type="number" class="st-operators" min="0" value="${data.operators ?? 1}"></td>
        <td><button class="btn-remove" title="Remove">&times;</button></td>
    `;
    tr.querySelector(".btn-remove").addEventListener("click", () => {
        tr.remove();
        autoCalc();
    });
    stationsBody.appendChild(tr);
}

// ===== Read Inputs =====
function readInputs() {
    const demandPeriod = $("#demand-period").value;
    const demandQty = parseFloat($("#demand-qty").value) || 0;
    const demandVariation = parseFloat($("#demand-variation").value) || 0;
    const workingDays = parseFloat($("#working-days").value) || 22;
    const shiftsManual = parseFloat($("#shifts-manual").value) || 1;
    const hoursPerShift = parseFloat($("#hours-per-shift").value) || 8;
    const breaksPerShift = parseFloat($("#breaks-per-shift").value) || 0;
    const plannedDowntime = parseFloat($("#planned-downtime").value) || 0;
    const oee = (parseFloat($("#oee").value) || 85) / 100;
    const robots247 = $("#robots-24-7").checked;

    // Convert demand to daily
    let dailyDemand;
    if (demandPeriod === "yearly") {
        dailyDemand = demandQty / (workingDays * 12);
    } else {
        dailyDemand = demandQty / workingDays;
    }
    const dailyDemandPeak = dailyDemand * (1 + demandVariation / 100);

    // Available time per day (seconds) — Manual
    const netMinutesPerShift = (hoursPerShift * 60) - breaksPerShift - plannedDowntime;
    const availManualSec = netMinutesPerShift * 60 * shiftsManual * oee;

    // Available time per day (seconds) — Robotic
    let availRoboticSec;
    if (robots247) {
        // 24h minus only planned downtime per shift × 3 shifts, adjusted by OEE
        const robotNetMin = (24 * 60) - (plannedDowntime * 3);
        availRoboticSec = robotNetMin * 60 * oee;
    } else {
        availRoboticSec = availManualSec; // same as manual if not 24/7
    }

    // Stations
    const rows = stationsBody.querySelectorAll("tr");
    const stations = [];
    rows.forEach((row) => {
        const name = row.querySelector(".st-name").value.trim() || "Unnamed";
        const type = row.querySelector(".st-type").value;
        const cycleTime = parseFloat(row.querySelector(".st-cycle").value) || 0;
        const operators = parseInt(row.querySelector(".st-operators").value) || 0;
        if (cycleTime > 0) {
            stations.push({ name, type, cycleTime, operators });
        }
    });

    return {
        dailyDemand,
        dailyDemandPeak,
        availManualSec,
        availRoboticSec,
        oee,
        stations,
        shiftsManual,
    };
}

// ===== Calculate =====
function calculate() {
    hasCalculated = true;
    const data = readInputs();
    const { dailyDemand, dailyDemandPeak, availManualSec, availRoboticSec, stations } = data;

    if (stations.length === 0 || dailyDemand <= 0) return;

    // Takt times
    const taktBase = availManualSec / dailyDemand;
    const taktPeak = availManualSec / dailyDemandPeak;

    // Per-station analysis
    let bottleneckStation = null;
    let bottleneckEffectiveCycle = 0;
    let totalCycleTime = 0;
    let totalOperators = 0;

    const stationResults = stations.map((st) => {
        const avail = st.type === "robotic" ? availRoboticSec : availManualSec;
        const maxOutput = Math.floor(avail / st.cycleTime);

        // Effective cycle time accounts for available time ratio
        // For robotic stations with more time, their effective takt pressure is different
        const effectiveTakt = avail / dailyDemand;
        const taktRatio = st.cycleTime / effectiveTakt;

        // Determine if this station is bottleneck based on ratio
        if (taktRatio > bottleneckEffectiveCycle) {
            bottleneckEffectiveCycle = taktRatio;
            bottleneckStation = st.name;
        }

        totalCycleTime += st.cycleTime;
        totalOperators += st.operators;

        let status, statusClass;
        if (taktRatio > 1.0) {
            status = "Over Takt";
            statusClass = "badge-danger";
        } else if (taktRatio > 0.85) {
            status = "Near Takt";
            statusClass = "badge-warn";
        } else {
            status = "OK";
            statusClass = "badge-ok";
        }

        return {
            ...st,
            avail,
            maxOutput,
            effectiveTakt,
            taktRatio,
            status,
            statusClass,
        };
    });

    // Line throughput = limited by bottleneck
    const bottleneckResult = stationResults.reduce((worst, s) =>
        s.maxOutput < worst.maxOutput ? s : worst
    , stationResults[0]);
    const throughputPerDay = bottleneckResult.maxOutput;

    // Line balance efficiency
    const numStations = stations.length;
    const maxCycle = Math.max(...stations.map((s) => s.cycleTime));
    const lineBalance = (totalCycleTime / (numStations * maxCycle)) * 100;

    // Meets demand?
    const meetsBase = throughputPerDay >= dailyDemand;
    const meetsPeak = throughputPerDay >= dailyDemandPeak;

    // ===== Render Results =====
    const resultsSection = $("#results-section");
    resultsSection.classList.remove("hidden");

    $("#res-daily-demand").textContent = Math.ceil(dailyDemand) + " units";
    $("#res-daily-demand-peak").textContent = Math.ceil(dailyDemandPeak) + " units";
    $("#res-avail-manual").textContent = formatTime(availManualSec);
    $("#res-avail-robotic").textContent = formatTime(availRoboticSec);
    $("#res-takt").textContent = taktBase.toFixed(1) + " sec";
    $("#res-takt-peak").textContent = taktPeak.toFixed(1) + " sec";
    $("#res-bottleneck").textContent = bottleneckStation;
    $("#res-balance").textContent = lineBalance.toFixed(1) + "%";
    $("#res-throughput").textContent = throughputPerDay.toLocaleString() + " units";
    $("#res-meets-base").textContent = meetsBase ? "Yes" : "No";
    $("#res-meets-base").style.color = meetsBase ? "#155724" : "#721c24";
    $("#res-meets-peak").textContent = meetsPeak ? "Yes" : "No";
    $("#res-meets-peak").style.color = meetsPeak ? "#155724" : "#721c24";
    $("#res-operators").textContent = totalOperators + " (per shift)";

    // Station table
    const tbody = $("#results-body");
    tbody.innerHTML = "";
    stationResults.forEach((s) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${s.name}</strong></td>
            <td>${s.type === "robotic" ? "Robotic" : "Manual"}</td>
            <td>${s.cycleTime} sec</td>
            <td>${formatTime(s.avail)}</td>
            <td>${s.maxOutput.toLocaleString()}</td>
            <td>${(s.taktRatio * 100).toFixed(1)}%</td>
            <td><span class="badge ${s.statusClass}">${s.status}</span></td>
        `;
        tbody.appendChild(tr);
    });

    // Chart
    renderChart(stationResults, taktBase, taktPeak);

    // Recommendations
    renderRecommendations(stationResults, data, taktBase, taktPeak, throughputPerDay, lineBalance, meetsBase, meetsPeak);

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ===== Chart =====
function renderChart(stationResults, taktBase, taktPeak) {
    const container = $("#chart-container");
    container.innerHTML = "";

    const maxVal = Math.max(taktBase, taktPeak, ...stationResults.map((s) => s.cycleTime));
    const chartHeight = 200; // px for bars

    // Takt line (base)
    const taktBaseY = chartHeight - (taktBase / maxVal) * chartHeight;
    const taktLine = document.createElement("div");
    taktLine.className = "takt-line";
    taktLine.style.bottom = `${(taktBase / maxVal) * chartHeight + 40}px`;
    taktLine.innerHTML = `<span class="takt-line-label">Takt (base): ${taktBase.toFixed(1)}s</span>`;
    container.appendChild(taktLine);

    // Takt line (peak)
    const taktLinePeak = document.createElement("div");
    taktLinePeak.className = "takt-line takt-line-peak";
    taktLinePeak.style.bottom = `${(taktPeak / maxVal) * chartHeight + 40}px`;
    taktLinePeak.innerHTML = `<span class="takt-line-label">Takt (peak): ${taktPeak.toFixed(1)}s</span>`;
    container.appendChild(taktLinePeak);

    stationResults.forEach((s) => {
        const group = document.createElement("div");
        group.className = "chart-bar-group";

        const barHeight = (s.cycleTime / maxVal) * chartHeight;
        const bar = document.createElement("div");
        bar.className = `chart-bar ${s.type}`;
        bar.style.height = barHeight + "px";

        const valLabel = document.createElement("div");
        valLabel.className = "chart-bar-value";
        valLabel.textContent = s.cycleTime + "s";

        const nameLabel = document.createElement("div");
        nameLabel.className = "chart-bar-label";
        nameLabel.textContent = s.name;

        group.appendChild(valLabel);
        group.appendChild(bar);
        group.appendChild(nameLabel);
        container.appendChild(group);
    });
}

// ===== Recommendations =====
function renderRecommendations(stationResults, data, taktBase, taktPeak, throughput, lineBalance, meetsBase, meetsPeak) {
    const ul = $("#recommendations");
    ul.innerHTML = "";

    const add = (text, cls) => {
        const li = document.createElement("li");
        li.className = cls;
        li.textContent = text;
        ul.appendChild(li);
    };

    // Bottleneck warnings
    const overTakt = stationResults.filter((s) => s.taktRatio > 1.0);
    const nearTakt = stationResults.filter((s) => s.taktRatio > 0.85 && s.taktRatio <= 1.0);

    if (overTakt.length > 0) {
        overTakt.forEach((s) => {
            const pct = ((s.taktRatio - 1) * 100).toFixed(0);
            add(`"${s.name}" exceeds its effective takt time by ${pct}%. This station is a bottleneck — consider adding a parallel station, reducing cycle time, or converting to robotic.`, "rec-danger");
        });
    }

    if (nearTakt.length > 0) {
        nearTakt.forEach((s) => {
            add(`"${s.name}" is at ${(s.taktRatio * 100).toFixed(0)}% of takt — close to becoming a bottleneck under peak demand.`, "rec-warn");
        });
    }

    if (!meetsBase) {
        add(`Current line configuration cannot meet base daily demand (${Math.ceil(data.dailyDemand)} units). Throughput is ${throughput} units/day. Address bottleneck stations first.`, "rec-danger");
    } else if (!meetsPeak) {
        add(`Line meets base demand but NOT peak demand (+${$("#demand-variation").value}% variation). Consider buffer stock or overtime capacity for demand surges.`, "rec-warn");
    } else {
        add(`Line can meet both base and peak demand. Current capacity headroom: ${((throughput / data.dailyDemandPeak - 1) * 100).toFixed(0)}% above peak.`, "rec-ok");
    }

    // Line balance
    if (lineBalance < 70) {
        add(`Line balance efficiency is ${lineBalance.toFixed(1)}% — significant idle time across stations. Rebalance work content to distribute cycle times more evenly.`, "rec-warn");
    } else if (lineBalance < 85) {
        add(`Line balance efficiency is ${lineBalance.toFixed(1)}% — acceptable but could be improved. Consider moving tasks from high-cycle stations to low-cycle ones.`, "rec-info");
    } else {
        add(`Line balance efficiency is ${lineBalance.toFixed(1)}% — well-balanced line.`, "rec-ok");
    }

    // Robotic advantage
    const roboticStations = stationResults.filter((s) => s.type === "robotic");
    const manualStations = stationResults.filter((s) => s.type === "manual");
    if (roboticStations.length > 0 && $("#robots-24-7").checked) {
        const robotAvgUtil = roboticStations.reduce((sum, s) => sum + s.taktRatio, 0) / roboticStations.length;
        add(`Robotic stations (24/7) average utilization: ${(robotAvgUtil * 100).toFixed(0)}%. ${robotAvgUtil < 0.5 ? "Low utilization — the 24/7 capacity provides significant headroom." : "Good utilization of robotic capacity."}`, "rec-info");
    }

    // Manual station bottleneck → suggest automation
    const worstManual = manualStations.sort((a, b) => b.taktRatio - a.taktRatio)[0];
    if (worstManual && worstManual.taktRatio > 0.8) {
        add(`"${worstManual.name}" is the tightest manual station (${(worstManual.taktRatio * 100).toFixed(0)}% of takt). If automated, it would gain ~${((data.availRoboticSec / data.availManualSec - 1) * 100).toFixed(0)}% more available time from 24/7 operation.`, "rec-info");
    }

    // Operator info
    const totalOps = stationResults.reduce((s, st) => s + st.operators, 0);
    if (totalOps > 0) {
        add(`Total operators needed per shift: ${totalOps}. With ${data.shiftsManual} shift(s), total manual headcount: ${totalOps * data.shiftsManual}.`, "rec-info");
    }
}

// ===== Helpers =====
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m (${Math.round(seconds).toLocaleString()}s)`;
}
