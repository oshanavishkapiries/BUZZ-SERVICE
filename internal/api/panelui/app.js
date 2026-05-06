'use strict';

// ── Helpers ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const fmtDate = iso => iso ? new Date(iso).toLocaleString() : '—';
const fmtDateShort = iso => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
};

// ── API Client ────────────────────────────────────────────────────────────
const API = {
  key()    { return ($('cfgKey') || {}).value || ''; },
  userId() { return ($('cfgUser') || {}).value || 'user-123'; },

  headers(extra = {}) {
    return {
      'Authorization': 'Bearer ' + this.key(),
      'X-User-ID':     this.userId(),
      'Content-Type':  'application/json',
      ...extra,
    };
  },

  async request(method, path, body) {
    const opts = { method, headers: this.headers() };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const r = await fetch(path, opts);
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('json')) return r.json();
    return { _text: await r.text(), _status: r.status };
  },

  get(path)        { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  patch(path)      { return this.request('PATCH', path); },
  del(path)        { return this.request('DELETE', path); },
};

// ── JSON Highlight ────────────────────────────────────────────────────────
function highlight(obj) {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(
    /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    m => {
      if (/^"/.test(m)) return /:$/.test(m) ? `<span class="jk">${esc(m)}</span>` : `<span class="js">${esc(m)}</span>`;
      if (/true|false/.test(m)) return `<span class="jb">${m}</span>`;
      if (/null/.test(m))       return `<span class="jz">${m}</span>`;
      return `<span class="jn">${m}</span>`;
    }
  );
}

function showResult(containerEl, data, ok = true) {
  if (!containerEl) return;
  containerEl.style.display = 'block';
  containerEl.querySelector('.result-status').textContent = ok ? 'OK' : 'Error';
  containerEl.querySelector('.result-status').className  = 'result-status ' + (ok ? 'ok' : 'error');
  containerEl.querySelector('.result-body').innerHTML    = highlight(data);
}

// ── Badge helpers ─────────────────────────────────────────────────────────
function channelBadge(ch) {
  return `<span class="badge badge-blue">${esc(ch || '—')}</span>`;
}
function priorityBadge(p) {
  const cls = { urgent:'red', high:'orange', normal:'green', low:'blue' }[p] || 'gray';
  return `<span class="badge badge-${cls}">${esc(p || 'normal')}</span>`;
}
function statusBadge(s) {
  const cls = { delivered:'green', failed:'red', queued:'gray', pending:'yellow', processing:'orange' }[s] || 'gray';
  return `<span class="badge badge-${cls}">${esc(s || '—')}</span>`;
}

// ── Navigation ────────────────────────────────────────────────────────────
function navigate(section) {
  document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-section]').forEach(el => el.classList.remove('active'));

  const s = $('section-' + section);
  if (s) s.classList.add('active');

  const n = document.querySelector(`.nav-item[data-section="${section}"]`);
  if (n) n.classList.add('active');

  // Load data for the activated section
  if (section === 'dashboard') Dashboard.load();
  if (section === 'inbox')     Inbox.load();
  if (section === 'stream')    Stream.init();
  if (section === 'notifications') NotifList.load();
}

