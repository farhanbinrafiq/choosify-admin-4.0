/**
 * Patches cms-mirror/app.html for studio profile API binding.
 * Run: node scripts/patch-studio-profile-editors.mjs
 */
import fs from 'fs';

const appPath = 'C:/Users/User/Projects/choosify-admin-4.0/public/cms-mirror/app.html';
let app = fs.readFileSync(appPath, 'utf8');

const SCRIPT_TAG = '<script src="./studio-profile-api.js?v=20260731-profile-1"></script>';
if (!app.includes('studio-profile-api.js')) {
  if (app.includes('</head>')) {
    app = app.replace('</head>', `  ${SCRIPT_TAG}\n</head>`);
  } else if (app.includes('<script')) {
    app = app.replace('<script', `${SCRIPT_TAG}\n<script`);
  } else {
    throw new Error('Could not find insertion point for studio-profile-api.js');
  }
  console.log('Inserted studio-profile-api.js');
}

const BRAND_EDITOR_HTML = `
        <!-- PROFILE FIELDS EDITOR (catalog-backed) -->
        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:12px;padding:20px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div>
              <div style="font-size:10px;font-weight:800;color:#FF5B00;letter-spacing:0.05em">STOREFRONT PROFILE FIELDS</div>
              <div style="font-size:14.5px;font-weight:800;margin-top:2px">Logo, Banner, Socials &amp; Overview</div>
            </div>
            <span style="font-size:11px;color:#9CA3AF;font-weight:600">Persists to /api/v1/catalog/brands</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
            <div>
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">LOGO URL</div>
              <input value="{{ selectedBrand.profileLogo }}" sc-camel-on-change="{{ selectedBrand.setProfileLogo }}" placeholder="https://..." style="width:100%;box-sizing:border-box;height:38px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12.5px">
            </div>
            <div>
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">BANNER / COVER URL</div>
              <input value="{{ selectedBrand.profileCover }}" sc-camel-on-change="{{ selectedBrand.setProfileCover }}" placeholder="https://..." style="width:100%;box-sizing:border-box;height:38px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12.5px">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
            <div>
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">TAGLINE</div>
              <input value="{{ selectedBrand.profileTagline }}" sc-camel-on-change="{{ selectedBrand.setProfileTagline }}" style="width:100%;box-sizing:border-box;height:38px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12.5px">
            </div>
            <div>
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">WEBSITE</div>
              <input value="{{ selectedBrand.profileWebsite }}" sc-camel-on-change="{{ selectedBrand.setProfileWebsite }}" style="width:100%;box-sizing:border-box;height:38px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12.5px">
            </div>
          </div>
          <div style="margin-bottom:14px">
            <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">BRAND STORY / DESCRIPTION</div>
            <textarea value="{{ selectedBrand.profileStory }}" sc-camel-on-change="{{ selectedBrand.setProfileStory }}" rows="3" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #E8EDF2;padding:10px 12px;font-size:12.5px;resize:vertical"></textarea>
          </div>
          <div style="font-size:10px;font-weight:800;color:#9CA3AF;letter-spacing:0.05em;margin-bottom:8px">SOCIAL LINKS</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
            <input value="{{ selectedBrand.socialFacebook }}" sc-camel-on-change="{{ selectedBrand.setSocialFacebook }}" placeholder="Facebook URL" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
            <input value="{{ selectedBrand.socialInstagram }}" sc-camel-on-change="{{ selectedBrand.setSocialInstagram }}" placeholder="Instagram URL" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
            <input value="{{ selectedBrand.socialYoutube }}" sc-camel-on-change="{{ selectedBrand.setSocialYoutube }}" placeholder="YouTube URL" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
            <input value="{{ selectedBrand.socialTiktok }}" sc-camel-on-change="{{ selectedBrand.setSocialTiktok }}" placeholder="TikTok URL" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
            <input value="{{ selectedBrand.socialLinkedin }}" sc-camel-on-change="{{ selectedBrand.setSocialLinkedin }}" placeholder="LinkedIn URL" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
          </div>
          <div style="font-size:10px;font-weight:800;color:#9CA3AF;letter-spacing:0.05em;margin-bottom:8px">OVERVIEW</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">
            <input value="{{ selectedBrand.profileAddress }}" sc-camel-on-change="{{ selectedBrand.setProfileAddress }}" placeholder="Address" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
            <input value="{{ selectedBrand.profileEmail }}" sc-camel-on-change="{{ selectedBrand.setProfileEmail }}" placeholder="Email" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
            <input value="{{ selectedBrand.profilePhone }}" sc-camel-on-change="{{ selectedBrand.setProfilePhone }}" placeholder="Phone" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
            <input value="{{ selectedBrand.profilePriceRange }}" sc-camel-on-change="{{ selectedBrand.setProfilePriceRange }}" placeholder="Price range" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
            <input value="{{ selectedBrand.profileAgeFocus }}" sc-camel-on-change="{{ selectedBrand.setProfileAgeFocus }}" placeholder="Age focus" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
            <input value="{{ selectedBrand.profileAudience }}" sc-camel-on-change="{{ selectedBrand.setProfileAudience }}" placeholder="Audience" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">SERVICES (one per line)</div>
              <textarea value="{{ selectedBrand.profileServicesText }}" sc-camel-on-change="{{ selectedBrand.setProfileServicesText }}" rows="3" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #E8EDF2;padding:8px 10px;font-size:12px;resize:vertical"></textarea>
            </div>
            <div>
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">TAGS (one per line)</div>
              <textarea value="{{ selectedBrand.profileTagsText }}" sc-camel-on-change="{{ selectedBrand.setProfileTagsText }}" rows="3" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #E8EDF2;padding:8px 10px;font-size:12px;resize:vertical"></textarea>
            </div>
          </div>
        </div>
`;

