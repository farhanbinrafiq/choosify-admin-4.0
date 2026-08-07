/**
 * Catalog API helpers for cms-mirror Brand / Product / Creator studio editors.
 * Same-origin iframe reads auth token from parent localStorage.
 */
(function (global) {
  var API_BASE = '/api/v1';
  var AUTH_KEY = 'choosify_auth_token';

  function authToken() {
    // Prefer the token posted by CmsMirrorHost (avoids storage-partition / parent access issues).
    try {
      if (global.__CMS_MIRROR_AUTH_TOKEN__) return global.__CMS_MIRROR_AUTH_TOKEN__;
    } catch (_) { /* ignore */ }

    // Same-origin iframe shares localStorage with the parent SPA — try the iframe first.
    // Do not wrap parent access in the same try/catch: a SecurityError on parent.localStorage
    // would otherwise skip own localStorage and return null.
    try {
      if (global.localStorage) {
        var own = global.localStorage.getItem(AUTH_KEY);
        if (own) return own;
      }
    } catch (_) { /* ignore */ }

    try {
      if (global.parent && global.parent !== global && global.parent.localStorage) {
        var fromParent = global.parent.localStorage.getItem(AUTH_KEY);
        if (fromParent) return fromParent;
      }
    } catch (_) { /* ignore */ }

    return null;
  }

  /** Ask the parent SPA to re-post the access token if we do not have one yet. */
  function ensureAuthToken() {
    return new Promise(function (resolve) {
      var existing = authToken();
      if (existing) {
        resolve(existing);
        return;
      }
      if (!global.parent || global.parent === global || typeof global.parent.postMessage !== 'function') {
        resolve(null);
        return;
      }
      var settled = false;
      function finish(token) {
        if (settled) return;
        settled = true;
        try { global.removeEventListener('message', onMsg); } catch (_) { /* ignore */ }
        resolve(token || null);
      }
      function onMsg(ev) {
        var data = ev && ev.data;
        if (!data || data.type !== 'cms-mirror-auth-token') return;
        if (typeof data.token === 'string' && data.token) {
          global.__CMS_MIRROR_AUTH_TOKEN__ = data.token;
          finish(data.token);
        }
      }
      global.addEventListener('message', onMsg);
      try {
        global.parent.postMessage({ type: 'cms-mirror-auth-token-request' }, '*');
      } catch (_) { /* ignore */ }
      setTimeout(function () {
        finish(authToken());
      }, 400);
    });
  }

  function request(path, method, body) {
    method = method || 'GET';
    var needsAuth = method !== 'GET';

    function send(token) {
      var headers = { 'Content-Type': 'application/json' };
      // Match catalogApi: attach Bearer whenever present (writes require it).
      if (token) headers.Authorization = 'Bearer ' + token;
      return fetch(API_BASE + path, {
        method: method,
        headers: headers,
        credentials: 'include',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }).then(function (res) {
        return res.text().then(function (text) {
          var parsed = null;
          try { parsed = text ? JSON.parse(text) : null; } catch (_) { parsed = { error: text }; }
          if (!res.ok) {
            var msg = (parsed && (parsed.error || parsed.message)) || ('Request failed (' + res.status + ')');
            throw new Error(msg);
          }
          return parsed;
        });
      });
    }

    if (!needsAuth) {
      return send(authToken());
    }

    return ensureAuthToken().then(function (token) {
      if (!token) {
        throw new Error('Missing bearer token');
      }
      return send(token);
    });
  }

  function listBrands() {
    return request('/catalog/brands').then(function (r) { return (r && r.data) || []; });
  }

  function ensureSellerWorkspace() {
    return request('/catalog/workspace/seller/ensure', 'POST', {}).then(function (r) {
      return r || { brands: [], products: [], customers: [], created: false };
    });
  }

  function ensureCreatorWorkspace(hints) {
    return request('/catalog/workspace/creator/ensure', 'POST', hints || {}).then(function (r) {
      return r || { creators: [], created: false };
    });
  }

  function listSellerCustomers() {
    return request('/catalog/workspace/seller/customers').then(function (r) {
      return (r && r.data) || [];
    });
  }

  function patchBrand(id, payload) {
    return request('/catalog/brands/' + encodeURIComponent(id), 'PATCH', payload)
      .then(function (r) { return (r && r.data) || r; });
  }

  function listCreators() {
    return request('/catalog/creators').then(function (r) { return (r && r.data) || []; });
  }

  function patchCreator(id, payload) {
    return request('/catalog/creators/' + encodeURIComponent(id), 'PATCH', payload)
      .then(function (r) { return (r && r.data) || r; });
  }

  function putCreator(id, payload) {
    return request('/catalog/creators/' + encodeURIComponent(id), 'PUT', payload)
      .then(function (r) { return (r && r.data) || r; });
  }

  function listProducts() {
    return request('/catalog/products?limit=200').then(function (r) { return (r && r.data) || []; });
  }

  function putProduct(id, payload) {
    return request('/catalog/products/' + encodeURIComponent(id), 'PUT', payload)
      .then(function (r) { return (r && r.data) || r; });
  }

  function patchProduct(id, payload) {
    return request('/catalog/products/' + encodeURIComponent(id), 'PATCH', payload)
      .then(function (r) { return (r && r.data) || r; });
  }

  function getProductDetail(productId) {
    return request('/catalog/product-details/' + encodeURIComponent(productId))
      .catch(function () { return null; });
  }

  function upsertProductDetail(productId, payload) {
    return request('/catalog/product-details/' + encodeURIComponent(productId), 'PUT', payload)
      .then(function (r) { return (r && r.data) || r; });
  }

  function putGuide(id, payload) {
    return request('/catalog/guides/' + encodeURIComponent(id), 'PUT', payload)
      .then(function (r) { return (r && r.data) || r; });
  }

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  function splitLines(text) {
    return String(text || '')
      .split(/\r?\n/)
      .map(function (l) { return l.trim(); })
      .filter(Boolean);
  }

  function parseKeyValueLines(text) {
    return splitLines(text).map(function (line) {
      var idx = line.indexOf(':');
      if (idx < 0) return { key: line, value: '' };
      return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    });
  }

  function overviewBlocksFromStudio(d) {
    var blocks = [];
    var defs = [
      { id: 'quality', title: 'Quality', text: d.overviewQualityText },
      { id: 'features', title: 'Features', text: d.overviewFeaturesText },
      { id: 'audience', title: 'Audience', text: d.overviewAudienceText },
      { id: 'support', title: 'Support', text: d.overviewSupportText },
    ];
    defs.forEach(function (def, i) {
      var content = String(def.text || '').trim();
      if (!content) return;
      blocks.push({
        id: def.id,
        title: def.title,
        content: content,
        bullets: splitLines(content),
        enabled: true,
        sortOrder: i,
      });
    });
    return blocks;
  }

  function optionGroupsFromText(text) {
    return splitLines(text).map(function (line, i) {
      var parts = line.split('|');
      var name = (parts[0] || 'Option').trim();
      var values = (parts[1] || '')
        .split(',')
        .map(function (v) { return v.trim(); })
        .filter(Boolean);
      return {
        id: 'opt-' + i + '-' + slugify(name),
        name: name,
        displayType: 'pills',
        values: values,
      };
    });
  }

  function sizeGuideFromStudio(d) {
    var enabled = !!(d.sizeGuideEnabled === true || d.sizeGuideEnabled === 'true' || d.sizeGuideEnabled === 1);
    var rowsText = String(d.sizeGuideRowsText || '').trim();
    var headers = splitLines(d.sizeGuideHeadersText || '').length
      ? splitLines(d.sizeGuideHeadersText)
      : ['Chest', 'Waist', 'Hip'];
    var rows = splitLines(rowsText).map(function (line) {
      var cells = line.split('|').map(function (c) { return c.trim(); });
      var row = { size: cells[0] || '' };
      headers.forEach(function (h, i) {
        row[h] = cells[i + 1] || '';
      });
      return row;
    });
    return {
      enabled: enabled,
      title: d.sizeGuideTitle || 'Size Guide',
      description: d.sizeGuideDescription || '',
      imageUrl: d.sizeGuideImageUrl || '',
      unitLabel: d.sizeGuideUnitLabel || 'cm',
      columnHeaders: headers,
      rows: rows,
    };
  }

  function brandPayloadFromMirror(b, draft) {
    draft = draft || {};
    var services = draft.servicesText != null
      ? splitLines(draft.servicesText)
      : (b.services || []);
    var tags = draft.tagsText != null
      ? splitLines(draft.tagsText).map(function (t) {
          return t.charAt(0) === '#' ? t : '#' + t.replace(/^#/, '');
        })
      : (b.tags || []);
    return {
      name: b.name,
      category: b.category || 'General',
      description: draft.story || draft.description || b.tagline || b.description || '',
      logo: draft.logo || b.logo || '',
      coverImage: draft.coverImage || b.coverImage || '',
      tagline: draft.tagline != null ? draft.tagline : (b.tagline || ''),
      website: draft.website != null ? draft.website : (b.website || ''),
      story: draft.story != null ? draft.story : (b.story || b.tagline || ''),
      storyVideoUrl: draft.storyVideoUrl != null ? draft.storyVideoUrl : (b.storyVideoUrl || ''),
      credentials: draft.credentials != null ? draft.credentials : (b.credentials || ''),
      socialLinks: {
        facebook: draft.socialFacebook || (b.socialLinks && b.socialLinks.facebook) || '',
        instagram: draft.socialInstagram || (b.socialLinks && b.socialLinks.instagram) || '',
        youtube: draft.socialYoutube || (b.socialLinks && b.socialLinks.youtube) || '',
        tiktok: draft.socialTiktok || (b.socialLinks && b.socialLinks.tiktok) || '',
        linkedin: draft.socialLinkedin || (b.socialLinks && b.socialLinks.linkedin) || '',
      },
      overview: {
        address: draft.address != null ? draft.address : (b.address || ''),
        email: draft.email != null ? draft.email : (b.email || ''),
        phone: draft.phone != null ? draft.phone : (b.phone || ''),
        priceRange: draft.priceRange != null ? draft.priceRange : (b.priceRange || ''),
        ageFocus: draft.ageFocus != null ? draft.ageFocus : (b.ageFocus || ''),
        audience: draft.audience != null ? draft.audience : (b.audience || ''),
        services: services,
        tags: tags,
      },
      verifiedStatus: !!b.verified,
      featuredFlag: false,
      sponsoredFlag: false,
      marketplaceAccess: typeof b.marketplaceAccess === 'boolean'
        ? b.marketplaceAccess
        : (typeof draft.marketplaceAccess === 'boolean' ? draft.marketplaceAccess : undefined),
    };
  }

  /** Section-scoped PATCH body so one CMS card can save without wiping others. */
  function brandSectionPayloadFromMirror(b, draft, section) {
    var full = brandPayloadFromMirror(b, draft);
    switch (section) {
      case 'cover':
        return { logo: full.logo, coverImage: full.coverImage };
      case 'identity':
        return { tagline: full.tagline, website: full.website };
      case 'social':
        return { socialLinks: full.socialLinks };
      case 'overview':
        return {
          story: full.story,
          description: full.description,
          overview: full.overview,
        };
      case 'benefits':
        return { overview: full.overview };
      case 'video':
        return { storyVideoUrl: full.storyVideoUrl };
      default:
        return full;
    }
  }

  function creatorPayloadFromMirror(c, draft) {
    draft = draft || {};
    return {
      name: c.name,
      handle: draft.handle || c.handle || ('@' + slugify(c.name)),
      avatar: draft.avatar || c.avatar || '',
      coverImage: draft.coverImage || c.coverImage || '',
      role: draft.role != null ? draft.role : (c.role || ''),
      location: draft.location != null ? draft.location : (c.location || ''),
      reviewVideoUrl: draft.reviewVideoUrl != null ? draft.reviewVideoUrl : (c.reviewVideoUrl || ''),
      bio: draft.bio != null ? draft.bio : (c.bio || ''),
      score: typeof c.trustScore === 'number' ? c.trustScore : (c.score || 4.5),
      bestFor: c.bestFor || 'Tech',
      bestForTags: c.bestForTags || [],
      platforms: typeof c.platform === 'string' ? [c.platform] : (c.platforms || c.contentPlatforms || ['YouTube']),
      followers: typeof c.followers === 'object' && c.followers
        ? c.followers
        : { YouTube: String(c.followers || 0) },
      socialLinks: {
        facebook: draft.socialFacebook || (c.socialLinks && c.socialLinks.facebook) || '',
        instagram: draft.socialInstagram || (c.socialLinks && c.socialLinks.instagram) || '',
        youtube: draft.socialYoutube || (c.socialLinks && c.socialLinks.youtube) || '',
        tiktok: draft.socialTiktok || (c.socialLinks && c.socialLinks.tiktok) || '',
        linkedin: draft.socialLinkedin || (c.socialLinks && c.socialLinks.linkedin) || '',
      },
      brandPartners: draft.brandPartnersText != null
        ? splitLines(draft.brandPartnersText).join(',').split(',').map(function (s) { return s.trim(); }).filter(Boolean)
        : (c.brandPartners || []),
      collabTypes: draft.collabTypesText != null
        ? splitLines(draft.collabTypesText).join(',').split(',').map(function (s) { return s.trim(); }).filter(Boolean)
        : (c.collabTypes || []),
      responseTime: draft.responseTime != null ? draft.responseTime : (c.responseTime || ''),
      preferredContact: draft.preferredContact != null ? draft.preferredContact : (c.preferredContact || ''),
      email: draft.email != null ? draft.email : (c.contactEmail || c.email || ''),
      phone: draft.phone != null ? draft.phone : (c.phone || ''),
      category: c.category || c.bestFor || 'Tech',
      verifiedStatus: c.status !== 'Pending' && c.status !== 'Suspended',
      featuredFlag: !!c.featuredFlag,
      videos: c.videos || [],
      reels: c.reels || [],
      blogs: c.blogs || [],
      status: 'live',
    };
  }

  function guidePayloadFromDraft(draft, creator) {
    draft = draft || {};
    var title = draft.title || 'Untitled Guide';
    var id = draft.catalogId || ('guide-' + slugify(title) + '-' + Date.now().toString(36));
    return {
      id: id,
      slug: draft.slug || slugify(title),
      title: title,
      author: draft.author || (creator && creator.name) || 'Creator',
      authorAvatar: creator && creator.avatar,
      category: draft.category || 'Tech',
      excerpt: (draft.articleText || '').slice(0, 180),
      image: draft.heroImage || '',
      type: 'article',
      readTime: draft.readTime || '5 min',
      views: String(draft.views || '0'),
      tags: [],
      creatorId: creator && (creator.catalogId || creator.id),
      productIds: [],
      verdict: '',
      whatWeLike: [],
      whatToConsider: [],
      status: 'live',
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || '');
        var comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = function () {
        reject(reader.error || new Error('Failed to read file'));
      };
      reader.readAsDataURL(file);
    });
  }

  function uploadImage(file) {
    if (!file) return Promise.reject(new Error('No file selected'));
    return fileToBase64(file).then(function (base64Data) {
      return request('/catalog/media/upload', 'POST', {
        fileName: file.name || 'upload.jpg',
        mimeType: file.type || 'image/jpeg',
        data: base64Data,
      }).then(function (r) {
        if (!r || !r.url) throw new Error('Upload succeeded but no URL returned');
        return r.url;
      });
    });
  }

  function pickImageFile() {
    return new Promise(function (resolve, reject) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp,image/gif';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.onchange = function () {
        var file = input.files && input.files[0];
        document.body.removeChild(input);
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }
        resolve(file);
      };
      input.click();
    });
  }

  function pickAndUploadImage() {
    return pickImageFile().then(uploadImage);
  }

  global.CmsStudioProfileApi = {
    request: request,
    listBrands: listBrands,
    ensureSellerWorkspace: ensureSellerWorkspace,
    ensureCreatorWorkspace: ensureCreatorWorkspace,
    listSellerCustomers: listSellerCustomers,
    patchBrand: patchBrand,
    listCreators: listCreators,
    patchCreator: patchCreator,
    putCreator: putCreator,
    listProducts: listProducts,
    putProduct: putProduct,
    patchProduct: patchProduct,
    getProductDetail: getProductDetail,
    upsertProductDetail: upsertProductDetail,
    putGuide: putGuide,
    slugify: slugify,
    splitLines: splitLines,
    parseKeyValueLines: parseKeyValueLines,
    overviewBlocksFromStudio: overviewBlocksFromStudio,
    optionGroupsFromText: optionGroupsFromText,
    sizeGuideFromStudio: sizeGuideFromStudio,
    brandPayloadFromMirror: brandPayloadFromMirror,
    brandSectionPayloadFromMirror: brandSectionPayloadFromMirror,
    creatorPayloadFromMirror: creatorPayloadFromMirror,
    guidePayloadFromDraft: guidePayloadFromDraft,
    uploadImage: uploadImage,
    pickImageFile: pickImageFile,
    pickAndUploadImage: pickAndUploadImage,
  };
})(typeof window !== 'undefined' ? window : globalThis);