// ── Dashboard ─────────────────────────────────────────────────────────────
const Dashboard = {
  refreshTimer: null,

  async load() {
    await Promise.all([this.loadSystem(), this.loadQueues()]);
  },

  async loadSystem() {
    try {
      const d = await API.get('/api/v1/monitoring/system');
      $('m-memory').textContent    = (d.memory?.heap_alloc_mb ?? '—') + ' MB';
      $('m-goroutines').textContent = d.goroutines ?? '—';
      $('m-uptime').textContent    = d.uptime?.display ?? '—';
      $('m-load').textContent      = d.load_avg ?? '—';
      $('m-gcRuns').textContent    = d.memory?.gc_runs ?? '—';
      $('m-sys').textContent       = (d.memory?.sys_mb ?? '—') + ' MB';
    } catch(e) {
      console.error('system metrics error', e);
    }
  },

  async loadQueues() {
    try {
      const d = await API.get('/api/v1/monitoring/stats');
      const queues  = d.queues || {};
      const totals  = d.totals || {};
      const names   = Object.keys(queues);

      // Totals bar
      $('total-processed').textContent = totals.processed ?? 0;
      $('total-failed').textContent    = totals.failed ?? 0;
      $('total-active').textContent    = totals.active ?? 0;

      if (!names.length) {
        $('queue-tbody').innerHTML = `<tr><td colspan="5" style="text-align:center;color:#aaa;padding:20px">No queues found</td></tr>`;
        return;
      }

      const maxProcessed = Math.max(...names.map(n => queues[n].processed || 0), 1);

      $('queue-tbody').innerHTML = names.map(name => {
        const q       = queues[name] || {};
        const proc    = q.processed || 0;
        const fail    = q.failed    || 0;
        const size    = q.size      || 0;
        const pct     = Math.round((proc / maxProcessed) * 100);
        const failPct = proc > 0 ? ((fail / proc) * 100).toFixed(1) : '0.0';

        return `<tr>
          <td class="td-name">${esc(name)}</td>
          <td>${size}</td>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="bar-wrap"><div class="bar-fill green" style="width:${pct}%"></div></div>
              <span class="td-mono">${proc.toLocaleString()}</span>
            </div>
          </td>
          <td>
            <span style="color:${fail>0?'var(--red)':'var(--text-3)'}">${fail.toLocaleString()}</span>
            ${fail > 0 ? `<span style="font-size:10px;color:var(--text-3);margin-left:4px">(${failPct}%)</span>` : ''}
          </td>
          <td>${q.paused ? '<span class="badge badge-yellow">paused</span>' : '<span class="badge badge-green">active</span>'}</td>
        </tr>`;
      }).join('');
    } catch(e) {
      $('queue-tbody').innerHTML = `<tr><td colspan="5" style="color:var(--red);padding:14px">${esc(e.message)}</td></tr>`;
    }
  },

  startAutoRefresh(secs = 30) {
    this.stopAutoRefresh();
    this.load();
    this.refreshTimer = setInterval(() => this.load(), secs * 1000);
    $('refresh-btn').textContent = 'Auto-refreshing';
    $('refresh-btn').classList.add('btn-primary');
    $('refresh-btn').classList.remove('btn-secondary');
  },

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if ($('refresh-btn')) {
      $('refresh-btn').textContent = 'Auto-refresh (30s)';
      $('refresh-btn').classList.remove('btn-primary');
      $('refresh-btn').classList.add('btn-secondary');
    }
  },

  toggleAutoRefresh() {
    if (this.refreshTimer) this.stopAutoRefresh();
    else this.startAutoRefresh();
  },
};