if (!app.includes('STOREFRONT PROFILE FIELDS')) {
  const marker = '<!-- BRAND PORTFOLIO (existing storefront profile CMS builder) -->';
  const idx = app.indexOf(marker);
  if (idx < 0) throw new Error('Brand portfolio marker not found');
  // Insert editor after the header bar closes (after Publish Live Profile header div)
  const afterHeader = app.indexOf('</div>\n\n        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:12px;overflow:hidden;margin-bottom:16px">', idx);
  if (afterHeader < 0) throw new Error('Brand portfolio header end not found');
  const insertAt = afterHeader + '</div>\n'.length;
  app = app.slice(0, insertAt) + '\n' + BRAND_EDITOR_HTML + app.slice(insertAt);
  console.log('Inserted brand profile editor');
}

const CREATOR_EDITOR_HTML = `
            <!-- CREATOR PROFILE FIELDS (catalog-backed) -->
            <div style="background:#fff;border:1px solid #E8EDF2;border-radius:12px;padding:20px;margin-bottom:16px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
                <div>
                  <div style="font-size:10px;font-weight:800;color:#FF5B00;letter-spacing:0.05em">CREATOR PROFILE FIELDS</div>
                  <div style="font-size:14.5px;font-weight:800;margin-top:2px">Cover, Bio, Socials &amp; Partners</div>
                </div>
                <button sc-camel-on-click="{{ selectedCreator.onSaveProfile }}" style="background:#FF5B00;border:none;border-radius:8px;padding:9px 16px;font-size:11.5px;font-weight:800;color:#fff;cursor:pointer">Save Profile</button>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
                <div>
                  <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">AVATAR URL</div>
                  <input value="{{ selectedCreator.profileAvatar }}" sc-camel-on-change="{{ selectedCreator.setProfileAvatar }}" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
                </div>
                <div>
                  <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">COVER / BANNER URL</div>
                  <input value="{{ selectedCreator.profileCover }}" sc-camel-on-change="{{ selectedCreator.setProfileCover }}" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
                </div>
                <div>
                  <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">ROLE / TITLE</div>
                  <input value="{{ selectedCreator.profileRole }}" sc-camel-on-change="{{ selectedCreator.setProfileRole }}" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
                </div>
                <div>
                  <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">LOCATION</div>
                  <input value="{{ selectedCreator.profileLocation }}" sc-camel-on-change="{{ selectedCreator.setProfileLocation }}" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
                </div>
              </div>
              <div style="margin-bottom:12px">
                <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">BIO</div>
                <textarea value="{{ selectedCreator.profileBio }}" sc-camel-on-change="{{ selectedCreator.setProfileBio }}" rows="3" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #E8EDF2;padding:10px 12px;font-size:12.5px;resize:vertical"></textarea>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
                <input value="{{ selectedCreator.socialFacebook }}" sc-camel-on-change="{{ selectedCreator.setSocialFacebook }}" placeholder="Facebook URL" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
                <input value="{{ selectedCreator.socialInstagram }}" sc-camel-on-change="{{ selectedCreator.setSocialInstagram }}" placeholder="Instagram URL" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
                <input value="{{ selectedCreator.socialYoutube }}" sc-camel-on-change="{{ selectedCreator.setSocialYoutube }}" placeholder="YouTube URL" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
                <input value="{{ selectedCreator.socialTiktok }}" sc-camel-on-change="{{ selectedCreator.setSocialTiktok }}" placeholder="TikTok URL" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
                <div>
                  <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">BRAND PARTNERS (comma or line separated)</div>
                  <textarea value="{{ selectedCreator.brandPartnersText }}" sc-camel-on-change="{{ selectedCreator.setBrandPartnersText }}" rows="2" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #E8EDF2;padding:8px 10px;font-size:12px;resize:vertical"></textarea>
                </div>
                <div>
                  <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">COLLAB TYPES (comma or line separated)</div>
                  <textarea value="{{ selectedCreator.collabTypesText }}" sc-camel-on-change="{{ selectedCreator.setCollabTypesText }}" rows="2" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #E8EDF2;padding:8px 10px;font-size:12px;resize:vertical"></textarea>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
                <input value="{{ selectedCreator.profileEmail }}" sc-camel-on-change="{{ selectedCreator.setProfileEmail }}" placeholder="Contact email" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
                <input value="{{ selectedCreator.profilePhone }}" sc-camel-on-change="{{ selectedCreator.setProfilePhone }}" placeholder="Phone" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
                <input value="{{ selectedCreator.profileResponseTime }}" sc-camel-on-change="{{ selectedCreator.setProfileResponseTime }}" placeholder="Response time" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
              </div>
            </div>
`;

