// Test de charge Konsilys (k6) — simule N utilisateurs simultanés effectuant le
// parcours de lecture principal (equivalent de loadSB) + l'agrégat serveur.
//
// NE PAS lancer contre la prod sans raison : préférez une branche Supabase ou un
// projet de staging. Le script refuse la prod sauf ALLOW_PROD=1.
//
// Prérequis : k6 (https://k6.io). Voir tests/load/README.md.
//
// Exemple :
//   SUPABASE_URL=https://xxxx.supabase.co \
//   SUPABASE_ANON_KEY=... \
//   TEST_EMAIL=demo@exemple.com TEST_PASSWORD=... \
//   VUS=50 HOLD=2m k6 run tests/load/k6-konsilys.js
import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { Trend } from 'k6/metrics';

const BASE = __ENV.SUPABASE_URL;
const ANON = __ENV.SUPABASE_ANON_KEY;
const JWT = __ENV.TEST_JWT || '';
const EMAIL = __ENV.TEST_EMAIL || '';
const PASSWORD = __ENV.TEST_PASSWORD || '';
const ALLOW_PROD = __ENV.ALLOW_PROD === '1';
const VUS = Number(__ENV.VUS || 20);

if (!BASE || !ANON) {
  throw new Error('SUPABASE_URL et SUPABASE_ANON_KEY sont requis (variables d\'environnement).');
}
// Garde-fou : le projet de prod ne doit pas être bombardé par accident.
if (BASE.indexOf('rwmstlesxnglpblrurqj') >= 0 && !ALLOW_PROD) {
  throw new Error('Cible = projet PROD. Utilisez une branche/staging Supabase, ou passez ALLOW_PROD=1 en connaissance de cause.');
}

export const options = {
  stages: [
    { duration: __ENV.RAMP || '30s', target: VUS },   // montée
    { duration: __ENV.HOLD || '1m', target: VUS },    // palier
    { duration: '20s', target: 0 },                   // descente
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],                   // < 1% d'erreurs
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],  // objectifs de latence
  },
};

const readTrend = new Trend('konsilys_read_ms', true);
const rpcTrend = new Trend('konsilys_rpc_ms', true);

export function setup() {
  let token = JWT;
  if (!token && EMAIL && PASSWORD) {
    const res = http.post(
      `${BASE}/auth/v1/token?grant_type=password`,
      JSON.stringify({ email: EMAIL, password: PASSWORD }),
      { headers: { 'Content-Type': 'application/json', apikey: ANON } }
    );
    check(res, { 'login 200': (r) => r.status === 200 });
    token = res.json('access_token');
  }
  if (!token) fail('Fournissez TEST_JWT, ou TEST_EMAIL + TEST_PASSWORD, pour authentifier les VUs.');
  return { token };
}

export default function (data) {
  const auth = { apikey: ANON, Authorization: `Bearer ${data.token}` };

  // Parcours de lecture (RLS cloisonne par entreprise) — équivalent de loadSB.
  const reads = [
    `${BASE}/rest/v1/consultants?select=*&order=name`,
    `${BASE}/rest/v1/missions?select=*&order=id`,
    `${BASE}/rest/v1/leaves?select=*&order=id`,
    `${BASE}/rest/v1/candidates?select=*&order=created_at.desc`,
  ];
  for (let i = 0; i < reads.length; i++) {
    const r = http.get(reads[i], { headers: Object.assign({ Range: '0-999' }, auth) });
    readTrend.add(r.timings.duration);
    check(r, { 'lecture 200/206': (x) => x.status === 200 || x.status === 206 });
  }

  // Agrégat serveur (montée en charge).
  const rpc = http.post(
    `${BASE}/rest/v1/rpc/company_kpi_snapshot`,
    '{}',
    { headers: Object.assign({ 'Content-Type': 'application/json' }, auth) }
  );
  rpcTrend.add(rpc.timings.duration);
  check(rpc, { 'rpc 200': (x) => x.status === 200 });

  sleep(Number(__ENV.THINK || 1)); // temps de réflexion entre deux itérations
}
