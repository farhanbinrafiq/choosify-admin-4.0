import fs from 'fs';

const p = 'C:/Users/User/Projects/choosify-admin-4.0/public/cms-mirror/app.html';
let app = fs.readFileSync(p, 'utf8');

const start = app.indexOf('        <!-- CORE PRODUCT PROFILE — gallery first (storefront order) -->');
const overviewEndMarker = '        <!-- BEST FOR TAGS -->';
const end = app.indexOf(overviewEndMarker);
if (start < 0 || end < 0) throw new Error('markers not found ' + start + ' ' + end);

const intro = `        <!-- PRODUCT STUDIO — storefront-aligned section cards -->
        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:14px 20px;margin-bottom:16px">
          <div style="font-size:10px;font-weight:800;color:#FF5B00;letter-spacing:0.05em">STOREFRONT PRODUCT PAGE</div>
          <div style="font-size:14.5px;font-weight:800;margin-top:2px">Edit sections in storefront order</div>
          <div style="font-size:11px;color:#9CA3AF;font-weight:600;margin-top:2px">Gallery → Identity → Variants → Checkout → Size Guide → Specs → Creator Reviews → Overview · Views/saves/orders &amp; customer reviews are storefront-only</div>
        </div>

`;

const gallery = `        <!-- 1. Product Gallery -->
        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:12px;padding:20px;margin-bottom:16px">
          <div style="font-size:10px;font-weight:800;color:#FF5B00;letter-spacing:0.05em;margin-bottom:4px">1. PRODUCT GALLERY</div>
          <div style="font-size:14.5px;font-weight:800;margin-bottom:14px">Hero media — photos &amp; video</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div>
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">MAIN PRODUCT PHOTO</div>
              <div style="height:150px;border-radius:10px;border:1px solid #E8EDF2;overflow:hidden;background:#F9FAFB;margin-bottom:8px;display:flex;align-items:center;justify-content:center">
                <sc-if value="{{ editingProduct.hasMainImage }}" hint-placeholder-val="{{ false }}">
                  <img src="{{ editingProduct.image }}" alt="Main" style="width:100%;height:100%;object-fit:cover">
                </sc-if>
                <sc-if value="{{ !editingProduct.hasMainImage }}" hint-placeholder-val="{{ true }}">
                  <span style="font-size:12px;color:#9CA3AF;font-weight:600">No photo yet</span>
                </sc-if>
              </div>
              <button sc-camel-on-click="{{ uploadProductImage_main }}" style="background:#fff;border:1px solid #E8EDF2;border-radius:8px;padding:8px 12px;font-size:11.5px;font-weight:800;cursor:pointer;margin-bottom:12px">Choose file</button>
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">GALLERY THUMBS</div>
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px">
                <div style="height:56px;border-radius:8px;border:1px solid #E8EDF2;overflow:hidden;background:#F9FAFB;display:flex;align-items:center;justify-content:center"><sc-if value="{{ editingProduct.hasGallery1 }}" hint-placeholder-val="{{ false }}"><img src="{{ editingProduct.gallery1 }}" style="width:100%;height:100%;object-fit:cover"></sc-if><sc-if value="{{ !editingProduct.hasGallery1 }}" hint-placeholder-val="{{ true }}"><span style="color:#9CA3AF;font-size:14px">+</span></sc-if></div>
                <div style="height:56px;border-radius:8px;border:1px solid #E8EDF2;overflow:hidden;background:#F9FAFB;display:flex;align-items:center;justify-content:center"><sc-if value="{{ editingProduct.hasGallery2 }}" hint-placeholder-val="{{ false }}"><img src="{{ editingProduct.gallery2 }}" style="width:100%;height:100%;object-fit:cover"></sc-if><sc-if value="{{ !editingProduct.hasGallery2 }}" hint-placeholder-val="{{ true }}"><span style="color:#9CA3AF;font-size:14px">+</span></sc-if></div>
                <div style="height:56px;border-radius:8px;border:1px solid #E8EDF2;overflow:hidden;background:#F9FAFB;display:flex;align-items:center;justify-content:center"><sc-if value="{{ editingProduct.hasGallery3 }}" hint-placeholder-val="{{ false }}"><img src="{{ editingProduct.gallery3 }}" style="width:100%;height:100%;object-fit:cover"></sc-if><sc-if value="{{ !editingProduct.hasGallery3 }}" hint-placeholder-val="{{ true }}"><span style="color:#9CA3AF;font-size:14px">+</span></sc-if></div>
                <div style="height:56px;border-radius:8px;border:1px solid #E8EDF2;overflow:hidden;background:#F9FAFB;display:flex;align-items:center;justify-content:center"><sc-if value="{{ editingProduct.hasGallery4 }}" hint-placeholder-val="{{ false }}"><img src="{{ editingProduct.gallery4 }}" style="width:100%;height:100%;object-fit:cover"></sc-if><sc-if value="{{ !editingProduct.hasGallery4 }}" hint-placeholder-val="{{ true }}"><span style="color:#9CA3AF;font-size:14px">+</span></sc-if></div>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button sc-camel-on-click="{{ uploadProductImage_gallery1 }}" style="background:#fff;border:1px solid #E8EDF2;border-radius:7px;padding:6px 10px;font-size:10.5px;font-weight:800;cursor:pointer">Thumb 1</button>
                <button sc-camel-on-click="{{ uploadProductImage_gallery2 }}" style="background:#fff;border:1px solid #E8EDF2;border-radius:7px;padding:6px 10px;font-size:10.5px;font-weight:800;cursor:pointer">Thumb 2</button>
                <button sc-camel-on-click="{{ uploadProductImage_gallery3 }}" style="background:#fff;border:1px solid #E8EDF2;border-radius:7px;padding:6px 10px;font-size:10.5px;font-weight:800;cursor:pointer">Thumb 3</button>
                <button sc-camel-on-click="{{ uploadProductImage_gallery4 }}" style="background:#fff;border:1px solid #E8EDF2;border-radius:7px;padding:6px 10px;font-size:10.5px;font-weight:800;cursor:pointer">Thumb 4</button>
              </div>
            </div>
            <div>
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">VIDEO COVER (optional upload)</div>
              <div style="height:150px;border-radius:10px;border:1px solid #E8EDF2;overflow:hidden;background:#F9FAFB;margin-bottom:8px;display:flex;align-items:center;justify-content:center">
                <sc-if value="{{ editingProduct.hasVideoCover }}" hint-placeholder-val="{{ false }}">
                  <img src="{{ editingProduct.videoCover }}" alt="Video cover" style="width:100%;height:100%;object-fit:cover">
                </sc-if>
                <sc-if value="{{ !editingProduct.hasVideoCover }}" hint-placeholder-val="{{ true }}">
                  <span style="font-size:12px;color:#9CA3AF;font-weight:600">No cover yet</span>
                </sc-if>
              </div>
              <button sc-camel-on-click="{{ uploadProductImage_videoCover }}" style="background:#fff;border:1px solid #E8EDF2;border-radius:8px;padding:8px 12px;font-size:11.5px;font-weight:800;cursor:pointer;margin-bottom:10px">Choose file</button>
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">EMBEDDED VIDEO URL</div>
              <input value="{{ editingProduct.videoUrl }}" sc-camel-on-change="{{ setField_videoUrl }}" placeholder="Paste YouTube / MP4 HTTPS URL..." style="width:100%;box-sizing:border-box;height:38px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12.5px">
            </div>
          </div>
        </div>

`;

