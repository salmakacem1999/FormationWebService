// RECETTE AUTOMATIQUE du TP noté 1 : « API de posts en mémoire ».
// Les élèves la lancent pour s'auto-évaluer ; le formateur s'en sert comme premier filtre. La note vient de la relecture (voir grille-d-evaluation.md).
//
// Prérequis : le serveur de l'élève tourne (par défaut http://localhost:3000).
//   node recette.js                                  # recette sur http://localhost:3000
//   API_URL=http://localhost:4000 node recette.js    # autre adresse
const BASE = process.env.API_URL ?? 'http://localhost:3000'
const JSON_HEADERS = { 'Content-Type': 'application/json' }

const sections = []
let current

function section(name, max) {
  current = { name, max, checks: [] }
  sections.push(current)
}
async function check(name, fn) {
  let ok = false
  let why = ''
  try {
    const result = await fn()
    ok = result === true
    if (!ok) why = typeof result === 'string' ? result : 'condition non remplie'
  } catch (err) {
    why = `exception : ${err.message}`
  }
  current.checks.push({ name, ok, why })
}

async function call(method, path, body, headers = {}) {
  const init = { method, headers: { ...headers } }
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
    init.headers = { ...JSON_HEADERS, ...headers }
  }
  const res = await fetch(BASE + path, init)
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : undefined
  } catch {
    json = undefined
  }
  return { status: res.status, headers: res.headers, text, json }
}

const valid = (over = {}) => ({ postId: 9001, name: 'Un post de recette', email: 'recette@exemple.com', body: 'Contenu du post de recette.', ...over })
const isJsonError = (r) => r.headers.get('content-type')?.includes('application/json') && typeof r.json?.error === 'string' && r.json.error.length > 0
const fieldsOk = (p) =>
  p && Number.isInteger(p.postId) && Number.isInteger(p.id) && typeof p.name === 'string' && typeof p.email === 'string' && typeof p.body === 'string'

// Vérifie que le serveur répond avant de commencer
try {
  await fetch(BASE + '/posts')
} catch {
  console.error(`Le serveur ne répond pas sur ${BASE}. Lancez-le (npm start) puis relancez la recette.`)
  process.exit(1)
}

// ================= LIRE (5 points) =================
section('Lire (GET)', 5)
const list = await call('GET', '/posts')
await check('GET /posts répond 200 avec un tableau JSON', () => list.status === 200 && Array.isArray(list.json) || `statut ${list.status}`)
await check('Chaque post a postId, id, name, email, body (bons types)', () => Array.isArray(list.json) && list.json.length > 0 && list.json.every(fieldsOk))
const first = Array.isArray(list.json) ? list.json[0] : undefined
await check('GET /posts/:id renvoie le bon post (200)', async () => {
  const r = await call('GET', `/posts/${first?.id}`)
  return (r.status === 200 && r.json?.id === first?.id) || `statut ${r.status}`
})
await check('GET /posts/999999 renvoie 404 avec { "error": "…" }', async () => {
  const r = await call('GET', '/posts/999999')
  return (r.status === 404 && isJsonError(r)) || `statut ${r.status}`
})
await check('GET /posts?postId=N ne renvoie que les posts de ce postId', async () => {
  const r = await call('GET', `/posts?postId=${first?.postId}`)
  return (r.status === 200 && Array.isArray(r.json) && r.json.length > 0 && r.json.every((p) => p.postId === first.postId)) || `statut ${r.status}`
})
await check('GET /posts?postId=abc renvoie 400', async () => (await call('GET', '/posts?postId=abc')).status === 400)

// ================= CRÉER (6 points) =================
section('Créer (POST)', 6)
const created = await call('POST', '/posts', valid())
await check('POST valide : 201', () => created.status === 201 || `statut ${created.status}`)
await check('POST valide : en-tête Location = /posts/<id>', () => created.headers.get('location')?.endsWith(`/posts/${created.json?.id}`) || `Location = ${created.headers.get('location')}`)
await check('POST valide : le corps contient le post avec un id entier', () => fieldsOk(created.json) && created.json.name === 'Un post de recette')
await check('Le post créé est lisible avec GET /posts/:id', async () => (await call('GET', `/posts/${created.json?.id}`)).status === 200)
await check('POST sans name : 400 avec un message', async () => {
  const { name, ...rest } = valid()
  const r = await call('POST', '/posts', rest)
  return (r.status === 400 && isJsonError(r)) || `statut ${r.status}`
})
await check('POST avec un email invalide : 400', async () => (await call('POST', '/posts', valid({ email: 'pas-un-email' }))).status === 400)
await check('POST avec du JSON cassé : 400', async () => (await call('POST', '/posts', '{cassé')).status === 400)
await check('POST deux fois : deux posts distincts (POST n’est pas idempotent)', async () => {
  const a = await call('POST', '/posts', valid({ name: 'Doublon' }))
  const b = await call('POST', '/posts', valid({ name: 'Doublon' }))
  return (a.status === 201 && b.status === 201 && a.json?.id !== b.json?.id) || 'les deux appels n’ont pas créé deux posts'
})

