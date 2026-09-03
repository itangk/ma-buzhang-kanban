/* Beihai CC6 progress dashboard */
function PD() { return window.PROGRESS_DATA || {}; }

function pgPct(v, d) {
  if (v == null || isNaN(v)) return '—';
  return (v * 100).toFixed(d == null ? 2 : d) + '%';
}
function pgNum(v, d) {
  if (v == null || isNaN(v)) return '—';
  const n = Number(v);
  if (Math.abs(n) >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: d == null ? 2 : d, minimumFractionDigits: 0 });
  return n.toFixed(d == null ? 2 : d);
}
function pgFmtDate(iso) {
  if (!iso) return '—';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dd = m[3];
  const mon = months[parseInt(m[2], 10) - 1] || m[2];
  const yy = m[1].slice(2);
  return dd + '-' + mon + '-' + yy;
}
function pgVarClass(v) {
  if (v == null) return '';
  if (v > 0.002) return 'lead';
  if (v < -0.002) return 'lag';
  return 'flat';
}
function pgCwaMap() {
  const m = {};
  (PD().cwa || []).forEach(c => { m[c.id] = c; });
  return m;
}
function pgUnitRow(source, unit) {
  const rows = source === 'owner' ? (PD().ownerUnits || []) : (PD().units || []);
  const id = !unit || unit === 'Overall' ? 'Overall Project' : String(unit);
  return rows.find(r => r.id === id) || rows.find(r => r.id === 'Overall Project') || {};
}
function pgColor(pct) {
  const p = Math.max(0, Math.min(1, pct || 0));
  const y = [234, 179, 8], g = [22, 163, 74];
  const m = y.map((a, i) => Math.round(a + (g[i] - a) * p));
  return 'rgb(' + m.join(',') + ')';
}

function pgCurve(unit, source) {
  const pd = PD();
  const cutoff = pd.meta && pd.meta.cutoff;
  if (source === 'owner') {
    const key = !unit || unit === 'Overall' ? 'Overall' : String(unit);
    const series = (pd.ownerCurve && pd.ownerCurve.series && pd.ownerCurve.series[key]) || pd.ownerCurve.series.Overall || [];
    return series.map(w => ({
      date: w.date,
      planPct: w.planCum,
      actualPct: w.actualCum,
      forecastPct: w.date > cutoff ? w.planCum : w.actualCum,
      planInc: w.planInc,
      actualInc: w.actualInc,
      forecastInc: w.date > cutoff ? w.planInc : null
    }));
  }
  const budgetAll = pd.kpis.budgetMh || 1;
  if (!unit || unit === 'Overall') {
    return (pd.sCurve || []).map(w => ({
      date: w.date,
      planPct: w.planMh != null ? w.planMh / budgetAll : null,
      actualPct: w.actualMh != null ? w.actualMh / budgetAll : null,
      forecastPct: w.forecastMh != null ? w.forecastMh / budgetAll : null,
      planInc: w.planInc != null ? w.planInc / budgetAll : null,
      actualInc: w.actualInc != null ? w.actualInc / budgetAll : null,
      forecastInc: w.forecastInc != null ? w.forecastInc / budgetAll : null
    }));
  }
  const plan = pd.byUnitPlan[unit];
  const actArr = pd.byUnitAct[unit] || [];
  if (!plan) return pgCurve('Overall', source);
  const actMap = {};
  actArr.forEach(x => { actMap[x.date] = x.mh; });
  const budget = plan.budgetMh || 1;
  let lastAct = null;
  return (plan.weeks || []).map((w, i) => {
    const prev = i ? plan.weeks[i - 1].mh : 0;
    const actual = actMap[w.date];
    if (actual != null) lastAct = actual;
    const after = cutoff && w.date > cutoff;
    return {
      date: w.date,
      planPct: w.mh / budget,
      actualPct: actual != null ? actual / budget : null,
      forecastPct: after ? (lastAct || 0) / budget : (actual != null ? actual / budget : null),
      planInc: ((w.mh || 0) - (prev || 0)) / budget,
      actualInc: null,
      forecastInc: null
    };
  });
}

