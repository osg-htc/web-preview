/**
 * AlphaFold3 Alignment Library search.
 *
 * Lets a researcher paste one or more protein sequences (FASTA or one per
 * line), hashes them in the browser, queries the af3-cache registry for all
 * of them in one go, and renders the matching alignments with download links.
 * "Download All" fetches every matching A3M for a source (or every source)
 * and bundles them into a single zip, built client-side.
 *
 * Only SHA-256 hashes of the normalized sequences are sent to the registry;
 * the sequences themselves never leave the browser.
 */

const API_BASE = "https://af3-msa-library.dannymorales.com";
const QUERY_URL = `${API_BASE}/v1/query`;
const OSDF_HTTPS_BASE = "https://osdf-director.osg-htc.org";

const HASHES_PER_REQUEST_SMALL = 100;  // /v1/query batch size for typical searches (finer progress)
const HASHES_PER_REQUEST_LARGE = 500;  // batch size for bulk searches (server answers 500 in ~0.16s)
const LARGE_QUERY_THRESHOLD = 10000;   // unique sequences at which to switch to large batches
const QUERY_CONCURRENCY = 4;      // parallel /v1/query batches
const DOWNLOAD_CONCURRENCY = 4;   // parallel A3M fetches when zipping
const RESULTS_PER_PAGE = 50;      // table rows per page
const MAX_ZIP_BYTES = 3.5 * 1024 ** 3; // stay well under the 4 GiB zip32 limit

const ANY_SOURCE = "__any__";

const EXAMPLE_FASTA = `>P62975 Ubiquitin
MQIFVKTLTGKTITLEVEPSDTIENVKAKIQDKEGIPPDQQRLIFAGKQLEDGRTLSDYNIQKESTLHLVLRLRGG
>P42212 Green fluorescent protein
MSKGEELFTGVVPILVELDGDVNGHKFSVSGEGEGDATYGKLTLKFICTTGKLPVPWPTLVTTFSYGVQCFSRYPDHMKQHDFFKSAMPEGYVQERTIFFKDDGNYKTRAEVKFEGDTLVNRIELKGIDFKEDGNILGHKLEYNYNSHNVYIMADKQKNGIKVNFKIRHNIEDGSVQLADHYQQNTPIGDGPVLLPDNHYLSTQSALSKDPNEKRDHMVLLEFVTAAGITHGMDELYK
>Not in the library (scrambled)
GGRLRLVLHLTSEKQINYDSLTRGDELQKGAFILRQQDPPIGEKDQIKAKVNEITDSPEVELTITKGTLTKVFIQM
`;

// ---------------------------------------------------------------------------
// Sequence parsing and hashing
// ---------------------------------------------------------------------------

/**
 * Parse the textarea contents into query records.
 *
 * Lines starting with ">" open a FASTA record whose sequence is the
 * concatenation of the following lines up to the next header. Non-empty
 * lines that appear before any header are each treated as their own
 * (unnamed) sequence, so "one sequence per line" also works.
 */
function parseSequences(text) {
    const queries = [];
    let current = null;
    let anonymous = 0;

    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith(";") || line.startsWith("#")) continue;

        if (line.startsWith(">")) {
            current = { name: line.slice(1).trim(), raw: "" };
            queries.push(current);
        } else if (current) {
            current.raw += line;
        } else {
            anonymous += 1;
            queries.push({ name: "", raw: line });
        }
    }

    queries.forEach((q, i) => {
        if (!q.name) q.name = `Query ${i + 1}`;
        // Match the registry's normalization (strip whitespace, uppercase)
        // and additionally drop a trailing stop marker.
        q.sequence = q.raw.replace(/\s+/g, "").toUpperCase().replace(/\*$/, "");
        q.error = null;
        if (!q.sequence) {
            q.error = "Empty sequence";
        } else if (!/^[A-Z]+$/.test(q.sequence)) {
            const bad = [...new Set(q.sequence.replace(/[A-Z]/g, ""))].join(" ");
            q.error = `Unexpected characters: ${bad}`;
        }
    });

    return queries;
}