// ================= REMPLACER / MODIFIER (6 points) =================
section('Remplacer et modifier (PUT, PATCH)', 6)
const target = created.json
await check('PUT remplace tous les champs (200)', async () => {
  const r = await call('PUT', `/posts/${target?.id}`, valid({ postId: 9002, name: 'Remplacé', email: 'autre@exemple.com', body: 'Nouveau corps' }))
  return (r.status === 200 && r.json?.name === 'Remplacé' && r.json?.postId === 9002 && r.json?.id === target?.id) || `statut ${r.status}`
})
await check('PUT idempotent : le même PUT envoyé deux fois donne le même état', async () => {
  const body = valid({ name: 'Stable' })
  await call('PUT', `/posts/${target?.id}`, body)
  const a = (await call('GET', `/posts/${target?.id}`)).text
  await call('PUT', `/posts/${target?.id}`, body)
  const b = (await call('GET', `/posts/${target?.id}`)).text
  return a === b
})
await check('PUT incomplet (sans email) : 400', async () => {
  const { email, ...rest } = valid()
  return (await call('PUT', `/posts/${target?.id}`, rest)).status === 400
})
await check('PUT sur un id inexistant : 404', async () => (await call('PUT', '/posts/999999', valid())).status === 404)
await check('PATCH ne modifie que les champs envoyés', async () => {
  await call('PUT', `/posts/${target?.id}`, valid({ name: 'Avant', body: 'Corps inchangé' }))
  const r = await call('PATCH', `/posts/${target?.id}`, { name: 'Après' })
  return (r.status === 200 && r.json?.name === 'Après' && r.json?.body === 'Corps inchangé') || `statut ${r.status}`
})
await check('PATCH {} : 400', async () => (await call('PATCH', `/posts/${target?.id}`, {})).status === 400)
await check('PATCH avec un champ non modifiable (id) ou inconnu : 400', async () => {
  const a = await call('PATCH', `/posts/${target?.id}`, { id: 1 })
  const b = await call('PATCH', `/posts/${target?.id}`, { role: 'admin' })
  return (a.status === 400 && b.status === 400) || `statuts ${a.status} et ${b.status}`
})
await check('PATCH sur un id inexistant : 404', async () => (await call('PATCH', '/posts/999999', { name: 'x' })).status === 404)

// ================= SUPPRIMER (1 point) =================
section('Supprimer (DELETE)', 1)
const toDelete = (await call('POST', '/posts', valid({ name: 'À supprimer' }))).json
await check('DELETE : 204 sans corps', async () => {
  const r = await call('DELETE', `/posts/${toDelete?.id}`)
  return (r.status === 204 && r.text === '') || `statut ${r.status}`
})
await check('Après DELETE, GET /posts/:id renvoie 404', async () => (await call('GET', `/posts/${toDelete?.id}`)).status === 404)
await check('DELETE rejoué : 404 (l’état final reste identique)', async () => (await call('DELETE', `/posts/${toDelete?.id}`)).status === 404)

// ================= ERREURS (2 points) =================
section('Erreurs propres', 2)
await check('Route inconnue : 404 en JSON { "error": "…" }', async () => isJsonError(await call('GET', '/nimportequoi')))
await check('JSON cassé : 400 en JSON { "error": "…" }', async () => isJsonError(await call('POST', '/posts', '{cassé')))
await check('Aucune requête hostile ne provoque de 5xx', async () => {
  const attempts = [
    call('POST', '/posts', 'null'),
    call('POST', '/posts', '[]'),
    call('POST', '/posts', '"texte"'),
    call('POST', '/posts', { postId: { $ne: null }, name: 'x', email: 'a@b.fr', body: 'y' }),
    call('PUT', '/posts/abc', valid()),
    call('PATCH', '/posts/1', { name: 'x'.repeat(200000) }),
    call('GET', '/posts/%00'),
  ]
  const results = await Promise.all(attempts)
  const bad = results.find((r) => r.status >= 500)
  return !bad || `un statut ${bad.status} a été renvoyé`
})
await check('Les erreurs 4xx sont toutes en JSON avec la clef error', async () => {
  const errors = [await call('GET', '/posts/999999'), await call('POST', '/posts', {}), await call('PATCH', '/posts/1', {})]
  return errors.every(isJsonError) || 'au moins une erreur n’est pas { "error": "…" }'
})

// ================= RAPPORT =================
let passedTotal = 0
let checksTotal = 0
console.log(`\nRecette du TP « Posts en mémoire » sur ${BASE}\n`)
for (const s of sections) {
  const passed = s.checks.filter((c) => c.ok).length
  passedTotal += passed
  checksTotal += s.checks.length
  console.log(`${s.name} : ${passed} / ${s.checks.length} contrôles`)
  for (const c of s.checks) console.log(`   ${c.ok ? '✅' : '❌'} ${c.name}${c.ok ? '' : `  → ${c.why}`}`)
}
console.log(`\nContrôles réussis : ${passedTotal} / ${checksTotal}  (indicatif : la note vient d'une relecture, voir la grille d'évaluation)`)
process.exit(passedTotal === checksTotal ? 0 : 1)
