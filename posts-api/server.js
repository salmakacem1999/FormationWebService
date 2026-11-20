const fs = require('fs');
const Koa = require('koa');
const Router = require('@koa/router');
const bodyParser = require('koa-bodyparser');

const app = new Koa();
const router = new Router();


const posts = JSON.parse(fs.readFileSync('./posts.seed.json', 'utf8'));

let prochainId = Math.max(0, ...posts.map((p) => p.id)) + 1;
const CHAMPS = ['postId', 'name', 'email', 'body'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function valider(corps, requisTous) {
  if (corps === null || typeof corps !== 'object' || Array.isArray(corps)) {
    return 'Le corps doit être un objet JSON';
  }

  const cles = Object.keys(corps);

  for (const cle of cles) {
    if (!CHAMPS.includes(cle)) return `Champ non autorisé : ${cle}`;
  }

  if (requisTous) {
    for (const champ of CHAMPS) {
      if (!(champ in corps)) return `Champ requis manquant : ${champ}`;
    }
  } else if (cles.length === 0) {
    return 'Au moins un champ est requis';
  }

  if ('postId' in corps && (!Number.isInteger(corps.postId) || corps.postId < 1)) {
    return 'postId doit être un entier >= 1';
  }
  if ('name' in corps && (typeof corps.name !== 'string' || corps.name.length < 1 || corps.name.length > 100)) {
    return 'name doit être un texte de 1 à 100 caractères';
  }
  if ('email' in corps && (typeof corps.email !== 'string' || corps.email.length > 100 || !EMAIL.test(corps.email))) {
    return 'email doit être une adresse valide de 100 caractères au plus';
  }
  if ('body' in corps && (typeof corps.body !== 'string' || corps.body.length < 1 || corps.body.length > 500)) {
    return 'body doit être un texte de 1 à 500 caractères';
  }

  return null;
}

router.get('/posts', (ctx) => {
  const { postId } = ctx.query;

  if (postId === undefined) {
    ctx.body = posts;
    return;
  }

  const n = Number(postId);
  if (!Number.isInteger(n) || n < 1) {
    ctx.status = 400;
    ctx.body = { error: 'postId doit être un entier >= 1' };
    return;
  }

  ctx.body = posts.filter((p) => p.postId === n);
});

router.post('/posts', (ctx) => {
  const corps = ctx.request.body;
  const erreur = valider(corps, true);
  if (erreur) {
    ctx.status = 400;
    ctx.body = { error: erreur };
    return;
  }

  const post = { id: prochainId++, ...corps };
  posts.push(post);

  ctx.status = 201;
  ctx.set('Location', `/posts/${post.id}`);
  ctx.body = post;
});

router.get('/posts/:id', (ctx) => {
  const id = Number(ctx.params.id);
  const post = posts.find((p) => p.id === id);

  if (!post) {
    ctx.status = 404;
    ctx.body = { error: 'Post introuvable' };
    return;
  }

  ctx.body = post;
});

router.delete('/posts/:id', (ctx) => {
  const id = Number(ctx.params.id);
  const index = posts.findIndex((p) => p.id === id);

  if (index === -1) {
    ctx.status = 404;
    ctx.body = { error: 'Post introuvable' };
    return;
  }

  posts.splice(index, 1);
  ctx.status = 204;
});

router.put('/posts/:id', (ctx) => {
  const id = Number(ctx.params.id);
  const index = posts.findIndex((p) => p.id === id);

  if (index === -1) {
    ctx.status = 404;
    ctx.body = { error: 'Post introuvable' };
    return;
  }

  const corps = ctx.request.body;
  const erreur = valider(corps, true);
  if (erreur) {
    ctx.status = 400;
    ctx.body = { error: erreur };
    return;
  }

  posts[index] = { id, ...corps };
  ctx.body = posts[index];
});

router.patch('/posts/:id', (ctx) => {
  const id = Number(ctx.params.id);
  const index = posts.findIndex((p) => p.id === id);

  if (index === -1) {
    ctx.status = 404;
    ctx.body = { error: 'Post introuvable' };
    return;
  }

  const corps = ctx.request.body;
  const erreur = valider(corps, false);
  if (erreur) {
    ctx.status = 400;
    ctx.body = { error: erreur };
    return;
  }

  Object.assign(posts[index], corps);
  ctx.body = posts[index];
});

app.use(async (ctx, next) => {
  try {
    await next();

    if (ctx.status === 404 && ctx.body === undefined) {
      ctx.body = { error: 'Route introuvable' };
    }
  } catch (err) {
    const status = err.status || 500;
    ctx.status = status;
    ctx.body = {
      error: status >= 500 ? 'Erreur interne du serveur' : err.message,
    };
  }
});

// 2. Body parser : JSON cassé -> 400, corps trop gros -> 413
app.use(
  bodyParser({
    enableTypes: ['json'],
    jsonLimit: '10kb',
    onerror: (err, ctx) => {
      if (err.status === 413) ctx.throw(413, 'Corps trop gros');
      ctx.throw(400, 'JSON invalide');
    },
  })
);


app.use(router.routes());
app.use(router.allowedMethods());


app.listen(3000, () => console.log('Serveur sur http://localhost:3000'));