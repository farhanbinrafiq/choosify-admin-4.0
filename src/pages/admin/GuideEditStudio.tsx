import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, History, RotateCw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { catalogApi } from '../../services/catalogApi';
import { useEntityDraft } from '../../hooks/useEntityDraft';
import { GuideDetailPresentation } from '../../components/guide-detail';
import { 
  createBlankGuideModel,
  editorModelToGuidePayload,
  mapCatalogGuideToEditor,
  type GuideEditSection,
  type GuideEditorModel,
} from './guideEditorModel';

function linesFromTextarea(value: string): string[] {
  return value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function csvToList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function GuideEditStudio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  const activeId = isNew ? 'new' : id;

  const draftKey = `choosify_guide_draft_${activeId}`;
  const pubKey = `choosify_guide_published_${activeId}`;
  const versionsKey = `choosify_guide_versions_${activeId}`;

  const [model, setModel] = useState<GuideEditorModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<GuideEditSection | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [productLabels, setProductLabels] = useState<string[]>([]);
  const [brandLabels, setBrandLabels] = useState<string[]>([]);

  const [mediaForm, setMediaForm] = useState({ image: '', videoUrl: '', watchUrl: '' });
  const [headerForm, setHeaderForm] = useState({
    title: '',
    slug: '',
    category: '',
    excerpt: '',
    author: '',
    authorAvatar: '',
    creatorId: '',
    type: 'article' as GuideEditorModel['type'],
    format: 'buying_guide' as GuideEditorModel['format'],
    readTime: '',
    tags: '',
    status: 'DRAFT' as GuideEditorModel['status'],
  });
  const [bodyText, setBodyText] = useState('');
  const [verdictForm, setVerdictForm] = useState({
    whatWeLike: '',
    whatToConsider: '',
    verdict: '',
  });
  const [assocForm, setAssocForm] = useState({ productIds: '', brandIds: '' });
  const [seoForm, setSeoForm] = useState({ seoTitle: '', seoDescription: '' });

  const {
    versions,
    saveDraft: persistDraft,
    saveVersion,
    isSaving: isDraftSaving,
    error: draftError,
  } = useEntityDraft<GuideEditorModel>(
    'guide',
    isNew ? '' : activeId,
    { draftKey, versionsKey },
    (backendDraft) => {
      if (!backendDraft) return;
      setModel((prev) => {
        const base = prev || createBlankGuideModel(activeId);
        return {
          ...base,
          ...backendDraft,
          id: activeId,
          title: backendDraft.title || base.title,
          image: backendDraft.image || base.image,
          author: backendDraft.author || base.author,
          views: base.views || backendDraft.views || '0',
        };
      });
    },
  );

  useEffect(() => {
    if (isDraftSaving) setSyncStatus('saving');
    else if (draftError) setSyncStatus('error');
    else if (syncStatus === 'saving') setSyncStatus('saved');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDraftSaving, draftError]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      if (isNew) {
        if (!cancelled) {
          setModel(createBlankGuideModel('new'));
          setLoading(false);
        }
        return;
      }

      let loaded: GuideEditorModel | null = null;
      let catalogHit = false;
      try {
        const cacheDraft = localStorage.getItem(draftKey);
        if (cacheDraft) {
          const parsed = JSON.parse(cacheDraft) as GuideEditorModel;
          // Ignore empty cache drafts that wipe a known Guide identity.
          if (parsed?.title) loaded = parsed;
        }
      } catch (_) {}
      if (!loaded) {
        try {
          const cachePub = localStorage.getItem(pubKey);
          if (cachePub) {
            const parsed = JSON.parse(cachePub) as GuideEditorModel;
            if (parsed?.title) loaded = parsed;
          }
        } catch (_) {}
      }

      try {
        const guides = await catalogApi.listGuides();
        const guide = guides.find((g) => g.id === activeId || g.slug === activeId);
        if (guide) {
          catalogHit = true;
          const fromCatalog = mapCatalogGuideToEditor(guide);
          if (loaded && loaded.title) {
            loaded = {
              ...fromCatalog,
              ...loaded,
              id: guide.id,
              title: loaded.title || fromCatalog.title,
              image: loaded.image || fromCatalog.image,
              author: loaded.author || fromCatalog.author,
              authorAvatar: loaded.authorAvatar || fromCatalog.authorAvatar,
              views: fromCatalog.views || loaded.views,
              productIds: loaded.productIds?.length ? loaded.productIds : fromCatalog.productIds,
              brandIds: loaded.brandIds?.length ? loaded.brandIds : fromCatalog.brandIds,
              creatorId: loaded.creatorId || fromCatalog.creatorId,
              status: loaded.status || fromCatalog.status,
            };
      } else {
            loaded = fromCatalog;
          }
        }
      } catch (err) {
        if (!cancelled && !loaded) {
          setLoadError(
            err instanceof Error
              ? err.message
              : 'Catalog Guide could not be loaded (API unavailable or rate-limited).',
          );
          // Must set a model so the UI leaves the infinite loading spinner.
          setModel(createBlankGuideModel(activeId));
          setLoading(false);
          return;
        }
      }

      if (!loaded) {
        if (!cancelled) {
          setLoadError(
            catalogHit
              ? null
              : `Guide "${activeId}" was not found in the catalog.`,
          );
          setModel(createBlankGuideModel(activeId));
          setLoading(false);
        }
        return;
      }
      if (!cancelled) {
        setLoadError(null);
        setModel(loaded);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, isNew]);

  useEffect(() => {
    if (!model) return;
    let cancelled = false;
    async function resolveLabels() {
      try {
        const [products, brands] = await Promise.all([
          catalogApi.listProducts().catch(() => []),
          catalogApi.listBrands().catch(() => []),
        ]);
        if (cancelled || !model) return;
        setProductLabels(
          model.productIds.map((pid) => {
            const p = products.find((x) => x.id === pid);
            return p?.title || pid;
          }),
        );
        setBrandLabels(
          model.brandIds.map((bid) => {
            const b = brands.find((x) => x.id === bid);
            return b?.name || bid;
          }),
        );
      } catch (_) {}
    }
    void resolveLabels();
    return () => {
      cancelled = true;
    };
  }, [model]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(null), 3500);
  };

  const openDrawer = (section: GuideEditSection) => {
    if (!model) return;
    setActiveDrawer(section);
    if (section === 'media') {
      setMediaForm({ image: model.image, videoUrl: model.videoUrl, watchUrl: model.watchUrl });
    } else if (section === 'header') {
      setHeaderForm({
        title: model.title,
        slug: model.slug,
        category: model.category,
        excerpt: model.excerpt,
        author: model.author,
        authorAvatar: model.authorAvatar,
        creatorId: model.creatorId,
        type: model.type,
        format: model.format,
        readTime: model.readTime,
        tags: model.tags.join(', '),
        status: model.status,
      });
    } else if (section === 'content') {
      setBodyText(model.bodyText);
    } else if (section === 'verdict') {
      setVerdictForm({
        whatWeLike: model.whatWeLike.join('\n'),
        whatToConsider: model.whatToConsider.join('\n'),
        verdict: model.verdict,
      });
    } else if (section === 'associations') {
      setAssocForm({
        productIds: model.productIds.join('\n'),
        brandIds: model.brandIds.join('\n'),
      });
    } else if (section === 'seo') {
      setSeoForm({ seoTitle: model.seoTitle, seoDescription: model.seoDescription });
    }
  };

  const saveDrawer = () => {
    if (!model || !activeDrawer) return;
    let next = { ...model };

    if (activeDrawer === 'media') {
      next = {
        ...next,
        image: mediaForm.image,
        videoUrl: mediaForm.videoUrl,
        watchUrl: mediaForm.watchUrl,
      };
    } else if (activeDrawer === 'header') {
      next = {
        ...next,
        title: headerForm.title,
        slug: headerForm.slug,
        category: headerForm.category,
        excerpt: headerForm.excerpt,
        author: headerForm.author,
        authorAvatar: headerForm.authorAvatar,
        creatorId: headerForm.creatorId,
        type: headerForm.type,
        format: headerForm.format,
        readTime: headerForm.readTime,
        tags: csvToList(headerForm.tags),
        status: headerForm.status,
      };
    } else if (activeDrawer === 'content') {
      next = { ...next, bodyText };
    } else if (activeDrawer === 'verdict') {
      next = {
        ...next,
        whatWeLike: linesFromTextarea(verdictForm.whatWeLike),
        whatToConsider: linesFromTextarea(verdictForm.whatToConsider),
        verdict: verdictForm.verdict,
      };
    } else if (activeDrawer === 'associations') {
      next = {
        ...next,
        productIds: linesFromTextarea(assocForm.productIds),
        brandIds: linesFromTextarea(assocForm.brandIds),
      };
    } else if (activeDrawer === 'seo') {
      next = {
        ...next,
        seoTitle: seoForm.seoTitle,
        seoDescription: seoForm.seoDescription,
      };
    }

    setModel(next);
    setHasUnsavedChanges(true);
    setActiveDrawer(null);
    triggerToast('Section saved to draft canvas');
  };

  const handleSaveDraft = async () => {
    if (!model) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(model));
      if (!isNew) {
        persistDraft(model);
        await saveVersion(`Draft ${new Date().toLocaleString()}`, model);
      }
      setHasUnsavedChanges(false);
      setSyncStatus('saved');
      triggerToast('Draft saved');
    } catch (err) {
      setSyncStatus('error');
      triggerToast(err instanceof Error ? err.message : 'Draft save failed');
    }
  };

  const handlePublish = async () => {
    if (!model) return;
    setIsPublishing(true);
    try {
      let guideId = model.id;
      const payload = editorModelToGuidePayload({ ...model, status: 'LIVE' });
      if (isNew || guideId === 'new') {
        guideId = `guide-${Date.now()}`;
        payload.id = guideId;
        if (!payload.slug) payload.slug = guideId;
      }
      await catalogApi.upsertGuide(guideId, payload);
      const published = { ...model, id: guideId, status: 'LIVE' as const };
      localStorage.setItem(`choosify_guide_published_${guideId}`, JSON.stringify(published));
      localStorage.setItem(`choosify_guide_draft_${guideId}`, JSON.stringify(published));
      setModel(published);
      setHasUnsavedChanges(false);
      setShowPublishModal(false);
      triggerToast('Guide published');
      if (isNew) navigate(`/admin/guides/${guideId}/edit`, { replace: true });
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setIsPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[420px] gap-3 text-app-text-muted">
        <RotateCw className="w-10 h-10 animate-spin text-[#EF3C23]" />
        <span className="text-xs font-mono">Loading Guide Visual Builder…</span>
      </div>
    );
  }

  if (!model || (loadError && !model.title)) {
  return (
      <div className="flex flex-col items-center justify-center h-[420px] gap-4 text-center px-6">
        <p className="text-sm font-bold text-[#111827] m-0">Could not load Guide</p>
        <p className="text-[12px] text-slate-500 m-0 max-w-md">
          {loadError || `Guide "${activeId}" could not be loaded.`}
        </p>
        <p className="text-[11px] text-slate-400 m-0 max-w-md">
          If you recently hit API rate limits, wait a moment and retry — or restart the local admin
          server.
        </p>
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={() => navigate('/admin/guides')}
            className="px-3.5 py-2 rounded-lg border border-[#E8EDF2] text-[11px] font-extrabold bg-white"
          >
            Back
          </button>
            <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3.5 py-2 rounded-lg text-[11px] font-extrabold text-white bg-[#EF3C23]"
          >
            Retry
            </button>
          </div>
      </div>
    );
  }

  const drawerTitle =
    activeDrawer === 'media'
      ? 'Edit Cover & Media'
      : activeDrawer === 'header'
        ? 'Edit Guide Header'
        : activeDrawer === 'content'
          ? 'Edit Guide Content'
          : activeDrawer === 'verdict'
            ? 'Edit Verdict & Pros/Cons'
            : activeDrawer === 'associations'
              ? 'Edit Products & Brands'
              : activeDrawer === 'seo'
                ? 'Edit SEO'
                : '';

  const previewSlug = model.slug || model.id;
  const publicPreviewPath = previewSlug ? `/spotlight/${previewSlug}` : null;

  return (
    <div className="aws-page flex flex-col text-slate-900 relative overflow-x-hidden">
      <header className="h-14 shrink-0 bg-white border border-app-border rounded-[18px] px-5 flex items-center justify-between z-30 shadow-sm mb-5">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/admin/guides')}
            className="p-2 bg-[#F1F3F5] text-slate-700 hover:bg-[#E8EDF2] rounded-[8px] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-black text-[#111827] truncate max-w-[420px]">
                {model.title || 'New Guide'}
              </h1>
              <span
                className={`p-0.5 rounded-full text-[9px] font-bold px-1.5 ${
                  model.status === 'LIVE'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {model.status === 'LIVE' ? '● LIVE' : '○ DRAFT'}
            </span>
          </div>
            <p className="text-[10px] text-slate-500 font-mono tracking-wider">
              Choosify Guide Visual Builder
            </p>
            </div>
          </div>

            <div className="flex items-center gap-3">
          {hasUnsavedChanges ? (
            <span className="text-[#EF3C23] text-[10px] font-mono font-bold animate-pulse">
              ● UNSAVED
                </span>
          ) : null}
          {syncStatus === 'saving' ? (
            <span className="text-blue-600 text-[10px] font-mono font-bold">● Saving…</span>
          ) : null}
          {syncStatus === 'saved' ? (
            <span className="text-emerald-600 text-[10px] font-mono font-bold flex items-center gap-1">
              <Check className="w-3 h-3" /> Synced
            </span>
          ) : null}

          {publicPreviewPath ? (
            <a
              href={`http://localhost:5173${publicPreviewPath}`}
                    target="_blank"
                    rel="noreferrer"
              className="px-3 py-2 rounded-lg border border-[#E8EDF2] text-[11px] font-bold bg-white no-underline text-slate-800"
            >
              Preview
            </a>
          ) : null}

          <div className="relative">
            <button 
              type="button"
              onClick={() => setShowVersions((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E8EDF2] text-[11px] font-bold bg-white"
            >
              <History className="w-4 h-4 text-[#EF3C23]" />
              Snapshots ({versions?.length || 0})
            </button>
            {showVersions ? (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#E8EDF2] rounded-xl shadow-xl p-3 z-40">
                <p className="text-xs font-black uppercase text-[#EF3C23] border-b border-slate-100 pb-2 m-0 mb-2">
                  History
                </p>
                {(versions || []).length === 0 ? (
                  <p className="text-[11px] text-slate-500 m-0">No snapshots yet.</p>
                ) : (
                  <ul className="m-0 p-0 list-none space-y-1 max-h-48 overflow-y-auto">
                    {(versions || []).slice(0, 8).map((v) => (
                      <li key={v.id} className="text-[11px] text-slate-700 py-1 border-b border-slate-50">
                        {v.label || v.createdAt}
                      </li>
                ))}
              </ul>
                )}
            </div>
            ) : null}
            </div>

                      <button
                        type="button"
            onClick={() => void handleSaveDraft()}
            className="px-3.5 py-2 rounded-lg border border-[#E8EDF2] text-[11px] font-extrabold bg-white"
                      >
            Save Draft
                      </button>
                    <button
                      type="button"
            onClick={() => setShowPublishModal(true)}
            className="px-3.5 py-2 rounded-lg text-[11px] font-extrabold text-white bg-[#EF3C23]"
          >
            Publish
                    </button>
                  </div>
      </header>

      <GuideDetailPresentation
        model={model}
        mode="editor"
        onEditSection={(section) => openDrawer(section)}
        productLabels={productLabels}
        brandLabels={brandLabels}
      />

      {/* SEO edit entry — not a public section; toolbar-adjacent control */}
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10 w-full -mt-6 mb-8">
          <button 
          type="button"
          onClick={() => openDrawer('seo')}
          className="text-[11px] font-bold text-[#EF3C23] bg-transparent border-0 cursor-pointer underline"
        >
          Edit SEO metadata
          </button>
        </div>

      <AnimatePresence>
        {activeDrawer ? (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveDrawer(null)}
              className="fixed inset-0 bg-app-card z-40"
            />
            <motion.div
              initial={{ x: 480 }}
              animate={{ x: 0 }}
              exit={{ x: 480 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed top-0 right-0 h-full w-full max-w-[480px] bg-white z-50 shadow-2xl border-l border-[#E8EDF2] p-5 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-black m-0">{drawerTitle}</h2>
                <button
                  type="button"
                  onClick={() => setActiveDrawer(null)}
                  className="text-[11px] font-bold text-slate-500 bg-transparent border-0 cursor-pointer"
                >
                  Close
                </button>
              </div>

              {activeDrawer === 'media' ? (
                <div className="space-y-3">
                  <label className="block text-[9px] font-black uppercase text-slate-500">Cover image URL</label>
                          <input
                    value={mediaForm.image}
                    onChange={(e) => setMediaForm({ ...mediaForm, image: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">Video URL</label>
                          <input
                    value={mediaForm.videoUrl}
                    onChange={(e) => setMediaForm({ ...mediaForm, videoUrl: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">
                    Watch / YouTube URL
                  </label>
                      <input 
                    value={mediaForm.watchUrl}
                    onChange={(e) => setMediaForm({ ...mediaForm, watchUrl: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                      />
                    </div>
              ) : null}

              {activeDrawer === 'header' ? (
                <div className="space-y-3">
                  <label className="block text-[9px] font-black uppercase text-slate-500">Title</label>
                      <input 
                    value={headerForm.title}
                    onChange={(e) => setHeaderForm({ ...headerForm, title: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">Slug</label>
                      <input 
                    value={headerForm.slug}
                    onChange={(e) => setHeaderForm({ ...headerForm, slug: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs font-mono"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">Category</label>
                        <input
                    value={headerForm.category}
                    onChange={(e) => setHeaderForm({ ...headerForm, category: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">Summary</label>
                      <textarea 
                    rows={3}
                    value={headerForm.excerpt}
                    onChange={(e) => setHeaderForm({ ...headerForm, excerpt: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">Author</label>
                          <input 
                    value={headerForm.author}
                    onChange={(e) => setHeaderForm({ ...headerForm, author: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">Author avatar URL</label>
                        <input 
                    value={headerForm.authorAvatar}
                    onChange={(e) => setHeaderForm({ ...headerForm, authorAvatar: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">Creator ID</label>
                        <input 
                    value={headerForm.creatorId}
                    onChange={(e) => setHeaderForm({ ...headerForm, creatorId: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs font-mono"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-black uppercase text-slate-500">Type</label>
                      <select
                        value={headerForm.type}
                        onChange={(e) =>
                          setHeaderForm({
                            ...headerForm,
                            type: e.target.value as GuideEditorModel['type'],
                          })
                        }
                        className="w-full p-2.5 border rounded-xl text-xs"
                      >
                        <option value="article">article</option>
                        <option value="video">video</option>
                        <option value="reels">reels</option>
                        <option value="shorts">shorts</option>
                      </select>
                      </div>
                    <div>
                      <label className="block text-[9px] font-black uppercase text-slate-500">Format</label>
                      <select
                        value={headerForm.format}
                        onChange={(e) =>
                          setHeaderForm({
                            ...headerForm,
                            format: e.target.value as GuideEditorModel['format'],
                          })
                        }
                        className="w-full p-2.5 border rounded-xl text-xs"
                      >
                        <option value="buying_guide">buying_guide</option>
                        <option value="product_review">product_review</option>
                        <option value="comparison">comparison</option>
                        <option value="tutorial">tutorial</option>
                        <option value="tips">tips</option>
                        <option value="live">live</option>
                      </select>
                    </div>
                  </div>
                  <label className="block text-[9px] font-black uppercase text-slate-500">Read time</label>
                        <input 
                    value={headerForm.readTime}
                    onChange={(e) => setHeaderForm({ ...headerForm, readTime: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">Tags (comma)</label>
                        <input 
                    value={headerForm.tags}
                    onChange={(e) => setHeaderForm({ ...headerForm, tags: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">Status</label>
                  <select
                    value={headerForm.status}
                    onChange={(e) =>
                      setHeaderForm({
                        ...headerForm,
                        status: e.target.value as GuideEditorModel['status'],
                      })
                    }
                    className="w-full p-2.5 border rounded-xl text-xs"
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="LIVE">LIVE</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                      </div>
              ) : null}

              {activeDrawer === 'content' ? (
                <div className="space-y-3">
                  <label className="block text-[9px] font-black uppercase text-slate-500">Guide body</label>
                  <textarea
                    rows={14}
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs"
                    placeholder="Guide article content…"
                      />
                    </div>
              ) : null}

              {activeDrawer === 'verdict' ? (
                <div className="space-y-3">
                  <label className="block text-[9px] font-black uppercase text-slate-500">
                    What we like (one per line)
                  </label>
                      <textarea 
                    rows={4}
                    value={verdictForm.whatWeLike}
                    onChange={(e) => setVerdictForm({ ...verdictForm, whatWeLike: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">
                    What to consider (one per line)
                  </label>
                  <textarea
                    rows={4}
                    value={verdictForm.whatToConsider}
                    onChange={(e) =>
                      setVerdictForm({ ...verdictForm, whatToConsider: e.target.value })
                    }
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">Verdict</label>
                  <textarea
                    rows={4}
                    value={verdictForm.verdict}
                    onChange={(e) => setVerdictForm({ ...verdictForm, verdict: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                      />
                    </div>
              ) : null}

              {activeDrawer === 'associations' ? (
                <div className="space-y-3">
                  <label className="block text-[9px] font-black uppercase text-slate-500">
                    Product IDs (one per line)
                  </label>
                      <textarea 
                    rows={4}
                    value={assocForm.productIds}
                    onChange={(e) => setAssocForm({ ...assocForm, productIds: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs font-mono"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">
                    Brand IDs (one per line)
                  </label>
                  <textarea
                    rows={4}
                    value={assocForm.brandIds}
                    onChange={(e) => setAssocForm({ ...assocForm, brandIds: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs font-mono"
                      />
                    </div>
              ) : null}

              {activeDrawer === 'seo' ? (
                <div className="space-y-3">
                  <label className="block text-[9px] font-black uppercase text-slate-500">SEO title</label>
                          <input 
                    value={seoForm.seoTitle}
                    onChange={(e) => setSeoForm({ ...seoForm, seoTitle: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">
                    SEO description
                  </label>
                      <textarea 
                    rows={4}
                    value={seoForm.seoDescription}
                    onChange={(e) => setSeoForm({ ...seoForm, seoDescription: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                      />
                    </div>
              ) : null}

              <div className="flex gap-2 mt-6 pt-4 border-t border-[#F1F1F3]">
                        <button 
                  type="button"
                  onClick={() => setActiveDrawer(null)}
                  className="flex-1 py-2.5 rounded-lg border border-[#E8EDF2] text-[11px] font-extrabold bg-white"
                        >
                  Cancel
                        </button>
                          <button
                  type="button"
                  onClick={saveDrawer}
                  className="flex-1 py-2.5 rounded-lg text-[11px] font-extrabold text-white bg-[#EF3C23]"
                >
                  Save
                          </button>
                        </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showPublishModal ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          >
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-sm font-black m-0 mb-2">Publish Guide?</h3>
              <p className="text-[12px] text-slate-600 m-0 mb-5">
                This will upsert the Guide to the catalog as LIVE. Public Spotlight will show the published
                payload once catalog sync completes.
              </p>
              <div className="flex gap-2 justify-end">
                        <button 
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="px-4 py-2 rounded-lg border text-[11px] font-bold bg-white"
                        >
                  Cancel
                        </button>
                          <button
                  type="button"
                  disabled={isPublishing}
                  onClick={() => void handlePublish()}
                  className="px-4 py-2 rounded-lg text-[11px] font-extrabold text-white bg-[#EF3C23] disabled:opacity-60"
                >
                  {isPublishing ? 'Publishing…' : 'Publish'}
                          </button>
                        </div>
                    </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {toastMessage ? (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-[#111827] text-white text-[11px] font-bold px-4 py-2.5 rounded-full shadow-lg"
          >
            {toastMessage}
            </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