const identity = `        <!-- 2. Identity & Pricing -->
        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:12px;padding:20px;margin-bottom:16px">
          <div style="font-size:10px;font-weight:800;color:#FF5B00;letter-spacing:0.05em;margin-bottom:4px">2. IDENTITY &amp; PRICING</div>
          <div style="font-size:14.5px;font-weight:800;margin-bottom:6px">Title, brand, price &amp; stock</div>
          <div style="font-size:11.5px;color:#9CA3AF;font-weight:600;margin-bottom:14px">Views, saves, shares, and orders update on the storefront automatically — not edited here.</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
            <div>
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">PRODUCT TITLE / SKU NAME</div>
              <input value="{{ editingProduct.name }}" sc-camel-on-change="{{ setField_name }}" placeholder="e.g. Used iPhone 13 — Excellent Condition" style="width:100%;box-sizing:border-box;height:40px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:13px">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
              <div>
                <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">BRAND</div>
                <input value="{{ editingProduct.brand }}" sc-camel-on-change="{{ setField_brand }}" placeholder="Brand" style="width:100%;box-sizing:border-box;height:40px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:13px">
              </div>
              <div>
                <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">CATEGORY</div>
                <input value="{{ editingProduct.category }}" sc-camel-on-change="{{ setField_category }}" placeholder="Category" style="width:100%;box-sizing:border-box;height:40px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:13px">
              </div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px">
            <div>
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">ACTUAL PRICE (৳)</div>
              <input value="{{ editingProduct.price }}" sc-camel-on-change="{{ setField_price }}" style="width:100%;box-sizing:border-box;height:40px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:13px">
            </div>
            <div>
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">SALE PRICE (৳)</div>
              <input value="{{ editingProduct.salePrice }}" sc-camel-on-change="{{ setField_salePrice }}" style="width:100%;box-sizing:border-box;height:40px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:13px">
            </div>
            <div>
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">STOCK (REQUIRED)</div>
              <input value="{{ editingProduct.stock }}" sc-camel-on-change="{{ setField_stock }}" placeholder="Units in stock" style="width:100%;box-sizing:border-box;height:40px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:13px">
            </div>
          </div>
          <sc-if value="{{ editingProduct.feeBreakdown.hasLines }}" hint-placeholder-val="{{ false }}">
            <div style="background:#F9FAFB;border:1px solid #E8EDF2;border-radius:8px;padding:14px 16px;margin-bottom:16px">
              <div style="font-size:10px;font-weight:800;color:#9CA3AF;letter-spacing:0.05em;margin-bottom:8px">PLATFORM FEES APPLIED (SET BY ADMIN)</div>
              <sc-for list="{{ editingProduct.feeBreakdown.lines }}" as="fl" hint-placeholder-count="2">
                <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;color:#6B7280;margin-bottom:4px"><span>{{ fl.label }} ({{ fl.valueLabel }})</span><span>+৳{{ fl.amount }}</span></div>
              </sc-for>
              <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;border-top:1px dashed #E8EDF2;padding-top:6px;margin-top:4px"><span>Customer pays</span><span>৳{{ editingProduct.feeBreakdown.finalPrice }}</span></div>
              <div style="font-size:10px;color:#9CA3AF;font-weight:600;margin-top:4px">You still receive your full listed price of ৳{{ editingProduct.feeBreakdown.basePrice }}.</div>
            </div>
          </sc-if>
          <div>
            <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">PRODUCT BIO / SHORT DESCRIPTION</div>
            <textarea value="{{ editingProduct.description }}" sc-camel-on-change="{{ setField_description }}" rows="3" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #E8EDF2;padding:10px 12px;font-size:13px;resize:vertical"></textarea>
          </div>
        </div>

`;

