const jobs = window.CSJOBS_JOBS || [];
const tableFields = ["Posted Date", "University", "Department", "City", "Position Title", "Application Deadline", "Application Materials"];
const calendarMonths = [
  { year: 2026, month: 8, label: "September 2026" },
  { year: 2026, month: 9, label: "October 2026" },
  { year: 2026, month: 10, label: "November 2026" },
  { year: 2026, month: 11, label: "December 2026" },
  { year: 2027, month: 0, label: "January 2027" },
];

let sortState = { field: "Posted Date", direction: "desc" };
let query = "";
let leafletMap = null;
let leafletMarkers = null;
const defaultMapCenter = [39.5, -98.35];
const defaultMapZoom = 4;

document.querySelectorAll(".nav-button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-button").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(button.dataset.view).classList.add("active");
    if (button.dataset.view === "map") {
      setTimeout(() => {
        renderMap();
        leafletMap?.invalidateSize();
      }, 0);
    }
  });
});

document.getElementById("job-search").addEventListener("input", (event) => {
  query = event.target.value.trim().toLowerCase();
  renderTable();
});

function renderTable() {
  const thead = document.querySelector("#jobs-table thead");
  const tbody = document.querySelector("#jobs-table tbody");
  const filtered = sortedJobs().filter((job) => searchableText(job).includes(query));

  thead.innerHTML = `<tr>${tableFields.map((field) => `
    <th><button class="sort-button ${sortClass(field)}" type="button" data-sort="${escapeHtml(field)}">${fieldLabel(field)}</button></th>
  `).join("")}</tr>`;

  tbody.innerHTML = filtered.map((job) => `
    <tr>
      ${tableFields.map((field) => `<td class="${field === "Application Materials" ? "materials" : ""}">${formatTableValue(job, field, { compact: true })}</td>`).join("")}
    </tr>
  `).join("");

  document.getElementById("job-count").textContent = `${filtered.length} of ${jobs.length} jobs`;
  thead.querySelectorAll("[data-sort]").forEach((button) => {
    button.addEventListener("click", () => updateSort(button.dataset.sort));
  });
  tbody.querySelectorAll("[data-materials-index]").forEach((button) => {
    button.addEventListener("click", () => openDetails(jobs[Number(button.dataset.materialsIndex)]));
  });
}

function updateSort(field) {
  if (sortState.field === field) {
    sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
  } else {
    sortState = { field, direction: field === "Posted Date" ? "desc" : "asc" };
  }
  renderTable();
}

function sortedJobs() {
  return [...jobs].sort((a, b) => {
    const comparison = compareValues(a[sortState.field], b[sortState.field], sortState.field);
    return sortState.direction === "asc" ? comparison : -comparison;
  });
}

function compareValues(a, b, field) {
  if (field.includes("Date") || field.includes("Deadline")) {
    const dateA = parseDateValue(a);
    const dateB = parseDateValue(b);
    if (dateA && dateB) return dateA - dateB;
    if (dateA) return 1;
    if (dateB) return -1;
  }
  return String(a || "").localeCompare(String(b || ""), undefined, { sensitivity: "base" });
}

function sortClass(field) {
  if (sortState.field !== field) return "";
  return sortState.direction === "asc" ? "sort-asc" : "sort-desc";
}

function fieldLabel(field) {
  return escapeHtml(field);
}

function searchableText(job) {
  return Object.values(job).join(" ").toLowerCase();
}

function formatTableValue(job, field, options = {}) {
  const value = escapeHtml(job[field] || "");
  if (field === "Posted Date" && job["Listing Link"]) {
    return `<a href="${escapeAttribute(job["Listing Link"])}" target="_blank" rel="noopener noreferrer">${value || "View"}</a>`;
  }
  if (field === "Application Materials" && options.compact && shouldClampMaterials(job[field])) {
    const jobIndex = jobs.indexOf(job);
    return `
      <div class="materials-preview">${value}</div>
      <button class="see-more-button" type="button" data-materials-index="${jobIndex}">[See more]</button>
    `;
  }
  return value;
}

function shouldClampMaterials(value) {
  const text = String(value || "");
  return text.length > 140 || text.split(";").length > 3 || text.split(",").length > 5;
}

function renderCalendar() {
  const container = document.getElementById("calendar-grid");
  container.innerHTML = calendarMonths.map((month) => renderMonth(month)).join("");
  container.querySelectorAll("[data-calendar-date]").forEach((button) => {
    button.addEventListener("click", () => openDayDetails(button.dataset.calendarDate));
  });
}

