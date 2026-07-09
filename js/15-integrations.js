'use strict';
/* ══════════════════════════════════════════════════════════════
   INTÉGRATIONS — connecteurs API (super_admin)

   Branche Konsilys sur les outils du marché : Microsoft 365 / Entra ID
   (écosystème CGI), les SIRH (Workday, SuccessFactors, Lucca, BambooHR),
   la Paie (Silae, PayFit, ADP) et la Facturation (Pennylane, Sage, Sellsy,
   QuickBooks). Tout passe par l'Edge Function `integrations` (verify_jwt=true) :
   les secrets ne repartent JAMAIS vers le navigateur. Chaque connecteur est
   désactivé par défaut — aucun effet tant qu'il n'est pas configuré et activé.
══════════════════════════════════════════════════════════════ */
var INTG_URL = SUPABASE_URL + '/functions/v1/integrations';
var INTG_CATS = [
  { id: 'sso_directory', lb: '🔗 Identité & annuaire — Microsoft / CGI', desc: "Le socle d'identité de CGI : Entra ID (Azure AD), utilisateurs et SSO." },
  { id: 'hr', lb: '👥 SIRH (RH)', desc: 'Synchronisez collaborateurs et données RH depuis votre SIRH.' },
  { id: 'payroll', lb: '💶 Paie', desc: 'Reliez la paie (dossiers, bulletins, éléments variables).' },
  { id: 'billing', lb: '🧾 Facturation', desc: 'Rapprochez la facturation et la comptabilité.' }
];
var INTG_STATUS = {
  connected:    { lb: '✓ Connecté',    bg: '#dcfce7', fg: '#166534' },
  configured:   { lb: '● Configuré',    bg: '#dbeafe', fg: '#1e40af' },
  error:        { lb: '⚠ Erreur',       bg: '#fee2e2', fg: '#991b1b' },
  disconnected: { lb: '○ Non connecté', bg: '#f1f5f9', fg: '#475569' }
};

/* Appel authentifié de l'Edge Function. */
function intgCall(payload) {
  if (!sb) return Promise.reject(new Error('Supabase non connecté.'));
  return sb.auth.getSession().then(function (s) {
    var tok = s && s.data && s.data.session ? s.data.session.access_token : '';
    return fetch(INTG_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Authorization': 'Bearer ' + tok },
      body: JSON.stringify(payload || {})
    }).then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); });
  });
}

/* Charge le catalogue + les connecteurs enregistrés dans S.integrations. */
function loadIntegrations() {
  return intgCall({ action: 'list' }).then(function (r) {
    if (r.body && r.body.catalog) S.integrations = r.body;
    else S.integrations = { catalog: [], saved: [], logs: [], error: (r.body && r.body.error) || 'Chargement impossible' };
    return S.integrations;
  }, function (e) {
    S.integrations = { catalog: [], saved: [], logs: [], error: (e && e.message) || String(e) };
    return S.integrations;
  });
}

function _intgSaved(pid) {
  var arr = (S.integrations && S.integrations.saved) || [];
  return arr.find(function (x) { return x.provider === pid; }) || null;
}

/* Formulaire de configuration inline d'un connecteur. */
function _intgConfigForm(p) {
  var sv = _intgSaved(p.id) || {};
  var cfg = sv.config || {};
  var secretsSet = sv.secretsSet || {};
  var flds = p.fields.map(function (f) {
    var isSecret = !!f.secret;
    var val = isSecret ? '' : esc(cfg[f.key] || '');
    var ph = isSecret
      ? (secretsSet[f.key] ? '•••••••• (laisser vide pour conserver)' : (f.ph || ''))
      : (f.ph || '');
    return '<div class="fd"><label class="fl">' + esc(f.label) + '</label>'
      + '<input class="ic" id="intg-' + p.id + '-' + f.key + '"' + (isSecret ? ' type="password" autocomplete="new-password"' : '')
      + ' value="' + val + '" placeholder="' + esc(ph) + '">'
      + (f.help ? '<p class="fh">' + esc(f.help) + '</p>' : '')
      + '</div>';
  }).join('');
  return '<div style="border-top:1px dashed #e2e8f0;margin-top:12px;padding-top:12px">'
    + '<div class="g2">' + flds + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">'
    + '<button class="bp" onclick="intgSave(\'' + p.id + '\')">💾 Enregistrer</button>'
    + '<button class="bs" onclick="intgConfigure(\'' + p.id + '\')">Fermer</button>'
    + '<a href="' + esc(p.docs) + '" target="_blank" rel="noopener" style="align-self:center;font-size:12px;color:#1B2B3A;font-weight:700">📖 Documentation ' + esc(p.vendor) + ' →</a>'
    + '</div>'
    + '<div id="intg-msg-' + p.id + '" style="font-size:12px;font-weight:600;margin-top:8px;display:none"></div>'
    + '</div>';
}