async function sha256Hex(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Registry query
// ---------------------------------------------------------------------------

async function queryRegistry(seqHashes, onChunkDone) {
    const batchSize = seqHashes.length < LARGE_QUERY_THRESHOLD
        ? HASHES_PER_REQUEST_SMALL
        : HASHES_PER_REQUEST_LARGE;
    const chunks = [];
    for (let i = 0; i < seqHashes.length; i += batchSize) {
        chunks.push(seqHashes.slice(i, i + batchSize));
    }

    const hitsByHash = new Map();
    await mapConcurrent(chunks, QUERY_CONCURRENCY, async chunk => {
        const response = await fetch(QUERY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ seq_hashes: chunk }),
        });
        if (!response.ok) {
            throw new Error(`Registry responded with HTTP ${response.status}`);
        }
        const json = await response.json();
        for (const result of json.results ?? []) {
            hitsByHash.set(result.seq_hash, result.hits ?? []);
        }
        onChunkDone?.(chunk);
    });

    return hitsByHash;
}

/**
 * Convert an OSDF/Pelican URI into a browser-fetchable HTTPS URL.
 *   osdf:///af3-msa-library/x.a3m            -> https://osdf-director.osg-htc.org/af3-msa-library/x.a3m
 *   pelican://osg-htc.org/af3-msa-library/x -> https://osdf-director.osg-htc.org/af3-msa-library/x
 */
function osdfToHttps(uri) {
    if (/^https?:\/\//i.test(uri)) return uri;
    let path = uri.replace(/^osdf:\/\//i, "").replace(/^pelican:\/\/[^/]*/i, "");
    if (!path.startsWith("/")) path = "/" + path;
    return OSDF_HTTPS_BASE + path.split("/").map(encodeURIComponent).join("/");
}

function basename(uri) {
    return decodeURIComponent(uri.split("/").filter(Boolean).pop() ?? "alignment.a3m");
}

function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "source";
}

/**
 * Display order for sources: OSG/OSPool-generated first, community
 * contributions second, everything else alphabetically.
 */
function sourceRank(name) {
    if (/(osg|ospool)[\s_-]*generated/i.test(name)) return 0;
    if (/community/i.test(name)) return 1;
    return 2;
}

function compareSources(a, b) {
    return sourceRank(a) - sourceRank(b) || a.localeCompare(b);
}

/**
 * Page numbers to offer in the pagination control: all of them when few,
 * otherwise first, last, and a window around the current page, with nulls
 * marking the gaps (rendered as ellipses).
 */
function pageNumbers(current, pages) {
    if (pages <= 7) return [...Array(pages).keys()];
    const shown = [...new Set([0, current - 1, current, current + 1, pages - 1])]
        .filter(p => p >= 0 && p < pages)
        .sort((a, b) => a - b);
    const items = [];
    for (let i = 0; i < shown.length; i++) {
        if (i > 0 && shown[i] - shown[i - 1] > 1) items.push(null);
        items.push(shown[i]);
    }
    return items;
}

function formatBytes(bytes) {
    if (bytes == null) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
    return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
}

/**
 * "N files · 12.3 MB" label for a set of hits; sizes come from the registry's
 * a3m_size_bytes, with a ≥ prefix when some hits don't report a size.
 */
function downloadSetLabel(hits) {
    const known = hits.filter(h => h.a3m_size_bytes != null);
    const files = `${numberFormat.format(hits.length)} ${hits.length === 1 ? "file" : "files"}`;
    if (!known.length) return files;
    const bytes = known.reduce((n, h) => n + h.a3m_size_bytes, 0);
    return `${files} &middot; ${known.length < hits.length ? "&ge;" : ""}${formatBytes(bytes)}`;
}

const numberFormat = new Intl.NumberFormat("en-US");

// ---------------------------------------------------------------------------
// Minimal ZIP writer (store method, no compression)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();

function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
        crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime(date) {
    const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
    const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return { time, day };
}

/**
 * Build a zip Blob from [{name, data: Uint8Array}] entries.
 */
function buildZip(entries) {
    const encoder = new TextEncoder();
    const { time, day } = dosDateTime(new Date());
    const parts = [];
    const central = [];
    let offset = 0;

    for (const entry of entries) {
        const nameBytes = encoder.encode(entry.name);
        const crc = crc32(entry.data);
        const size = entry.data.length;

        const local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, 0x04034b50, true);
        local.setUint16(4, 20, true);        // version needed
        local.setUint16(6, 0x0800, true);    // flags: UTF-8 names
        local.setUint16(8, 0, true);         // method: store
        local.setUint16(10, time, true);
        local.setUint16(12, day, true);
        local.setUint32(14, crc, true);
        local.setUint32(18, size, true);
        local.setUint32(22, size, true);
        local.setUint16(26, nameBytes.length, true);
        local.setUint16(28, 0, true);
        parts.push(local.buffer, nameBytes, entry.data);

        const cd = new DataView(new ArrayBuffer(46));
        cd.setUint32(0, 0x02014b50, true);
        cd.setUint16(4, 20, true);           // version made by
        cd.setUint16(6, 20, true);           // version needed
        cd.setUint16(8, 0x0800, true);
        cd.setUint16(10, 0, true);
        cd.setUint16(12, time, true);
        cd.setUint16(14, day, true);
        cd.setUint32(16, crc, true);
        cd.setUint32(20, size, true);
        cd.setUint32(24, size, true);
        cd.setUint16(28, nameBytes.length, true);
        cd.setUint16(30, 0, true);           // extra length
        cd.setUint16(32, 0, true);           // comment length
        cd.setUint16(34, 0, true);           // disk number
        cd.setUint16(36, 0, true);           // internal attrs
        cd.setUint32(38, 0, true);           // external attrs
        cd.setUint32(42, offset, true);      // local header offset
        central.push(cd.buffer, nameBytes);

        offset += 30 + nameBytes.length + size;
    }

    const centralSize = central.reduce((n, p) => n + (p.byteLength ?? p.length), 0);
    const eocd = new DataView(new ArrayBuffer(22));
    eocd.setUint32(0, 0x06054b50, true);
    eocd.setUint16(4, 0, true);
    eocd.setUint16(6, 0, true);
    eocd.setUint16(8, entries.length, true);
    eocd.setUint16(10, entries.length, true);
    eocd.setUint32(12, centralSize, true);
    eocd.setUint32(16, offset, true);
    eocd.setUint16(20, 0, true);

    return new Blob([...parts, ...central, eocd.buffer], { type: "application/zip" });
}