if (!app.includes('CREATOR PROFILE FIELDS')) {
  const studioMarker = '<!-- CREATOR STUDIO (Guide builder, reused from Website CMS Guide Studio) -->';
  const sidx = app.indexOf(studioMarker);
  if (sidx < 0) throw new Error('Creator studio marker not found');
  app = app.slice(0, sidx) + CREATOR_EDITOR_HTML + '\n' + app.slice(sidx);
  console.log('Inserted creator profile editor');
}

const SIZE_GUIDE_HTML = `
        <!-- SIZE GUIDE (catalog product-detail) -->
        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:22px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div>
              <div style="font-size:10px;font-weight:800;color:#FF5B00;letter-spacing:0.05em">SIZE GUIDE</div>
              <div style="font-size:14.5px;font-weight:800;margin-top:2px">Persist to product detail</div>
            </div>
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;cursor:pointer">
              <input type="checkbox" checked="{{ editingProduct.sizeGuideEnabled }}" sc-camel-on-change="{{ setField_sizeGuideEnabled }}"> Enabled
            </label>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <input value="{{ editingProduct.sizeGuideTitle }}" sc-camel-on-change="{{ setField_sizeGuideTitle }}" placeholder="Title" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
            <input value="{{ editingProduct.sizeGuideUnitLabel }}" sc-camel-on-change="{{ setField_sizeGuideUnitLabel }}" placeholder="Unit (cm)" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
          </div>
          <textarea value="{{ editingProduct.sizeGuideDescription }}" sc-camel-on-change="{{ setField_sizeGuideDescription }}" rows="2" placeholder="Description" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #E8EDF2;padding:8px 10px;font-size:12px;resize:vertical;margin-bottom:10px"></textarea>
          <input value="{{ editingProduct.sizeGuideImageUrl }}" sc-camel-on-change="{{ setField_sizeGuideImageUrl }}" placeholder="Image URL" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px;margin-bottom:10px">
          <textarea value="{{ editingProduct.sizeGuideHeadersText }}" sc-camel-on-change="{{ setField_sizeGuideHeadersText }}" rows="2" placeholder="Column headers (one per line, e.g. Chest)" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #E8EDF2;padding:8px 10px;font-size:12px;resize:vertical;margin-bottom:10px"></textarea>
          <textarea value="{{ editingProduct.sizeGuideRowsText }}" sc-camel-on-change="{{ setField_sizeGuideRowsText }}" rows="3" placeholder="Rows: Size|Chest|Waist|Hip (one per line)" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #E8EDF2;padding:8px 10px;font-size:12px;font-family:'JetBrains Mono',monospace;resize:vertical"></textarea>
        </div>
`;

if (!app.includes('Persist to product detail')) {
  // Insert before tags section or after overview blocks — find overview support textarea block end area
  const tagsMarker = 'editingProduct.tagsText';
  const tidx = app.indexOf(tagsMarker);
  if (tidx < 0) throw new Error('Product tags marker not found');
  // Find the start of the containing card before tags
  const cardStart = app.lastIndexOf('<div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:22px;margin-bottom:16px">', tidx);
  if (cardStart < 0) throw new Error('Product tags card not found');
  app = app.slice(0, cardStart) + SIZE_GUIDE_HTML + '\n' + app.slice(cardStart);
  console.log('Inserted product size guide editor');
}

