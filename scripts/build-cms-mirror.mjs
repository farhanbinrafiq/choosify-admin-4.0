import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const root = 'C:/Users/User/Projects/choosify-admin-4.0';
const srcHtml = 'c:/Users/User/Downloads/Choosify Admin CMS (standalone).html';
const ref = path.join(root, 'src/cms-mirror/_reference');
const pub = path.join(root, 'public/cms-mirror');

fs.mkdirSync(ref, { recursive: true });
fs.mkdirSync(pub, { recursive: true });

function extractBundler(type, html) {
  const marker = `type="__bundler/${type}">`;
  const start = html.indexOf(marker);
  if (start < 0) throw new Error('missing ' + type);
  const from = start + marker.length;
  const end = html.indexOf('</script>', from);
  return html.slice(from, end).trim();
}

// Re-extract if reference missing template
if (!fs.existsSync(path.join(ref, 'template.html')) && fs.existsSync(srcHtml)) {
  const c = fs.readFileSync(srcHtml, 'utf8');
  const template = JSON.parse(extractBundler('template', c));
  fs.writeFileSync(path.join(ref, 'template.html'), template);
  const manifest = JSON.parse(extractBundler('manifest', c));
  for (const [k, e] of Object.entries(manifest)) {
    let buf = Buffer.from(e.data, 'base64');
    if (e.compressed) buf = zlib.gunzipSync(buf);
    const mime = e.mime || '';
    let ext = 'bin';
    if (mime.includes('javascript')) ext = 'js';
    else if (mime.includes('svg')) ext = 'svg';
    else if (mime.includes('woff2')) ext = 'woff2';
    else if (mime.includes('webp')) ext = 'webp';
    fs.writeFileSync(path.join(ref, `${k}.${ext}`), buf);
  }
}

const copyMap = {
  '4a6a1b15-bb8e-4bf3-86de-63d0b824f516.js': 'dc-runtime.js',
  '257c4884-94b1-489f-81ce-8341b3d85c88.js': 'react.production.min.js',
  '5ad5b462-0b54-4029-b9d3-15c7be1be55c.js': 'react-dom.production.min.js',
  '48b1f74f-652c-4fc3-bbaa-6fa4b5d2e5a6.js': 'omelette.js',
};

for (const [src, dest] of Object.entries(copyMap)) {
  const p = path.join(ref, src);
  if (fs.existsSync(p)) fs.copyFileSync(p, path.join(pub, dest));
}

// Copy fonts/images
for (const f of fs.readdirSync(ref)) {
  if (/\.(woff2|svg|webp)$/i.test(f)) {
    fs.copyFileSync(path.join(ref, f), path.join(pub, f));
  }
}

// Omelette UUID aliases (x-import loads bare uuid)
const omeletteId = '48b1f74f-652c-4fc3-bbaa-6fa4b5d2e5a6';
if (fs.existsSync(path.join(pub, 'omelette.js'))) {
  fs.copyFileSync(path.join(pub, 'omelette.js'), path.join(pub, omeletteId));
  fs.copyFileSync(path.join(pub, 'omelette.js'), path.join(pub, `${omeletteId}.js`));
}

const template = fs.readFileSync(path.join(ref, 'template.html'), 'utf8');

const uuidToPublic = {};
for (const f of fs.readdirSync(pub)) {
  const m = f.match(/^([0-9a-f-]{36})\./i);
  if (m) uuidToPublic[m[1]] = '/cms-mirror/' + f;
}
uuidToPublic['4a6a1b15-bb8e-4bf3-86de-63d0b824f516'] = '/cms-mirror/dc-runtime.js';
uuidToPublic[omeletteId] = '/cms-mirror/omelette.js';

let body = template;
body = body.replace(/url\("([0-9a-f-]{36})"\)/gi, (full, id) =>
  uuidToPublic[id] ? `url("${uuidToPublic[id]}")` : full,
);
body = body.replace(/src="([0-9a-f-]{36})"/gi, (full, id) =>
  uuidToPublic[id] ? `src="${uuidToPublic[id]}"` : full,
);
body = body.replace(/<script src="\/cms-mirror\/dc-runtime\.js"><\/script>/gi, '');
body = body.replace(/<script src="[0-9a-f-]{36}"><\/script>/gi, '');