function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Run `worker(item, index)` over `items` with a bounded number in flight.
 */
async function mapConcurrent(items, limit, worker) {
    const results = new Array(items.length);
    let next = 0;
    const run = async () => {
        while (next < items.length) {
            const i = next++;
            results[i] = await worker(items[i], i);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
    return results;
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

const el = id => document.getElementById(id);

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

class AlphaFoldSearch {
    constructor() {
        this.form = el("af3-search-form");
        if (!this.form) return;

        this.textarea = el("af3-sequences");
        this.fileInput = el("af3-fasta-file");
        this.submitButton = el("af3-search-button");
        this.status = el("af3-status");
        this.error = el("af3-error");
        this.results = el("af3-results");
        this.summary = el("af3-summary");
        this.sourceSummary = el("af3-source-summary");
        this.tableBody = el("af3-results-body");
        this.downloadButton = el("af3-download-button");
        this.downloadMenu = el("af3-download-menu");
        this.downloadProgress = el("af3-download-progress");
        this.downloadProgressBar = el("af3-download-progress-bar");
        this.downloadProgressText = el("af3-download-progress-text");
        this.downloadError = el("af3-download-error");
        this.paginationRow = el("af3-pagination-row");
        this.paginationInfo = el("af3-pagination-info");
        this.paginationList = el("af3-pagination");
        this.searchProgress = el("af3-search-progress");
        this.searchProgressBar = el("af3-search-progress-bar");
        this.searchProgressText = el("af3-search-progress-text");

        this.page = 0;
        this.queries = [];
        this.hits = [];          // unique hits across all queries
        this.hitsBySource = new Map();
        this.downloading = false;

        this.form.addEventListener("submit", e => { e.preventDefault(); this.search(); });
        this.textarea.addEventListener("keydown", e => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); this.search(); }
        });
        el("af3-example")?.addEventListener("click", () => { this.textarea.value = EXAMPLE_FASTA; this.textarea.focus(); });
        el("af3-clear")?.addEventListener("click", () => this.reset());
        this.fileInput?.addEventListener("change", () => this.loadFile());
        for (const type of ["dragenter", "dragover"]) {
            this.form.addEventListener(type, e => {
                if (![...(e.dataTransfer?.types ?? [])].includes("Files")) return;
                e.preventDefault();
                this.form.classList.add("af3-drop-active");
            });
        }
        this.form.addEventListener("dragleave", e => {
            if (!this.form.contains(e.relatedTarget)) this.form.classList.remove("af3-drop-active");
        });
        this.form.addEventListener("drop", e => {
            e.preventDefault();
            this.form.classList.remove("af3-drop-active");
            const files = [...(e.dataTransfer?.files ?? [])];
            if (files.length) this.loadFasta(files);
        });
        this.downloadMenu.addEventListener("click", e => {
            const item = e.target.closest("[data-source]");
            if (!item) return;
            e.preventDefault();
            this.downloadAll(item.dataset.source);
        });
        this.tableBody.addEventListener("click", e => {
            const link = e.target.closest("a[data-a3m]");
            if (link) { e.preventDefault(); this.downloadOne(link); return; }
            const toggle = e.target.closest(".af3-meta-toggle");
            if (toggle) {
                const hidden = toggle.closest("li").querySelector(".af3-meta").classList.toggle("d-none");
                toggle.innerHTML = hidden
                    ? `Get Metadata <i class="bi bi-chevron-down"></i>`
                    : `Hide Metadata <i class="bi bi-chevron-up"></i>`;
                return;
            }
            const seq = e.target.closest(".af3-seq");
            if (seq) seq.classList.toggle("af3-seq-expanded");
        });
        this.paginationList.addEventListener("click", e => {
            const button = e.target.closest("button[data-page]");
            if (button && !button.disabled) this.setPage(Number(button.dataset.page));
        });
    }

    reset() {
        this.textarea.value = "";
        this.fileInput.value = "";
        this.results.classList.add("d-none");
        this.error.classList.add("d-none");
        this.setStatus("");
        this.textarea.focus();
    }

    async loadFile() {
        const files = [...(this.fileInput.files ?? [])];
        if (files.length) await this.loadFasta(files);
        this.fileInput.value = "";
    }

    /**
     * Load FASTA file(s) into the form, replacing whatever is there.
     * Multiple files are appended together in the order given.
     */
    async loadFasta(files) {
        try {
            const texts = await Promise.all(files.map(f => f.text()));
            this.textarea.value = texts.map(t => t.trim()).filter(Boolean).join("\n") + "\n";
            const label = files.length === 1 ? files[0].name : `${files.length} files (appended together)`;
            this.setStatus(`Loaded ${label}`);
            this.error.classList.add("d-none");
        } catch (e) {
            this.showError(`Could not read the FASTA file(s): ${e.message}`);
        }
    }

    setStatus(text) { this.status.textContent = text; }

    showError(message) {
        this.error.textContent = message;
        this.error.classList.remove("d-none");
    }

    setBusy(busy) {
        this.submitButton.disabled = busy;
        this.submitButton.querySelector(".spinner-border")?.classList.toggle("d-none", !busy);
    }

    async search() {
        this.error.classList.add("d-none");
        const queries = parseSequences(this.textarea.value);
        if (!queries.length) {
            this.showError("Enter at least one protein sequence to search for.");
            return;
        }

        this.setBusy(true);
        this.setStatus(`Hashing ${queries.length} ${queries.length === 1 ? "sequence" : "sequences"}…`);
        try {
            const valid = queries.filter(q => !q.error);
            await Promise.all(valid.map(async q => { q.hash = await sha256Hex(q.sequence); }));
            const uniqueHashes = [...new Set(valid.map(q => q.hash))];

            this.setStatus("");
            this.setSearchProgress(0, valid.length);
            const seqsPerHash = new Map();
            for (const q of valid) seqsPerHash.set(q.hash, (seqsPerHash.get(q.hash) ?? 0) + 1);
            let done = 0;
            const hitsByHash = uniqueHashes.length
                ? await queryRegistry(uniqueHashes, chunk => {
                    done += chunk.reduce((n, hash) => n + (seqsPerHash.get(hash) ?? 0), 0);
                    this.setSearchProgress(done, valid.length);
                })
                : new Map();

            for (const q of queries) {
                q.hits = q.error ? [] : (hitsByHash.get(q.hash) ?? []);
            }
            this.queries = queries;
            this.render();
        } catch (e) {
            console.error("AlphaFold alignment search failed:", e);
            this.showError(`The alignment registry could not be queried (${e.message}). Please try again later or contact support@osg-htc.org.`);
            this.setStatus("");
        } finally {
            this.setBusy(false);
            this.searchProgress.classList.add("d-none");
        }
    }

    /**
     * Show query progress in terms of the researcher's sequences (not the
     * deduplicated hashes actually sent on the wire).
     */
    setSearchProgress(done, total) {
        this.searchProgress.classList.remove("d-none");
        this.searchProgressBar.style.width = total ? `${Math.round((done / total) * 100)}%` : "100%";
        this.searchProgressText.textContent =
            `Queried ${numberFormat.format(done)} of ${numberFormat.format(total)} ${total === 1 ? "sequence" : "sequences"}…`;
    }

    render() {
        // Collect unique hits (a sequence submitted twice should only count once).
        const seen = new Map();
        for (const q of this.queries) {
            for (const hit of q.hits) {
                if (!seen.has(hit.osdf_uri)) {
                    seen.set(hit.osdf_uri, { ...hit, https_url: osdfToHttps(hit.osdf_uri), query_names: [] });
                }
                seen.get(hit.osdf_uri).query_names.push(q.name);
            }
        }
        this.hits = [...seen.values()].sort((a, b) =>
            compareSources(a.source, b.source) || basename(a.osdf_uri).localeCompare(basename(b.osdf_uri)));
        this.hitsBySource = new Map();
        for (const hit of this.hits) {
            if (!this.hitsBySource.has(hit.source)) this.hitsBySource.set(hit.source, []);
            this.hitsBySource.get(hit.source).push(hit);
        }
        const sources = [...this.hitsBySource.keys()].sort(compareSources);

        // Headline summary
        const queriesWithHits = this.queries.filter(q => q.hits.length).length;
        const invalid = this.queries.filter(q => q.error).length;
        const totalHits = this.queries.reduce((n, q) => n + q.hits.length, 0);
        this.summary.innerHTML = `
            <div class="af3-stat"><b>${numberFormat.format(this.queries.length)}</b><span>${this.queries.length === 1 ? "query" : "queries"}</span></div>
            <div class="af3-stat"><b>${numberFormat.format(queriesWithHits)}</b><span>with a cached alignment</span></div>
            <div class="af3-stat"><b>${numberFormat.format(totalHits)}</b><span>${totalHits === 1 ? "hit" : "hits"} in total</span></div>
            ${invalid ? `<div class="af3-stat text-danger"><b>${numberFormat.format(invalid)}</b><span>could not be parsed</span></div>` : ""}
        `;

        // Per-source summary
        this.sourceSummary.innerHTML = sources.length
            ? sources.map(source => {
                const n = this.hitsBySource.get(source).length;
                return `<span class="badge rounded-pill text-bg-light border fw-normal fs-6 me-2 mb-2">${escapeHtml(source)} <b class="ms-1">${numberFormat.format(n)}</b></span>`;
            }).join("")
            : `<span class="text-muted">No matching alignments were found for these sequences.</span>`;

        // Download menu
        this.downloadButton.disabled = !this.hits.length;
        this.downloadMenu.innerHTML = [
            `<li><h6 class="dropdown-header">Download every hit from…</h6></li>`,
            ...sources.map(source =>
                `<li><a class="dropdown-item" href="#" data-source="${escapeHtml(source)}">${escapeHtml(source)} <span class="text-muted">(${downloadSetLabel(this.hitsBySource.get(source))})</span></a></li>`),
            sources.length > 1 ? `<li><hr class="dropdown-divider"></li>` : "",
            `<li><a class="dropdown-item" href="#" data-source="${ANY_SOURCE}">Any Matching Source <span class="text-muted">(${downloadSetLabel(this.hits)})</span></a></li>`,
        ].join("");
        this.downloadProgress.classList.add("d-none");
        this.downloadError.classList.add("d-none");

        // Results table
        this.page = 0;
        this.renderTable();
        this.results.classList.remove("d-none");
        this.results.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    /**
     * Render the current page of the results table. Only the table is paged;
     * the summary, per-source counts, and "Download All" always cover the
     * entire result set.
     */
    renderTable() {
        const total = this.queries.length;
        const pages = Math.max(1, Math.ceil(total / RESULTS_PER_PAGE));
        this.page = Math.min(Math.max(this.page, 0), pages - 1);
        const start = this.page * RESULTS_PER_PAGE;
        const slice = this.queries.slice(start, start + RESULTS_PER_PAGE);
        this.tableBody.innerHTML = slice.map((q, i) => this.renderRow(q, start + i)).join("");

        this.paginationRow.classList.toggle("d-none", pages <= 1);
        if (pages <= 1) return;
        this.paginationInfo.textContent =
            `Showing queries ${numberFormat.format(start + 1)}–${numberFormat.format(start + slice.length)} of ${numberFormat.format(total)}`;
        const item = (label, page, { disabled = false, active = false, gap = false } = {}) => gap
            ? `<li class="page-item disabled"><span class="page-link">&hellip;</span></li>`
            : `<li class="page-item ${disabled ? "disabled" : ""} ${active ? "active" : ""}">
                 <button type="button" class="page-link" data-page="${page}" ${disabled ? "disabled" : ""}>${label}</button>
               </li>`;
        this.paginationList.innerHTML = [
            item("&laquo; Prev", this.page - 1, { disabled: this.page === 0 }),
            ...pageNumbers(this.page, pages).map(p => p === null
                ? item("", 0, { gap: true })
                : item(numberFormat.format(p + 1), p, { active: p === this.page })),
            item("Next &raquo;", this.page + 1, { disabled: this.page === pages - 1 }),
        ].join("");
    }

    setPage(page) {
        if (page === this.page) return;
        this.page = page;
        this.renderTable();
        this.tableBody.closest(".table-responsive").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    renderRow(q, index) {
        const name = `<div class="fw-semibold">${escapeHtml(q.name)}</div>` +
            (q.hash ? `<small class="text-muted font-monospace" title="SHA-256 ${escapeHtml(q.hash)}">${q.hash.slice(0, 12)}…</small>` : "");

        const sequence = q.error
            ? `<span class="text-danger"><i class="bi bi-exclamation-triangle-fill"></i> ${escapeHtml(q.error)}</span>` +
              (q.raw ? `<br><code class="af3-seq text-muted" title="Click to expand">${escapeHtml(q.raw)}</code>` : "")
            : `<code class="af3-seq" title="Click to expand">${escapeHtml(q.sequence)}</code>` +
              `<br><small class="text-muted">${numberFormat.format(q.sequence.length)} aa</small>`;

        const count = q.error
            ? `<span class="text-muted">&mdash;</span>`
            : q.hits.length
                ? `<span class="fw-bold">${numberFormat.format(q.hits.length)}</span>`
                : `<span class="text-muted">0</span>`;

        const sortedHits = [...q.hits].sort((a, b) => compareSources(a.source, b.source));
        const hits = sortedHits.length
            ? `<ul class="list-unstyled mb-0 af3-hit-list">${sortedHits.map(hit => this.renderHit(hit)).join("")}</ul>`
            : q.error ? "" : `<span class="text-muted fst-italic">No cached alignment</span>`;

        return `<tr class="${q.hits.length ? "" : "table-light"}">
            <td>${name}</td>
            <td>${sequence}</td>
            <td class="text-center">${count}</td>
            <td>${hits}</td>
        </tr>`;
    }

    renderHit(hit) {
        const url = osdfToHttps(hit.osdf_uri);
        const filename = basename(hit.osdf_uri);
        const details = [
            hit.query_name && hit.query_name !== "Unclassified" ? hit.query_name : null,
            hit.species && hit.species !== "Unclassified" ? `<i>${escapeHtml(hit.species)}</i>` : null,
            hit.n_sequences != null ? `${numberFormat.format(hit.n_sequences)} sequences` : null,
            hit.a3m_size_bytes != null ? formatBytes(hit.a3m_size_bytes) : null,
        ].filter(Boolean).map(d => d.startsWith("<i>") ? d : escapeHtml(d)).join(" · ");
        const metadata = [
            ["File", filename],
            ["Source", hit.source],
            ["Database version", hit.db_version],
            ["Query length", hit.seq_length != null ? `${numberFormat.format(hit.seq_length)} aa` : null],
            ["Aligned sequences", hit.n_sequences != null ? numberFormat.format(hit.n_sequences) : null],
            ["Size", hit.a3m_size_bytes != null ? `${formatBytes(hit.a3m_size_bytes)} (${numberFormat.format(hit.a3m_size_bytes)} bytes)` : null],
            ["A3M SHA-256", hit.a3m_sha256],
            ["Sequence hash", hit.seq_hash],
        ].filter(([, value]) => value != null && value !== "");

        return `<li class="mb-2">
            <a href="${escapeHtml(url)}" data-a3m="${escapeHtml(filename)}" title="Download ${escapeHtml(filename)}" class="fw-semibold text-decoration-none">
                <i class="bi bi-download"></i> ${escapeHtml(hit.source)}
            </a>
            ${details ? `<br><small class="text-muted">${details}</small>` : ""}
            <br><button type="button" class="btn btn-link btn-sm p-0 af3-meta-toggle">Get Metadata <i class="bi bi-chevron-down"></i></button>
            <div class="af3-meta d-none">
                <dl class="mb-0">${metadata.map(([key, value]) =>
                    `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
                </dl>
            </div>
        </li>`;
    }

    /**
     * Download a single hit. Fetching it ourselves lets us attach a proper
     * filename; if that fails (e.g. the cache is unreachable) fall back to
     * opening the link directly.
     */
    async downloadOne(link) {
        const url = link.href;
        const filename = link.dataset.a3m || basename(url);
        link.classList.add("disabled");
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            saveBlob(await response.blob(), filename);
        } catch (e) {
            console.warn(`Direct download of ${url} failed, opening in a new tab instead:`, e);
            window.open(url, "_blank", "noopener");
        } finally {
            link.classList.remove("disabled");
        }
    }

    /**
     * Fetch every hit for `source` (or every hit when source === ANY_SOURCE)
     * and hand the user a single zip archive.
     */
    async downloadAll(source) {
        if (this.downloading) return;
        const hits = source === ANY_SOURCE ? this.hits : (this.hitsBySource.get(source) ?? []);
        if (!hits.length) return;

        const label = source === ANY_SOURCE ? "any-source" : slugify(source);
        const zipName = `af3-alignments-${label}.zip`;

        this.downloading = true;
        this.downloadButton.disabled = true;
        this.downloadError.classList.add("d-none");
        this.downloadProgress.classList.remove("d-none");
        this.downloadProgressBar.style.width = "0%";
        this.downloadProgressBar.classList.add("progress-bar-striped", "progress-bar-animated");
        this.downloadProgressBar.classList.remove("bg-success");
        this.downloadProgressText.textContent = `Preparing ${hits.length} ${hits.length === 1 ? "file" : "files"}…`;

        let done = 0;
        let bytes = 0;
        const failures = [];
        const tick = () => {
            done += 1;
            const pct = Math.round((done / hits.length) * 100);
            this.downloadProgressBar.style.width = `${pct}%`;
            this.downloadProgressText.textContent = `Fetched ${done} of ${hits.length} ${hits.length === 1 ? "file" : "files"} (${formatBytes(bytes)})…`;
        };

        try {
            const usedNames = new Set();
            const entries = await mapConcurrent(hits, DOWNLOAD_CONCURRENCY, async hit => {
                let entry = null;
                try {
                    const response = await fetch(hit.https_url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const data = new Uint8Array(await response.arrayBuffer());
                    bytes += data.length;
                    if (bytes > MAX_ZIP_BYTES) throw new Error("the archive would exceed the zip size limit");
                    let name = `${slugify(hit.source)}/${basename(hit.osdf_uri)}`;
                    let n = 1;
                    while (usedNames.has(name)) name = name.replace(/(\.[^.]*)?$/, `-${++n}$1`);
                    usedNames.add(name);
                    entry = { name, data };
                } catch (e) {
                    failures.push({ hit, reason: e.message });
                }
                tick();
                return entry;
            });

            const files = entries.filter(Boolean);
            if (!files.length) {
                throw new Error(`none of the ${hits.length} alignment files could be fetched (${failures[0]?.reason ?? "unknown error"})`);
            }

            files.push({ name: "manifest.tsv", data: new TextEncoder().encode(this.buildManifest(hits, failures)) });
            this.downloadProgressText.textContent = `Building ${zipName} (${formatBytes(bytes)})…`;
            saveBlob(buildZip(files), zipName);
            this.downloadProgressBar.style.width = "100%";
            this.downloadProgressBar.classList.remove("progress-bar-striped", "progress-bar-animated");
            this.downloadProgressBar.classList.add("bg-success");
            const n = files.length - 1;
            this.downloadProgressText.innerHTML = `<i class="bi bi-check-circle-fill text-success"></i> ` +
                `Done &mdash; downloaded ${n} ${n === 1 ? "alignment" : "alignments"} (${formatBytes(bytes)}) as ${escapeHtml(zipName)}.`;

            if (failures.length) {
                this.downloadError.innerHTML = `<b>${failures.length} ${failures.length === 1 ? "file" : "files"} could not be fetched</b> and ${failures.length === 1 ? "was" : "were"} left out of the archive (see manifest.tsv):<ul class="mb-0">` +
                    failures.map(f => `<li><code>${escapeHtml(basename(f.hit.osdf_uri))}</code> &mdash; ${escapeHtml(f.reason)}</li>`).join("") + `</ul>`;
                this.downloadError.classList.remove("d-none");
            }
        } catch (e) {
            console.error("Download all failed:", e);
            this.downloadProgress.classList.add("d-none");
            this.downloadError.textContent = `Could not build the archive: ${e.message}.`;
            this.downloadError.classList.remove("d-none");
        } finally {
            this.downloading = false;
            this.downloadButton.disabled = false;
        }
    }

    buildManifest(hits, failures) {
        const failed = new Map(failures.map(f => [f.hit.osdf_uri, f.reason]));
        const header = ["query_names", "seq_hash", "source", "file", "osdf_uri", "https_url", "db_version", "species", "query_name", "n_sequences", "a3m_size_bytes", "a3m_sha256", "status"];
        const rows = hits.map(hit => [
            hit.query_names.join("; "), hit.seq_hash, hit.source, `${slugify(hit.source)}/${basename(hit.osdf_uri)}`,
            hit.osdf_uri, hit.https_url, hit.db_version, hit.species, hit.query_name,
            hit.n_sequences ?? "", hit.a3m_size_bytes ?? "", hit.a3m_sha256 ?? "",
            failed.has(hit.osdf_uri) ? `failed: ${failed.get(hit.osdf_uri)}` : "ok",
        ].map(v => String(v ?? "").replace(/[\t\r\n]+/g, " ")).join("\t"));
        return [header.join("\t"), ...rows].join("\n") + "\n";
    }
}

new AlphaFoldSearch();
