/**
 * Rearrange Brand/Creator/Product studio editors to storefront order,
 * Choose-file image uploads, remove view-only metrics.
 */
import fs from 'fs';

const appPath = 'C:/Users/User/Projects/choosify-admin-4.0/public/cms-mirror/app.html';
let app = fs.readFileSync(appPath, 'utf8');

const BRAND_EDITOR = `
        <!-- PROFILE FIELDS EDITOR (storefront order: banner → logo → identity → socials → story → overview) -->
        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:12px;padding:20px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div>
              <div style="font-size:10px;font-weight:800;color:#FF5B00;letter-spacing:0.05em">STOREFRONT PROFILE</div>
              <div style="font-size:14.5px;font-weight:800;margin-top:2px">Edit live brand page fields</div>
            </div>
            <span style="font-size:11px;color:#9CA3AF;font-weight:600">Banner → Logo → Socials → Overview</span>
          </div>

          <div style="margin-bottom:18px">
            <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:8px;letter-spacing:0.04em">1. BANNER / COVER</div>
            <div style="height:190px;border-radius:10px;border:1px solid #E8EDF2;overflow:hidden;background:#F9FAFB;margin-bottom:10px;display:flex;align-items:center;justify-content:center">
              <sc-if value="{{ selectedBrand.hasProfileCover }}" hint-placeholder-val="{{ false }}">
                <img src="{{ selectedBrand.profileCover }}" alt="Banner" style="width:100%;height:100%;object-fit:cover">
              </sc-if>
              <sc-if value="{{ !selectedBrand.hasProfileCover }}" hint-placeholder-val="{{ true }}">
                <span style="font-size:12px;color:#9CA3AF;font-weight:600">No banner uploaded yet</span>
              </sc-if>
            </div>
            <button sc-camel-on-click="{{ selectedBrand.onUploadCover }}" style="background:#fff;border:1px solid #E8EDF2;border-radius:8px;padding:9px 14px;font-size:11.5px;font-weight:800;color:#111827;cursor:pointer">Choose file</button>
          </div>

          <div style="margin-bottom:18px">
            <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:8px;letter-spacing:0.04em">2. LOGO</div>
            <div style="display:flex;align-items:center;gap:14px">
              <div style="width:88px;height:88px;border-radius:12px;border:1px solid #E8EDF2;overflow:hidden;background:#F9FAFB;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <sc-if value="{{ selectedBrand.hasProfileLogo }}" hint-placeholder-val="{{ false }}">
                  <img src="{{ selectedBrand.profileLogo }}" alt="Logo" style="width:100%;height:100%;object-fit:cover">
                </sc-if>
                <sc-if value="{{ !selectedBrand.hasProfileLogo }}" hint-placeholder-val="{{ true }}">
                  <span style="font-size:11px;color:#9CA3AF;font-weight:700">Logo</span>
                </sc-if>
              </div>
              <button sc-camel-on-click="{{ selectedBrand.onUploadLogo }}" style="background:#fff;border:1px solid #E8EDF2;border-radius:8px;padding:9px 14px;font-size:11.5px;font-weight:800;color:#111827;cursor:pointer">Choose file</button>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
            <div>
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">3. TAGLINE</div>
              <input value="{{ selectedBrand.profileTagline }}" sc-camel-on-change="{{ selectedBrand.setProfileTagline }}" style="width:100%;box-sizing:border-box;height:38px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12.5px">
            </div>
            <div>
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">4. WEBSITE</div>
              <input value="{{ selectedBrand.profileWebsite }}" sc-camel-on-change="{{ selectedBrand.setProfileWebsite }}" style="width:100%;box-sizing:border-box;height:38px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12.5px">
            </div>
          </div>

          <div style="font-size:10px;font-weight:800;color:#9CA3AF;letter-spacing:0.05em;margin-bottom:8px">5. SOCIAL LINKS</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
            <input value="{{ selectedBrand.socialFacebook }}" sc-camel-on-change="{{ selectedBrand.setSocialFacebook }}" placeholder="Facebook URL" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
            <input value="{{ selectedBrand.socialInstagram }}" sc-camel-on-change="{{ selectedBrand.setSocialInstagram }}" placeholder="Instagram URL" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
            <input value="{{ selectedBrand.socialYoutube }}" sc-camel-on-change="{{ selectedBrand.setSocialYoutube }}" placeholder="YouTube URL" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
            <input value="{{ selectedBrand.socialTiktok }}" sc-camel-on-change="{{ selectedBrand.setSocialTiktok }}" placeholder="TikTok URL" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
            <input value="{{ selectedBrand.socialLinkedin }}" sc-camel-on-change="{{ selectedBrand.setSocialLinkedin }}" placeholder="LinkedIn URL" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
          </div>

          <div style="margin-bottom:14px">
            <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">6. BRAND STORY / DESCRIPTION</div>
            <textarea value="{{ selectedBrand.profileStory }}" sc-camel-on-change="{{ selectedBrand.setProfileStory }}" rows="3" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #E8EDF2;padding:10px 12px;font-size:12.5px;resize:vertical"></textarea>
          </div>

          <div style="font-size:10px;font-weight:800;color:#9CA3AF;letter-spacing:0.05em;margin-bottom:8px">7. OVERVIEW</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">
            <input value="{{ selectedBrand.profileAddress }}" sc-camel-on-change="{{ selectedBrand.setProfileAddress }}" placeholder="Address" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
            <input value="{{ selectedBrand.profileEmail }}" sc-camel-on-change="{{ selectedBrand.setProfileEmail }}" placeholder="Email" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
            <input value="{{ selectedBrand.profilePhone }}" sc-camel-on-change="{{ selectedBrand.setProfilePhone }}" placeholder="Phone" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
            <input value="{{ selectedBrand.profilePriceRange }}" sc-camel-on-change="{{ selectedBrand.setProfilePriceRange }}" placeholder="Price range" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
            <input value="{{ selectedBrand.profileAgeFocus }}" sc-camel-on-change="{{ selectedBrand.setProfileAgeFocus }}" placeholder="Age focus" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
            <input value="{{ selectedBrand.profileAudience }}" sc-camel-on-change="{{ selectedBrand.setProfileAudience }}" placeholder="Audience" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
            <div>
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">SERVICES (one per line)</div>
              <textarea value="{{ selectedBrand.profileServicesText }}" sc-camel-on-change="{{ selectedBrand.setProfileServicesText }}" rows="3" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #E8EDF2;padding:8px 10px;font-size:12px;resize:vertical"></textarea>
            </div>
            <div>
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">TAGS (one per line)</div>
              <textarea value="{{ selectedBrand.profileTagsText }}" sc-camel-on-change="{{ selectedBrand.setProfileTagsText }}" rows="3" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #E8EDF2;padding:8px 10px;font-size:12px;resize:vertical"></textarea>
            </div>
          </div>

          <div style="border-top:1px solid #F1F3F5;padding-top:14px">
            <div style="font-size:10px;font-weight:800;color:#9CA3AF;letter-spacing:0.05em;margin-bottom:8px">8. BRAND STORY / CREATOR REVIEW VIDEO EMBEDS (URL only)</div>
            <input value="{{ selectedBrand.storyVideoUrl }}" sc-camel-on-change="{{ selectedBrand.setStoryVideoUrl }}" placeholder="Paste YouTube / MP4 HTTPS URL for brand story or creator review embed" style="width:100%;box-sizing:border-box;height:38px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12.5px">
          </div>
        </div>
`;

