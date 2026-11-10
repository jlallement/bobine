// Styles des maquettes : seulement ce qui n'existe pas encore dans l'app, sur ses jetons.
export const MAQ_CSS = String.raw`
/* ---------- Barre latérale (fiches 133, 134) ---------- */
.mq-sb { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 0; overflow: hidden; }
.mq-sb-fixed { padding: 4px 8px 6px; display: flex; flex-direction: column; }
.mq-sb-fixed.scrolled { border-bottom: 1px solid var(--border); }
.mq-sb-scroll { flex: 1; overflow-y: auto; padding: 0 8px 12px; }
.mq-sec { display: flex; align-items: center; justify-content: space-between; height: 28px;
  margin: 20px 0 2px; padding: 0 10px; font-size: 11px; font-weight: 600; letter-spacing: 0.05em;
  text-transform: uppercase; color: var(--muted); }
.mq-sec:first-child { margin-top: 8px; }
.mq-sec .mq-sec-tools { display: flex; align-items: center; gap: 2px; color: var(--muted); }
.mq-sec .mq-chev { display: none; }
.mq-sec.collapsed .mq-chev, .mq-sec.hover .mq-chev { display: inline-flex; }
/* L'icône de l'en-tête sur la même verticale que les états des lignes (roue, coche, …) et le chevron d'Archivées. */
.mq-sec .mq-sec-tools svg { display: block; }
.mq-folder { display: flex; align-items: center; gap: 10px; height: 30px; padding: 0 10px; margin: 6px 0 0;
  font-size: 13px; font-weight: 600; color: var(--text-2); border-radius: 8px; }
.mq-folder { gap: 4px; margin-top: 12px; color: var(--text); }
.mq-sec + .mq-folder { margin-top: 2px; }
.mq-folder .mq-folder-icon { display: inline-flex; color: var(--muted); }
/* Plus de colonne d'icône vide : les titres partent du bord ; seules les filles gardent la colonne (ligne fine). */
.mq-sb-scroll .history-item:not(.mq-child) .row-slot { display: none; }
.mq-folder .mq-folder-chev { display: inline-flex; color: var(--muted); margin-left: -4px; }
.mq-folder.closed { color: var(--muted); }
/* Arbre des filles : une ligne fine dans la colonne d'icône, sans décaler les titres. */
.history-item .row-slot { position: relative; align-self: stretch; height: auto; }
.mq-tree { position: absolute; top: -7px; left: 0; color: color-mix(in srgb, var(--muted) 70%, transparent); }
.inbox-line .mq-reason { vertical-align: -1px; margin-right: 5px; color: var(--accent); }
.inbox-line .mq-reason.done { color: var(--ok); }
.history-item.mq-hover:not(.active) { background: color-mix(in srgb, var(--surface-3) 40%, var(--sidebar)); }
.mq-tag { font-size: 11px; color: var(--muted); border: 1px solid var(--border-strong); border-radius: 5px; padding: 0 5px; line-height: 16px; }
.mq-state { font-size: 11.5px; color: var(--muted); display: inline-flex; align-items: center; gap: 4px; }
.mq-state.ok { color: var(--ok); }
.inbox-state.mq-q, .inbox-state.mq-hand { color: var(--accent); }

/* ---------- Activité de l'agent (fiche 127) ---------- */
.mq-time { position: relative; }
.mq-time .tooltip { position: absolute; left: 50%; top: calc(100% + 8px); transform: translateX(-50%); white-space: nowrap; }
.tool-row .mq-files { color: var(--muted); }

/* ---------- Réglages (fiches 135, 143, 144) ---------- */
.settings-nav .mq-gap { height: 14px; }
.mq-settings-body { padding: 4px 32px 32px; }
.mq-h3 { font-size: 12.5px; font-weight: 600; color: var(--muted); margin: 22px 4px 8px; }
.mq-h3:first-child { margin-top: 6px; }
.mq-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.mq-card > .settings-row { padding: 12px 16px; border-bottom: 1px solid var(--border); }
.mq-card > .settings-row:last-child { border-bottom: 0; }
.mq-card > .settings-row.mq-sub { padding-left: 32px; }
.mq-card > .settings-row.mq-sub .settings-row-label::before { content: ''; }
.mq-banner { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px;
  background: var(--warn-soft); color: var(--text-2); font-size: 13px; margin: 6px 0 4px; }
.mq-banner svg { color: var(--warn); flex-shrink: 0; }
.mq-banner .grow { flex: 1; }
.mq-advanced { margin-top: 22px; }
.mq-advanced > summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 6px;
  font-size: 12.5px; font-weight: 600; color: var(--muted); margin: 0 4px 8px; }
.mq-advanced > summary::-webkit-details-marker { display: none; }
.mq-advanced > summary small { font-weight: 400; }
.mq-crumb { display: inline-flex; align-items: center; gap: 2px; font-size: 13px; color: var(--muted); margin-right: 10px; }
.mq-agent-head { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
.mq-avatar { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; font-weight: 600;
  background: var(--surface-3); color: var(--text); font-size: 14px; flex-shrink: 0; }
.mq-agent-head .grow { flex: 1; min-width: 0; }
.mq-agent-head .mq-name { font-weight: 600; font-size: 14px; color: var(--text); }
.mq-agent-head .mq-sub { font-size: 12.5px; color: var(--muted); display: flex; align-items: center; gap: 6px; }
.mq-agent-head .mq-sub .status-dot { position: static; }
.mq-list-row { display: flex; align-items: center; gap: 12px; padding: 11px 16px; border-bottom: 1px solid var(--border); font-size: 13.5px; color: var(--text); }
.mq-list-row:last-child { border-bottom: 0; }
.mq-list-row .grow { flex: 1; min-width: 0; }
.mq-list-row small { display: block; font-size: 12px; color: var(--muted); }
.mq-list-row .mq-side { font-size: 12.5px; color: var(--muted); }
.mq-list-row > svg:last-child { color: var(--muted); }
.mq-pill { font-size: 11.5px; padding: 1px 7px; border-radius: 999px; background: var(--surface-2); color: var(--text-2); }
.mq-pill.ok { color: var(--ok); }
.mq-ok { color: var(--ok); }
.mq-check-list { list-style: none; margin: 0; padding: 4px 16px 10px; columns: 2; column-gap: 24px; }
.mq-check-list li { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-2); padding: 5px 0; break-inside: avoid; }
.mq-check-list li svg { color: var(--ok); }
.mq-check-list li.no { color: var(--muted); }
.mq-check-list li.no svg { color: var(--muted); }

/* Apparence */
.mq-preview { padding: 16px; display: flex; flex-direction: column; gap: 10px; background: var(--bg); }
.mq-preview p { margin: 0; font-size: 15px; line-height: 1.55; color: var(--text); }
.mq-preview code { font-family: var(--font-mono); font-size: 13px; background: var(--surface-2); padding: 1px 5px; border-radius: 5px; }
.mq-code { font-family: var(--font-mono); font-size: 13px; line-height: 1.55; padding: 10px 12px; border-radius: 8px;
  background: var(--mq-code-bg); color: var(--mq-code-fg); border: 1px solid var(--border); }
.mq-code .k { color: var(--mq-syn-k); } .mq-code .s { color: var(--mq-syn-s); } .mq-code .f { color: var(--mq-syn-f); } .mq-code .c { color: var(--mq-syn-c); }
.mq-term { font-family: var(--font-mono); font-size: 13px; line-height: 1.55; padding: 8px 12px; border-radius: 8px;
  background: var(--mq-code-bg); color: var(--mq-code-fg); border: 1px solid var(--border); }
.mq-term .ok { color: var(--mq-ansi-green); } .mq-term .p { color: var(--mq-ansi-blue); }
.mq-themes { display: flex; gap: 10px; }
.mq-theme { display: flex; flex-direction: column; align-items: center; gap: 5px; font-size: 12px; color: var(--text-2); }
.mq-theme .mq-thumb { width: 64px; height: 42px; border-radius: 8px; border: 1px solid var(--border-strong); position: relative; overflow: hidden; }
.mq-theme .mq-thumb i { position: absolute; left: 0; top: 0; bottom: 0; width: 18px; }
.mq-theme .mq-thumb b { position: absolute; left: 24px; right: 8px; height: 4px; border-radius: 2px; }
.mq-theme.active .mq-thumb { outline: 2px solid var(--accent); outline-offset: 2px; }
.mq-theme.active { color: var(--text); font-weight: 500; }
.mq-mac-accent { background: conic-gradient(#c96442, #c9a142, #3f8a57, #2f6fdb, #7b55d6, #c94292, #c96442) !important; }
.mq-swatch-wrap { display: flex; align-items: center; gap: 8px; }
.mq-swatch-label { font-size: 12px; color: var(--muted); margin-left: 4px; }

.mq-fontpick { position: relative; }
.mq-fontmenu { position: absolute; right: 0; top: calc(100% + 6px); width: 270px; z-index: 5; }
.mq-fontmenu .menu-item { display: flex; align-items: center; gap: 8px; }
.mq-fontmenu .mq-check { width: 15px; color: var(--accent); }
.mq-code { font-family: 'JetBrains Mono', var(--font-mono); }
/* Consommation (fiche 145) */
.mq-filters { display: flex; align-items: center; gap: 10px; margin: 4px 0 16px; }
.mq-filters .grow { flex: 1; }
.mq-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.mq-kpi { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; }
.mq-kpi .mq-k-label { font-size: 12px; color: var(--muted); }
.mq-kpi .mq-k-value { font-size: 22px; font-weight: 600; color: var(--text); margin-top: 4px; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.mq-kpi .mq-k-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
.mq-chart-card { padding: 14px 16px 10px; }
.mq-chart-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.mq-chart-head .mq-title { font-size: 13px; font-weight: 600; color: var(--text); }
.mq-chart-head .grow { flex: 1; }
.mq-legend { display: flex; gap: 14px; font-size: 12px; color: var(--text-2); }
.mq-legend span { display: inline-flex; align-items: center; gap: 6px; }
.mq-legend i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.mq-chart svg text { font-size: 11px; fill: var(--muted); font-family: var(--font-ui); }
.mq-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.mq-table th { text-align: right; font-weight: 500; color: var(--muted); font-size: 12px; padding: 9px 16px; border-bottom: 1px solid var(--border); }
.mq-table td { text-align: right; padding: 9px 16px; border-bottom: 1px solid var(--border); color: var(--text); font-variant-numeric: tabular-nums; }
.mq-table tr:last-child td { border-bottom: 0; }
.mq-table th:first-child, .mq-table td:first-child { text-align: left; }
.mq-table td small { color: var(--muted); font-size: 12px; }
.mq-table td .mq-dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 8px; vertical-align: 0; }
.mq-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.mq-bar-cell { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
.mq-bar-cell i { height: 6px; border-radius: 3px; background: var(--border-strong); display: inline-block; }

/* ---------- Navigateur (fiches 129, 130, 132) ---------- */
.mq-panel { width: 610px !important; }
.browser-bar .mq-zoom { position: absolute; right: 7px; top: 50%; transform: translateY(-50%); font-size: 11.5px;
  padding: 1px 6px; border-radius: 5px; background: var(--surface-2); color: var(--text-2); }
.browser-bar .mq-addr { position: relative; flex: 1; min-width: 0; display: flex; }
.browser-bar .mq-addr .browser-address { margin-left: 4px; }
.browser-bar .chip { height: 28px; font-size: 12.5px; }
.browser-bar .chip.mq-on, .icon-button.mq-on { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }
.mq-device { position: relative; }
.mq-device-menu { position: absolute; top: calc(100% + 6px); right: 0; width: 270px; z-index: 50; }
.mq-device-menu .menu-item { display: flex; align-items: center; gap: 8px; }
.mq-device-menu .menu-value { margin-left: auto; color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.mq-device-menu .mq-check { width: 15px; color: var(--accent); }
.mq-device-menu .segmented { margin: 4px 8px 6px; display: flex; }
.mq-device-menu .segmented button { flex: 1; }
.mq-stage { position: absolute; inset: 0; background: var(--surface-2); display: flex; align-items: flex-start; justify-content: center; padding-top: 18px; overflow: hidden; }
.mq-device-frame { box-shadow: 0 0 0 1px var(--border-strong), 0 8px 24px rgb(0 0 0 / 0.12); border-radius: 6px; overflow: hidden; background: #fff; }
.mq-hint { display: flex; align-items: center; gap: 8px; padding: 6px 12px; font-size: 12.5px; color: var(--text-2);
  background: color-mix(in srgb, var(--accent) 10%, var(--surface)); border-bottom: 1px solid var(--border); }
.mq-hint svg { color: var(--accent); }
.mq-hint kbd { font: inherit; font-size: 11px; border: 1px solid var(--border-strong); border-radius: 4px; padding: 0 4px; background: var(--surface); }
.mq-hint .grow { flex: 1; }
.mq-notes { border-top: 1px solid var(--border); background: var(--bg); padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
.mq-note { display: flex; gap: 10px; align-items: flex-start; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; }
.mq-note .mq-n { width: 18px; height: 18px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 11px; font-weight: 600; display: grid; place-items: center; flex-shrink: 0; margin-top: 1px; }
.mq-note .mq-thumbn { width: 74px; height: 44px; border-radius: 6px; border: 1px solid var(--border); flex-shrink: 0; overflow: hidden; background: #fff; position: relative; }
.mq-note .grow { flex: 1; min-width: 0; }
.mq-note .mq-what { font-size: 12px; color: var(--muted); font-family: var(--font-mono); }
.mq-note .mq-text { font-size: 13px; color: var(--text); margin-top: 2px; }
.mq-note textarea { width: 100%; border: 0; outline: none; resize: none; background: transparent; font: inherit; font-size: 13px; color: var(--text); padding: 0; margin-top: 2px; height: 36px; }
.mq-note .mq-note-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 4px; }
.mq-note.editing { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent); }
.mq-note kbd, .btn kbd, .mq-k { font: inherit; font-size: 11px; opacity: 0.75; margin-left: 4px; }

/* ---------- Journal et échanges ACP ---------- */
.mq-diag-head { display: flex; align-items: center; gap: 10px; margin: 4px 0 4px; font-size: 14px; color: var(--text); }
.mq-diag-head .grow { flex: 1; }
.mq-diag-head .btn svg { margin-right: 6px; }
.mq-list-row > .btn { flex-shrink: 0; }
.mq-acp { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.mq-acp-bar { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-bottom: 1px solid var(--border); }
.mq-acp-bar .grow { flex: 1; }
.mq-acp-search { display: flex; align-items: center; gap: 6px; border: 1px solid var(--border); border-radius: 8px; padding: 4px 8px; background: var(--surface); color: var(--muted); width: 230px; }
.mq-acp-search input { border: 0; outline: none; background: transparent; font: inherit; font-size: 12.5px; color: var(--text); width: 100%; }
.mq-acp-bar .chip { height: 28px; font-size: 12.5px; }
.mq-acp-list { flex: 1; overflow: auto; font-family: var(--font-mono); font-size: 12px; }
.mq-acp-row { display: grid; grid-template-columns: 92px 16px minmax(0, 1fr) auto 56px; gap: 8px; align-items: center; padding: 5px 10px; border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent); color: var(--text-2); }
.mq-acp-row.sel { background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--text); }
.mq-acp-t { color: var(--muted); font-variant-numeric: tabular-nums; }
.mq-acp-dir.out { color: var(--accent); font-weight: 600; }
.mq-acp-dir.in { color: var(--muted); font-weight: 600; }
.mq-acp-what { color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mq-acp-what .mq-pill { font-family: var(--font-ui); font-size: 10.5px; }
.mq-acp-detail { color: var(--muted); white-space: nowrap; }
.mq-acp-size { color: var(--muted); text-align: right; font-variant-numeric: tabular-nums; }
.mq-json { margin: 0; padding: 10px 14px 12px 126px; background: var(--mq-code-bg); color: var(--mq-code-fg); font: 12px/1.55 var(--font-mono); border-bottom: 1px solid var(--border); white-space: pre; overflow: auto; }
.mq-json k { color: var(--mq-syn-f); } .mq-json s { color: var(--mq-syn-s); text-decoration: none; }
.mq-acp-foot { display: flex; align-items: center; gap: 6px; padding: 7px 10px; border-top: 1px solid var(--border); font-size: 12px; color: var(--muted); }

/* Annoter au clic (façon Figma) */
.mq-frozen { cursor: crosshair; }
.mq-panel .browser-page { background: #fff; }
.mq-pin { position: absolute; width: 26px; height: 26px; margin: -26px 0 0 0; border-radius: 13px 13px 13px 2px; background: var(--accent);
  color: #fff; font-size: 12px; font-weight: 600; display: grid; place-items: center; box-shadow: 0 0 0 2px #fff, 0 2px 8px rgb(0 0 0 / 0.25); }
.mq-bubble { position: absolute; width: 250px; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 10px;
  box-shadow: var(--shadow-menu); padding: 8px 10px; font: 13px/1.4 var(--font-ui); }
.mq-bubble.editing { border-color: var(--accent); }
.mq-bubble textarea { width: 100%; border: 0; outline: none; resize: none; background: transparent; font: inherit; color: var(--text); padding: 0; height: 38px; }
.mq-bubble .mq-note-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 4px; }

/* ---------- Productivité ---------- */
.pc-actions .btn kbd { display: inline-grid; place-items: center; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 4px;
  border: 1px solid currentColor; opacity: 0.55; font-size: 10.5px; margin-left: 8px; margin-right: -2px; }
.mq-group-label { padding: 8px 10px 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.search-result .mq-kbd-side { margin-left: auto; font-size: 11.5px; color: var(--muted); }
.mq-net { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--border);
  background: var(--warn-soft); margin: 4px 0 18px; font-size: 13.5px; color: var(--text); }
.mq-net svg { color: var(--warn); margin-top: 2px; flex-shrink: 0; }
.mq-net .grow { flex: 1; }
.mq-net small { display: block; color: var(--text-2); font-size: 12.5px; margin-top: 2px; }
`

