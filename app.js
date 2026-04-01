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

// ===== Regional Presets =====
// Based on real manufacturing norms: working days, statutory holidays,
// typical shift patterns, mandated breaks, common plant shutdowns.
const PRESETS = {
    us: {
        label: "US",
        workingDays: 22,           // ~260/yr ÷ 12
        shifts: 2,
        hoursPerShift: 8,
        breaksPerShift: 30,        // two 15-min breaks
        plannedDowntime: 10,
        oee: 85,
        robots247: true,
        annualHolidays: 10,        // federal holidays (plants vary 6-11)
        shutdownDays: 5,           // typical summer/year-end
        maxWeeklyHours: 50,        // no federal cap but OSHA fatigue guidance; OT after 40
        notes: "No federal max hours. OT pay after 40h/week. OSHA recommends fatigue management above 50h.",
    },
    uk: {
        label: "UK",
        workingDays: 21,           // ~252/yr ÷ 12
        shifts: 2,
        hoursPerShift: 8,
        breaksPerShift: 30,        // 20 min statutory + 10 min allowance
        plannedDowntime: 10,
        oee: 85,
        robots247: true,
        annualHolidays: 8,         // bank holidays
        shutdownDays: 5,           // common Christmas shutdown
        maxWeeklyHours: 48,        // Working Time Regulations (opt-out available)
        notes: "Working Time Regs: 48h/week max (opt-out possible). 28 days paid leave incl. bank holidays. 20-min break every 6h.",
    },
    "eu-de": {
        label: "EU (Germany)",
        workingDays: 20,           // ~220-230/yr ÷ 12 (generous leave)
        shifts: 2,
        hoursPerShift: 7.5,        // 37.5h week common in IG Metall agreements
        breaksPerShift: 30,        // 30 min mandatory after 6h
        plannedDowntime: 15,
        oee: 85,
        robots247: true,
        annualHolidays: 12,        // varies by state (9-13)
        shutdownDays: 8,           // Betriebsferien (summer + Christmas)
        maxWeeklyHours: 48,        // Arbeitszeitgesetz max; standard is 35-37.5h (IG Metall)
        notes: "Arbeitszeitgesetz: max 48h/week, typical IG Metall contract 35-37.5h. 30-min break after 6h. 20+ vacation days + 9-13 public holidays.",
    },
    "eu-fr": {
        label: "EU (France)",
        workingDays: 19,           // ~218/yr ÷ 12 (RTT days reduce this)
        shifts: 2,
        hoursPerShift: 7,          // 35h week legal standard
        breaksPerShift: 30,        // 20 min statutory minimum, 30 typical
        plannedDowntime: 15,
        oee: 82,
        robots247: true,
        annualHolidays: 11,        // jours fériés
        shutdownDays: 10,          // August + Christmas closures common
        maxWeeklyHours: 44,        // 44h avg over 12 weeks; absolute max 48h
        notes: "Code du Travail: 35h standard week. Max 44h averaged over 12 weeks (absolute 48h). 25+ vacation days + RTT. 11 public holidays.",
    },
    jp: {
        label: "Japan",
        workingDays: 21,           // ~250/yr ÷ 12
        shifts: 2,
        hoursPerShift: 8,
        breaksPerShift: 45,        // 45 min for 8h+ shifts (Labor Standards Act)
        plannedDowntime: 5,        // kaizen/TPM culture = lower unplanned downtime
        oee: 90,                   // typically higher OEE targets
        robots247: true,
        annualHolidays: 16,        // national holidays
        shutdownDays: 7,           // Golden Week + Obon + New Year
        maxWeeklyHours: 45,        // Labor Standards Act base; OT agreements (36 Agreement) can extend
        notes: "Labor Standards Act: 40h base, 45-min break for 8h+. 36 Agreement allows OT. High OEE targets (TPM culture). 16 national holidays.",
    },
    cn: {
        label: "China",
        workingDays: 22,           // ~250/yr ÷ 12
        shifts: 2,
        hoursPerShift: 8,
        breaksPerShift: 30,
        plannedDowntime: 10,
        oee: 80,
        robots247: true,
        annualHolidays: 11,        // statutory (7 festivals, some multi-day)
        shutdownDays: 5,           // Chinese New Year (some factories close 2+ weeks)
        maxWeeklyHours: 44,        // Labor Law standard; OT capped at 36h/month
        notes: "Labor Law: 44h standard week. OT limited to 36h/month. Chinese New Year shutdown varies (1-3 weeks). 5-15 vacation days by tenure.",
    },
};

// ===== DOM refs =====
const $ = (sel) => document.querySelector(sel);
const stationsBody = $("#stations-body");

// ===== Initialize =====
document.addEventListener("DOMContentLoaded", () => {
    DEFAULT_STATIONS.forEach((s) => addStationRow(s));
    $("#add-station-btn").addEventListener("click", () => addStationRow());
    $("#calculate-btn").addEventListener("click", calculate);

    // Preset buttons
    document.querySelectorAll(".btn-preset").forEach((btn) => {
        btn.addEventListener("click", () => applyPreset(btn.dataset.preset));
    });

    // Auto-recalculate on any input change
    document.addEventListener("input", debounce(autoCalc, 400));
    document.addEventListener("change", debounce(autoCalc, 200));
});