// Replace old brand profile fields editor
const oldBrandEditorStart = '        <!-- PROFILE FIELDS EDITOR (catalog-backed) -->';
const oldBrandEditorEnd = '        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:12px;overflow:hidden;margin-bottom:16px">\n          <div style="position:relative;height:190px">';
const bi = app.indexOf(oldBrandEditorStart);
const be = app.indexOf(oldBrandEditorEnd);
if (bi < 0 || be < 0) throw new Error('Brand editor markers not found');
app = app.slice(0, bi) + BRAND_EDITOR + '\n' + app.slice(be);
console.log('Replaced brand profile editor');

// Remove trust score badge from hero mock (keep banner/logo visual or remove whole mock?)
// Remove the entire old visual hero mock + metrics blocks through total promo cards
const heroMockStart = '        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:12px;overflow:hidden;margin-bottom:16px">\n          <div style="position:relative;height:190px">';
const metricsEndMarker = '        <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px;align-items:start">\n          <div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:20px">\n            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">\n              <div>\n                <div style="font-size:10px;font-weight:800;color:#FF5B00;letter-spacing:0.05em;margin-bottom:4px">BRAND CAMPAIGNS &amp; INFLUENCERS</div>';
const hs = app.indexOf(heroMockStart);
const he = app.indexOf(metricsEndMarker);
if (hs < 0 || he < 0) throw new Error('Hero/metrics markers not found: ' + hs + ' ' + he);
app = app.slice(0, hs) + app.slice(he);
console.log('Removed brand hero mock + view-only metrics');