// Extract existing blocks from old region for reuse
const old = app.slice(start, end);

function extractBlock(html, startMarker, nextMarkers) {
  const i = html.indexOf(startMarker);
  if (i < 0) throw new Error('missing ' + startMarker);
  let j = html.length;
  for (const m of nextMarkers) {
    const k = html.indexOf(m, i + startMarker.length);
    if (k >= 0 && k < j) j = k;
  }
  return html.slice(i, j);
}

const sizeGuide = extractBlock(old, '        <!-- SIZE GUIDE', ['        <!-- ADD-ON ITEMS -->']);
const addons = extractBlock(old, '        <!-- ADD-ON ITEMS -->', ['        <!-- VARIANTS -->']);
const variants = extractBlock(old, '        <!-- VARIANTS -->', ['        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:20px;margin-bottom:16px">\n          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">\n            <div>\n              <div style="font-size:10px;font-weight:800;color:#9CA3AF;letter-spacing:0.05em">CHECKOUT</div>']);
const partialPay = extractBlock(old, '        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:20px;margin-bottom:16px">\n          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">\n            <div>\n              <div style="font-size:10px;font-weight:800;color:#9CA3AF;letter-spacing:0.05em">CHECKOUT</div>', ['        <!-- ADDITIONAL SPECS -->']);
const addlSpecs = extractBlock(old, '        <!-- ADDITIONAL SPECS -->', ['        <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-bottom:16px;align-items:start">']);
const creatorAndPrice = extractBlock(old, '        <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px;margin-bottom:16px;align-items:start">', ['        <div style="display:grid;grid-template-columns:1fr;gap:16px;margin-bottom:16px;align-items:start">']);
const specsBlock = extractBlock(old, '        <div style="display:grid;grid-template-columns:1fr;gap:16px;margin-bottom:16px;align-items:start">', ['        <!-- BOX CONTENTS -->']);
const boxContents = extractBlock(old, '        <!-- BOX CONTENTS -->', ['        <!-- PRODUCT OVERVIEW -->']);
const overview = extractBlock(old, '        <!-- PRODUCT OVERVIEW -->', ['        <!-- BEST FOR TAGS -->']);

