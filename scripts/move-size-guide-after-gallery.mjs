import fs from 'fs';

const p = 'C:/Users/User/Projects/choosify-admin-4.0/public/cms-mirror/app.html';
let app = fs.readFileSync(p, 'utf8');

const sizeMarker = '        <!-- SIZE GUIDE (catalog product-detail) -->';
const sizeStart = app.indexOf(sizeMarker);
if (sizeStart < 0) throw new Error('size marker missing');

const rows = app.indexOf('editingProduct.sizeGuideRowsText', sizeStart);
const afterRowsTextarea = app.indexOf('</textarea>', rows) + '</textarea>'.length;
const sizeEnd = app.indexOf('</div>', afterRowsTextarea) + '</div>'.length;
const sizeBlock = app.slice(sizeStart, sizeEnd).trim();
app = app.slice(0, sizeStart) + app.slice(sizeEnd);
console.log('removed size block');

// Find gallery card and the end of the unified gallery+SKU core card
const galleryTitle = app.indexOf('Product Gallery</div>');
const stock = app.indexOf('STOCK (REQUIRED)', galleryTitle);
if (galleryTitle < 0 || stock < 0) throw new Error('gallery/stock missing');

// After stock + fee + description, the core card closes. Look for setField_description textarea end then closing divs.
const desc = app.indexOf('setField_description', stock);
const descTextareaEnd = app.indexOf('</textarea>', desc) + '</textarea>'.length;
// From here, skip fee sc-if closes and find the outer card close — next section often starts with margin-bottom:16px white card OR variants
let probe = descTextareaEnd;
let found = -1;
for (let n = 0; n < 30; n++) {
  const idx = app.indexOf('<div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:', probe);
  if (idx < 0) break;
  // ensure this is a top-level product studio card (indented with 8 spaces typically)
  const lineStart = app.lastIndexOf('\n', idx) + 1;
  const indent = app.slice(lineStart, idx);
  if (indent === '        ' && idx > stock) {
    found = idx;
    break;
  }
  probe = idx + 10;
}
if (found < 0) {
  // dump nearby for debug
  console.log(app.slice(descTextareaEnd, descTextareaEnd + 1200));
  throw new Error('insert point not found');
}

app = app.slice(0, found) + '\n' + sizeBlock + '\n\n' + app.slice(found);
fs.writeFileSync(p, app);

const ps = app.indexOf('<!-- ===== PRODUCT STUDIO');
const pe = app.indexOf('<!-- =====', ps + 20);
const product = app.slice(ps, pe);
console.log({
  gallery: product.indexOf('Product Gallery'),
  sku: product.indexOf('PRODUCT CATALOG SKU'),
  size: product.indexOf('<!-- SIZE GUIDE'),
});