// Remove duplicate Brand Overview display card (editable fields already above) — keep products onward
// Actually storefront has overview as section - the display card duplicates. Remove "Edit Overview" toast stub display OR keep as read preview.
// User asked rearrange editors - the display overview with Edit Overview button is redundant. Remove it.
const overviewCardStart = '        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:20px">\n          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">\n            <div>\n              <div style="font-size:10px;font-weight:800;color:#FF5B00;letter-spacing:0.05em;margin-bottom:4px">OUR HERITAGE BRAND SPECIFICATIONS</div>';
const overviewCardEnd = '        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:20px;margin-top:16px">\n          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">\n            <div style="font-size:14.5px;font-weight:800">{{ selectedBrand.name }} Products</div>';
const os = app.indexOf(overviewCardStart);
const oe = app.indexOf(overviewCardEnd);
if (os > 0 && oe > os) {
  app = app.slice(0, os) + app.slice(oe);
  console.log('Removed duplicate brand overview display card');
}

// Remove What Customers Say reviews section
const reviewsStart = '        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:20px;margin-top:16px">\n          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">\n            <div style="font-size:14.5px;font-weight:800">What Customers Say';
const reviewsEnd = '        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:16px;align-items:start">\n          <div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:20px">\n            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">\n              <div style="font-size:14.5px;font-weight:800">Where to Buy</div>';
const rs = app.indexOf(reviewsStart);
const re = app.indexOf(reviewsEnd);
if (rs > 0 && re > rs) {
  app = app.slice(0, rs) + app.slice(re);
  console.log('Removed What Customers Say reviews section');
}