// ── SSE Stream ────────────────────────────────────────────────────────────
const Stream = {
  ctrl: null,
  count: 0,

  init() {
    // already connected: nothing to do
  },

  connect() {
    if (this.ctrl) this.disconnect();
    this.setStatus('connecting', 'Connecting…');
    this.ctrl = new AbortController();

    fetch('/api/v1/stream', {
      headers: { ...API.headers(), Accept: 'text/event-stream' },
      signal: this.ctrl.signal,
    })
    .then(r => {
      if (!r.ok) return r.text().then(t => { throw new Error('HTTP ' + r.status + ': ' + t); });
      this.setStatus('connected', 'Connected');
      $('stream-connect-btn').textContent = 'Disconnect';
      $('stream-connect-btn').onclick = () => this.disconnect();
      $('stream-feed-empty').style.display = 'none';

      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      const pump = () => reader.read().then(({ done, value }) => {
        if (done) { this.setStatus('idle', 'Stream ended'); return; }
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try { this.pushEvent(JSON.parse(line.slice(6))); } catch(_) {}
          }
        }
        return pump();
      });
      return pump();
    })
    .catch(e => {
      if (e.name === 'AbortError') return;
      this.setStatus('err', 'Error: ' + e.message);
    });
  },

  disconnect() {
    if (this.ctrl) { this.ctrl.abort(); this.ctrl = null; }
    this.setStatus('idle', 'Disconnected');
    if ($('stream-connect-btn')) {
      $('stream-connect-btn').textContent = 'Connect';
      $('stream-connect-btn').onclick = () => this.connect();
    }
  },

  setStatus(state, label) {
    const dot = $('stream-dot');
    const txt = $('stream-status-text');
    if (dot) dot.className = 'dot ' + (state === 'connected' ? 'ok' : state === 'connecting' ? 'warn' : state === 'err' ? 'err' : 'idle');
    if (txt) txt.textContent = label;
  },

  pushEvent(data) {
    this.count++;
    $('stream-feed-empty').style.display = 'none';
    const el = document.createElement('div');
    el.className = 'feed-item p-' + (data.priority || 'normal');
    el.innerHTML = `
      <div class="feed-meta">
        <span class="feed-time">${fmtDateShort(new Date().toISOString())}</span>
        ${channelBadge(data.channel)}
        ${priorityBadge(data.priority)}
      </div>
      <div class="feed-body">${esc(data.body || data.message || JSON.stringify(data))}</div>
    `;
    $('stream-feed').prepend(el);
    if ($('stream-count')) $('stream-count').textContent = this.count + ' events received';
  },

  clear() {
    $('stream-feed').innerHTML = '';
    $('stream-feed-empty').style.display = 'block';
    this.count = 0;
    if ($('stream-count')) $('stream-count').textContent = '';
  },
};

// ── Send Notification ─────────────────────────────────────────────────────
const Send = {
  async submit() {
    const to       = ($('s-to').value || API.userId()).trim();
    const channel  = $('s-channel').value;
    const priority = $('s-priority').value;
    const body     = $('s-body').value.trim();
    const subject  = $('s-subject').value.trim();
    const tmpl     = $('s-template').value.trim();

    if (!body && !tmpl) { alert('Body or template name is required'); return; }

    const payload = { to, channel, priority, body };
    if (subject) payload.subject = subject;
    if (tmpl)    payload.template = tmpl;

    try {
      const data = await API.post('/api/v1/notifications', payload);
      showResult($('send-result'), data, !data.error);
    } catch(e) {
      showResult($('send-result'), { error: e.message }, false);
    }
  },
};