// Wire Publish Guide button
app = app.replace(
  '<button style="background:#FF5B00;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-size:12px;font-weight:800;cursor:pointer">Publish Guide</button>',
  '<button sc-camel-on-click="{{ publishGuide }}" style="background:#FF5B00;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-size:12px;font-weight:800;cursor:pointer">Publish Guide</button>',
);
console.log('Wired Publish Guide buttons');

// Replace toast-only brand save/publish with API-backed handlers
const OLD_SAVE = `onEdit: () => this.showToast('Opening hero banner editor'),
        onPublish: () => this.showToast(\`\${b.name} profile published live\`),
        onSaveDraft: () => this.showToast('Draft saved'),`;

const NEW_SAVE = `onEdit: () => this.showToast('Edit logo & banner URLs in Profile Fields below'),
        onPublish: this.saveBrandProfile(b.name, true),
        onSaveDraft: this.saveBrandProfile(b.name, false),`;

if (app.includes(OLD_SAVE)) {
  app = app.replace(OLD_SAVE, NEW_SAVE);
  console.log('Replaced brand save/publish handlers');
} else if (!app.includes('saveBrandProfile(b.name')) {
  console.warn('WARN: brand save handlers pattern not found — check manually');
}

// Inject brand profile draft field wiring after selectedBrand.website assignment
const BRAND_WIRE = `
      const __bp = (this.state.brandProfileDrafts && this.state.brandProfileDrafts[b.name]) || {};
      selectedBrand.catalogId = b.catalogId || __bp.catalogId || null;
      selectedBrand.profileLogo = __bp.logo != null ? __bp.logo : (b.logo || '');
      selectedBrand.profileCover = __bp.coverImage != null ? __bp.coverImage : (b.coverImage || '');
      selectedBrand.profileTagline = __bp.tagline != null ? __bp.tagline : (b.tagline || '');
      selectedBrand.profileWebsite = __bp.website != null ? __bp.website : (selectedBrand.website || '');
      selectedBrand.profileStory = __bp.story != null ? __bp.story : (b.story || b.tagline || '');
      selectedBrand.socialFacebook = __bp.socialFacebook || (b.socialLinks && b.socialLinks.facebook) || '';
      selectedBrand.socialInstagram = __bp.socialInstagram || (b.socialLinks && b.socialLinks.instagram) || '';
      selectedBrand.socialYoutube = __bp.socialYoutube || (b.socialLinks && b.socialLinks.youtube) || '';
      selectedBrand.socialTiktok = __bp.socialTiktok || (b.socialLinks && b.socialLinks.tiktok) || '';
      selectedBrand.socialLinkedin = __bp.socialLinkedin || (b.socialLinks && b.socialLinks.linkedin) || '';
      selectedBrand.profileAddress = __bp.address != null ? __bp.address : (b.address || '');
      selectedBrand.profileEmail = __bp.email != null ? __bp.email : (b.email || '');
      selectedBrand.profilePhone = __bp.phone != null ? __bp.phone : (b.phone || '');
      selectedBrand.profilePriceRange = __bp.priceRange != null ? __bp.priceRange : (b.priceRange || '');
      selectedBrand.profileAgeFocus = __bp.ageFocus != null ? __bp.ageFocus : (b.ageFocus || '');
      selectedBrand.profileAudience = __bp.audience != null ? __bp.audience : (b.audience || '');
      selectedBrand.profileServicesText = __bp.servicesText != null ? __bp.servicesText : ((b.services || []).join('\\n'));
      selectedBrand.profileTagsText = __bp.tagsText != null ? __bp.tagsText : ((b.tags || []).join('\\n'));
      selectedBrand.setProfileLogo = this.setBrandProfileField(b.name, 'logo');
      selectedBrand.setProfileCover = this.setBrandProfileField(b.name, 'coverImage');
      selectedBrand.setProfileTagline = this.setBrandProfileField(b.name, 'tagline');
      selectedBrand.setProfileWebsite = this.setBrandProfileField(b.name, 'website');
      selectedBrand.setProfileStory = this.setBrandProfileField(b.name, 'story');
      selectedBrand.setSocialFacebook = this.setBrandProfileField(b.name, 'socialFacebook');
      selectedBrand.setSocialInstagram = this.setBrandProfileField(b.name, 'socialInstagram');
      selectedBrand.setSocialYoutube = this.setBrandProfileField(b.name, 'socialYoutube');
      selectedBrand.setSocialTiktok = this.setBrandProfileField(b.name, 'socialTiktok');
      selectedBrand.setSocialLinkedin = this.setBrandProfileField(b.name, 'socialLinkedin');
      selectedBrand.setProfileAddress = this.setBrandProfileField(b.name, 'address');
      selectedBrand.setProfileEmail = this.setBrandProfileField(b.name, 'email');
      selectedBrand.setProfilePhone = this.setBrandProfileField(b.name, 'phone');
      selectedBrand.setProfilePriceRange = this.setBrandProfileField(b.name, 'priceRange');
      selectedBrand.setProfileAgeFocus = this.setBrandProfileField(b.name, 'ageFocus');
      selectedBrand.setProfileAudience = this.setBrandProfileField(b.name, 'audience');
      selectedBrand.setProfileServicesText = this.setBrandProfileField(b.name, 'servicesText');
      selectedBrand.setProfileTagsText = this.setBrandProfileField(b.name, 'tagsText');
`;

