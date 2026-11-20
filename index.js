const Koa = require('koa');
const Router = require('@koa/router');

const app = new Koa();
const router = new Router();

const exemple = [
  { id: 1, title: 'exemple', bool: true },
  { id: 2, title: 'exemple2', bool: false },
];

router.get('/', (ctx) => {
  ctx.body = 'Hello World';
});

router.get('/infos', (ctx) => {
  ctx.body = {
    method: ctx.method,
    path: ctx.path,
    query: ctx.query,
    userAgent: ctx.get('User-Agent'),
  };
});

router.get('/texte', (ctx) => {
  ctx.body = 'Bonjour en texte';
});

router.get('/json', (ctx) => {
  ctx.body = { message: 'Bonjour en JSON' };
});

router.get('/vide', (ctx) => {
  ctx.status = 204;
});

router.get('/cree', (ctx) => {
  ctx.status = 201;
  ctx.set('Location', '/examples/1');
  ctx.body = { id: 1 };
});

router.get('/examples', (ctx) => {
  const { bool } = ctx.query;

  if (bool) {
    ctx.body = exemple.filter((e) => String(e.bool) === bool);
  } else {
    ctx.body = exemple;
  }
});

router.get('/examples/count', (ctx) => {
  ctx.body = { count: exemple.length };
});


router.get('/examples/:id', (ctx) => {
  const item = exemple.find((e) => e.id === Number(ctx.params.id));
  if (!item) {
    ctx.status = 404;
    ctx.body = { error: 'Ressource introuvable' };
    return;
  }
  ctx.body = item;
});



app.use(router.routes());
app.use(router.allowedMethods());

app.listen(3000, () => console.log('Serveur sur http://localhost:3000'));