const checkout = `        <!-- 4. Checkout actions -->
        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:12px;padding:20px;margin-bottom:16px">
          <div style="font-size:10px;font-weight:800;color:#FF5B00;letter-spacing:0.05em;margin-bottom:4px">4. CHECKOUT ACTIONS</div>
          <div style="font-size:14.5px;font-weight:800;margin-bottom:14px">Buy box toggles &amp; payment</div>
          <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:10px">ENABLED INTERACTIVE CHECKOUT ACTIONS</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;margin-bottom:18px">
            <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12.5px;font-weight:700">Enable 'FIND IN STORE' map search trigger</span><input type="checkbox" checked="{{ editingProduct.checkout.findInStore }}" sc-camel-on-change="{{ toggleCheckoutFindInStore }}"></div>
            <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12.5px;font-weight:700">Enable 'BUY ONLINE' direct portal</span><input type="checkbox" checked="{{ editingProduct.checkout.buyOnline }}" sc-camel-on-change="{{ toggleCheckoutBuyOnline }}"></div>
            <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12.5px;font-weight:700">Enable 'HEART LOVE' stats counter</span><input type="checkbox" checked="{{ editingProduct.checkout.heartLove }}" sc-camel-on-change="{{ toggleCheckoutHeartLove }}"></div>
            <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12.5px;font-weight:700">Enable 'WISHLIST' catalog bookmarking</span><input type="checkbox" checked="{{ editingProduct.checkout.wishlist }}" sc-camel-on-change="{{ toggleCheckoutWishlist }}"></div>
            <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12.5px;font-weight:700">Enable 'DIGITAL CHAT WITH SELLER' assistant</span><input type="checkbox" checked="{{ editingProduct.checkout.chatSeller }}" sc-camel-on-change="{{ toggleCheckoutChatSeller }}"></div>
            <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12.5px;font-weight:700">Enable 'REQUEST BULK QUOTE' document module</span><input type="checkbox" checked="{{ editingProduct.checkout.bulkQuote }}" sc-camel-on-change="{{ toggleCheckoutBulkQuote }}"></div>
            <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12.5px;font-weight:700">Enable 'PRE ORDER' billing toggle</span><input type="checkbox" checked="{{ editingProduct.checkout.preOrder }}" sc-camel-on-change="{{ toggleCheckoutPreOrder }}"></div>
          </div>
${partialPay.replace('CHECKOUT', 'PARTIAL / ADVANCE PAYMENT').replace('💳 Advance / Partial Payment', 'Advance / Partial Payment')}
        </div>

`;

// Fix: I nested partialPay incorrectly - partialPay is a full card. Let me not nest it inside checkout.
// Rebuild checkout without nesting partialPay inside wrongly.