const CREATOR_EDITOR = `
            <!-- CREATOR PROFILE FIELDS (storefront order: cover → avatar → identity → socials → partners) -->
            <div style="background:#fff;border:1px solid #E8EDF2;border-radius:12px;padding:20px;margin-bottom:16px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
                <div>
                  <div style="font-size:10px;font-weight:800;color:#FF5B00;letter-spacing:0.05em">CREATOR PROFILE</div>
                  <div style="font-size:14.5px;font-weight:800;margin-top:2px">Edit live creator page fields</div>
                </div>
                <button sc-camel-on-click="{{ selectedCreator.onSaveProfile }}" style="background:#FF5B00;border:none;border-radius:8px;padding:9px 16px;font-size:11.5px;font-weight:800;color:#fff;cursor:pointer">Save Profile</button>
              </div>

              <div style="margin-bottom:16px">
                <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:8px">1. COVER / BANNER</div>
                <div style="height:180px;border-radius:10px;border:1px solid #E8EDF2;overflow:hidden;background:#F9FAFB;margin-bottom:10px;display:flex;align-items:center;justify-content:center">
                  <sc-if value="{{ selectedCreator.hasProfileCover }}" hint-placeholder-val="{{ false }}">
                    <img src="{{ selectedCreator.profileCover }}" alt="Cover" style="width:100%;height:100%;object-fit:cover">
                  </sc-if>
                  <sc-if value="{{ !selectedCreator.hasProfileCover }}" hint-placeholder-val="{{ true }}">
                    <span style="font-size:12px;color:#9CA3AF;font-weight:600">No cover uploaded yet</span>
                  </sc-if>
                </div>
                <button sc-camel-on-click="{{ selectedCreator.onUploadCover }}" style="background:#fff;border:1px solid #E8EDF2;border-radius:8px;padding:9px 14px;font-size:11.5px;font-weight:800;color:#111827;cursor:pointer">Choose file</button>
              </div>

              <div style="margin-bottom:16px">
                <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:8px">2. AVATAR</div>
                <div style="display:flex;align-items:center;gap:14px">
                  <div style="width:96px;height:96px;border-radius:50%;border:1px solid #E8EDF2;overflow:hidden;background:#F9FAFB;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                    <sc-if value="{{ selectedCreator.hasProfileAvatar }}" hint-placeholder-val="{{ false }}">
                      <img src="{{ selectedCreator.profileAvatar }}" alt="Avatar" style="width:100%;height:100%;object-fit:cover">
                    </sc-if>
                    <sc-if value="{{ !selectedCreator.hasProfileAvatar }}" hint-placeholder-val="{{ true }}">
                      <span style="font-size:11px;color:#9CA3AF;font-weight:700">Photo</span>
                    </sc-if>
                  </div>
                  <button sc-camel-on-click="{{ selectedCreator.onUploadAvatar }}" style="background:#fff;border:1px solid #E8EDF2;border-radius:8px;padding:9px 14px;font-size:11.5px;font-weight:800;color:#111827;cursor:pointer">Choose file</button>
                </div>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
                <div>
                  <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">3. ROLE / TITLE</div>
                  <input value="{{ selectedCreator.profileRole }}" sc-camel-on-change="{{ selectedCreator.setProfileRole }}" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
                </div>
                <div>
                  <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">4. LOCATION</div>
                  <input value="{{ selectedCreator.profileLocation }}" sc-camel-on-change="{{ selectedCreator.setProfileLocation }}" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
                </div>
              </div>
              <div style="margin-bottom:12px">
                <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">5. BIO</div>
                <textarea value="{{ selectedCreator.profileBio }}" sc-camel-on-change="{{ selectedCreator.setProfileBio }}" rows="3" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #E8EDF2;padding:10px 12px;font-size:12.5px;resize:vertical"></textarea>
              </div>
              <div style="font-size:10px;font-weight:800;color:#9CA3AF;letter-spacing:0.05em;margin-bottom:8px">6. SOCIAL LINKS</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
                <input value="{{ selectedCreator.socialFacebook }}" sc-camel-on-change="{{ selectedCreator.setSocialFacebook }}" placeholder="Facebook URL" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
                <input value="{{ selectedCreator.socialInstagram }}" sc-camel-on-change="{{ selectedCreator.setSocialInstagram }}" placeholder="Instagram URL" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
                <input value="{{ selectedCreator.socialYoutube }}" sc-camel-on-change="{{ selectedCreator.setSocialYoutube }}" placeholder="YouTube URL" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
                <input value="{{ selectedCreator.socialTiktok }}" sc-camel-on-change="{{ selectedCreator.setSocialTiktok }}" placeholder="TikTok URL" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
                <div>
                  <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">7. BRAND PARTNERS</div>
                  <textarea value="{{ selectedCreator.brandPartnersText }}" sc-camel-on-change="{{ selectedCreator.setBrandPartnersText }}" rows="2" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #E8EDF2;padding:8px 10px;font-size:12px;resize:vertical"></textarea>
                </div>
                <div>
                  <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">8. COLLAB TYPES</div>
                  <textarea value="{{ selectedCreator.collabTypesText }}" sc-camel-on-change="{{ selectedCreator.setCollabTypesText }}" rows="2" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #E8EDF2;padding:8px 10px;font-size:12px;resize:vertical"></textarea>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">
                <input value="{{ selectedCreator.profileEmail }}" sc-camel-on-change="{{ selectedCreator.setProfileEmail }}" placeholder="Contact email" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
                <input value="{{ selectedCreator.profilePhone }}" sc-camel-on-change="{{ selectedCreator.setProfilePhone }}" placeholder="Phone" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
                <input value="{{ selectedCreator.profileResponseTime }}" sc-camel-on-change="{{ selectedCreator.setProfileResponseTime }}" placeholder="Response time" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
              </div>
              <div style="border-top:1px solid #F1F3F5;padding-top:12px">
                <div style="font-size:10px;font-weight:800;color:#9CA3AF;letter-spacing:0.05em;margin-bottom:8px">9. REVIEW / STORY VIDEO EMBED (URL only)</div>
                <input value="{{ selectedCreator.reviewVideoUrl }}" sc-camel-on-change="{{ selectedCreator.setReviewVideoUrl }}" placeholder="Paste YouTube / MP4 HTTPS URL" style="width:100%;box-sizing:border-box;height:36px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12px">
              </div>
            </div>
`;