function pgApplyKpi(unit, source, cwaId) {
  const pd = PD();
  if (cwaId && cwaId !== 'all') {
    const c = pgCwaMap()[cwaId];
    if (c) {
      return {
        cumPlan: c.planPct, cumActual: c.actualPct, cumVar: c.varPct,
        incPlan: null, incActual: null, incVar: null,
        spi: c.planPct ? c.actualPct / c.planPct : null,
        label: c.id + ' ' + (c.name || '')
      };
    }
  }
  const row = pgUnitRow(source, unit);
  const spi = row.cumPlan ? row.cumActual / row.cumPlan : pd.kpis.spi;
  return {
    cumPlan: row.cumPlan, cumActual: row.cumActual, cumVar: row.cumVar,
    incPlan: row.incPlan, incActual: row.incActual, incVar: row.incVar,
    spi: spi, label: row.id
  };
}

function pgDailyItems(unit, workClass) {
  const d = PD().daily || {};
  let items = d.lastDayItems || [];
  if (unit && unit !== 'Overall') {
    const u = (d.lastDayByUnit || []).find(x => String(x.unit) === String(unit));
    items = u ? u.items : [];
  }
  if (workClass && workClass !== 'all') items = items.filter(i => i.workClass === workClass);
  return items;
}

function setProgressTab(tab) {
  state.filters.progress.tab = tab;
  renderProgress();
}
function setProgressFilter(key, value) {
  state.filters.progress[key] = value;
  if (key === 'unit' && (value === '605' || value === '608')) state.filters.progress.mapUnit = value;
  if (key === 'unit') state.filters.progress.cwa = 'all';
  renderProgress();
}
function selectProgressCwa(id) {
  const f = state.filters.progress;
  f.cwa = f.cwa === id ? 'all' : id;
  if (id && id.startsWith('608')) f.mapUnit = '608';
  if (id && id.startsWith('605')) f.mapUnit = '605';
  renderProgress();
}

function renderProgress() {
  const pd = PD();
  if (!pd.kpis) {
    $('#contentArea').innerHTML = '<div class="empty-state">进度数据未加载</div>';
    return;
  }
  if (!state.filters.progress.tab) {
    state.filters.progress = Object.assign({
      tab: 'overview', unit: 'Overall', cwa: 'all', workClass: 'all',
      source: 'cc6', mapMode: 'schematic', mapUnit: '605'
    }, state.filters.progress);
  }
  const f = state.filters.progress;
  const tabs = [
    ['overview', '总览'],
    ['compare', 'CC6 vs Owner'],
    ['qty', '专业工程量'],
    ['cwa', 'CWA 滞后'],
    ['ld', 'LD 里程碑']
  ];
  const html = `
    <div class="page-header">
      <div class="page-title">进度管理 <span class="subtitle">${pd.meta.project} · 截止日期 ${pgFmtDate(pd.meta.cutoff)} · ${pd.meta.note}</span></div>
      <div class="page-actions">
        <span class="tag ${pd.kpis.lagging ? 'tag-danger' : 'tag-success'}">${pd.kpis.lagging ? 'Lagging 滞后' : 'Leading 超前'}</span>
      </div>
    </div>
    <div class="pg-tabs">
      ${tabs.map(([id, name]) => `<button class="pg-tab ${f.tab===id?'active':''}" onclick="setProgressTab('${id}')">${name}</button>`).join('')}
    </div>
    ${f.tab === 'overview' ? renderPgOverview() : ''}
    ${f.tab === 'compare' ? renderPgCompare() : ''}
    ${f.tab === 'qty' ? renderPgQty() : ''}
    ${f.tab === 'cwa' ? renderPgCwaRank() : ''}
    ${f.tab === 'ld' ? renderPgLd() : ''}
  `;
  $('#contentArea').innerHTML = html;
  setTimeout(() => initProgressCharts(), 80);
}