if (!app.includes('setBrandProfileField(b.name, \'logo\')')) {
  const websiteLine = "selectedBrand.website = b.website || `https://${slug.toLowerCase().replace(/-/g,'')}.com.bd`;";
  if (!app.includes(websiteLine)) throw new Error('website line not found');
  app = app.replace(websiteLine, websiteLine + '\n' + BRAND_WIRE);
  console.log('Wired brand profile draft fields');
}

// Creator profile wiring — after selectedCreator.onSavePaymentInfo
const CREATOR_WIRE = `
      const __cp = (this.state.creatorProfileDrafts && this.state.creatorProfileDrafts[c.name]) || {};
      selectedCreator.catalogId = c.catalogId || __cp.catalogId || null;
      selectedCreator.profileAvatar = __cp.avatar != null ? __cp.avatar : (c.avatar || '');
      selectedCreator.profileCover = __cp.coverImage != null ? __cp.coverImage : (c.coverImage || '');
      selectedCreator.profileRole = __cp.role != null ? __cp.role : (selectedCreator.role || '');
      selectedCreator.profileLocation = __cp.location != null ? __cp.location : (selectedCreator.location || '');
      selectedCreator.profileBio = __cp.bio != null ? __cp.bio : (selectedCreator.bio || '');
      selectedCreator.socialFacebook = __cp.socialFacebook || (c.socialLinks && c.socialLinks.facebook) || '';
      selectedCreator.socialInstagram = __cp.socialInstagram || (c.socialLinks && c.socialLinks.instagram) || '';
      selectedCreator.socialYoutube = __cp.socialYoutube || (c.socialLinks && c.socialLinks.youtube) || '';
      selectedCreator.socialTiktok = __cp.socialTiktok || (c.socialLinks && c.socialLinks.tiktok) || '';
      selectedCreator.brandPartnersText = __cp.brandPartnersText != null ? __cp.brandPartnersText : ((c.brandPartners || []).join(', '));
      selectedCreator.collabTypesText = __cp.collabTypesText != null ? __cp.collabTypesText : ((c.collabTypes || []).join(', '));
      selectedCreator.profileEmail = __cp.email != null ? __cp.email : (selectedCreator.contactEmail || '');
      selectedCreator.profilePhone = __cp.phone != null ? __cp.phone : (c.phone || '');
      selectedCreator.profileResponseTime = __cp.responseTime != null ? __cp.responseTime : (selectedCreator.responseTime || '');
      selectedCreator.setProfileAvatar = this.setCreatorProfileField(c.name, 'avatar');
      selectedCreator.setProfileCover = this.setCreatorProfileField(c.name, 'coverImage');
      selectedCreator.setProfileRole = this.setCreatorProfileField(c.name, 'role');
      selectedCreator.setProfileLocation = this.setCreatorProfileField(c.name, 'location');
      selectedCreator.setProfileBio = this.setCreatorProfileField(c.name, 'bio');
      selectedCreator.setSocialFacebook = this.setCreatorProfileField(c.name, 'socialFacebook');
      selectedCreator.setSocialInstagram = this.setCreatorProfileField(c.name, 'socialInstagram');
      selectedCreator.setSocialYoutube = this.setCreatorProfileField(c.name, 'socialYoutube');
      selectedCreator.setSocialTiktok = this.setCreatorProfileField(c.name, 'socialTiktok');
      selectedCreator.setBrandPartnersText = this.setCreatorProfileField(c.name, 'brandPartnersText');
      selectedCreator.setCollabTypesText = this.setCreatorProfileField(c.name, 'collabTypesText');
      selectedCreator.setProfileEmail = this.setCreatorProfileField(c.name, 'email');
      selectedCreator.setProfilePhone = this.setCreatorProfileField(c.name, 'phone');
      selectedCreator.setProfileResponseTime = this.setCreatorProfileField(c.name, 'responseTime');
      selectedCreator.onSaveProfile = this.saveCreatorProfile(c.name);
`;