// ── Inbox ─────────────────────────────────────────────────────────────────
const Inbox = {
  async load() {
    try {
      const d = await API.get('/api/v1/inbox');
      this.render(d);
    } catch(e) {
      $('inbox-list').innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`;
    }
  },

  render(d) {
    const items  = d.data || [];
    const unread = d.unread_count || 0;
    $('inbox-summary').textContent = `${d.total ?? items.length} items · ${unread} unread`;

    if (!items.length) {
      $('inbox-list').innerHTML = `<div class="empty"><p>Inbox is empty</p></div>`;
      return;
    }
    $('inbox-list').innerHTML = items.map(it => `
      <div class="inbox-item ${it.read_at ? 'read' : 'unread'}" id="ii-${it.id}">
        <div class="inbox-dot"></div>
        <div style="flex:1;min-width:0">
          <div class="inbox-body">${esc(it.body || it.content || '')}</div>
          <div class="inbox-meta">${channelBadge(it.channel)} · ${fmtDate(it.created_at)}</div>
        </div>
        <div class="inbox-actions">
          ${!it.read_at ? `<button class="btn btn-secondary btn-sm" onclick="Inbox.markRead('${it.id}')">Mark read</button>` : ''}
          <button class="btn btn-danger btn-sm" onclick="Inbox.del('${it.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  },

  async markRead(id) {
    await API.patch('/api/v1/inbox/' + id + '/read');
    this.load();
  },

  async markAllRead() {
    await API.post('/api/v1/inbox/read-all', {});
    this.load();
  },

  async del(id) {
    await API.del('/api/v1/inbox/' + id);
    const el = $('ii-' + id);
    if (el) el.remove();
  },
};

// ── Notification List ─────────────────────────────────────────────────────
const NotifList = {
  page: 0,
  limit: 20,
  total: 0,

  async load(page = 0) {
    this.page = page;
    const offset = page * this.limit;
    const params = new URLSearchParams({ limit: this.limit, offset });
    const status  = $('nl-status').value;
    const channel = $('nl-channel').value;
    const to      = $('nl-to').value.trim();
    if (status)  params.set('status', status);
    if (channel) params.set('channel', channel);
    if (to)      params.set('recipient_id', to);

    try {
      const d = await API.get('/api/v1/notifications?' + params);
      this.render(d);
    } catch(e) {
      $('nl-table').innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`;
    }
  },

  render(d) {
    const items = d.data || [];
    this.total = d.total || 0;
    $('nl-summary').textContent = `${this.total} notifications (${this.page * this.limit + 1} - ${Math.min((this.page + 1) * this.limit, this.total)})`;

    if (!items.length) {
      $('nl-table').innerHTML = `<div class="empty"><p>No notifications found</p></div>`;
      this.renderPagination();
      return;
    }

    $('nl-table').innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>ID</th><th>Channel</th><th>Priority</th><th>Status</th>
            <th>Recipient</th><th>Body</th><th>Created</th>
          </tr></thead>
          <tbody>
            ${items.map(n => {
              const recip = (n.recipient && n.recipient.address) || (n.recipient && n.recipient.user_id) || n.to || '—';
              return `<tr>
              <td class="td-mono">${esc((n.id||'').slice(0,8))}…</td>
              <td>${channelBadge(n.channel)}</td>
              <td>${priorityBadge(n.priority)}</td>
              <td>${statusBadge(n.status)}</td>
              <td class="td-truncate">${esc(recip)}</td>
              <td class="td-truncate">${esc((n.body||'').slice(0,50))}${(n.body||'').length>50?'…':''}</td>
              <td class="td-mono">${fmtDateShort(n.created_at)}</td>
            </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
    this.renderPagination();
  },

  renderPagination() {
    const pages = Math.ceil(this.total / this.limit);
    const pagEl = $('nl-pagination');
    if (!pagEl) return;

    if (pages <= 1) {
      pagEl.innerHTML = '';
      return;
    }

    let html = `<div class="pagination" style="margin-top:12px">`;
    if (this.page > 0) html += `<button class="btn btn-sm" onclick="NotifList.load(${this.page-1})">← Prev</button>`;
    html += `<span style="margin: 0 8px; font-size:13px">Page ${this.page+1} of ${pages}</span>`;
    if (this.page < pages - 1) html += `<button class="btn btn-sm" onclick="NotifList.load(${this.page+1})">Next →</button>`;
    html += `</div>`;
    pagEl.innerHTML = html;
  },
};

// ── Templates ─────────────────────────────────────────────────────────────
const Templates = {
  page: 0,
  limit: 10,
  total: 0,

  async list(page = 0) {
    this.page = page;
    const offset = page * this.limit;
    try {
      const d = await API.get(`/api/v1/templates?limit=${this.limit}&offset=${offset}`);
      const items = d.data || [];
      this.total = d.total || 0;

      if (!items.length) {
        $('tmpl-list').innerHTML = `<div class="empty"><p>No templates</p></div>`;
        this.renderPagination();
        return;
      }

      const channels = (t) => (t.channels || [t.channel]).map(ch => channelBadge(ch)).join(' ');
      $('tmpl-list').innerHTML = `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Channels</th><th>Subject</th><th>Body preview</th><th>Variables</th><th>Actions</th></tr></thead>
            <tbody>
              ${items.map(t => {
                const vars = (t.variables||[]).map(v => '{{' + esc(v) + '}}').join(', ');
                return `<tr>
                <td class="td-name">${esc(t.name)}</td>
                <td>${channels(t)}</td>
                <td class="td-truncate">${esc(t.subject||'—')}</td>
                <td class="td-truncate">${esc((t.body||'').slice(0,40))}${(t.body||'').length>40?'…':''}</td>
                <td><span class="td-mono" style="font-size:10px">${vars||'—'}</span></td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="Templates.editForm('${esc(t.name)}')">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="if(confirm('Delete template?')) Templates.delete('${esc(t.name)}')">Del</button>
                </td>
              </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
      this.renderPagination();
    } catch(e) {
      $('tmpl-list').innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`;
    }
  },

  renderPagination() {
    const pages = Math.ceil(this.total / this.limit);
    const pagEl = $('tmpl-pagination');
    if (!pagEl) return;

    if (pages <= 1) {
      pagEl.innerHTML = '';
      return;
    }

    let html = `<div class="pagination" style="margin-top:12px">`;
    if (this.page > 0) html += `<button class="btn btn-sm" onclick="Templates.list(${this.page-1})">← Prev</button>`;
    html += `<span style="margin: 0 8px; font-size:13px">Page ${this.page+1} of ${pages}</span>`;
    if (this.page < pages - 1) html += `<button class="btn btn-sm" onclick="Templates.list(${this.page+1})">Next →</button>`;
    html += `</div>`;
    pagEl.innerHTML = html;
  },

  async create() {
    const name    = $('t-name').value.trim();
    const channel = $('t-channel').value;
    const subject = $('t-subject').value.trim();
    const body    = $('t-body').value.trim();
    const vars    = $('t-vars').value.split(',').map(s=>s.trim()).filter(Boolean);

    if (!name || !body) { alert('Name and body are required'); return; }

    try {
      const d = await API.post('/api/v1/templates', { name, channel, subject, body, variables: vars });
      showResult($('tmpl-result'), d, !d.error);
      if (!d.error) {
        ['t-name','t-subject','t-body','t-vars','t-channel'].forEach(id => {
          const el = $(id);
          if (el) el.value = el.tagName === 'SELECT' ? 'email' : '';
        });
        this.list(0);
      }
    } catch(e) {
      showResult($('tmpl-result'), { error: e.message }, false);
    }
  },

  async editForm(name) {
    try {
      const d = await API.get(`/api/v1/templates/${encodeURIComponent(name)}`);
      $('t-name').value = d.name;
      $('t-name').readOnly = true;
      $('t-channel').value = (d.channels || [d.channel])[0] || 'email';
      $('t-subject').value = d.subject || '';
      $('t-body').value = d.body;
      $('t-vars').value = (d.variables || []).join(', ');
      $('t-update-btn').style.display = 'inline-block';
      document.querySelector('.form-section:has(#t-name)').scrollIntoView({ behavior: 'smooth' });
    } catch(e) {
      alert('Failed to load template: ' + e.message);
    }
  },

  async update() {
    const name    = $('t-name').value.trim();
    const subject = $('t-subject').value.trim();
    const body    = $('t-body').value.trim();

    if (!name || !body) { alert('Name and body are required'); return; }

    try {
      const d = await API.patch(`/api/v1/templates/${encodeURIComponent(name)}`, { subject: subject || null, body });
      showResult($('tmpl-result'), d, !d.error);
      if (!d.error) {
        ['t-name','t-subject','t-body','t-vars','t-channel'].forEach(id => {
          const el = $(id);
          if (el) { el.value = el.tagName === 'SELECT' ? 'email' : ''; el.readOnly = false; }
        });
        this.list(0);
      }
    } catch(e) {
      showResult($('tmpl-result'), { error: e.message }, false);
    }
  },

  async delete(name) {
    try {
      const d = await API.del(`/api/v1/templates/${encodeURIComponent(name)}`);
      showResult($('tmpl-result'), d, !d.error);
      if (!d.error) this.list(0);
    } catch(e) {
      alert('Failed to delete: ' + e.message);
    }
  },
};

// ── Batches ───────────────────────────────────────────────────────────────
const Batches = {
  async send() {
    const datasource = $('b-datasource').value.trim();
    const channel    = $('b-channel').value;
    const priority   = $('b-priority').value;
    const body       = $('b-body').value.trim();
    const subject    = $('b-subject').value.trim();

    if (!datasource || !body) { alert('Datasource ID and body are required'); return; }

    const payload = { datasource_id: datasource, channel, priority, body };
    if (subject) payload.subject = subject;

    try {
      const d = await API.post('/api/v1/batches/send', payload);
      showResult($('batch-result'), d, !d.error);
      if (!d.error && d.id) $('b-status-id').value = d.id;
    } catch(e) {
      showResult($('batch-result'), { error: e.message }, false);
    }
  },

  async status() {
    const id = $('b-status-id').value.trim();
    if (!id) { alert('Enter a batch ID'); return; }
    try {
      const d = await API.get('/api/v1/batches/' + id);
      showResult($('batch-result'), d, !d.error);
    } catch(e) {
      showResult($('batch-result'), { error: e.message }, false);
    }
  },

  async list() {
    try {
      const d = await API.get('/api/v1/batches');
      const items = d.data || [];
      if (!items.length) {
        $('batch-list').innerHTML = `<div class="empty"><p>No batch jobs yet</p></div>`;
        return;
      }
      $('batch-list').innerHTML = `
        <div class="table-wrap" style="margin-top:16px">
          <table>
            <thead><tr><th>ID</th><th>Status</th><th>Channel</th><th>Progress</th><th>Total</th><th>Created</th><th></th></tr></thead>
            <tbody>
              ${items.map(b => {
                const pct = b.total > 0 ? Math.round((b.processed/b.total)*100) : 0;
                return `<tr>
                  <td class="td-mono">${esc((b.id||'').slice(0,8))}…</td>
                  <td>${statusBadge(b.status)}</td>
                  <td>${channelBadge(b.channel)}</td>
                  <td>
                    <div class="bar-wrap"><div class="bar-fill" style="width:${pct}%"></div></div>
                    <span class="td-mono" style="margin-left:6px">${pct}%</span>
                  </td>
                  <td class="td-mono">${b.total ?? '—'}</td>
                  <td class="td-mono">${fmtDateShort(b.created_at)}</td>
                  <td><button class="btn btn-secondary btn-sm" onclick="$('b-status-id').value='${esc(b.id)}';Batches.status()">Details</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    } catch(e) {
      $('batch-list').innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`;
    }
  },
};

// ── Devices ───────────────────────────────────────────────────────────────
const Devices = {
  async register() {
    const user_id  = ($('d-user').value.trim()) || API.userId();
    const token    = $('d-token').value.trim();
    const platform = $('d-platform').value;

    if (!token) { alert('Device token is required'); return; }

    try {
      const d = await API.post('/api/v1/devices/register', { user_id, token, platform });
      showResult($('device-result'), d, !d.error);
      if (!d.error) { $('d-token').value = ''; this.list(); }
    } catch(e) {
      showResult($('device-result'), { error: e.message }, false);
    }
  },

  async list() {
    try {
      const d = await API.get('/api/v1/devices');
      const items = d.data || [];
      if (!items.length) {
        $('device-list').innerHTML = `<div class="empty"><p>No devices registered</p></div>`;
        return;
      }
      $('device-list').innerHTML = `
        <div class="table-wrap" style="margin-top:16px">
          <table>
            <thead><tr><th>Token</th><th>Platform</th><th>User</th><th>Registered</th><th></th></tr></thead>
            <tbody>
              ${items.map(dv => `<tr>
                <td class="td-mono">${esc((dv.token||'').slice(0,24))}…</td>
                <td>${channelBadge(dv.platform)}</td>
                <td>${esc(dv.user_id||'—')}</td>
                <td class="td-mono">${fmtDateShort(dv.created_at)}</td>
                <td><button class="btn btn-danger btn-sm" onclick="Devices.unregister('${esc(dv.token)}')">Remove</button></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } catch(e) {
      $('device-list').innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`;
    }
  },

  async unregister(token) {
    await API.del('/api/v1/devices/' + encodeURIComponent(token));
    this.list();
  },
};

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Bind nav items
  document.querySelectorAll('.nav-item[data-section]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.section));
  });

  // Load dashboard on boot
  navigate('dashboard');
  Dashboard.startAutoRefresh(30);
});