const checkoutFixed = `        <!-- 4. Checkout actions -->
        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:12px;padding:20px;margin-bottom:16px">
          <div style="font-size:10px;font-weight:800;color:#FF5B00;letter-spacing:0.05em;margin-bottom:4px">4. CHECKOUT ACTIONS</div>
          <div style="font-size:14.5px;font-weight:800;margin-bottom:14px">Buy box toggles (Add to Cart / Buy Now)</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 24px">
            <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12.5px;font-weight:700">Enable 'FIND IN STORE' map search trigger</span><input type="checkbox" checked="{{ editingProduct.checkout.findInStore }}" sc-camel-on-change="{{ toggleCheckoutFindInStore }}"></div>
            <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12.5px;font-weight:700">Enable 'BUY ONLINE' direct portal</span><input type="checkbox" checked="{{ editingProduct.checkout.buyOnline }}" sc-camel-on-change="{{ toggleCheckoutBuyOnline }}"></div>
            <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12.5px;font-weight:700">Enable 'HEART LOVE' stats counter</span><input type="checkbox" checked="{{ editingProduct.checkout.heartLove }}" sc-camel-on-change="{{ toggleCheckoutHeartLove }}"></div>
            <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12.5px;font-weight:700">Enable 'WISHLIST' catalog bookmarking</span><input type="checkbox" checked="{{ editingProduct.checkout.wishlist }}" sc-camel-on-change="{{ toggleCheckoutWishlist }}"></div>
            <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12.5px;font-weight:700">Enable 'DIGITAL CHAT WITH SELLER' assistant</span><input type="checkbox" checked="{{ editingProduct.checkout.chatSeller }}" sc-camel-on-change="{{ toggleCheckoutChatSeller }}"></div>
            <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12.5px;font-weight:700">Enable 'REQUEST BULK QUOTE' document module</span><input type="checkbox" checked="{{ editingProduct.checkout.bulkQuote }}" sc-camel-on-change="{{ toggleCheckoutBulkQuote }}"></div>
            <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12.5px;font-weight:700">Enable 'PRE ORDER' billing toggle</span><input type="checkbox" checked="{{ editingProduct.checkout.preOrder }}" sc-camel-on-change="{{ toggleCheckoutPreOrder }}"></div>
          </div>
        </div>

`;

const variantsLabeled = variants
  .replace(
    'WORKS FOR ANY INDUSTRY — CLOTHING SIZES, TECH STORAGE, HOTEL ROOM TYPES, ETC.',
    '3. VARIANTS'
  )
  .replace(
    '🎨 Product Options &amp; Variants',
    'Product Options &amp; Variants'
  );

const sizeLabeled = sizeGuide.replace(
  '        <!-- SIZE GUIDE (catalog product-detail) -->\n        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:22px;margin-bottom:16px">\n          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">\n            <div>\n              <div style="font-size:10px;font-weight:800;color:#FF5B00;letter-spacing:0.05em">SIZE GUIDE</div>',
  '        <!-- 5. SIZE GUIDE -->\n        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:12px;padding:20px;margin-bottom:16px">\n          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">\n            <div>\n              <div style="font-size:10px;font-weight:800;color:#FF5B00;letter-spacing:0.05em">5. SIZE GUIDE</div>'
);

const specsLabeled = specsBlock
  .replace('PRODUCT CORE PARAMETERS', '6. PRODUCT SPECIFICATIONS')
  .replace('>Specifications</div>', '>Specifications</div>');

const creatorLabeled = creatorAndPrice
  .replace('VIDEO REVIEWS FROM CREATORS', '7. CREATOR REVIEWS')
  .replace('🎬 Creator Reviews', 'Creator Reviews')
  .replace('COMPARATIVE PRICING DEALS', 'PRICE ACROSS STORES');

const overviewLabeled = overview
  .replace('VISUAL SOURCING STORYBOARDS', '8. PRODUCT DETAILS / OVERVIEW')
  .replace('Product Overview', 'Product Overview');