function pgFilterBar() {
  const pd = PD();
  const f = state.filters.progress;
  const units = ['Overall', '605', '608', '761'];
  const cwas = (pd.cwa || []).filter(c => f.unit === 'Overall' || c.unit === f.unit);
  const wcs = (pd.daily && pd.daily.workClasses) || [];
  return `
    <div class="pg-slicer">
      <div class="pg-slicer-label">口径</div>
      <div class="pg-slicer-btns">
        <button class="${f.source==='cc6'?'on':''}" onclick="setProgressFilter('source','cc6')">CC6 P6</button>
        <button class="${f.source==='owner'?'on':''}" onclick="setProgressFilter('source','owner')">Owner</button>
      </div>
      <div class="pg-slicer-label">装置 Unit</div>
      <div class="pg-slicer-btns">
        ${units.map(u => `<button class="${f.unit===u?'on':''}" onclick="setProgressFilter('unit','${u}')">${u==='Overall'?'总体':u}</button>`).join('')}
      </div>
      <div class="pg-slicer-label">区块 CWA</div>
      <select class="form-control" style="height:28px;" onchange="setProgressFilter('cwa', this.value)">
        <option value="all">全部区块</option>
        ${cwas.map(c => `<option value="${c.id}" ${f.cwa===c.id?'selected':''}>${c.id} ${c.name||''}</option>`).join('')}
      </select>
      <div class="pg-slicer-label">专业 Activity</div>
      <select class="form-control" style="height:28px;" onchange="setProgressFilter('workClass', this.value)">
        <option value="all">全部专业</option>
        ${wcs.map(w => `<option value="${w.id}" ${f.workClass===w.id?'selected':''}>${w.name}</option>`).join('')}
      </select>
    </div>`;
}

function renderPgOverview() {
  const pd = PD();
  const f = state.filters.progress;
  const kpi = pgApplyKpi(f.unit, f.source, f.cwa);
  const daily = pgDailyItems(f.unit, f.workClass);
  const lag = pgVarClass(kpi.cumVar);
  const mapUnit = f.mapUnit === '608' ? '608' : '605';
  return `
    <div class="pg-kpi-grid">
      ${pgKpiCard('本周计划', pgPct(kpi.incPlan), '周增量 · 工时加权', '')}
      ${pgKpiCard('本周实际', pgPct(kpi.incActual), '周增量 · 工时加权', '')}
      ${pgKpiCard('本周偏差', pgPct(kpi.incVar), kpi.incVar != null && kpi.incVar < 0 ? 'Lagging' : 'On plan', pgVarClass(kpi.incVar))}
      ${pgKpiCard('累计计划', pgPct(kpi.cumPlan), 'Cut-off ' + pgFmtDate(pd.meta.cutoff), '')}
      ${pgKpiCard('累计实际', pgPct(kpi.cumActual), kpi.label || '', 'accent')}
      ${pgKpiCard('累计偏差', pgPct(kpi.cumVar), lag === 'lag' ? 'Lagging 滞后' : (lag === 'lead' ? 'Leading 超前' : '持平'), lag)}
    </div>
    <div class="pg-meta-row">
      <span>计划工期 ${pd.meta.plannedDays} 天</span>
      <span>已过 ${pd.meta.elapsedDays} 天</span>
      <span>剩余 ${pd.meta.remainDays} 天（至机械完工 ${pgFmtDate(pd.meta.planFinish)}）</span>
      <span>预算工时 ${pgNum(pd.kpis.budgetMh, 0)} MH</span>
    </div>
    <div class="grid-2-1" style="margin-bottom:14px;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">${f.source==='owner'?'Owner':'CC6'} 进度曲线 ${f.unit==='Overall'?'总体':f.unit}</div>
          <div style="font-size:11px;color:var(--text-muted);">柱=周增量　线=累计%　红线=截止日期</div>
        </div>
        <div class="card-body"><div id="pgChartS" class="chart-container large"></div></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">筛选 / SPI</div></div>
        <div class="card-body">
          ${pgFilterBar()}
          <div id="pgChartSpi" style="height:150px;margin-top:8px;"></div>
          <div class="pg-qty-mini">
            ${(pd.qty||[]).map(q => {
              const pct = q.cumPlan ? q.cumActual / q.cumPlan : 0;
              return `<div class="pg-qty-line"><span>${q.name}</span><b>${pgNum(q.cumActual,0)} / ${pgNum(q.cumPlan,0)} ${q.uom}</b><span class="${q.cumVar<0?'lag':'lead'}">${pgPct(pct)}</span></div>`;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">当日工程量（日报 ${pgFmtDate(pd.daily.lastDate)}）</div>
        <span style="font-size:11px;color:var(--text-muted);">物理量，不可跨专业加总</span>
      </div>
      <div class="card-body" style="display:flex;flex-wrap:wrap;gap:8px;">
        ${daily.length ? daily.slice(0,12).map(i => `<div class="pg-chip"><div class="k">${i.name} · ${i.uom}</div><div class="v">${pgNum(i.qty,2)}</div></div>`).join('') : '<span style="color:var(--text-muted);font-size:12px;">当日无记录</span>'}
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">区块完成图 ${mapUnit}</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-sm ${f.mapMode==='schematic'?'btn-primary':'btn-default'}" onclick="setProgressFilter('mapMode','schematic')">简化色块</button>
          <button class="btn btn-sm ${f.mapMode==='cad'?'btn-primary':'btn-default'}" onclick="setProgressFilter('mapMode','cad')">CAD 总图</button>
          <button class="btn btn-sm ${mapUnit==='605'?'btn-primary':'btn-default'}" onclick="setProgressFilter('mapUnit','605')">605</button>
          <button class="btn btn-sm ${mapUnit==='608'?'btn-primary':'btn-default'}" onclick="setProgressFilter('mapUnit','608')">608</button>
        </div>
      </div>
      <div class="card-body">
        ${f.mapMode === 'cad' ? renderPgCad(mapUnit) : renderPgSchematic(mapUnit)}
        <div class="pg-legend"><span>0%</span><span class="bar"></span><span>100%</span><span style="margin-left:12px;color:var(--text-muted);">颜色=该区块工时加权实际完成率 · 点击下钻</span></div>
      </div>
    </div>
  `;
}