const oldCreatorStart = '            <!-- CREATOR PROFILE FIELDS (catalog-backed) -->';
const oldCreatorEnd = '<!-- CREATOR STUDIO (Guide builder, reused from Website CMS Guide Studio) -->';
const cs = app.indexOf(oldCreatorStart);
const ce = app.indexOf(oldCreatorEnd);
if (cs < 0 || ce < 0) throw new Error('Creator editor markers not found');
app = app.slice(0, cs) + CREATOR_EDITOR + '\n' + app.slice(ce);
console.log('Replaced creator profile editor');

// Remove creator trust score + audience metrics cards (view-only)
const trustBlock = `            <div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:16px">
              <div style="font-size:10px;font-weight:800;color:#111827;letter-spacing:0.04em;margin-bottom:10px">TRUST SCORE BREAKDOWN</div>`;
const trustIdx = app.indexOf(trustBlock);
if (trustIdx > 0) {
  // find closing of that card: next sibling after rating bars ends with </div>\n            </div>\n          </div>
  const afterTrust = app.indexOf('            <div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:16px">', trustIdx + 10);
  // Actually structure: trust card closes then </div> of left column. Find end of trust card by matching from trustIdx
  const trustCardEnd = app.indexOf('            </div>\n          </div>\n\n          <div style="display:flex;flex-direction:column;gap:14px;min-width:0">', trustIdx);
  if (trustCardEnd > trustIdx) {
    // Remove only the trust score card, keep left column with profile card
    // Find start of trust card (previous sibling ends before it)
    app = app.slice(0, trustIdx) + app.slice(trustCardEnd);
    console.log('Removed creator trust score card');
  }
}

const audienceMetrics = `            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px">
              <div style="background:#fff;border:1px solid #E8EDF2;border-radius:8px;padding:14px">
                <div style="font-size:9px;font-weight:800;color:#9CA3AF">CONTENT PUBLISHED</div>`;
const am = app.indexOf(audienceMetrics);
if (am > 0) {
  const amEnd = app.indexOf('            <div style="display:flex;gap:16px;background:#fff;border:1px solid #E8EDF2;border-radius:8px;padding:0 16px;overflow-x:auto">', am);
  if (amEnd > am) {
    app = app.slice(0, am) + app.slice(amEnd);
    console.log('Removed creator audience/metrics cards');
  }
}

// Remove community says from creator reviews tab content - find and strip manage-ish community block? Keep partnerships editable.
const communityStart = '                <div style="background:#fff;border:1px solid #E8EDF2;border-radius:8px;padding:16px">\n                  <div style="font-size:13px;font-weight:800;margin-bottom:14px">What The Community Says</div>';
const cm = app.indexOf(communityStart);
if (cm > 0) {
  const cmEnd = app.indexOf('              </div>\n            </sc-if>\n          </div>\n        </div>\n      </sc-if>\n\n      <!-- ===== DEALS ===== -->', cm);
  // safer: find next closing of that card only
  const nextCard = app.indexOf('                <div style="background:#fff;border:1px solid #E8EDF2;border-radius:8px;padding:16px">', cm + 20);
  // community is last in reviews tab - remove until after its closing before </div></sc-if>
  const communityClose = app.indexOf('                </div>\n              </div>\n            </sc-if>', cm);
  if (communityClose > cm) {
    app = app.slice(0, cm) + app.slice(communityClose + '                </div>\n'.length);
    console.log('Removed creator community reviews block');
  }
}