if (!app.includes('setCreatorProfileField(c.name, \'avatar\')')) {
  const payLine = 'selectedCreator.onSavePaymentInfo = this.savePaymentInfo(c.name);';
  if (!app.includes(payLine)) throw new Error('creator payment line not found');
  app = app.replace(payLine, payLine + '\n' + CREATOR_WIRE);
  console.log('Wired creator profile draft fields');
}

// Add methods before saveProduct
const METHODS = `
  setBrandProfileField = (brandName, key) => (e) => {
    const value = e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    this.setState(s => ({
      brandProfileDrafts: {
        ...(s.brandProfileDrafts || {}),
        [brandName]: { ...(s.brandProfileDrafts && s.brandProfileDrafts[brandName] || {}), [key]: value },
      },
    }));
  };
  saveBrandProfile = (brandName, publish) => async () => {
    const api = window.CmsStudioProfileApi;
    if (!api) { this.showToast('Profile API unavailable'); return; }
    const b = Component.BRANDS.find(x => x.name === brandName);
    if (!b) return;
    const draft = (this.state.brandProfileDrafts && this.state.brandProfileDrafts[brandName]) || {};
    try {
      let catalogId = b.catalogId || draft.catalogId;
      if (!catalogId) {
        const brands = await api.listBrands();
        const match = brands.find(x => x.name === brandName || x.slug === api.slugify(brandName));
        if (match) catalogId = match.id;
      }
      if (!catalogId) {
        this.showToast('No catalog brand found for ' + brandName + ' — seed catalog first');
        return;
      }
      const payload = api.brandPayloadFromMirror(b, draft);
      const saved = await api.patchBrand(catalogId, payload);
      const ov = saved.overview || {};
      Component.BRANDS = Component.BRANDS.map(row => row.name !== brandName ? row : ({
        ...row,
        catalogId: saved.id,
        logo: saved.logo || row.logo,
        coverImage: saved.coverImage || row.coverImage,
        tagline: saved.tagline || row.tagline,
        website: saved.website || row.website,
        story: saved.story || row.story,
        socialLinks: saved.socialLinks || row.socialLinks,
        address: ov.address || row.address,
        email: ov.email || row.email,
        phone: ov.phone || row.phone,
        priceRange: ov.priceRange || row.priceRange,
        ageFocus: ov.ageFocus || row.ageFocus,
        audience: ov.audience || row.audience,
        services: ov.services || row.services,
        tags: ov.tags || row.tags,
      }));
      this.setState(s => ({
        brandProfileDrafts: {
          ...(s.brandProfileDrafts || {}),
          [brandName]: { ...(s.brandProfileDrafts && s.brandProfileDrafts[brandName] || {}), catalogId: saved.id },
        },
      }));
      this.showToast(publish ? (brandName + ' profile published live') : 'Draft saved to catalog');
    } catch (err) {
      this.showToast('Save failed: ' + (err && err.message ? err.message : err));
    }
  };
  setCreatorProfileField = (creatorName, key) => (e) => {
    const value = e && e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    this.setState(s => ({
      creatorProfileDrafts: {
        ...(s.creatorProfileDrafts || {}),
        [creatorName]: { ...(s.creatorProfileDrafts && s.creatorProfileDrafts[creatorName] || {}), [key]: value },
      },
    }));
  };
  saveCreatorProfile = (creatorName) => async () => {
    const api = window.CmsStudioProfileApi;
    if (!api) { this.showToast('Profile API unavailable'); return; }
    const c = Component.CREATORS.find(x => x.name === creatorName);
    if (!c) return;
    const draft = (this.state.creatorProfileDrafts && this.state.creatorProfileDrafts[creatorName]) || {};
    try {
      let catalogId = c.catalogId || draft.catalogId;
      if (!catalogId) {
        const creators = await api.listCreators();
        const match = creators.find(x => x.name === creatorName || x.slug === api.slugify(creatorName));
        if (match) catalogId = match.id;
        if (!catalogId) catalogId = 'creator-' + api.slugify(creatorName);
      }
      const payload = api.creatorPayloadFromMirror(c, draft);
      const saved = await api.putCreator(catalogId, { ...payload, id: catalogId });
      Component.CREATORS = Component.CREATORS.map(row => row.name !== creatorName ? row : ({
        ...row,
        catalogId: saved.id,
        avatar: saved.avatar || row.avatar,
        coverImage: saved.coverImage || row.coverImage,
        role: saved.role || row.role,
        location: saved.location || row.location,
        bio: saved.bio || row.bio,
        socialLinks: saved.socialLinks || row.socialLinks,
        brandPartners: saved.brandPartners || row.brandPartners,
        collabTypes: saved.collabTypes || row.collabTypes,
        contactEmail: saved.email || row.contactEmail,
        phone: saved.phone || row.phone,
        responseTime: saved.responseTime || row.responseTime,
      }));
      this.setState(s => ({
        creatorProfileDrafts: {
          ...(s.creatorProfileDrafts || {}),
          [creatorName]: { ...(s.creatorProfileDrafts && s.creatorProfileDrafts[creatorName] || {}), catalogId: saved.id },
        },
      }));
      this.showToast(creatorName + ' profile saved');
    } catch (err) {
      this.showToast('Save failed: ' + (err && err.message ? err.message : err));
    }
  };
  publishGuide = async () => {
    const api = window.CmsStudioProfileApi;
    if (!api) { this.showToast('Profile API unavailable'); return; }
    const draft = this.state.guideDraft || {};
    const creator = Component.CREATORS.find(c => c.name === this.state.selectedCreatorName) || Component.CREATORS[0];
    try {
      const payload = api.guidePayloadFromDraft(draft, creator);
      await api.putGuide(payload.id, payload);
      this.showToast('Guide published: ' + payload.title);
    } catch (err) {
      this.showToast('Guide publish failed: ' + (err && err.message ? err.message : err));
    }
  };
`;

