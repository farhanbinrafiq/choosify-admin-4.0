import fs from 'fs';

const appPath = 'C:/Users/User/Projects/choosify-admin-4.0/public/cms-mirror/app.html';
let app = fs.readFileSync(appPath, 'utf8');

// Remove Product Studio PUBLIC REVIEWS (view-only / storefront-driven)
const reviewsMarker = '        <!-- PUBLIC REVIEWS -->';
const boxMarker = '        <!-- BOX CONTENTS -->';
const rs = app.indexOf(reviewsMarker);
const be = app.indexOf(boxMarker);
if (rs < 0 || be < 0 || be < rs) {
  console.log('Public Reviews section already gone or markers mismatch', { rs, be });
} else {
  app = app.slice(0, rs) + app.slice(be);
  console.log('Removed Product Studio PUBLIC REVIEWS section');
}

// Tidy leftover empty comment stubs near gallery / size guide
app = app.replace(
  /        <!-- CORE PRODUCT PROFILE — gallery first \(storefront order\) -->\s*\n\s*\n\s*\n\s*\n/,
  '        <!-- CORE PRODUCT PROFILE — gallery first (storefront order) -->\n'
);
app = app.replace(
  /        <!-- ADD-ON ITEMS -->\s*\n\s*\n<!-- SIZE GUIDE/,
  '        <!-- SIZE GUIDE'
);
app = app.replace(
  /<\/div>\s*\n\s*\n<div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:20px;margin-bottom:16px">\s*\n          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">\s*\n            <div>\s*\n              <div style="font-size:10px;font-weight:800;color:#9CA3AF;letter-spacing:0.05em">BUY BOX UPSELLS<\/div>/,
  `</div>

        <!-- ADD-ON ITEMS -->
        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:20px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
            <div>
              <div style="font-size:10px;font-weight:800;color:#9CA3AF;letter-spacing:0.05em">BUY BOX UPSELLS</div>`
);

fs.writeFileSync(appPath, app);

const ps = app.indexOf('<!-- ===== PRODUCT STUDIO');
const pe = app.indexOf('<!-- =====', ps + 20);
const product = app.slice(ps, pe);
console.log({
  gallery: product.indexOf('Product Gallery'),
  sku: product.indexOf('PRODUCT CATALOG SKU'),
  size: product.indexOf('<!-- SIZE GUIDE'),
  publicReviews: product.indexOf('PUBLIC REVIEWS'),
  whatCustomers: app.includes('What Customers Say'),
});
