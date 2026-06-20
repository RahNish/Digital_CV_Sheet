// ===================== CONFIG =====================
// Replace these with your own "Publish to web" CSV links if you ever
// recreate the sheet. Each must point to ONE specific tab (not the
// whole spreadsheet) with output=csv.
const SHEET_URLS = {
  publications: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRVxhGWhR5Hy5fYU7ImzJDLxEDOrVt-YrW5LZ_LJ1el6tSHu1K9BSb-9KuVvMDvvT4jIYSfxdPfsqb3/pub?gid=0&single=true&output=csv',
  projects:     'https://docs.google.com/spreadsheets/d/e/2PACX-1vRVxhGWhR5Hy5fYU7ImzJDLxEDOrVt-YrW5LZ_LJ1el6tSHu1K9BSb-9KuVvMDvvT4jIYSfxdPfsqb3/pub?gid=1931317134&single=true&output=csv',
  students:     'https://docs.google.com/spreadsheets/d/e/2PACX-1vRVxhGWhR5Hy5fYU7ImzJDLxEDOrVt-YrW5LZ_LJ1el6tSHu1K9BSb-9KuVvMDvvT4jIYSfxdPfsqb3/pub?gid=1899733357&single=true&output=csv',
  workshops:    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRVxhGWhR5Hy5fYU7ImzJDLxEDOrVt-YrW5LZ_LJ1el6tSHu1K9BSb-9KuVvMDvvT4jIYSfxdPfsqb3/pub?gid=805060318&single=true&output=csv',
  news:         'https://docs.google.com/spreadsheets/d/e/2PACX-1vRVxhGWhR5Hy5fYU7ImzJDLxEDOrVt-YrW5LZ_LJ1el6tSHu1K9BSb-9KuVvMDvvT4jIYSfxdPfsqb3/pub?gid=581138924&single=true&output=csv'
};

const MY_NAME_PATTERN = /Srivastava,?\s*A\.?|Ashish\s+Srivastava/i;

// ===================== CSV PARSER =====================
// Handles quoted fields containing commas/newlines, which Google's
// CSV export uses whenever a cell contains a comma.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') { field += '"'; i++; }
      else if (char === '"') { inQuotes = false; }
      else { field += char; }
    } else {
      if (char === '"') { inQuotes = true; }
      else if (char === ',') { row.push(field); field = ''; }
      else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (char === '\r') { /* skip */ }
      else { field += char; }
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  const headers = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.some(cell => cell.trim() !== ''))
    .map(r => {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (r[idx] || '').trim(); });
      return obj;
    });
}

async function fetchSheet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch sheet: ' + res.status);
  const text = await res.text();
  return parseCSV(text);
}

// ===================== HELPERS =====================
function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

function highlightAuthors(authorsStr) {
  const escaped = escapeHtml(authorsStr);
  return escaped.replace(MY_NAME_PATTERN, match => `<span class="me">${match}</span>`);
}

function quartileBadgeClass(q) {
  const v = (q || '').trim().toUpperCase();
  if (v === 'Q1') return 'badge-q1';
  if (v === 'Q2') return 'badge-q2';
  if (v === 'Q3') return 'badge-q3';
  if (v === 'Q4') return 'badge-q4';
  return 'badge-q4';
}