function pgKpiCard(label, value, sub, cls) {
  return `<div class="pg-kpi ${cls||''}"><div class="pg-kpi-label">${label}</div><div class="pg-kpi-value">${value}</div><div class="pg-kpi-sub">${sub||''}</div></div>`;
}

function renderPgSchematic(unit) {
  const blocks = (PD().schematic && PD().schematic[unit]) || [];
  const cmap = pgCwaMap();
  const sel = state.filters.progress.cwa;
  return `<div class="pg-schematic">${blocks.map(b => {
    const c = cmap[b.id] || {};
    const pct = c.actualPct || 0;
    const on = sel === b.id;
    return `<button type="button" class="pg-block ${on?'on':''}" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%;background:${pgColor(pct)};" onclick="selectProgressCwa('${b.id}')" title="${b.id} ${b.name}">
      <span class="id">${b.id.replace(unit+'-','')}</span>
      <span class="nm">${b.name||''}</span>
      <span class="pc">${pgPct(pct)}</span>
    </button>`;
  }).join('')}</div>`;
}

function renderPgCad(unit) {
  const spots = (PD().cadHotspots && PD().cadHotspots[unit]) || [];
  const cmap = pgCwaMap();
  const sel = state.filters.progress.cwa;
  const src = unit === '608' ? './data/plot/u608.png' : './data/plot/u605.png';
  return `<div class="pg-cad">
    <img src="${src}" alt="U${unit} plot plan">
    ${spots.map(b => {
      const c = cmap[b.id] || {};
      const pct = c.actualPct || 0;
      const on = sel === b.id;
      return `<button type="button" class="pg-hot ${on?'on':''}" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%;background:${pgColor(pct)};" onclick="selectProgressCwa('${b.id}')" title="${b.id} ${b.name} ${pgPct(pct)}">
        <span>${b.id.slice(-3)} ${pgPct(pct)}</span>
      </button>`;
    }).join('')}
  </div>`;
}