/** Faux site « Carnet de lecture » : ses propres couleurs (claires), comme une vraie page. */
export const SITE_CSS = String.raw`
.mq-site { font: 15px/1.45 Georgia, 'Times New Roman', serif; color: #1d1d1b; background: #fff; }
.mq-site h1 { font-size: 30px; margin: 0 0 16px; font-weight: 400; }
.mq-site h2 { font-size: 18px; margin: 22px 0 10px; font-weight: 400; }
.mq-site .bar { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.mq-site input, .mq-site select, .mq-site .b { font: inherit; font-size: 14px; border: 1px solid #b9b6ad; border-radius: 6px; padding: 7px 10px; background: #fff; color: #1d1d1b; }
.mq-site .b { background: #f4f2ec; }
.mq-site .b.primary { background: #2b2a26; color: #fff; border-color: #2b2a26; }
.mq-site table { border-collapse: collapse; width: 100%; font-size: 14px; }
.mq-site th { text-align: left; font-weight: 700; border-bottom: 1px solid #d6d3ca; padding: 6px 8px; }
.mq-site td { border-bottom: 1px solid #ecebe6; padding: 7px 8px; }
.mq-site .st { font-size: 12px; padding: 1px 7px; border-radius: 99px; background: #eef3ea; color: #3f6b3f; }
.mq-site .st.r { background: #fbefe4; color: #8a5524; }
.mq-site .st.a { background: #eceffb; color: #3e4f8f; }
.mq-site .add { display: flex; gap: 8px; flex-wrap: wrap; }
.mq-site .card { border: 1px solid #e3e0d6; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
.mq-site .card b { display: block; font-weight: 700; }
.mq-site .card span { font-size: 13px; color: #5d5a52; }
`