if (!app.includes('saveBrandProfile = (brandName')) {
  const saveProductLine = '  saveProduct = () => {';
  if (!app.includes(saveProductLine)) throw new Error('saveProduct not found');
  app = app.replace(saveProductLine, METHODS + '\n  saveProduct = () => {');
  console.log('Inserted save methods');
}

// Replace saveProduct body to also persist catalog
const OLD_SAVE_PRODUCT = `  saveProduct = () => {
    const d = this.state.editingProduct;
    if (!d) return;
    this.setState(s => {
      if (s.isNew) {
        const newId = Math.max(0, ...s.products.map(p => p.id)) + 1;
        return {products: [{...d, id:newId, price: Number(d.price)||0, stock: Number(d.stock)||0, rating: d.rating||4.0}, ...s.products], editingProduct:null};
      }
      return {products: s.products.map(p => p.id === d.id ? {...d, price: Number(d.price)||0, stock: Number(d.stock)||0} : p), editingProduct:null};
    });
  };`;

const NEW_SAVE_PRODUCT = `  saveProduct = async () => {
    const d = this.state.editingProduct;
    if (!d) return;
    this.setState(s => {
      if (s.isNew) {
        const newId = Math.max(0, ...s.products.map(p => p.id)) + 1;
        return {products: [{...d, id:newId, price: Number(d.price)||0, stock: Number(d.stock)||0, rating: d.rating||4.0}, ...s.products], editingProduct:null};
      }
      return {products: s.products.map(p => p.id === d.id ? {...d, price: Number(d.price)||0, stock: Number(d.stock)||0} : p), editingProduct:null};
    });
    const api = window.CmsStudioProfileApi;
    if (!api) return;
    try {
      const products = await api.listProducts();
      const match = products.find(p =>
        (d.catalogId && p.id === d.catalogId) ||
        p.title === d.name ||
        (d.slug && p.slug === d.slug)
      );
      if (!match) {
        this.showToast('Local draft saved (no matching catalog product)');
        return;
      }
      const gallery = [d.image, d.gallery1, d.gallery2, d.gallery3, d.gallery4].filter(Boolean);
      await api.patchProduct(match.id, {
        title: d.name || match.title,
        description: d.description || match.description,
        price: Number(d.price) || match.price,
        originalPrice: Number(d.salePrice) || match.originalPrice,
        stock: Number(d.stock) || match.stock,
        image: d.image || match.image,
        gallery: gallery.length ? gallery : match.gallery,
        tags: api.splitLines(d.tagsText || '').length ? api.splitLines(d.tagsText) : match.tags,
        status: 'live',
      });
      const detailPayload = {
        productId: match.id,
        about: d.description || '',
        specs: api.parseKeyValueLines(d.specsText || d.additionalSpecsText || ''),
        pros: [],
        cons: [],
        bestForTags: api.splitLines(d.tagsText || ''),
        storeComparisonList: [],
        physicalStores: [],
        overviewBlocks: api.overviewBlocksFromStudio(d),
        optionGroups: api.optionGroupsFromText(d.variantGroupsText || ''),
        productVariants: [],
        creatorContent: [],
        sizeGuide: api.sizeGuideFromStudio(d),
      };
      await api.upsertProductDetail(match.id, detailPayload);
      this.showToast('Product + detail saved to catalog');
    } catch (err) {
      this.showToast('Catalog product save failed: ' + (err && err.message ? err.message : err));
    }
  };`;