function renderPgCompare() {
  const pd = PD();
  const rows = ['Overall Project', '605', '608', '761'];
  const cc6 = pd.units || [];
  const ow = pd.ownerUnits || [];
  const find = (arr, id) => arr.find(r => r.id === id) || {};
  return `
    <div class="card" style="margin-bottom:14px;">
      <div class="card-header"><div class="card-title">CC6 P6 vs Owner 累计进度</div>
        <span style="font-size:11px;color:var(--text-muted);">两条曲线口径不同，不可直接当成同一指标</span>
      </div>
      <div class="card-body"><div id="pgChartCompare" class="chart-container large"></div></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">装置对照（截止 ${pgFmtDate(pd.meta.cutoff)}）</div></div>
      <div class="card-body no-padding">
        <table class="data-table">
          <thead><tr><th>装置</th><th>CC6 计划</th><th>CC6 实际</th><th>CC6 偏差</th><th>Owner 计划</th><th>Owner 实际</th><th>Owner 偏差</th></tr></thead>
          <tbody>
            ${rows.map(id => {
              const a = find(cc6, id), b = find(ow, id);
              const name = id === 'Overall Project' ? '总体' : id;
              return `<tr>
                <td style="font-weight:600;">${name}</td>
                <td>${pgPct(a.cumPlan)}</td><td>${pgPct(a.cumActual)}</td>
                <td class="${pgVarClass(a.cumVar)}">${pgPct(a.cumVar)}</td>
                <td>${pgPct(b.cumPlan)}</td><td>${pgPct(b.cumActual)}</td>
                <td class="${pgVarClass(b.cumVar)}">${pgPct(b.cumVar)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderPgQty() {
  const pd = PD();
  const f = state.filters.progress;
  const weekly = (pd.daily.weekly || []).filter(w => f.workClass === 'all' || w.workClass === f.workClass);
  const weeks = [...new Set(weekly.map(w => w.week))].sort().slice(-12);
  const wcs = [...new Set(weekly.map(w => w.workClass))];
  return `
    <div class="card" style="margin-bottom:14px;">
      <div class="card-header"><div class="card-title">P6 专业计划量 vs 实际量</div></div>
      <div class="card-body no-padding">
        <table class="data-table">
          <thead><tr><th>专业</th><th>单位</th><th>上周计划</th><th>上周实际</th><th>本周计划</th><th>本周实际</th><th>累计计划</th><th>累计实际</th><th>累计偏差</th><th>完成率</th></tr></thead>
          <tbody>
            ${(pd.qty||[]).map(q => {
              const pct = q.cumPlan ? q.cumActual / q.cumPlan : 0;
              return `<tr>
                <td style="font-weight:500;">${q.name}</td><td>${q.uom}</td>
                <td>${pgNum(q.lastPlan,1)}</td><td>${pgNum(q.lastActual,1)}</td>
                <td>${pgNum(q.incPlan,1)}</td><td>${pgNum(q.incActual,1)}</td>
                <td>${pgNum(q.cumPlan,1)}</td><td>${pgNum(q.cumActual,1)}</td>
                <td class="${q.cumVar<0?'lag':'lead'}">${pgNum(q.cumVar,1)}</td>
                <td>${progressBar(Math.round(Math.max(0, Math.min(100, pct*100))))}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <div class="card-title">日报工程量（近 12 周）</div>
        <select class="form-control" style="width:200px;height:28px;" onchange="setProgressFilter('workClass', this.value)">
          <option value="all">全部专业</option>
          ${(pd.daily.workClasses||[]).map(w => `<option value="${w.id}" ${f.workClass===w.id?'selected':''}>${w.name}</option>`).join('')}
        </select>
      </div>
      <div class="card-body"><div id="pgChartQty" class="chart-container"></div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:8px;">同一专业若有多种单位，图中按最大量单位展示。混凝土可在专业筛选后对照日报 Step。</div>
      </div>
    </div>
    ${renderPgStepHint()}
  `;
}

function renderPgStepHint() {
  const d = PD().daily || {};
  const last = (d.lastWeekItems || []).filter(i => /Concrete|Piling|Steel|Piping/i.test(i.workClass));
  if (!last.length) return '';
  return `<div class="card" style="margin-top:14px;"><div class="card-header"><div class="card-title">本周日完成（含工序 Step 汇总）</div></div>
    <div class="card-body" style="display:flex;flex-wrap:wrap;gap:8px;">
      ${last.map(i => `<div class="pg-chip"><div class="k">${i.name} · ${i.uom}</div><div class="v">${pgNum(i.qty,1)}</div><div class="k">${i.rows} 条</div></div>`).join('')}
    </div></div>`;
}

function renderPgCwaRank() {
  const pd = PD();
  const f = state.filters.progress;
  let list = (pd.cwa || []).slice();
  if (f.unit !== 'Overall') list = list.filter(c => c.unit === f.unit);
  list = list.filter(c => !String(c.id).endsWith('-000'));
  const worst = list.slice().sort((a,b) => (a.contrib||0)-(b.contrib||0)).slice(0, 15);
  return `
    <div class="grid-2-1">
      <div class="card">
        <div class="card-header"><div class="card-title">对项目偏差贡献最大的区块（负值=拖后腿）</div>
          <button class="btn btn-sm btn-default" onclick="setProgressTab('overview')">回到地图</button>
        </div>
        <div class="card-body no-padding">
          <table class="data-table">
            <thead><tr><th>CWA</th><th>名称</th><th>装置</th><th>计划%</th><th>实际%</th><th>区块偏差</th><th>项目贡献</th><th></th></tr></thead>
            <tbody>
              ${worst.map(c => `<tr>
                <td style="font-family:monospace;">${c.id}</td>
                <td>${c.name||''}</td><td>${c.unit}</td>
                <td>${pgPct(c.planPct)}</td><td>${pgPct(c.actualPct)}</td>
                <td class="${pgVarClass(c.varPct)}">${pgPct(c.varPct)}</td>
                <td class="lag">${pgPct(c.contrib)}</td>
                <td class="col-action"><button class="btn-link" onclick="state.filters.progress.mapUnit='${c.unit}';selectProgressCwa('${c.id}');setProgressTab('overview')">地图</button></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">趋势结论</div></div>
        <div class="card-body">
          <div id="pgChartCwa" class="chart-container"></div>
          <p style="font-size:11px;color:var(--text-muted);margin-top:8px;">Contribution 来自 P6 工时加权偏差对总体的贡献。761 无总图，仅列表。</p>
        </div>
      </div>
    </div>`;
}

function renderPgLd() {
  const pd = PD();
  const stMap = { met: 'tag-success', missed: 'tag-danger', due: 'tag-warning', upcoming: 'tag-info' };
  const stCn = { met: '已达成', missed: '未达成', due: '已到期', upcoming: '未到' };
  return `
    <div class="card">
      <div class="card-header"><div class="card-title">LD 关键里程碑（相对 ${pgFmtDate(pd.meta.cutoff)}）</div></div>
      <div class="card-body no-padding">
        <table class="data-table">
          <thead><tr><th>编号</th><th>里程碑</th><th>日期</th><th>Target</th><th>Actual</th><th>状态</th><th>LD</th></tr></thead>
          <tbody>
            ${(pd.ld||[]).map(x => `<tr>
              <td>${x.no}</td>
              <td style="max-width:420px;">${x.nameEn || x.nameRu}</td>
              <td>${x.date ? pgFmtDate(x.date) : '—'}</td>
              <td>${x.target != null ? pgNum(x.target,1) : '—'}</td>
              <td>${x.actual != null ? pgNum(x.actual,1) : '—'}</td>
              <td><span class="tag ${stMap[x.status]||'tag-plain'}">${stCn[x.status]||x.status}</span></td>
              <td style="font-size:11px;color:var(--text-muted);">${x.ldType ? String(x.ldType).slice(0,40) : '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function initProgressCharts() {
  const pd = PD();
  const f = state.filters.progress;
  const colors = { plan: '#1a56a0', actual: '#16a34a', forecast: '#d4a017', cut: '#d9363e' };

  if (f.tab === 'overview') {
    const curve = pgCurve(f.unit, f.source);
    const el = document.getElementById('pgChartS');
    if (el) {
      const ch = echarts.init(el);
      const labels = curve.map(w => pgFmtDate(w.date));
      ch.setOption({
        tooltip: {
          trigger: 'axis',
          valueFormatter: v => (v == null || isNaN(v)) ? '—' : ((v * 100).toFixed(2) + '%')
        },
        legend: { data: ['计划周增量', '实际周增量', '预测周增量', '计划累计', '实际累计', '预测累计'], top: 0, textStyle: { fontSize: 11 } },
        grid: { left: 48, right: 48, top: 36, bottom: 36 },
        xAxis: { type: 'category', data: labels, axisLabel: { fontSize: 9, interval: 5, rotate: 35, color: '#5c6c7c' }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
        yAxis: [
          { type: 'value', name: '周增量', axisLabel: { formatter: v => (v * 100).toFixed(2) + '%', fontSize: 10 }, splitLine: { lineStyle: { color: '#edf0f3' } } },
          { type: 'value', name: '累计', max: 1, axisLabel: { formatter: v => (v * 100).toFixed(0) + '%', fontSize: 10 }, splitLine: { show: false } }
        ],
        series: [
          { name: '计划周增量', type: 'bar', data: curve.map(w => w.planInc), itemStyle: { color: '#93c5fd' }, barMaxWidth: 8, yAxisIndex: 0 },
          { name: '实际周增量', type: 'bar', data: curve.map(w => w.actualInc), itemStyle: { color: '#16a34a' }, barMaxWidth: 8, yAxisIndex: 0 },
          { name: '预测周增量', type: 'bar', data: curve.map(w => w.forecastInc), itemStyle: { color: '#fde68a' }, barMaxWidth: 8, yAxisIndex: 0 },
          { name: '计划累计', type: 'line', data: curve.map(w => w.planPct), yAxisIndex: 1, symbol: 'none', lineStyle: { color: colors.plan, width: 2 } },
          { name: '实际累计', type: 'line', data: curve.map(w => w.actualPct), yAxisIndex: 1, symbol: 'none', lineStyle: { color: colors.actual, width: 2.5 } },
          { name: '预测累计', type: 'line', data: curve.map(w => w.forecastPct), yAxisIndex: 1, symbol: 'none', lineStyle: { color: colors.forecast, type: 'dashed', width: 2 } },
          { name: '截止日期', type: 'line', yAxisIndex: 1, markLine: { symbol: 'none', label: { formatter: pgFmtDate(pd.meta.cutoff), color: colors.cut }, lineStyle: { color: colors.cut, type: 'solid', width: 1.5 }, data: [{ xAxis: labels[curve.findIndex(w => w.date === pd.meta.cutoff)] }] }, data: [] }
        ]
      });
      new ResizeObserver(() => ch.resize()).observe(el);
      state.charts.pgS = ch;
    }
    const kpi = pgApplyKpi(f.unit, f.source, f.cwa);
    const spiEl = document.getElementById('pgChartSpi');
    if (spiEl) {
      const spi = kpi.spi || 0;
      const ch = echarts.init(spiEl);
      ch.setOption({
        series: [{
          type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 1.2,
          pointer: { show: true, length: '60%', width: 4 },
          axisLine: { lineStyle: { width: 10, color: [[0.71, '#d9363e'], [0.83, '#e8a317'], [1, '#2e9e5b']] } },
          axisTick: { show: false }, splitLine: { length: 8, lineStyle: { width: 1 } },
          axisLabel: { fontSize: 9, distance: 12, formatter: v => v.toFixed(1) },
          title: { fontSize: 11, offsetCenter: [0, '72%'] },
          detail: { fontSize: 18, formatter: v => v.toFixed(2), offsetCenter: [0, '42%'] },
          data: [{ value: spi, name: 'SPI' }]
        }]
      });
      new ResizeObserver(() => ch.resize()).observe(spiEl);
      state.charts.pgSpi = ch;
    }
  }

  if (f.tab === 'compare') {
    const el = document.getElementById('pgChartCompare');
    if (!el) return;
    const cc6 = pgCurve('Overall', 'cc6');
    const ow = pgCurve('Overall', 'owner');
    const dates = [...new Set(cc6.map(w => w.date).concat(ow.map(w => w.date)))].sort();
    const m6 = Object.fromEntries(cc6.map(w => [w.date, w]));
    const mo = Object.fromEntries(ow.map(w => [w.date, w]));
    const ch = echarts.init(el);
    ch.setOption({
      tooltip: {
        trigger: 'axis',
        valueFormatter: v => (v == null || isNaN(v)) ? '—' : ((v * 100).toFixed(2) + '%')
      },
      legend: { data: ['CC6 计划', 'CC6 实际', 'Owner 计划', 'Owner 实际'] },
      grid: { left: 48, right: 24, top: 32, bottom: 36 },
      xAxis: { type: 'category', data: dates.map(d => pgFmtDate(d)), axisLabel: { interval: 6, fontSize: 9, rotate: 35 } },
      yAxis: { type: 'value', max: 1, axisLabel: { formatter: v => (v * 100).toFixed(0) + '%' } },
      series: [
        { name: 'CC6 计划', type: 'line', symbol: 'none', data: dates.map(d => m6[d] && m6[d].planPct), lineStyle: { color: '#1a56a0', type: 'dashed' } },
        { name: 'CC6 实际', type: 'line', symbol: 'none', data: dates.map(d => m6[d] && m6[d].actualPct), lineStyle: { color: '#16a34a', width: 2.5 } },
        { name: 'Owner 计划', type: 'line', symbol: 'none', data: dates.map(d => mo[d] && mo[d].planPct), lineStyle: { color: '#7c3aed', type: 'dashed' } },
        { name: 'Owner 实际', type: 'line', symbol: 'none', data: dates.map(d => mo[d] && mo[d].actualPct), lineStyle: { color: '#c026d3', width: 2 } }
      ]
    });
    new ResizeObserver(() => ch.resize()).observe(el);
    state.charts.pgCmp = ch;
  }

  if (f.tab === 'qty') {
    const el = document.getElementById('pgChartQty');
    if (!el) return;
    let weekly = PD().daily.weekly || [];
    if (f.workClass !== 'all') weekly = weekly.filter(w => w.workClass === f.workClass);
    const uomCount = {};
    weekly.forEach(w => { uomCount[w.uom] = (uomCount[w.uom] || 0) + Math.abs(w.qty || 0); });
    const uom = Object.keys(uomCount).sort((a,b) => uomCount[b]-uomCount[a])[0];
    weekly = weekly.filter(w => w.uom === uom);
    const weeks = [...new Set(weekly.map(w => w.week))].sort();
    const wcs = [...new Set(weekly.map(w => w.name || w.workClass))];
    const ch = echarts.init(el);
    ch.setOption({
      tooltip: { trigger: 'axis' },
      legend: { type: 'scroll', top: 0 },
      grid: { left: 48, right: 16, top: 36, bottom: 28 },
      xAxis: { type: 'category', data: weeks.map(d => pgFmtDate(d)), axisLabel: { fontSize: 9, rotate: 35 } },
      yAxis: { type: 'value', name: uom || '' },
      series: wcs.map(name => ({
        name, type: 'bar', stack: f.workClass === 'all' ? 'q' : undefined,
        data: weeks.map(wk => {
          const hit = weekly.find(x => x.week === wk && (x.name === name || x.workClass === name));
          return hit ? hit.qty : 0;
        })
      }))
    });
    new ResizeObserver(() => ch.resize()).observe(el);
    state.charts.pgQty = ch;
  }

  if (f.tab === 'cwa') {
    const el = document.getElementById('pgChartCwa');
    if (!el) return;
    let list = (PD().cwa || []).filter(c => !String(c.id).endsWith('-000'));
    if (f.unit !== 'Overall') list = list.filter(c => c.unit === f.unit);
    list = list.slice().sort((a,b) => (a.contrib||0)-(b.contrib||0)).slice(0, 12);
    const ch = echarts.init(el);
    ch.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 90, right: 16, top: 8, bottom: 24 },
      xAxis: { type: 'value', axisLabel: { formatter: v => (v * 100).toFixed(2) + '%' } },
      yAxis: { type: 'category', data: list.map(c => c.id).reverse(), axisLabel: { fontSize: 10 } },
      series: [{ type: 'bar', data: list.map(c => c.contrib).reverse(), itemStyle: { color: '#d9363e' } }]
    });
    new ResizeObserver(() => ch.resize()).observe(el);
    state.charts.pgCwa = ch;
  }
}

function progressOverviewTrend() {
  const pd = PD();
  const weeks = (pd.sCurve || []).filter(w => w.actualMh != null);
  const byMonth = {};
  weeks.forEach(w => {
    const m = w.date.slice(0, 7);
    byMonth[m] = w;
  });
  const months = Object.keys(byMonth).sort().slice(-6);
  const budget = pd.kpis.budgetMh || 1;
  return months.map(m => ({
    month: m.slice(5) + '月',
    plan: +(byMonth[m].planMh / budget * 100).toFixed(2),
    actual: +(byMonth[m].actualMh / budget * 100).toFixed(2)
  }));
}

function progressOverviewMilestones() {
  const ld = (PD().ld || []).filter(x => x.date);
  const key = ld.filter(x => ['1', '2.1', '4.1', '5', '7.1', '13', '14'].includes(String(x.no)));
  const list = (key.length ? key : ld).slice(0, 7);
  return list.map(x => ({
    name: (x.nameEn || x.nameRu || x.no).slice(0, 42),
    date: pgFmtDate(x.date),
    status: x.status === 'met' ? 'done' : x.status === 'missed' || x.status === 'due' ? 'delay' : (x.date <= (PD().meta || {}).cutoff ? 'doing' : 'todo')
  }));
}