const PRODUCT_GALLERY = `
        <!-- CORE PRODUCT PROFILE — gallery first (storefront order) -->
        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:22px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
            <div style="display:flex;gap:12px">
              <div style="width:34px;height:34px;border-radius:8px;background:rgba(255,91,0,0.12);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">🖼</div>
              <div>
                <div style="font-size:10px;font-weight:800;color:#9CA3AF;letter-spacing:0.05em">PRIMARY PRESENTATION</div>
                <div style="font-size:14.5px;font-weight:800;margin-top:2px">Product Gallery</div>
              </div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
            <div>
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px;letter-spacing:0.04em">1. MAIN PRODUCT PHOTO</div>
              <div style="height:150px;border-radius:10px;border:1px solid #E8EDF2;overflow:hidden;background:#F9FAFB;margin-bottom:8px;display:flex;align-items:center;justify-content:center">
                <sc-if value="{{ editingProduct.hasMainImage }}" hint-placeholder-val="{{ false }}">
                  <img src="{{ editingProduct.image }}" alt="Main" style="width:100%;height:100%;object-fit:cover">
                </sc-if>
                <sc-if value="{{ !editingProduct.hasMainImage }}" hint-placeholder-val="{{ true }}">
                  <span style="font-size:12px;color:#9CA3AF;font-weight:600">No photo yet</span>
                </sc-if>
              </div>
              <button sc-camel-on-click="{{ uploadProductImage_main }}" style="background:#fff;border:1px solid #E8EDF2;border-radius:8px;padding:8px 12px;font-size:11.5px;font-weight:800;cursor:pointer;margin-bottom:12px">Choose file</button>
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px;letter-spacing:0.04em">2. GALLERY THUMBS</div>
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
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px;letter-spacing:0.04em">3. VIDEO COVER (optional upload)</div>
              <div style="height:150px;border-radius:10px;border:1px solid #E8EDF2;overflow:hidden;background:#F9FAFB;margin-bottom:8px;display:flex;align-items:center;justify-content:center">
                <sc-if value="{{ editingProduct.hasVideoCover }}" hint-placeholder-val="{{ false }}">
                  <img src="{{ editingProduct.videoCover }}" alt="Video cover" style="width:100%;height:100%;object-fit:cover">
                </sc-if>
                <sc-if value="{{ !editingProduct.hasVideoCover }}" hint-placeholder-val="{{ true }}">
                  <span style="font-size:12px;color:#9CA3AF;font-weight:600">No cover yet</span>
                </sc-if>
              </div>
              <button sc-camel-on-click="{{ uploadProductImage_videoCover }}" style="background:#fff;border:1px solid #E8EDF2;border-radius:8px;padding:8px 12px;font-size:11.5px;font-weight:800;cursor:pointer;margin-bottom:10px">Choose file</button>
              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px;letter-spacing:0.04em">4. EMBEDDED VIDEO URL</div>
              <input value="{{ editingProduct.videoUrl }}" sc-camel-on-change="{{ setField_videoUrl }}" placeholder="Paste video HTTPS URL (YouTube/MP4)..." style="width:100%;box-sizing:border-box;height:38px;border-radius:8px;border:1px solid #E8EDF2;padding:0 12px;font-size:12.5px">
            </div>
          </div>
`;

// Remove engagement stats bar (view-only analytics)
const engStart = '        <!-- ENGAGEMENT STATS BAR -->';
const engEnd = '        <!-- CORE PRODUCT PROFILE -->';
const es = app.indexOf(engStart);
const ee = app.indexOf(engEnd);
if (es > 0 && ee > es) {
  app = app.slice(0, es) + app.slice(ee);
  console.log('Removed product engagement stats bar');
}

// Replace size guide + old core profile gallery with: gallery first, then rest of core (name/price), then size guide later
const sizeGuideStart = '        <!-- CORE PRODUCT PROFILE -->';
const afterGalleryMarker = '          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">\n            <div>\n              <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px;letter-spacing:0.04em">PRODUCT CATALOG SKU NAME</div>';
const sg = app.indexOf(sizeGuideStart);
const ag = app.indexOf(afterGalleryMarker);
if (sg < 0 || ag < 0) throw new Error('Product gallery markers not found ' + sg + ' ' + ag);
app = app.slice(0, sg) + PRODUCT_GALLERY + '\n' + app.slice(ag);
console.log('Replaced product gallery with Choose file uploads (gallery first)');