function initials(name) {
  return (name || '')
    .replace(/^Dr\.?\s*/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ===================== RENDERERS =====================
let allPublicationRows = [];
let activeYear = 'All';

function renderPublicationsList(rows) {
  const journal = rows.filter(r => (r.type || 'Journal').toLowerCase() !== 'conference');
  const conference = rows.filter(r => (r.type || '').toLowerCase() === 'conference');

  const journalHtml = journal.map(p => `
    <div class="entry-card">
      <p class="entry-title">${escapeHtml(p.title)}</p>
      <p class="entry-meta">${escapeHtml(p.journal)} &middot; ${escapeHtml(p.year)} &middot; ${highlightAuthors(p.authors)}</p>
      ${p.quartile ? `<span class="badge ${quartileBadgeClass(p.quartile)}">${escapeHtml(p.quartile)}</span>` : ''}
      ${p.doi ? `<a href="https://doi.org/${escapeHtml(p.doi)}" target="_blank" style="font-size:11px;margin-left:8px;color:#1a5fa3;">DOI →</a>` : ''}
    </div>
  `).join('');

  const conferenceHtml = conference.map(p => `
    <div class="entry-card">
      <p class="entry-title">${escapeHtml(p.title)}</p>
      <p class="entry-meta">${escapeHtml(p.journal)} &middot; ${escapeHtml(p.year)} &middot; ${highlightAuthors(p.authors)}</p>
      ${p.volume_issue ? `<span style="font-size:11px;color:#6b7280;">Vol/Issue: ${escapeHtml(p.volume_issue)}${p.pages ? ' &middot; Pages: ' + escapeHtml(p.pages) : ''}</span>` : ''}
      ${p.doi ? `<a href="https://doi.org/${escapeHtml(p.doi)}" target="_blank" style="font-size:11px;margin-left:8px;color:#1a5fa3;">DOI →</a>` : ''}
    </div>
  `).join('');

  document.getElementById('publications-journal').innerHTML = journalHtml || '<p class="loading-text">No publications for this year.</p>';

  const confHeading = document.getElementById('conf-heading');
  if (conference.length > 0) {
    confHeading.style.display = 'block';
    document.getElementById('publications-conference').innerHTML = conferenceHtml;
  } else {
    confHeading.style.display = 'none';
    document.getElementById('publications-conference').innerHTML = '';
  }
}

function applyYearFilter(year) {
  activeYear = year;
  document.querySelectorAll('.year-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.year === year);
  });
  const filtered = year === 'All'
    ? allPublicationRows
    : allPublicationRows.filter(r => r.year === year);
  renderPublicationsList(filtered);
}

function renderPublications(rows) {
  allPublicationRows = rows;

  const years = Array.from(new Set(rows.map(r => r.year).filter(Boolean)))
    .sort((a, b) => Number(b) - Number(a));

  const yearButtonsHtml = ['All', ...years].map(y => `
    <button class="year-btn${y === activeYear ? ' active' : ''}" data-year="${escapeHtml(y)}">${escapeHtml(y)}</button>
  `).join('');

  const yearFilterEl = document.getElementById('year-filter');
  yearFilterEl.innerHTML = yearButtonsHtml;
  yearFilterEl.querySelectorAll('.year-btn').forEach(btn => {
    btn.addEventListener('click', () => applyYearFilter(btn.dataset.year));
  });

  applyYearFilter(activeYear);
}

function renderProjects(rows) {
  const html = rows.map(p => `
    <div class="entry-card">
      <div class="row-between">
        <p class="entry-title">${escapeHtml(p.title)}</p>
        ${p.status ? `<span class="badge badge-${(p.status || '').toLowerCase()}">${escapeHtml(p.status)}</span>` : ''}
      </div>
      <p class="entry-meta" style="margin-top:6px;">${escapeHtml(p.funding_agency)}${p.amount ? ' &middot; ' + escapeHtml(p.amount) : ''}${p.duration ? ' &middot; ' + escapeHtml(p.duration) : ''}</p>
    </div>
  `).join('');
  document.getElementById('projects-list').innerHTML = html || '<p class="loading-text">No projects yet.</p>';
}

function renderStudents(rows) {
  const html = rows.map(s => `
    <div class="student-card">
      <div class="student-head">
        <div class="avatar">${initials(s.name)}</div>
        <p class="student-name">${escapeHtml(s.name)}</p>
      </div>
      <p class="student-thesis">${escapeHtml(s.phd_title)}</p>
      <span class="badge badge-${(s.status || 'awarded').toLowerCase()}">${escapeHtml(s.role)}${s.year_awarded ? ' &middot; ' + escapeHtml(s.year_awarded) : ''}</span>
    </div>
  `).join('');
  document.getElementById('students-list').innerHTML = html || '<p class="loading-text">No students yet.</p>';
}

function renderWorkshops(rows) {
  const html = rows.map(w => `
    <div class="entry-card">
      <p class="entry-title" style="font-size:13.5px;">${escapeHtml(w.title)}</p>
      <p class="entry-meta">${escapeHtml(w.institution)} &middot; ${formatDate(w.start_date)}${w.end_date && w.end_date !== w.start_date ? ' - ' + formatDate(w.end_date) : ''}${w.type ? ' &middot; ' + escapeHtml(w.type) : ''}</p>
    </div>
  `).join('');
  document.getElementById('workshops-list').innerHTML = html || '<p class="loading-text">No workshops yet.</p>';
}

function renderNews(rows) {
  const sorted = rows.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

  if (sorted.length === 0) {
    document.getElementById('news-list').innerHTML = '<p class="loading-text light">No news yet.</p>';
    return;
  }

  const itemHtml = n => `
    <div class="news-item">
      <p>${escapeHtml(n.message)}${n.link_url ? ` <a href="${escapeHtml(n.link_url)}" target="_blank" style="color:#7fa8e0;">Read →</a>` : ''}</p>
      ${n.date ? `<span class="news-date">${formatDate(n.date)}</span>` : ''}
    </div>
  `;

  const track = document.getElementById('news-list');
  const viewport = document.getElementById('news-viewport');

  // Only animate (and duplicate the list) if there's enough content to
  // make scrolling worthwhile; otherwise just show it statically.
  if (sorted.length > 2) {
    const singleHtml = sorted.map(itemHtml).join('');
    track.innerHTML = singleHtml + singleHtml; // duplicate for seamless loop
    const duration = Math.max(sorted.length * 6, 18); // ~6s per item, min 18s
    track.style.setProperty('--news-duration', duration + 's');
  } else {
    track.innerHTML = sorted.map(itemHtml).join('');
    track.style.animation = 'none';
    viewport.style.maxHeight = 'none';
  }
}

// ===================== LOAD ALL DATA =====================
async function loadAll() {
  const tasks = [
    fetchSheet(SHEET_URLS.publications).then(renderPublications).catch(() => {
      document.getElementById('publications-journal').innerHTML = '<p class="error-text">Could not load publications.</p>';
    }),
    fetchSheet(SHEET_URLS.projects).then(renderProjects).catch(() => {
      document.getElementById('projects-list').innerHTML = '<p class="error-text">Could not load projects.</p>';
    }),
    fetchSheet(SHEET_URLS.students).then(renderStudents).catch(() => {
      document.getElementById('students-list').innerHTML = '<p class="error-text">Could not load students.</p>';
    }),
    fetchSheet(SHEET_URLS.workshops).then(renderWorkshops).catch(() => {
      document.getElementById('workshops-list').innerHTML = '<p class="error-text">Could not load workshops.</p>';
    }),
    fetchSheet(SHEET_URLS.news).then(renderNews).catch(() => {
      document.getElementById('news-list').innerHTML = '<p class="error-text" style="color:#e08080;">Could not load news.</p>';
    })
  ];
  await Promise.all(tasks);
}

// ===================== TAB SWITCHING =====================
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(targetId).classList.add('active');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadAll();
});