let hasCalculated = false;
function autoCalc() {
    if (hasCalculated) calculate();
}

// ===== Apply Preset =====
function applyPreset(key) {
    const p = PRESETS[key];
    if (!p) return;

    // Highlight active button
    document.querySelectorAll(".btn-preset").forEach((b) => b.classList.remove("active"));
    document.querySelector(`.btn-preset[data-preset="${key}"]`).classList.add("active");

    // Fill fields
    $("#working-days").value = p.workingDays;
    $("#shifts-manual").value = p.shifts;
    $("#hours-per-shift").value = p.hoursPerShift;
    $("#breaks-per-shift").value = p.breaksPerShift;
    $("#planned-downtime").value = p.plannedDowntime;
    $("#oee").value = p.oee;
    $("#robots-24-7").checked = p.robots247;
    $("#annual-holidays").value = p.annualHolidays;
    $("#annual-shutdown-days").value = p.shutdownDays;
    $("#max-weekly-hours").value = p.maxWeeklyHours;

    // Show notes
    showPresetNotes(p.notes, p.label);

    autoCalc();
}

function showPresetNotes(text, label) {
    let el = document.getElementById("preset-notes");
    if (!el) {
        el = document.createElement("div");
        el.id = "preset-notes";
        el.className = "preset-notes";
        // Insert after preset bar
        const presetBar = document.querySelector(".preset-bar");
        presetBar.parentNode.insertBefore(el, presetBar.nextSibling);
    }
    el.innerHTML = `<strong>${label}:</strong> ${text}`;
    el.style.display = "block";
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
    const workingDaysInput = parseFloat($("#working-days").value) || 22;
    const shiftsManual = parseFloat($("#shifts-manual").value) || 1;
    const hoursPerShift = parseFloat($("#hours-per-shift").value) || 8;
    const breaksPerShift = parseFloat($("#breaks-per-shift").value) || 0;
    const plannedDowntime = parseFloat($("#planned-downtime").value) || 0;
    const oee = (parseFloat($("#oee").value) || 85) / 100;
    const robots247 = $("#robots-24-7").checked;
    const annualHolidays = parseFloat($("#annual-holidays").value) || 0;
    const shutdownDays = parseFloat($("#annual-shutdown-days").value) || 0;
    const maxWeeklyHours = parseFloat($("#max-weekly-hours").value) || 48;

    // Effective working days per month (subtract holidays & shutdowns spread across 12 months)
    const lostDaysPerMonth = (annualHolidays + shutdownDays) / 12;
    const effectiveWorkingDays = Math.max(1, workingDaysInput - lostDaysPerMonth);

    // Annual effective working days for yearly demand conversion
    const annualWorkingDays = effectiveWorkingDays * 12;

    // Convert demand to daily
    let dailyDemand;
    if (demandPeriod === "yearly") {
        dailyDemand = demandQty / annualWorkingDays;
    } else {
        dailyDemand = demandQty / effectiveWorkingDays;
    }
    const dailyDemandPeak = dailyDemand * (1 + demandVariation / 100);

    // Check if shift pattern exceeds regulated max weekly hours
    const weeklyHoursPlanned = shiftsManual * hoursPerShift * 5; // assume 5-day week
    const hoursExceeded = weeklyHoursPlanned > maxWeeklyHours;

    // Available time per day (seconds) — Manual
    const netMinutesPerShift = (hoursPerShift * 60) - breaksPerShift - plannedDowntime;
    const availManualSec = netMinutesPerShift * 60 * shiftsManual * oee;

    // Available time per day (seconds) — Robotic
    let availRoboticSec;
    if (robots247) {
        const robotNetMin = (24 * 60) - (plannedDowntime * 3);
        availRoboticSec = robotNetMin * 60 * oee;
    } else {
        availRoboticSec = availManualSec;
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
        effectiveWorkingDays,
        annualWorkingDays,
        availManualSec,
        availRoboticSec,
        oee,
        stations,
        shiftsManual,
        hoursExceeded,
        weeklyHoursPlanned,
        maxWeeklyHours,
        annualHolidays,
        shutdownDays,
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
    $("#res-eff-days").textContent = data.effectiveWorkingDays.toFixed(1) + " days";
    $("#res-annual-days").textContent = Math.round(data.annualWorkingDays) + " days";

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

    // Regulatory hours warning
    if (data.hoursExceeded) {
        add(`Planned shift pattern (${data.weeklyHoursPlanned}h/week) exceeds regulated max (${data.maxWeeklyHours}h/week). Reduce shifts/hours or verify local overtime agreements.`, "rec-danger");
    }

    // Effective working days info
    if (data.annualHolidays > 0 || data.shutdownDays > 0) {
        add(`Effective working days: ${data.effectiveWorkingDays.toFixed(1)}/month (${Math.round(data.annualWorkingDays)}/year) after accounting for ${data.annualHolidays} public holidays and ${data.shutdownDays} shutdown days.`, "rec-info");
    }

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