// Move size guide after description area — find size guide leftover? We removed it when replacing from CORE PRODUCT. Need to re-insert size guide later.
// Check if SIZE GUIDE still exists
if (!app.includes('Persist to product detail')) {
  const sizeGuideBlock = `
        <!-- SIZE GUIDE (catalog product-detail) -->
        <div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:22px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <div>
              <div style="font-size:10px;font-weight:800;color:#FF5B00;letter-spacing:0.05em">SIZE GUIDE</div>
              <div style="font-size:14.5px;font-weight:800;margin-top:2px">Optional size chart for storefront</div>
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
          <div style="margin-bottom:10px">
            <div style="font-size:10.5px;font-weight:800;color:#6B7280;margin-bottom:6px">SIZE GUIDE IMAGE</div>
            <div style="height:100px;border-radius:8px;border:1px solid #E8EDF2;overflow:hidden;background:#F9FAFB;margin-bottom:8px;display:flex;align-items:center;justify-content:center">
              <sc-if value="{{ editingProduct.hasSizeGuideImage }}" hint-placeholder-val="{{ false }}"><img src="{{ editingProduct.sizeGuideImageUrl }}" style="width:100%;height:100%;object-fit:contain"></sc-if>
              <sc-if value="{{ !editingProduct.hasSizeGuideImage }}" hint-placeholder-val="{{ true }}"><span style="font-size:12px;color:#9CA3AF;font-weight:600">No image</span></sc-if>
            </div>
            <button sc-camel-on-click="{{ uploadProductImage_sizeGuide }}" style="background:#fff;border:1px solid #E8EDF2;border-radius:8px;padding:8px 12px;font-size:11.5px;font-weight:800;cursor:pointer">Choose file</button>
          </div>
          <textarea value="{{ editingProduct.sizeGuideHeadersText }}" sc-camel-on-change="{{ setField_sizeGuideHeadersText }}" rows="2" placeholder="Column headers (one per line)" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #E8EDF2;padding:8px 10px;font-size:12px;resize:vertical;margin-bottom:10px"></textarea>
          <textarea value="{{ editingProduct.sizeGuideRowsText }}" sc-camel-on-change="{{ setField_sizeGuideRowsText }}" rows="3" placeholder="Rows: Size|Chest|Waist|Hip" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid #E8EDF2;padding:8px 10px;font-size:12px;font-family:'JetBrains Mono',monospace;resize:vertical"></textarea>
        </div>
`;
  const tagsMarker = 'editingProduct.tagsText';
  const ti = app.indexOf(tagsMarker);
  if (ti > 0) {
    const cardStart = app.lastIndexOf('<div style="background:#fff;border:1px solid #E8EDF2;border-radius:10px;padding:22px;margin-bottom:16px">', ti);
    app = app.slice(0, cardStart) + sizeGuideBlock + '\n' + app.slice(cardStart);
    console.log('Re-inserted size guide after gallery/core (before tags)');
  }
}

// JS: upload helpers + preview flags + story video field
const UPLOAD_METHODS = `
  uploadBrandImage = (brandName, key) => async () => {
    const api = window.CmsStudioProfileApi;
    if (!api) { this.showToast('Upload API unavailable'); return; }
    try {
      this.showToast('Uploading...');
      const url = await api.pickAndUploadImage();
      this.setState(s => ({
        brandProfileDrafts: {
          ...(s.brandProfileDrafts || {}),
          [brandName]: { ...(s.brandProfileDrafts && s.brandProfileDrafts[brandName] || {}), [key]: url },
        },
      }));
      this.showToast('Image uploaded');
    } catch (err) {
      if (String(err && err.message) !== 'No file selected') this.showToast('Upload failed: ' + (err && err.message ? err.message : err));
    }
  };
  uploadCreatorImage = (creatorName, key) => async () => {
    const api = window.CmsStudioProfileApi;
    if (!api) { this.showToast('Upload API unavailable'); return; }
    try {
      this.showToast('Uploading...');
      const url = await api.pickAndUploadImage();
      this.setState(s => ({
        creatorProfileDrafts: {
          ...(s.creatorProfileDrafts || {}),
          [creatorName]: { ...(s.creatorProfileDrafts && s.creatorProfileDrafts[creatorName] || {}), [key]: url },
        },
      }));
      this.showToast('Image uploaded');
    } catch (err) {
      if (String(err && err.message) !== 'No file selected') this.showToast('Upload failed: ' + (err && err.message ? err.message : err));
    }
  };
  uploadProductImageField = (field) => async () => {
    const api = window.CmsStudioProfileApi;
    if (!api || !this.state.editingProduct) { this.showToast('Upload API unavailable'); return; }
    try {
      this.showToast('Uploading...');
      const url = await api.pickAndUploadImage();
      this.setState(s => ({ editingProduct: { ...s.editingProduct, [field]: url } }));
      this.showToast('Image uploaded');
    } catch (err) {
      if (String(err && err.message) !== 'No file selected') this.showToast('Upload failed: ' + (err && err.message ? err.message : err));
    }
  };
`;

if (!app.includes('uploadBrandImage = (brandName')) {
  const anchor = '  setBrandProfileField = (brandName, key) => (e) => {';
  if (!app.includes(anchor)) throw new Error('setBrandProfileField not found');
  app = app.replace(anchor, UPLOAD_METHODS + '\n  setBrandProfileField = (brandName, key) => (e) => {');
  console.log('Inserted upload methods');
}