function renderMonth({ year, month, label }) {
  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const offset = firstDay.getDay();
  const cells = [];
  for (let i = 0; i < offset; i += 1) {
    cells.push(`<div class="day empty" aria-hidden="true"></div>`);
  }
  for (let day = 1; day <= lastDate; day += 1) {
    const dayJobs = jobs
      .map((job, index) => ({ job, index }))
      .filter(({ job }) => {
        const deadline = parseDateValue(job["Application Deadline"]);
        return deadline && deadline.getFullYear() === year && deadline.getMonth() === month && deadline.getDate() === day;
      });
    cells.push(`
      <div class="day">
        <span class="day-number">${day}</span>
        ${renderCalendarEntries(dayJobs, year, month, day)}
      </div>
    `);
  }
  return `
    <section class="month">
      <h3>${label}</h3>
      <div class="calendar-weekdays">
        <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
      </div>
      <div class="calendar-days">${cells.join("")}</div>
    </section>
  `;
}

function renderCalendarEntries(dayJobs, year, month, day) {
  if (dayJobs.length === 0) return "";
  const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const label = dayJobs.length === 1 ? "1 deadline" : `${dayJobs.length} deadlines`;
  return `
    <button class="calendar-more" type="button" data-calendar-date="${dateKey}">
      ${label}
    </button>
  `;
}

function renderMap() {
  const details = document.getElementById("map-details");
  const points = jobs
    .map((job) => ({ job, point: parseLatLong(job["Lat/Long"]) }))
    .filter(({ point }) => point);

  if (!window.L) {
    details.innerHTML = `<h3>Map Unavailable</h3><p class="muted">Leaflet could not be loaded.</p>`;
    return;
  }

  if (!leafletMap) {
    leafletMap = L.map("job-map", { scrollWheelZoom: true }).setView(defaultMapCenter, defaultMapZoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(leafletMap);
    leafletMarkers = L.layerGroup().addTo(leafletMap);
  }

  leafletMarkers.clearLayers();
  const bounds = [];

  points.forEach(({ job, point }) => {
    const marker = L.circleMarker([point.lat, point.lng], {
      radius: 7,
      color: "#ffffff",
      weight: 2,
      fillColor: "#176b72",
      fillOpacity: 0.95,
    });
    marker.bindPopup(`
      <p class="map-popup-title">${escapeHtml(job.University || "Unknown University")}</p>
      <p class="map-popup-subtitle">${escapeHtml(job.Department || "")}</p>
    `);
    marker.on("click", () => {
      details.innerHTML = detailsHtml(job);
    });
    marker.addTo(leafletMarkers);
    bounds.push([point.lat, point.lng]);
  });

  leafletMap.setView(defaultMapCenter, defaultMapZoom);
  if (bounds.length === 0) {
    details.innerHTML = `<h3>No Map Points</h3><p class="muted">No valid Lat/Long values were found.</p>`;
  }
}

function openDayDetails(dateKey) {
  const dayJobs = jobs.filter((job) => {
    const deadline = parseDateValue(job["Application Deadline"]);
    return deadline && formatDateKey(deadline) === dateKey;
  });
  const dialog = document.getElementById("job-dialog");
  document.getElementById("dialog-content").innerHTML = `
    <h3>${escapeHtml(dateKey)} Deadlines</h3>
    <div class="day-details">
      ${dayJobs.map((job) => `<section>${detailsHtml(job)}</section>`).join("")}
    </div>
  `;
  dialog.showModal();
}

function openDetails(job) {
  const dialog = document.getElementById("job-dialog");
  document.getElementById("dialog-content").innerHTML = detailsHtml(job);
  dialog.showModal();
}

document.querySelector(".dialog-close").addEventListener("click", () => {
  document.getElementById("job-dialog").close();
});

function detailsHtml(job) {
  return `
    <h3>${escapeHtml(job.University || "Job Details")}</h3>
    <dl class="detail-list">
      ${tableFields.map((field) => `<dt>${escapeHtml(field)}</dt><dd>${formatTableValue(job, field)}</dd>`).join("")}
    </dl>
    ${job["Listing Link"] ? `<p><a class="details-button" href="${escapeAttribute(job["Listing Link"])}" target="_blank" rel="noopener noreferrer">Open Listing</a></p>` : ""}
  `;
}

function parseDateValue(value) {
  if (!value) return null;
  const match = String(value).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseLatLong(value) {
  if (!value) return null;
  const numbers = String(value).match(/-?\d+(?:\.\d+)?/g);
  if (!numbers || numbers.length < 2) return null;
  const lat = Number(numbers[0]);
  const lng = Number(numbers[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

renderTable();
renderCalendar();
renderMap();
