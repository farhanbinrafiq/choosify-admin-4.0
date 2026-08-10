import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, History, RotateCw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { catalogApi } from '../../services/catalogApi';
import { useEntityDraft } from '../../hooks/useEntityDraft';
import { useAuth } from '../../contexts/AuthContext';
import { CreatorProfilePresentation } from '../../components/creator-profile';
import {
  createBlankCreatorModel,
  editorModelToCreatorPayload,
  mapCatalogCreatorToEditor,
  type CreatorEditSection,
  type CreatorEditorModel,
} from './creatorEditorModel';

function linesFromTextarea(value: string): string[] {
  return value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function CreatorEditStudio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isPlatformAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isNew = !id || id === 'new';
  const activeId = isNew ? 'new' : id;

  const draftKey = `choosify_creator_draft_${activeId}`;
  const pubKey = `choosify_creator_published_${activeId}`;
  const versionsKey = `choosify_creator_versions_${activeId}`;

  const [model, setModel] = useState<CreatorEditorModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<CreatorEditSection | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [coverForm, setCoverForm] = useState({ coverImage: '', avatar: '' });
  const [identityForm, setIdentityForm] = useState({
    name: '',
    handle: '',
    title: '',
    location: '',
    bio: '',
    bestFor: '',
    verified: false,
    status: 'DRAFT' as CreatorEditorModel['status'],
  });
  const [socialForm, setSocialForm] = useState({
    facebook: '',
    instagram: '',
    youtube: '',
    linkedin: '',
    tiktok: '',
  });
  const [expertiseText, setExpertiseText] = useState('');
  const [platformsText, setPlatformsText] = useState('');
  const [contactForm, setContactForm] = useState({
    email: '',
    phone: '',
    responseTime: '',
    preferredContact: '',
  });
  const [partnersText, setPartnersText] = useState('');
  const [collabText, setCollabText] = useState('');
  const [overviewBio, setOverviewBio] = useState('');

  const {
    versions,
    saveDraft: persistDraft,
    saveVersion,
    isSaving: isDraftSaving,
    error: draftError,
  } = useEntityDraft<CreatorEditorModel>(
    'creator',
    isNew ? '' : activeId,
    { draftKey, versionsKey },
    (backendDraft) => {
      if (!backendDraft) return;
      setModel((prev) => {
        const base = prev || createBlankCreatorModel(activeId);
        // Prefer catalog media/metrics; never let an empty draft wipe identity.
        return {
          ...base,
          ...backendDraft,
          id: activeId,
          name: backendDraft.name || base.name,
          handle: backendDraft.handle || base.handle,
          avatar: backendDraft.avatar || base.avatar,
          coverImage: backendDraft.coverImage || base.coverImage,
          videos: base.videos?.length ? base.videos : backendDraft.videos || [],
          reels: base.reels?.length ? base.reels : backendDraft.reels || [],
          blogs: base.blogs?.length ? base.blogs : backendDraft.blogs || [],
          followerTotal: base.followerTotal || backendDraft.followerTotal || '',
          score: base.score || backendDraft.score || 0,
          verified: backendDraft.verified ?? base.verified,
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
      if (isNew) {
        if (!cancelled) {
          setModel(createBlankCreatorModel('new'));
          setLoading(false);
        }
        return;
      }

      let loaded: CreatorEditorModel | null = null;
      try {
        const cacheDraft = localStorage.getItem(draftKey);
        if (cacheDraft) loaded = JSON.parse(cacheDraft);
      } catch (_) {}
      if (!loaded) {
        try {
          const cachePub = localStorage.getItem(pubKey);
          if (cachePub) loaded = JSON.parse(cachePub);
        } catch (_) {}
      }

      try {
        const creators = await catalogApi.listCreators();
        const creator = creators.find((c) => c.id === activeId || c.slug === activeId);
        if (creator) {
          const fromCatalog = mapCatalogCreatorToEditor(creator);
          // Catalog is authority for identity/media. Local draft may enrich editable fields.
          if (loaded && loaded.name) {
            loaded = {
              ...fromCatalog,
              ...loaded,
              id: creator.id,
              name: loaded.name || fromCatalog.name,
              handle: loaded.handle || fromCatalog.handle,
              avatar: loaded.avatar || fromCatalog.avatar,
              coverImage: loaded.coverImage || fromCatalog.coverImage,
              videos: fromCatalog.videos,
              reels: fromCatalog.reels,
              blogs: fromCatalog.blogs,
              followerTotal: fromCatalog.followerTotal,
              score: fromCatalog.score || loaded.score,
              verified: fromCatalog.verified || loaded.verified,
              status: loaded.status || fromCatalog.status,
            };
          } else {
            loaded = fromCatalog;
          }
        }
      } catch (_) {}

      // Never fall back to demo seed profiles — blank canvas if catalog miss.
      if (!loaded) loaded = createBlankCreatorModel(activeId);
      if (!cancelled) {
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

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(null), 3500);
  };

  const openDrawer = (section: CreatorEditSection) => {
    if (!model) return;
    setActiveDrawer(section);
    if (section === 'cover') {
      setCoverForm({ coverImage: model.coverImage, avatar: model.avatar });
    } else if (section === 'identity') {
      setIdentityForm({
        name: model.name,
        handle: model.handle,
        title: model.title,
        location: model.location,
        bio: model.bio,
        bestFor: model.bestFor,
        verified: model.verified,
        status: model.status,
      });
    } else if (section === 'social') {
      setSocialForm({
        facebook: model.socialLinks.facebook || '',
        instagram: model.socialLinks.instagram || '',
        youtube: model.socialLinks.youtube || '',
        linkedin: model.socialLinks.linkedin || '',
        tiktok: model.socialLinks.tiktok || '',
      });
    } else if (section === 'expertise') {
      setExpertiseText(model.bestForTags.join('\n'));
      setPlatformsText(model.platforms.join('\n'));
    } else if (section === 'contact') {
      setContactForm({
        email: model.email,
        phone: model.phone,
        responseTime: model.responseTime,
        preferredContact: model.preferredContact,
      });
    } else if (section === 'partnerships') {
      setPartnersText(model.brandPartners.map((b) => b.name).join('\n'));
      setCollabText(model.collabTypes.join('\n'));
    } else if (section === 'overview') {
      setOverviewBio(model.bio);
      setExpertiseText(model.bestForTags.join('\n'));
    }
  };

  const saveDrawer = () => {
    if (!model || !activeDrawer) return;
    let next = { ...model };

    if (activeDrawer === 'cover') {
      next = { ...next, coverImage: coverForm.coverImage, avatar: coverForm.avatar };
    } else if (activeDrawer === 'identity') {
      next = {
        ...next,
        name: identityForm.name,
        handle: identityForm.handle,
        title: identityForm.title,
        location: identityForm.location,
        bio: identityForm.bio,
        bestFor: identityForm.bestFor,
        // Verification + LIVE status are platform-controlled; creators publish via Publish only.
        verified: isPlatformAdmin ? identityForm.verified : model.verified,
        status: isPlatformAdmin ? identityForm.status : model.status,
      };
    } else if (activeDrawer === 'social') {
      next = { ...next, socialLinks: { ...socialForm } };
    } else if (activeDrawer === 'expertise') {
      next = {
        ...next,
        bestForTags: linesFromTextarea(expertiseText),
        platforms: linesFromTextarea(platformsText),
        bestFor: next.bestFor || linesFromTextarea(expertiseText)[0] || '',
      };
    } else if (activeDrawer === 'contact') {
      next = { ...next, ...contactForm };
    } else if (activeDrawer === 'partnerships') {
      next = {
        ...next,
        brandPartners: linesFromTextarea(partnersText).map((name) => ({ name })),
        collabTypes: linesFromTextarea(collabText),
      };
    } else if (activeDrawer === 'overview') {
      next = {
        ...next,
        bio: overviewBio,
        bestForTags: linesFromTextarea(expertiseText),
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
      let creatorId = model.id;
      const payload = editorModelToCreatorPayload({ ...model, status: 'LIVE' });
      if (isNew || creatorId === 'new') {
        creatorId = `creator-${Date.now()}`;
        await catalogApi.upsertCreator(creatorId, {
          ...payload,
          id: creatorId,
          slug: model.slug || creatorId,
        });
      } else {
        await catalogApi.upsertCreator(creatorId, payload);
      }
      const published = { ...model, id: creatorId, status: 'LIVE' as const };
      localStorage.setItem(`choosify_creator_published_${creatorId}`, JSON.stringify(published));
      localStorage.setItem(`choosify_creator_draft_${creatorId}`, JSON.stringify(published));
      setModel(published);
      setHasUnsavedChanges(false);
      setShowPublishModal(false);
      triggerToast('Creator profile published');
      if (isNew) navigate(`/admin/creator-studio/${creatorId}/edit`, { replace: true });
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setIsPublishing(false);
    }
  };

  if (loading || !model) {
    return (
      <div className="flex flex-col items-center justify-center h-[420px] gap-3 text-app-text-muted">
        <RotateCw className="w-10 h-10 animate-spin text-[#EF3C23]" />
        <span className="text-xs font-mono">Loading Creator Visual Builder…</span>
      </div>
    );
  }

  const drawerTitle =
    activeDrawer === 'cover'
      ? 'Edit Cover & Avatar'
      : activeDrawer === 'identity'
        ? 'Edit Profile Identity'
        : activeDrawer === 'social'
          ? 'Edit Social Links'
          : activeDrawer === 'expertise'
            ? 'Edit Expertise & Platforms'
            : activeDrawer === 'contact'
              ? 'Edit Contact & Reach'
              : activeDrawer === 'partnerships'
                ? 'Edit Partnerships'
                : activeDrawer === 'overview'
                  ? 'Edit Creator Overview'
                  : '';

  return (
    <div className="aws-page flex flex-col text-slate-900 relative overflow-x-hidden">
      <header className="h-14 shrink-0 bg-white border border-app-border rounded-[18px] px-5 flex items-center justify-between z-30 shadow-sm mb-5">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() =>
              navigate(profile?.role === 'creator' ? '/admin/creator-profile' : '/admin/creator-studio')
            }
            className="p-2 bg-[#F1F3F5] text-slate-700 hover:bg-[#E8EDF2] rounded-[8px] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-black text-[#111827] truncate max-w-[420px]">
                {model.name || 'New Creator'}
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
              Choosify Creator Visual Builder
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
          {hasUnsavedChanges ? (
            <button
              type="button"
              onClick={() => {
                // Discard canvas edits by reloading catalog + clearing local draft cache.
                try {
                  localStorage.removeItem(draftKey);
                } catch (_) {}
                setHasUnsavedChanges(false);
                window.location.reload();
              }}
              className="px-3.5 py-2 rounded-lg border border-[#E8EDF2] text-[11px] font-extrabold bg-white text-slate-600"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowPublishModal(true)}
            className="px-3.5 py-2 rounded-lg text-[11px] font-extrabold text-white bg-[#EF3C23]"
          >
            Publish
          </button>
        </div>
      </header>

      <CreatorProfilePresentation
        model={model}
        mode="editor"
        onEditSection={(section) => openDrawer(section)}
      />

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

              {activeDrawer === 'cover' && (
                <div className="space-y-3">
                  <label className="block text-[9px] font-black uppercase text-slate-500">Cover image URL</label>
                  <input
                    value={coverForm.coverImage}
                    onChange={(e) => setCoverForm({ ...coverForm, coverImage: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">Avatar URL</label>
                  <input
                    value={coverForm.avatar}
                    onChange={(e) => setCoverForm({ ...coverForm, avatar: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                </div>
              )}

              {activeDrawer === 'identity' && (
                <div className="space-y-3">
                  <label className="block text-[9px] font-black uppercase text-slate-500">Name</label>
                  <input
                    value={identityForm.name}
                    onChange={(e) => setIdentityForm({ ...identityForm, name: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">Handle</label>
                  <input
                    value={identityForm.handle}
                    onChange={(e) => setIdentityForm({ ...identityForm, handle: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">Title / role</label>
                  <input
                    value={identityForm.title}
                    onChange={(e) => setIdentityForm({ ...identityForm, title: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">Location</label>
                  <input
                    value={identityForm.location}
                    onChange={(e) => setIdentityForm({ ...identityForm, location: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">Best for</label>
                  <input
                    value={identityForm.bestFor}
                    onChange={(e) => setIdentityForm({ ...identityForm, bestFor: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  <label className="block text-[9px] font-black uppercase text-slate-500">Bio</label>
                  <textarea
                    rows={4}
                    value={identityForm.bio}
                    onChange={(e) => setIdentityForm({ ...identityForm, bio: e.target.value })}
                    className="w-full p-2.5 border rounded-xl text-xs"
                  />
                  {isPlatformAdmin ? (
                    <>
                      <label className="flex items-center gap-2 text-[11px] font-bold">
                        <input
                          type="checkbox"
                          checked={identityForm.verified}
                          onChange={(e) => setIdentityForm({ ...identityForm, verified: e.target.checked })}
                        />
                        Verified creator
                      </label>
                      <label className="block text-[9px] font-black uppercase text-slate-500">Status</label>
                      <select
                        value={identityForm.status}
                        onChange={(e) =>
                          setIdentityForm({
                            ...identityForm,
                            status: e.target.value as CreatorEditorModel['status'],
                          })
                        }
                        className="w-full p-2.5 border rounded-xl text-xs"
                      >
                        <option value="DRAFT">DRAFT</option>
                        <option value="LIVE">LIVE</option>
                        <option value="ARCHIVED">ARCHIVED</option>
                      </select>
                    </>
                  ) : (
                    <p className="text-[11px] text-slate-500 m-0">
                      Verification and Trust Score are system-managed. Use Publish to go live.
                    </p>
                  )}
                </div>
              )}

              {activeDrawer === 'social' && (
                <div className="space-y-3">
                  {(['facebook', 'instagram', 'youtube', 'linkedin', 'tiktok'] as const).map((key) => (
                    <div key={key}>
                      <label className="block text-[9px] font-black uppercase text-slate-500">{key}</label>
                      <input
                        value={socialForm[key]}
                        onChange={(e) => setSocialForm({ ...socialForm, [key]: e.target.value })}
                        className="w-full p-2.5 border rounded-xl text-xs"
                        placeholder={`${key} URL`}
                      />
                    </div>
                  ))}
                </div>
              )}

              {activeDrawer === 'expertise' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">
                      Expertise topics (one per line)
                    </label>
                    <textarea
                      rows={6}
                      value={expertiseText}
                      onChange={(e) => setExpertiseText(e.target.value)}
                      className="w-full p-2.5 border rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">
                      Platforms (one per line)
                    </label>
                    <textarea
                      rows={4}
                      value={platformsText}
                      onChange={(e) => setPlatformsText(e.target.value)}
                      className="w-full p-2.5 border rounded-xl text-xs"
                    />
                  </div>
                </div>
              )}

              {activeDrawer === 'contact' && (
                <div className="space-y-3">
                  {(
                    [
                      ['email', 'Business email'],
                      ['phone', 'Phone'],
                      ['responseTime', 'Response time'],
                      ['preferredContact', 'Preferred contact'],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-[9px] font-black uppercase text-slate-500">{label}</label>
                      <input
                        value={contactForm[key]}
                        onChange={(e) => setContactForm({ ...contactForm, [key]: e.target.value })}
                        className="w-full p-2.5 border rounded-xl text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}

              {activeDrawer === 'partnerships' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">
                      Brand partners (one per line)
                    </label>
                    <textarea
                      rows={5}
                      value={partnersText}
                      onChange={(e) => setPartnersText(e.target.value)}
                      className="w-full p-2.5 border rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">
                      Collaboration types (one per line)
                    </label>
                    <textarea
                      rows={5}
                      value={collabText}
                      onChange={(e) => setCollabText(e.target.value)}
                      className="w-full p-2.5 border rounded-xl text-xs"
                    />
                  </div>
                </div>
              )}

              {activeDrawer === 'overview' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Bio / overview</label>
                    <textarea
                      rows={5}
                      value={overviewBio}
                      onChange={(e) => setOverviewBio(e.target.value)}
                      className="w-full p-2.5 border rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">
                      Expertise (one per line)
                    </label>
                    <textarea
                      rows={5}
                      value={expertiseText}
                      onChange={(e) => setExpertiseText(e.target.value)}
                      className="w-full p-2.5 border rounded-xl text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="border-t border-slate-100 pt-4 mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveDrawer(null)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-800 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveDrawer}
                  className="flex-1 py-2.5 bg-[#EF3C23] text-white text-xs font-black uppercase tracking-wider rounded-xl"
                >
                  Save Section
                </button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      {showPublishModal ? (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-black m-0 mb-2">Publish Live Creator Profile?</h3>
            <p className="text-[12px] text-slate-600 m-0 mb-5">
              This writes the Creator to the catalog API and marks it LIVE where supported.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPublishing}
                onClick={() => void handlePublish()}
                className="flex-1 py-2.5 rounded-xl bg-[#EF3C23] text-white text-xs font-black disabled:opacity-50"
              >
                {isPublishing ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-[70] bg-[#0A0A1F] text-white text-xs font-bold px-5 py-3 rounded-xl shadow-2xl">
          {toastMessage}
        </div>
      ) : null}
    </div>
  );
}