// Wire brand upload + has flags + story video
const brandWireExtra = `
      selectedBrand.hasProfileCover = !!(selectedBrand.profileCover);
      selectedBrand.hasProfileLogo = !!(selectedBrand.profileLogo);
      selectedBrand.storyVideoUrl = __bp.storyVideoUrl || b.storyVideoUrl || '';
      selectedBrand.setStoryVideoUrl = this.setBrandProfileField(b.name, 'storyVideoUrl');
      selectedBrand.onUploadCover = this.uploadBrandImage(b.name, 'coverImage');
      selectedBrand.onUploadLogo = this.uploadBrandImage(b.name, 'logo');
`;
if (!app.includes('onUploadCover = this.uploadBrandImage')) {
  const marker = "selectedBrand.setProfileTagsText = this.setBrandProfileField(b.name, 'tagsText');";
  if (!app.includes(marker)) throw new Error('brand tags wire not found');
  app = app.replace(marker, marker + '\n' + brandWireExtra);
  console.log('Wired brand upload handlers');
}

const creatorWireExtra = `
      selectedCreator.hasProfileCover = !!(selectedCreator.profileCover);
      selectedCreator.hasProfileAvatar = !!(selectedCreator.profileAvatar);
      selectedCreator.reviewVideoUrl = __cp.reviewVideoUrl || c.reviewVideoUrl || '';
      selectedCreator.setReviewVideoUrl = this.setCreatorProfileField(c.name, 'reviewVideoUrl');
      selectedCreator.onUploadCover = this.uploadCreatorImage(c.name, 'coverImage');
      selectedCreator.onUploadAvatar = this.uploadCreatorImage(c.name, 'avatar');
`;
if (!app.includes('onUploadCover = this.uploadCreatorImage')) {
  const marker = 'selectedCreator.onSaveProfile = this.saveCreatorProfile(c.name);';
  if (!app.includes(marker)) throw new Error('creator save wire not found');
  app = app.replace(marker, creatorWireExtra + '\n      ' + marker);
  console.log('Wired creator upload handlers');
}

// Product gallery flags + upload bindings in renderVals
if (!app.includes('uploadProductImage_main')) {
  const productExtras = `
      uploadProductImage_main: this.uploadProductImageField('image'),
      uploadProductImage_gallery1: this.uploadProductImageField('gallery1'),
      uploadProductImage_gallery2: this.uploadProductImageField('gallery2'),
      uploadProductImage_gallery3: this.uploadProductImageField('gallery3'),
      uploadProductImage_gallery4: this.uploadProductImageField('gallery4'),
      uploadProductImage_videoCover: this.uploadProductImageField('videoCover'),
      uploadProductImage_sizeGuide: this.uploadProductImageField('sizeGuideImageUrl'),
      setField_videoUrl: this.setField('videoUrl'),
`;
  // enrich editingProduct in renderVals
  const epLine = 'editingProduct: this.state.editingProduct ? {...this.state.editingProduct, feeBreakdown:';
  if (app.includes(epLine)) {
    app = app.replace(
      epLine,
      `editingProduct: this.state.editingProduct ? {...this.state.editingProduct, hasMainImage: !!(this.state.editingProduct.image), hasGallery1: !!(this.state.editingProduct.gallery1), hasGallery2: !!(this.state.editingProduct.gallery2), hasGallery3: !!(this.state.editingProduct.gallery3), hasGallery4: !!(this.state.editingProduct.gallery4), hasVideoCover: !!(this.state.editingProduct.videoCover), hasSizeGuideImage: !!(this.state.editingProduct.sizeGuideImageUrl), feeBreakdown: `,
    );
  }
  const setFieldName = "setField_name: this.setField('name'),";
  if (app.includes(setFieldName)) {
    app = app.replace(setFieldName, productExtras + '\n      ' + setFieldName);
    console.log('Wired product gallery uploads');
  }
}

// Bump studio-profile-api cache buster in script tag
app = app.replace(/studio-profile-api\.js\?v=[^"]+/, 'studio-profile-api.js?v=20260731-uploads-1');

fs.writeFileSync(appPath, app);
console.log('Done. bytes', app.length);