body = body.replace(
  "page: this.props.landingPage ?? 'dashboard'",
  "page: (typeof window!=='undefined' && window.__CMS_MIRROR_LANDING__) || this.props.landingPage || 'dashboard'",
);

// Login redesign lives on /login — remove from CMS sidebar
body = body.replace(
  /\s*\{title:'DESIGN PREVIEW', items:\[\{key:'loginPageDesign',label:'Login Page Redesign',tag:'NEW'\}\]\},?/g,
  '',
);

body = body.replace('const navDefs = [', 'let navDefs = [');
body = body.replace(
  "{title:'SETTINGS', items:[{key:'settings',label:'Settings'}]},\n    ];",
  `{title:'SETTINGS', items:[{key:'settings',label:'Settings'}]},
    ];
    navDefs = (typeof window.__CMS_MIRROR_FILTER_NAV__ === 'function')
      ? window.__CMS_MIRROR_FILTER_NAV__(navDefs, window.__CMS_MIRROR_ALLOWED_KEYS__)
      : navDefs;`,
);

body = body.replace(
  "setPage = (p) => this.setState({page: p, editingProduct: null, productsView: 'catalog'});",
  `setPage = (p) => {
      window.__CMS_MIRROR_INSTANCE__ = this;
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'cms-mirror-page', page: p }, '*');
        }
        history.replaceState(null, '', '#page=' + encodeURIComponent(p) + '&role=' + encodeURIComponent(window.__CMS_MIRROR_ROLE__ || 'super_admin'));
      } catch (e) {}
      var role = window.__CMS_MIRROR_ROLE__ || 'super_admin';
      var firstBrand = (Component.BRANDS && Component.BRANDS[0] && Component.BRANDS[0].name) || null;
      if (role === 'seller' && (p === 'brands' || p === 'brandProfile') && firstBrand) {
        this.setState({
          page: p,
          selectedBrandName: firstBrand,
          brandProfileTab: p === 'brands' ? 'portfolio' : (this.state.brandProfileTab === 'portfolio' ? 'account' : (this.state.brandProfileTab || 'account')),
          sellerBrandView: p === 'brands' ? 'portfolio' : 'profile',
          editingProduct: null,
          productsView: 'catalog',
          viewingClaimId: null,
        });
        return;
      }
      var firstCreator = (Component.CREATORS && Component.CREATORS[0] && Component.CREATORS[0].name) || null;
      if (role === 'creator' && (p === 'creators' || p === 'creatorProfile') && firstCreator) {
        this.setState({
          page: p,
          selectedCreatorName: firstCreator,
          creatorProfileTab: p === 'creators' ? 'studio' : (this.state.creatorProfileTab === 'studio' ? 'account' : (this.state.creatorProfileTab || 'account')),
          creatorMirrorView: p === 'creators' ? 'studio' : 'profile',
          editingProduct: null,
          productsView: 'catalog',
        });
        return;
      }
      this.setState({page: p, editingProduct: null, productsView: 'catalog'});
    };`,
);

// Append instance capture inside the x-dc script (after class Component closes)
body = body.replace(
  /(class Component extends DCLogic \{[\s\S]*?\n\}\s*)(<\/script>)/,
  `$1
; (function(){
  try {
    var prev = Component.prototype.componentDidMount;
    Component.prototype.componentDidMount = function(){
      window.__CMS_MIRROR_INSTANCE__ = this;
      if (typeof prev === 'function') prev.call(this);
      var pending = window.__CMS_MIRROR_PENDING__ || window.__CMS_MIRROR_LANDING__;
      if (pending) this.setPage(pending);
      window.__CMS_MIRROR_PENDING__ = null;
    };
  } catch (e) {}
})();
$2`,
);

