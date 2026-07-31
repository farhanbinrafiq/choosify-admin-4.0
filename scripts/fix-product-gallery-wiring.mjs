import fs from 'fs';

const p = 'C:/Users/User/Projects/choosify-admin-4.0/public/cms-mirror/app.html';
let app = fs.readFileSync(p, 'utf8');

const setFieldName =
  "setField_name: this.setField('name'), setField_brand: this.setField('brand'), setField_category: this.setField('category'),";
const productExtras = `uploadProductImage_main: this.uploadProductImageField('image'),
      uploadProductImage_gallery1: this.uploadProductImageField('gallery1'),
      uploadProductImage_gallery2: this.uploadProductImageField('gallery2'),
      uploadProductImage_gallery3: this.uploadProductImageField('gallery3'),
      uploadProductImage_gallery4: this.uploadProductImageField('gallery4'),
      uploadProductImage_videoCover: this.uploadProductImageField('videoCover'),
      uploadProductImage_sizeGuide: this.uploadProductImageField('sizeGuideImageUrl'),
      setField_videoUrl: this.setField('videoUrl'),
      `;

if (!app.includes("uploadProductImage_main: this.uploadProductImageField")) {
  if (!app.includes(setFieldName)) throw new Error('setField_name line missing');
  app = app.replace(setFieldName, productExtras + setFieldName);
  console.log('wired product uploads');
}

const oldEp = 'editingProduct: this.state.editingProduct ? {...this.state.editingProduct, feeBreakdown:';
const newEp =
  'editingProduct: this.state.editingProduct ? {...this.state.editingProduct, hasMainImage: !!(this.state.editingProduct.image), hasGallery1: !!(this.state.editingProduct.gallery1), hasGallery2: !!(this.state.editingProduct.gallery2), hasGallery3: !!(this.state.editingProduct.gallery3), hasGallery4: !!(this.state.editingProduct.gallery4), hasVideoCover: !!(this.state.editingProduct.videoCover), hasSizeGuideImage: !!(this.state.editingProduct.sizeGuideImageUrl), feeBreakdown:';
if (app.includes(oldEp) && !app.includes('hasMainImage:')) {
  app = app.replace(oldEp, newEp);
  console.log('wired hasMainImage flags');
}

// Move size guide after product gallery+core identity block
const sizeMarker = '        <!-- SIZE GUIDE (catalog product-detail) -->';
const galleryHeading = 'Product Gallery</div>';
const si = app.indexOf(sizeMarker);
console.log('sizeIdx', si);

if (si >= 0) {
  // Extract size guide card (from marker through its closing </div>\n\n or next major section)
  const sizeStart = si;
  // find end of size guide outer div: after rows textarea and </div>
  const rowsNeedle = 'Rows: Size|Chest|Waist|Hip';
  const rowsIdx = app.indexOf(rowsNeedle, sizeStart);
  const sizeEnd = app.indexOf('</div>', app.indexOf('</textarea>', rowsIdx)) + '</div>'.length;
  const sizeBlock = app.slice(sizeStart, sizeEnd);
  app = app.slice(0, sizeStart) + app.slice(sizeEnd).replace(/^\s*\n+/, '\n');
  console.log('extracted size guide len', sizeBlock.length);

  // Insert after core product profile card that contains PRODUCT CATALOG SKU NAME
  const sku = 'PRODUCT CATALOG SKU NAME';
  const skuIdx = app.indexOf(sku);
  if (skuIdx < 0) throw new Error('SKU section missing');
  // Find the opening div of that card, then find matching close after description/stock section —
  // simpler: insert before next section titled ADD-ONS or VARIANT or OVERVIEW quality
  const nextSectionCandidates = [
    'ADDITIONAL PRODUCT DETAILS',
    'VARIANT / OPTION GROUPS',
    'overviewQualityText',
    'PRODUCT VARIANTS',
    'Add-ons',
    'ADD-ONS',
  ];
  let insertAt = -1;
  for (const c of nextSectionCandidates) {
    const idx = app.indexOf(c, skuIdx);
    if (idx > 0) {
      insertAt = app.lastIndexOf(
        '<div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:22px;margin-bottom:16px">',
        idx,
      );
      if (insertAt > skuIdx) break;
    }
  }
  if (insertAt < 0) {
    // fallback: after the gallery/core card — find closing after stock field
    const stock = 'STOCK (REQUIRED)';
    const stockIdx = app.indexOf(stock, skuIdx);
    // walk forward to find a blank line + next card
    insertAt = app.indexOf(
      '\n        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:22px;margin-bottom:16px">',
      stockIdx,
    );
  }
  if (insertAt < 0) throw new Error('Could not find insert point for size guide');
  app = app.slice(0, insertAt) + '\n' + sizeBlock + '\n' + app.slice(insertAt);
  console.log('moved size guide after gallery/core');
}

// Clean orphaned comment if present before gallery
app = app.replace(
  '        <!-- CORE PRODUCT PROFILE — gallery first (storefront order) -->\n        \n\n<div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:22px;margin-bottom:16px">\n          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">\n            <div style="display:flex;gap:12px">\n              <div style="width:34px;height:34px;border-radius:8px;background:rgba(255,91,0,0.12);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">🖼</div>\n              <div>\n                <div style="font-size:10px;font-weight:800;color:#9CA3AF;letter-spacing:0.05em">PRIMARY PRESENTATION</div>\n                <div style="font-size:14.5px;font-weight:800;margin-top:2px">Product Gallery</div>',
  '        <!-- CORE PRODUCT PROFILE — gallery first (storefront order) -->\n        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:22px;margin-bottom:16px">\n          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">\n            <div style="display:flex;gap:12px">\n              <div style="width:34px;height:34px;border-radius:8px;background:rgba(255,91,0,0.12);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">🖼</div>\n              <div>\n                <div style="font-size:10px;font-weight:800;color:#9CA3AF;letter-spacing:0.05em">PRIMARY PRESENTATION</div>\n                <div style="font-size:14.5px;font-weight:800;margin-top:2px">Product Gallery</div>',
);

fs.writeFileSync(p, app);
console.log('done', app.length);