const boxLabeled = boxContents
  .replace('INCLUDED ACCESSORIES &amp; PACKAGES', 'BOX CONTENTS')
  .replace('📦 Box Contents / Complimentary Features', 'Box Contents / Complimentary Features');

const addonsLabeled = addons
  .replace('BUY BOX UPSELLS', 'ADD-ON ITEMS')
  .replace('➕ Add-on Items', 'Add-on Items');

const partialLabeled = partialPay
  .replace(
    '<div style="font-size:10px;font-weight:800;color:#9CA3AF;letter-spacing:0.05em">CHECKOUT</div>\n              <div style="font-size:14.5px;font-weight:800;margin-top:2px">💳 Advance / Partial Payment</div>',
    '<div style="font-size:10px;font-weight:800;color:#FF5B00;letter-spacing:0.05em">PARTIAL PAYMENT</div>\n              <div style="font-size:14.5px;font-weight:800;margin-top:2px">Advance / Partial Payment</div>'
  );

const rebuilt =
  intro +
  gallery +
  identity +
  variantsLabeled +
  checkoutFixed +
  partialLabeled +
  sizeLabeled +
  specsLabeled +
  addlSpecs +
  creatorLabeled +
  overviewLabeled +
  boxLabeled +
  addonsLabeled;

app = app.slice(0, start) + rebuilt + app.slice(end);

// Header hint under product studio title
app = app.replace(
  `              <div style="font-size:15px;font-weight:800;margin-top:2px">{{ studioHeading }}</div>
            </div>
          </div>
          <div style="display:flex;gap:10px">
            <button sc-camel-on-click="{{ saveProduct }}" style="background:#fff;border:1px solid #E8EDF2;border-radius:8px;padding:10px 16px;font-size:11.5px;font-weight:700;color:#374151;cursor:pointer">Save Draft</button>`,
  `              <div style="font-size:15px;font-weight:800;margin-top:2px">{{ studioHeading }}</div>
              <div style="font-size:11px;color:#9CA3AF;font-weight:600;margin-top:2px">Product Studio · Gallery → Specs → Creator Reviews → Overview</div>
            </div>
          </div>
          <div style="display:flex;gap:10px">
            <button sc-camel-on-click="{{ saveProduct }}" style="background:#fff;border:1px solid #E8EDF2;border-radius:8px;padding:10px 16px;font-size:11.5px;font-weight:700;color:#374151;cursor:pointer">Save Draft</button>`
);

fs.writeFileSync(p, app);

const ps = app.indexOf('<!-- ===== PRODUCT STUDIO');
const pe = app.indexOf('<!-- =====', ps + 20);
const product = app.slice(ps, pe);
console.log({
  gallery: product.indexOf('1. PRODUCT GALLERY'),
  identity: product.indexOf('2. IDENTITY'),
  variants: product.indexOf('3. VARIANTS'),
  checkout: product.indexOf('4. CHECKOUT'),
  size: product.indexOf('5. SIZE GUIDE'),
  specs: product.indexOf('6. PRODUCT SPECIFICATIONS'),
  creator: product.indexOf('7. CREATOR REVIEWS'),
  overview: product.indexOf('8. PRODUCT DETAILS'),
  publicReviews: product.indexOf('PUBLIC REVIEWS'),
  orderOk:
    product.indexOf('1. PRODUCT GALLERY') < product.indexOf('2. IDENTITY') &&
    product.indexOf('2. IDENTITY') < product.indexOf('3. VARIANTS') &&
    product.indexOf('3. VARIANTS') < product.indexOf('4. CHECKOUT') &&
    product.indexOf('4. CHECKOUT') < product.indexOf('5. SIZE GUIDE') &&
    product.indexOf('5. SIZE GUIDE') < product.indexOf('6. PRODUCT SPECIFICATIONS') &&
    product.indexOf('6. PRODUCT SPECIFICATIONS') < product.indexOf('7. CREATOR REVIEWS') &&
    product.indexOf('7. CREATOR REVIEWS') < product.indexOf('8. PRODUCT DETAILS'),
});