const bridge = `
<script>
window.__CMS_MIRROR_ROLE_NAV__ = {
  super_admin: null,
  admin: null,
  seller: ['dashboard','brands','brandProfile','products','orders','sellerCustomers','returnsRefunds','promoCodes','messages','reviews','finance','courierProviders','shipmentOperations','courierAnalytics','myCashbook','settings'],
  creator: ['dashboard','creators','creatorProfile','contentStudio','creatorEconomy','messages','reviews','finance','myCashbook','settings'],
  moderator: ['dashboard','moderationCenter','reviews','messages'],
  finance_manager: ['dashboard','payouts','feeCharges','finance'],
  support_agent: ['dashboard','messages','reviews'],
  marketing_manager: ['dashboard','adsDealsStudio','promoCodes','websiteCmsStudio']
};
window.__CMS_MIRROR_FILTER_NAV__ = function(defs) {
  var role = window.__CMS_MIRROR_ROLE__ || 'super_admin';
  var allowed = window.__CMS_MIRROR_ROLE_NAV__[role];
  if (arguments.length > 1 && arguments[1]) allowed = arguments[1];
  if (!allowed) return defs;
  var mapped = defs.map(function(g) {
    return { title: g.title, items: (g.items || []).filter(function(it) { return allowed.indexOf(it.key) >= 0; }) };
  }).filter(function(g) { return g.items && g.items.length > 0; });
  if (role === 'seller') {
    return [
      {title:'OVERVIEW', items:[{key:'dashboard',label:'Dashboard'}]},
      {title:'BRAND & CATALOG', items:[
        {key:'brands',label:'Brand Management Studio'},
        {key:'brandProfile',label:'Brand Profile'},
        {key:'products',label:'Products & Inventory'}
      ]},
      {title:'COMMERCE', items:[
        {key:'orders',label:'Orders Hub'},
        {key:'sellerCustomers',label:'Seller Customers'},
        {key:'returnsRefunds',label:'Returns & Refunds'},
        {key:'promoCodes',label:'Promo Codes & Vouchers'}
      ]},
      {title:'LOGISTICS MANAGEMENT', items:[
        {key:'courierProviders',label:'Courier Providers'},
        {key:'shipmentOperations',label:'Shipment Operations'},
        {key:'courierAnalytics',label:'Courier Analytics'}
      ]},
      {title:'TRUST & SAFETY', items:[{key:'reviews',label:'Reviews'}]},
      {title:'COMMUNICATION', items:[{key:'messages',label:'Messages',tag:'12'}]},
      {title:'FINANCE', items:[
        {key:'finance',label:'Analytics'},
        {key:'myCashbook',label:'My Cashbook',tag:'PRIVATE'}
      ]},
      {title:'SETTINGS', items:[{key:'settings',label:'Settings'}]}
    ];
  }
  if (role === 'creator') {
    mapped = mapped.map(function(g) {
      var items = [];
      (g.items || []).forEach(function(it) {
        if (it.key === 'creators') {
          items.push({ key: 'creators', label: 'Creator Studio' });
          items.push({ key: 'creatorProfile', label: 'My Profile' });
        } else {
          items.push(it);
        }
      });
      return { title: g.title, items: items };
    });
  }
  return mapped;
};
(function(){
  function parseHash(){
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return { page: null, role: null };
    if (h.indexOf('=') >= 0) {
      var q = new URLSearchParams(h);
      return { page: q.get('page') || q.get('p'), role: q.get('role') };
    }
    return { page: h, role: null };
  }
  function pageFromHash(){ return parseHash().page; }
  var __boot = parseHash();
  window.__CMS_MIRROR_LANDING__ = __boot.page || 'dashboard';
  window.__CMS_MIRROR_PENDING__ = __boot.page || window.__CMS_MIRROR_PENDING__ || null;
  if (__boot.role) window.__CMS_MIRROR_ROLE__ = __boot.role;
  window.addEventListener('message', function(e){
    if (!e.data) return;
    if (e.data.type === 'cms-mirror-set-state') {
      if (e.data.role) window.__CMS_MIRROR_ROLE__ = e.data.role;
      if (e.data.allowedKeys) window.__CMS_MIRROR_ALLOWED_KEYS__ = e.data.allowedKeys;
      var page = e.data.page;
      if (page) {
        window.__CMS_MIRROR_PENDING__ = page;
        window.__CMS_MIRROR_LANDING__ = page;
        if (window.__CMS_MIRROR_INSTANCE__ && typeof window.__CMS_MIRROR_INSTANCE__.setPage === 'function') {
          window.__CMS_MIRROR_INSTANCE__.setPage(page);
          try { window.__CMS_MIRROR_INSTANCE__.forceUpdate && window.__CMS_MIRROR_INSTANCE__.forceUpdate(); } catch (err) {}
        } else {
          location.hash = 'page=' + encodeURIComponent(page) + '&role=' + encodeURIComponent(window.__CMS_MIRROR_ROLE__ || 'super_admin');
        }
      }
      return;
    }
    if (e.data.type !== 'cms-mirror-set-page') return;
    var page2 = e.data.page;
    window.__CMS_MIRROR_PENDING__ = page2;
    window.__CMS_MIRROR_LANDING__ = page2;
    if (window.__CMS_MIRROR_INSTANCE__ && typeof window.__CMS_MIRROR_INSTANCE__.setPage === 'function') {
      window.__CMS_MIRROR_INSTANCE__.setPage(page2);
      return;
    }
    if (pageFromHash() !== page2) {
      location.hash = 'page=' + encodeURIComponent(page2) + '&role=' + encodeURIComponent(window.__CMS_MIRROR_ROLE__ || 'super_admin');
    }
  });
  window.addEventListener('hashchange', function(){
    var parsed = parseHash();
    if (parsed.role) window.__CMS_MIRROR_ROLE__ = parsed.role;
    if (!parsed.page) return;
    window.__CMS_MIRROR_PENDING__ = parsed.page;
    if (window.__CMS_MIRROR_INSTANCE__) window.__CMS_MIRROR_INSTANCE__.setPage(parsed.page);
  });
  function findLogic(){
    var el = document.querySelector('x-dc');
    if (!el) return null;
    var key = Object.keys(el).find(function(k){ return k.indexOf('__reactFiber') === 0 || k.indexOf('__reactContainer') === 0; });
    if (!key) return null;
    var fiber = el[key];
    var q = [fiber];
    var guard = 0;
    while (q.length && guard++ < 200) {
      var f = q.shift();
      if (!f) continue;
      var sn = f.stateNode;
      if (sn && sn.logic && typeof sn.logic.setPage === 'function') return sn.logic;
      if (f.child) q.push(f.child);
      if (f.sibling) q.push(f.sibling);
    }
    return null;
  }
  var n = 0;
  var t = setInterval(function(){
    n++;
    var logic = findLogic();
    if (logic) {
      window.__CMS_MIRROR_INSTANCE__ = logic;
      var bootPage = window.__CMS_MIRROR_PENDING__ || window.__CMS_MIRROR_LANDING__;
      if (bootPage) {
        logic.setPage(bootPage);
        window.__CMS_MIRROR_PENDING__ = null;
      }
      clearInterval(t);
    }
    if (n > 100) clearInterval(t);
  }, 100);
})();
</script>
`;

if (body.includes('</x-dc>')) {
  body = body.replace('</x-dc>', bridge + '</x-dc>');
} else {
  body += bridge;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Choosify Admin CMS</title>
<script src="/cms-mirror/react.production.min.js"><\/script>
<script src="/cms-mirror/react-dom.production.min.js"><\/script>
<script src="/cms-mirror/dc-runtime.js"><\/script>
<script src="/cms-mirror/omelette.js"><\/script>
</head>
<body>
${body.includes('<body>') ? body.replace(/^[\s\S]*?<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '') : body}
</body>
</html>`;

fs.writeFileSync(path.join(pub, 'app.html'), html);
console.log('Built', path.join(pub, 'app.html'), html.length);