function _intgCard(p) {
  var sv = _intgSaved(p.id);
  var status = sv ? (sv.status || 'configured') : 'disconnected';
  var st = INTG_STATUS[status] || INTG_STATUS.disconnected;
  var enabled = sv && sv.enabled;
  var open = S.intgOpen === p.id;
  var configured = !!sv;
  var lastErr = sv && sv.last_error;
  var syncTxt = sv && sv.last_sync_at ? new Date(sv.last_sync_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;

  return '<div class="card" style="padding:16px;margin-bottom:12px;border:1px solid ' + (enabled ? '#bbf7d0' : '#e2e8f0') + '">'
    + '<div style="display:flex;align-items:flex-start;gap:12px">'
    + '<div style="font-size:26px;line-height:1;flex-shrink:0">' + p.icon + '</div>'
    + '<div style="flex:1;min-width:0">'
    + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
    + '<span style="font-weight:800;font-size:14px;color:#0f172a">' + esc(p.name) + '</span>'
    + '<span style="font-size:11px;color:#94a3b8">' + esc(p.vendor) + '</span>'
    + '<span style="padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;background:' + st.bg + ';color:' + st.fg + '">' + st.lb + '</span>'
    + (enabled ? '<span style="padding:2px 9px;border-radius:99px;font-size:10px;font-weight:800;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0">ACTIVÉ</span>' : '')
    + '</div>'
    + '<div style="font-size:12px;color:#64748b;margin-top:4px;line-height:1.5">' + esc(p.desc) + '</div>'
    + (lastErr ? '<div style="font-size:11px;color:#b91c1c;margin-top:6px">⚠ ' + esc(lastErr) + '</div>' : '')
    + (syncTxt ? '<div style="font-size:11px;color:#94a3b8;margin-top:4px">Dernier aperçu : ' + esc(syncTxt) + '</div>' : '')
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'
    + '<button class="bs" onclick="intgConfigure(\'' + p.id + '\')">' + (open ? 'Masquer' : (configured ? '⚙ Configurer' : '⚙ Configurer')) + '</button>'
    + (configured ? '<button class="bs" onclick="intgTest(\'' + p.id + '\')">🔌 Tester la connexion</button>' : '')
    + (configured ? '<button class="bs" onclick="intgSync(\'' + p.id + '\')" title="Lecture seule : récupère un échantillon d\'enregistrements">👁 Aperçu (lecture seule)</button>' : '')
    + (configured && p.canImport ? '<button class="bs" onclick="intgImportPreview(\'' + p.id + '\')" style="color:#1d4ed8" title="Importer les collaborateurs comme consultants (aperçu avant écriture)">⬇ Importer les collaborateurs</button>' : '')
    + (configured ? '<button class="bs" onclick="intgToggle(\'' + p.id + '\',' + (enabled ? 'false' : 'true') + ')" style="' + (enabled ? 'color:#b45309' : 'color:#15803d') + '">' + (enabled ? '⏸ Désactiver' : '▶ Activer') + '</button>' : '')
    + (configured ? '<button class="lr" onclick="intgRemove(\'' + p.id + '\')" style="color:#b91c1c">Retirer</button>' : '')
    + '</div>'
    + (open ? _intgConfigForm(p) : '')
    + (S.intgImportFor === p.id ? _intgImportPanel(p) : '')
    + '</div></div>';
}

function tIntegrations() {
  if (S.role !== 'super_admin') return '<div class="emp">Accès réservé au Sénior VP.</div>';
  /* Chargement paresseux : la 1re ouverture déclenche le fetch puis re-render. */
  if (!S.integrations && !S._intgLoading) {
    S._intgLoading = true;
    loadIntegrations().then(function () { S._intgLoading = false; render(); });
  }
  var data = S.integrations;
  var head = '<div class="vw">'
    + '<div class="ph"><div class="pt">🔌 Intégrations</div>'
    + '<div class="ps">Connectez Konsilys à vos outils : Microsoft 365 / Entra ID (CGI), SIRH, Paie et Facturation</div></div>'
    + '<div class="card" style="padding:16px;margin-bottom:16px;background:#eff6ff;border:1px solid #bfdbfe">'
    + '<div style="font-size:12px;color:#374151;line-height:1.6">🔒 <strong>Sécurisé & sans risque.</strong> Chaque connecteur est <strong>désactivé par défaut</strong> : rien n\'est envoyé à un tiers tant que vous n\'avez pas saisi vos identifiants et testé la connexion. Vos clés secrètes sont stockées côté serveur et <strong>ne réapparaissent jamais</strong> dans l\'écran. La synchronisation proposée ici est en <strong>lecture seule</strong> (aperçu) — elle ne modifie aucune donnée de l\'application.</div></div>';

  if (!data) {
    return head + '<div class="card" style="padding:30px;text-align:center;color:#94a3b8">Chargement des connecteurs…</div></div>';
  }
  if (data.error) {
    return head + '<div class="card" style="padding:20px;color:#b91c1c">⚠ ' + esc(data.error) + '<div style="margin-top:10px"><button class="bs" onclick="S.integrations=null;render();">Réessayer</button></div></div></div>';
  }

  var catalog = data.catalog || [];
  var sections = INTG_CATS.map(function (c) {
    var ps = catalog.filter(function (p) { return p.category === c.id; });
    if (!ps.length) return '';
    return '<div style="margin-bottom:22px">'
      + '<h3 style="font-weight:800;font-size:14px;color:#0f172a;margin-bottom:2px">' + c.lb + '</h3>'
      + '<p style="font-size:12px;color:#94a3b8;margin-bottom:12px">' + esc(c.desc) + '</p>'
      + ps.map(_intgCard).join('')
      + '</div>';
  }).join('');

  /* Journal des tests / aperçus. */
  var logs = data.logs || [];
  var logRows = logs.slice(0, 30).map(function (l) {
    var d = l.created_at ? new Date(l.created_at) : null;
    var dTxt = d && !isNaN(d) ? d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
    var pv = (catalog.find(function (p) { return p.id === l.provider; }) || {}).name || l.provider;
    return '<tr><td style="white-space:nowrap;font-size:11px;color:#64748b">' + esc(dTxt) + '</td>'
      + '<td style="font-size:12px;color:#0f172a">' + esc(pv) + '</td>'
      + '<td>' + (l.ok ? '<span style="color:#16a34a;font-weight:700">✓</span>' : '<span style="color:#dc2626;font-weight:700">✗</span>') + ' ' + esc(l.action) + '</td>'
      + '<td style="font-size:12px;color:#64748b">' + esc(l.message || '') + '</td></tr>';
  }).join('');
  var logCard = '<div class="card ov" style="margin-top:6px">'
    + '<div style="padding:14px 20px;border-bottom:1px solid #f1f5f9"><span style="font-size:13px;font-weight:700;color:#0f172a">📜 Journal des connexions</span></div>'
    + '<table><thead><tr><th>Date</th><th>Connecteur</th><th>Action</th><th>Détail</th></tr></thead>'
    + '<tbody>' + (logRows || '<tr><td colspan="4" class="emp">Aucun test pour le moment.</td></tr>') + '</tbody></table></div>';

  return head + sections + logCard + '</div>';
}

/* ── Handlers ── */
function intgConfigure(id) { S.intgOpen = (S.intgOpen === id) ? null : id; render(); }

function _intgSay(id, txt, ok) {
  var el = document.getElementById('intg-msg-' + id);
  if (el) { el.style.display = 'block'; el.style.color = ok ? '#16a34a' : '#ef4444'; el.textContent = txt; }
}

function intgSave(id) {
  var p = (S.integrations.catalog || []).find(function (x) { return x.id === id; });
  if (!p) return;
  var cfg = {};
  p.fields.forEach(function (f) {
    var el = document.getElementById('intg-' + id + '-' + f.key);
    if (!el) return;
    /* Secret laissé vide → on n'envoie pas la clé (conserve l'ancien secret). */
    if (f.secret && !el.value) return;
    cfg[f.key] = el.value;
  });
  var enabled = !!(_intgSaved(id) && _intgSaved(id).enabled);
  _intgSay(id, 'Enregistrement…', true);
  intgCall({ action: 'save', provider: id, config: cfg, enabled: enabled }).then(function (r) {
    if (r.body && r.body.ok) {
      _intgSay(id, '✓ Configuration enregistrée. Testez la connexion.', true);
      loadIntegrations().then(function () { render(); });
    } else {
      _intgSay(id, '⚠ ' + ((r.body && r.body.error) || 'Échec'), false);
    }
  }, function (e) { _intgSay(id, '⚠ ' + (e && e.message || e), false); });
}

function intgTest(id) {
  toast('Test de connexion en cours…');
  intgCall({ action: 'test', provider: id }).then(function (r) {
    var b = r.body || {};
    if (b.ok) toast('✓ ' + (b.message || 'Connexion réussie'));
    else toast('⚠ ' + (b.error || 'Échec de la connexion'), 'error');
    loadIntegrations().then(function () { render(); });
  }, function (e) { toast('⚠ ' + (e && e.message || e), 'error'); });
}

function intgSync(id) {
  toast('Récupération d\'un aperçu (lecture seule)…');
  intgCall({ action: 'sync', provider: id }).then(function (r) {
    var b = r.body || {};
    if (b.ok) toast('✓ ' + (b.message || 'Aperçu récupéré'));
    else toast('⚠ ' + (b.error || 'Échec'), 'error');
    loadIntegrations().then(function () { render(); });
  }, function (e) { toast('⚠ ' + (e && e.message || e), 'error'); });
}

function intgToggle(id, enable) {
  if (enable && !confirm('Activer ce connecteur ? Il restera en lecture seule tant qu\'aucune synchronisation d\'import n\'est configurée.')) return;
  intgCall({ action: 'save', provider: id, config: {}, enabled: !!enable }).then(function (r) {
    if (r.body && r.body.ok) { toast(enable ? 'Connecteur activé' : 'Connecteur désactivé'); loadIntegrations().then(function () { render(); }); }
    else toast('⚠ ' + ((r.body && r.body.error) || 'Échec'), 'error');
  }, function (e) { toast('⚠ ' + (e && e.message || e), 'error'); });
}

function intgRemove(id) {
  if (!confirm('Retirer ce connecteur et sa configuration ?')) return;
  intgCall({ action: 'remove', provider: id }).then(function () {
    if (S.intgOpen === id) S.intgOpen = null;
    toast('Connecteur retiré');
    loadIntegrations().then(function () { render(); });
  }, function (e) { toast('⚠ ' + (e && e.message || e), 'error'); });
}

/* ── Import des collaborateurs → consultants ──
   Aperçu (people via l'Edge Function) puis dédoublonnage par email/nom contre les
   consultants existants, et écriture côté app (RLS) après confirmation. */
function _intgImportPanel(p) {
  var d = S.intgImportData;
  if (!d || d.provider !== p.id) return '';
  var wrap = function (inner) {
    return '<div style="border-top:1px dashed #bfdbfe;margin-top:12px;padding-top:12px;background:#f8fbff;border-radius:8px;padding:12px">'
      + '<div style="font-weight:800;font-size:13px;color:#0f172a;margin-bottom:8px">⬇ Import des collaborateurs → Consultants</div>'
      + inner + '</div>';
  };
  if (d.loading) return wrap('<div style="font-size:12px;color:#64748b">Récupération des collaborateurs…</div>');
  if (d.error) return wrap('<div style="font-size:12px;color:#b91c1c">⚠ ' + esc(d.error) + '</div>'
    + '<button class="bs" onclick="intgImportCancel()">Fermer</button>');
  var toCreate = d.toCreate || [];
  var list = toCreate.slice(0, 30).map(function (r) {
    return '<div style="font-size:12px;color:#0f172a;padding:2px 0">• ' + esc(r.name) + (r.email ? ' <span style="color:#94a3b8">' + esc(r.email) + '</span>' : '') + (r.title ? ' — <span style="color:#64748b">' + esc(r.title) + '</span>' : '') + '</div>';
  }).join('');
  return wrap(
    '<div style="font-size:12px;color:#374151;margin-bottom:8px">'
    + '<strong>' + toCreate.length + '</strong> à créer · <strong>' + d.existing + '</strong> déjà présent(s)'
    + (d.skippedNoName ? ' · ' + d.skippedNoName + ' ignoré(s) (sans nom)' : '')
    + '</div>'
    + (toCreate.length ? '<div style="max-height:200px;overflow:auto;border:1px solid #e2e8f0;border-radius:8px;padding:8px;background:#fff;margin-bottom:10px">' + list + (toCreate.length > 30 ? '<div style="font-size:11px;color:#94a3b8;margin-top:4px">… et ' + (toCreate.length - 30) + ' autre(s)</div>' : '') + '</div>' : '<div style="font-size:12px;color:#64748b;margin-bottom:10px">Rien de nouveau à importer — tous les collaborateurs existent déjà.</div>')
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    + (toCreate.length ? '<button class="bp" onclick="intgImportCommit(\'' + p.id + '\')"' + (d.committing ? ' disabled style="opacity:.6"' : '') + '>' + (d.committing ? 'Import en cours…' : '✓ Créer ' + toCreate.length + ' consultant(s)') + '</button>' : '')
    + '<button class="bs" onclick="intgImportCancel()">Annuler</button>'
    + '</div>'
    + '<div style="font-size:11px;color:#94a3b8;margin-top:8px">Les consultants sont créés avec nom, email et intitulé. Vous pourrez compléter TJM/BU/manager depuis l\'onglet Équipe.</div>'
  );
}

function intgImportPreview(id) {
  S.intgImportFor = id;
  S.intgImportData = { provider: id, loading: true };
  render();
  if (!sb || !SB_CID) { S.intgImportData = { provider: id, error: 'Supabase non connecté.' }; render(); return; }
  Promise.all([
    intgCall({ action: 'people', provider: id }),
    sb.from('consultants').select('name,email').eq('company_id', SB_CID)
  ]).then(function (arr) {
    var resp = arr[0].body || {};
    if (!resp.ok) { S.intgImportData = { provider: id, error: resp.error || 'Récupération impossible' }; render(); return; }
    var existing = (arr[1] && arr[1].data) || [];
    var emailSet = {}, nameSet = {};
    existing.forEach(function (c) {
      if (c.email) emailSet[String(c.email).toLowerCase().trim()] = 1;
      if (c.name) nameSet[String(c.name).toLowerCase().trim()] = 1;
    });
    var toCreate = [], nExisting = 0, nSkipped = 0, seen = {};
    (resp.records || []).forEach(function (r) {
      var name = (r.name || '').trim();
      var email = (r.email || '').trim().toLowerCase();
      if (!name && !email) { nSkipped++; return; }
      if (!name) { nSkipped++; return; } /* un consultant sans nom n'a pas de sens */
      var key = email || ('name:' + name.toLowerCase());
      if (seen[key]) return; /* doublon dans le lot */
      seen[key] = 1;
      if ((email && emailSet[email]) || (!email && nameSet[name.toLowerCase()])) { nExisting++; return; }
      toCreate.push({ name: name, email: r.email || '', title: r.title || '', start: r.start || '' });
    });
    S.intgImportData = { provider: id, toCreate: toCreate, existing: nExisting, skippedNoName: nSkipped };
    render();
  }, function (e) { S.intgImportData = { provider: id, error: (e && e.message) || String(e) }; render(); });
}

function intgImportCommit(id) {
  var d = S.intgImportData;
  if (!d || d.provider !== id || !(d.toCreate || []).length) return;
  if (!sb || !SB_CID) { toast('⚠ Supabase non connecté.', 'error'); return; }
  d.committing = true; render();
  var rows = d.toCreate.map(function (r) {
    return { company_id: SB_CID, name: r.name, email: r.email || null, title: r.title || null, arrive: r.start || null, contract: 'salarie' };
  });
  sb.from('consultants').insert(rows).then(function (res) {
    if (res.error) { d.committing = false; toast('⚠ Import : ' + res.error.message, 'error'); render(); return; }
    var n = rows.length;
    S.intgImportFor = null; S.intgImportData = null;
    toast('✓ ' + n + ' consultant(s) importé(s)');
    /* Recharge les données de l\'entreprise pour refléter les nouveaux consultants. */
    if (typeof loadSB === 'function') { loadSB().then(function () { render(); }, function () { render(); }); }
    else render();
  }, function (e) { d.committing = false; toast('⚠ ' + (e && e.message || e), 'error'); render(); });
}

function intgImportCancel() { S.intgImportFor = null; S.intgImportData = null; render(); }