if (app.includes('Local draft saved (no matching catalog product)')) {
  console.log('saveProduct already catalog-wired');
} else if (app.includes(OLD_SAVE_PRODUCT)) {
  app = app.replace(OLD_SAVE_PRODUCT, NEW_SAVE_PRODUCT);
  console.log('Replaced saveProduct with catalog persistence');
} else {
  // Methods insert may have left duplicate — find current saveProduct async or sync
  console.warn('WARN: exact saveProduct block not found; trying regex');
  app = app.replace(
    /  saveProduct = \(\) => \{\n    const d = this\.state\.editingProduct;\n    if \(!d\) return;\n    this\.setState\(s => \{\n      if \(s\.isNew\) \{\n        const newId = Math\.max\(0, \.\.\.s\.products\.map\(p => p\.id\)\) \+ 1;\n        return \{products: \[\{\.\.\.d, id:newId, price: Number\(d\.price\)\|\|0, stock: Number\(d\.stock\)\|\|0, rating: d\.rating\|\|4\.0\}, \.\.\.s\.products\], editingProduct:null\};\n      \}\n      return \{products: s\.products\.map\(p => p\.id === d\.id \? \{\.\.\.d, price: Number\(d\.price\)\|\|0, stock: Number\(d\.stock\)\|\|0\} : p\), editingProduct:null\};\n    \}\);\n  \};/,
    NEW_SAVE_PRODUCT.trimStart(),
  );
}

// Add size guide setField bindings
if (!app.includes('setField_sizeGuideTitle')) {
  const overviewFields = "setField_overviewAudienceText: this.setField('overviewAudienceText'), setField_overviewSupportText: this.setField('overviewSupportText'),";
  if (app.includes(overviewFields)) {
    app = app.replace(
      overviewFields,
      overviewFields +
        "\n      setField_sizeGuideEnabled: this.setField('sizeGuideEnabled'), setField_sizeGuideTitle: this.setField('sizeGuideTitle'), setField_sizeGuideUnitLabel: this.setField('sizeGuideUnitLabel'), setField_sizeGuideDescription: this.setField('sizeGuideDescription'), setField_sizeGuideImageUrl: this.setField('sizeGuideImageUrl'), setField_sizeGuideHeadersText: this.setField('sizeGuideHeadersText'), setField_sizeGuideRowsText: this.setField('sizeGuideRowsText'),",
    );
    console.log('Added size guide setField bindings');
  }
}

// Expose publishGuide in renderVals return — find guideDraft in return object
if (!app.includes('publishGuide: this.publishGuide')) {
  const guideDraftRef = 'guideDraft:';
  const gidx = app.indexOf(guideDraftRef);
  if (gidx > 0) {
    // find nearby return props — add after guideDraft line start
    const lineEnd = app.indexOf('\n', gidx);
    app = app.slice(0, lineEnd) + '\n      publishGuide: this.publishGuide,' + app.slice(lineEnd);
    console.log('Exposed publishGuide in renderVals');
  }
}

// Initial state for drafts
if (!app.includes('brandProfileDrafts:')) {
  const stateNeedle = 'cmsFeaturedCreatorNames:';
  const sidx = app.indexOf(stateNeedle);
  if (sidx > 0) {
    app = app.slice(0, sidx) + 'brandProfileDrafts: {},\n    creatorProfileDrafts: {},\n    ' + app.slice(sidx);
    console.log('Added draft state keys');
  }
}

// Auth token listener
if (!app.includes('cms-mirror-auth-token')) {
  const boot = "window.addEventListener('message'";
  // add a dedicated listener near ROLE handling if present
  const inject = `
window.addEventListener('message', function(ev) {
  var data = ev && ev.data;
  if (!data || data.type !== 'cms-mirror-auth-token') return;
  if (typeof data.token === 'string') window.__CMS_MIRROR_AUTH_TOKEN__ = data.token;
});
`;
  if (app.includes('<script>') && !app.includes('cms-mirror-auth-token')) {
    // insert before first large script block end — after studio-profile script is fine at top
    app = app.replace(SCRIPT_TAG, SCRIPT_TAG + '\n<script>' + inject + '</script>');
    console.log('Added auth token listener');
  }
}

fs.writeFileSync(appPath, app);
console.log('Wrote', appPath, 'bytes', app.length);
