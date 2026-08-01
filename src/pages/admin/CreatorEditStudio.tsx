import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  History,
  Pencil,
  Facebook,
  Instagram,
  Youtube,
  Linkedin,
  Mail,
  Phone,
  Clock,
  MapPin,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { BrandImageUploadField } from './BrandImageUploadField';
import { CreatorCMSModel, CreatorPlatform, initialCreatorSeeds, CREATOR_STUDIO_LIST_KEY } from './creatorSeeds';
import { uploadCreatorImage } from '../../services/mediaUpload';
import { catalogApi } from '../../services/catalogApi';
import { useEntityDraft } from '../../hooks/useEntityDraft';
import { BestForTagsChipField } from '../../components/admin/product-studio/OverviewBento';

const ALL_PLATFORMS: CreatorPlatform[] = ['YouTube', 'Instagram', 'Facebook', 'TikTok'];
const COLLAB_TYPE_PRESETS = ['Product Reviews', 'Buying Guides', 'Brand Stories', 'Tech Analysis', 'Comparisons', 'Live Sessions'];

interface CreatorEditStudioProps {
  overrideId?: string;
  isNested?: boolean;
}

export default function CreatorEditStudio({ overrideId, isNested }: CreatorEditStudioProps = {}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const activeId = overrideId || id || initialCreatorSeeds[0]?.id || 'creator-farhan';

  const [model, setModel] = useState<CreatorCMSModel | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<'cover' | 'identity' | 'social' | 'journey' | 'partnerships' | null>(null);

  const [coverForm, setCoverForm] = useState({ coverImage: '', avatar: '' });
  const [identityForm, setIdentityForm] = useState({ title: '', location: '', bio: '' });
  const [socialForm, setSocialForm] = useState({ facebook: '', instagram: '', youtube: '', linkedin: '', tiktok: '' });
  const [journeyForm, setJourneyForm] = useState({
    bestForTags: [] as string[],
    platforms: [] as CreatorPlatform[],
    email: '',
    phone: '',
    responseTime: '',
    preferredContact: '',
  });
  const [partnershipsForm, setPartnershipsForm] = useState({
    brandPartners: [] as { name: string; color?: string }[],
    collabTypes: [] as string[],
  });

  const draftKey = `choosify_creator_draft_${activeId}`;
  const pubKey = `choosify_creator_published_${activeId}`;
  const versionsKey = `choosify_creator_versions_${activeId}`;

  const {
    saveDraft: persistDraft,
    versions,
    saveVersion,
    error: draftError,
    isSaving: isDraftSaving,
    isLoading: isDraftLoading,
  } = useEntityDraft<CreatorCMSModel>(
    'creator',
    activeId,
    { draftKey, versionsKey },
    (backendDraft) => setModel(backendDraft),
  );

  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    if (isDraftSaving) {
      setSyncStatus('saving');
    } else if (draftError) {
      setSyncStatus('error');
      triggerToast(`⚠ Save failed: ${draftError}`);
    } else if (syncStatus === 'saving') {
      setSyncStatus('saved');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDraftSaving, draftError]);

  useEffect(() => {
    let loaded: CreatorCMSModel | null = null;
    const draftRaw = localStorage.getItem(draftKey);
    const pubRaw = localStorage.getItem(pubKey);
    try {
      if (draftRaw) loaded = JSON.parse(draftRaw);
      else if (pubRaw) loaded = JSON.parse(pubRaw);
    } catch {
      loaded = null;
    }

    if (!loaded) {
      loaded = initialCreatorSeeds.find((c) => c.id === activeId) || {
        ...initialCreatorSeeds[0],
        id: activeId,
      };
    }

    setModel(loaded);
    // useEntityDraft fetches the backend draft in the background and, once it
    // resolves, calls setModel again — the backend copy wins over this local seed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const openCoverDrawer = () => {
    if (!model) return;
    setCoverForm({ coverImage: model.coverImage || '', avatar: model.avatar || '' });
    setActiveDrawer('cover');
  };

  const saveCoverSection = () => {
    if (!model) return;
    setModel({
      ...model,
      coverImage: coverForm.coverImage,
      avatar: coverForm.avatar,
    });
    setHasUnsavedChanges(true);
    setActiveDrawer(null);
    triggerToast('Cover & Avatar Updated');
  };

  const openIdentityDrawer = () => {
    if (!model) return;
    setIdentityForm({ title: model.title || '', location: model.location || '', bio: model.bio || '' });
    setActiveDrawer('identity');
  };

  const saveIdentitySection = () => {
    if (!model) return;
    setModel({ ...model, ...identityForm });
    setHasUnsavedChanges(true);
    setActiveDrawer(null);
    triggerToast('Identity Updated');
  };

  const openSocialDrawer = () => {
    if (!model) return;
    setSocialForm({
      facebook: model.socialLinks?.facebook || '',
      instagram: model.socialLinks?.instagram || '',
      youtube: model.socialLinks?.youtube || '',
      linkedin: model.socialLinks?.linkedin || '',
      tiktok: model.socialLinks?.tiktok || '',
    });
    setActiveDrawer('social');
  };

  const saveSocialSection = () => {
    if (!model) return;
    setModel({ ...model, socialLinks: { ...socialForm } });
    setHasUnsavedChanges(true);
    setActiveDrawer(null);
    triggerToast('Social Links Updated');
  };

  const openJourneyDrawer = () => {
    if (!model) return;
    setJourneyForm({
      bestForTags: [...(model.bestForTags || [])],
      platforms: [...(model.platforms || [])],
      email: model.email || '',
      phone: model.phone || '',
      responseTime: model.responseTime || '',
      preferredContact: model.preferredContact || '',
    });
    setActiveDrawer('journey');
  };

  const saveJourneySection = () => {
    if (!model) return;
    setModel({ ...model, ...journeyForm });
    setHasUnsavedChanges(true);
    setActiveDrawer(null);
    triggerToast('Journey & Contact Updated');
  };

  const openPartnershipsDrawer = () => {
    if (!model) return;
    setPartnershipsForm({
      brandPartners: JSON.parse(JSON.stringify(model.brandPartners || [])),
      collabTypes: [...(model.collabTypes || [])],
    });
    setActiveDrawer('partnerships');
  };

  const savePartnershipsSection = () => {
    if (!model) return;
    setModel({ ...model, ...partnershipsForm });
    setHasUnsavedChanges(true);
    setActiveDrawer(null);
    triggerToast('Partnerships Updated');
  };

  const handleSaveDraft = () => {
    if (!model) return;
    persistDraft(model);
    setHasUnsavedChanges(false);
    setSyncStatus('saving');
    saveVersion(`Draft Saved: ${model.name}`, model);

    // Keep list registry in sync
      try {
      const raw = localStorage.getItem(CREATOR_STUDIO_LIST_KEY);
      const list: CreatorCMSModel[] = raw ? JSON.parse(raw) : [...initialCreatorSeeds];
      const next = list.some((c) => c.id === model.id)
        ? list.map((c) => (c.id === model.id ? model : c))
        : [...list, model];
      localStorage.setItem(CREATOR_STUDIO_LIST_KEY, JSON.stringify(next));
    } catch {
      localStorage.setItem(CREATOR_STUDIO_LIST_KEY, JSON.stringify([model]));
    }

    triggerToast('Saving draft…');
  };

  const handlePublishChanges = async () => {
    if (!model) return;
    setIsPublishing(true);
    setShowPublishModal(false);

    let publishSucceeded = false;
    try {
      await catalogApi.upsertCreator(activeId, model);
      publishSucceeded = true;
    } catch (error) {
      console.warn('Failed to publish creator to catalog API', error);
    }

    localStorage.setItem(`choosify_creator_published_${activeId}`, JSON.stringify(model));
    localStorage.setItem(`choosify_creator_draft_${activeId}`, JSON.stringify(model));
    persistDraft(model);
    setHasUnsavedChanges(false);

    try {
      const raw = localStorage.getItem(CREATOR_STUDIO_LIST_KEY);
      const list: CreatorCMSModel[] = raw ? JSON.parse(raw) : [...initialCreatorSeeds];
      const next = list.some((c) => c.id === model.id)
        ? list.map((c) => (c.id === model.id ? model : c))
        : [...list, model];
      localStorage.setItem(CREATOR_STUDIO_LIST_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }

    setIsPublishing(false);
    triggerToast(
      publishSucceeded
        ? 'Creator Profile Published Live!'
        : '⚠ Publish failed to sync to catalog — draft saved locally, please retry.',
    );
  };

  const restoreVersion = (snapshot: Record<string, unknown>) => {
    setModel(snapshot as unknown as CreatorCMSModel);
    setHasUnsavedChanges(true);
    setShowVersions(false);
    triggerToast('Snapshot restored into working draft');
  };

  const requestExit = () => {
    if (hasUnsavedChanges) setShowExitModal(true);
    else navigate('/admin/creator-studio');
  };

  if (!model || isDraftLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-xs font-mono text-slate-400 uppercase tracking-widest">
        Loading creator studio…
      </div>
    );
  }

  const initials = model.name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`bg-[#F8FAFC] text-[#111827] ${isNested ? '' : 'min-h-screen'} pb-16`}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {!isNested && (
            <button
              type="button"
              onClick={requestExit}
              className="p-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black text-[#111827]">{model.name}</h1>
              <span className="p-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-bold px-1.5">
                ● CREATOR PROFILE
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono tracking-wider">Creator Studio · Cover & Avatar</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasUnsavedChanges && (
            <span className="flex items-center gap-1 text-[#FF5B00] text-[10px] font-mono font-bold animate-pulse">
              ● UNSAVED DRAFT CHANGES
            </span>
          )}

          {syncStatus === 'saving' && (
            <span className="flex items-center gap-1 text-blue-600 text-[10px] font-mono font-bold animate-pulse">
              ● Saving…
            </span>
          )}
          {syncStatus === 'saved' && (
            <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-mono font-bold">
              ✓ Synced to server
            </span>
          )}
          {syncStatus === 'error' && (
            <span className="flex items-center gap-1 text-red-600 text-[10px] font-mono font-bold" title={draftError || undefined}>
              ⚠ Save failed — retry
            </span>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowVersions(!showVersions)}
              className="p-2 bg-white border border-slate-200 rounded-xl text-[#111827] hover:bg-slate-50 transition flex items-center gap-1.5 text-xs font-semibold"
            >
              <History className="w-4 h-4 text-[#FF5B00]" />
              <span>Snapshots ({versions.length})</span>
            </button>
            {showVersions && (
              <div className="absolute right-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 w-80 z-40 text-left">
                <p className="text-xs font-black uppercase text-[#FF5B00] border-b border-slate-100 pb-2">
                  History Logs & Revisions
                </p>
                {versions.length === 0 ? (
                  <p className="text-[11px] font-mono text-slate-400 py-4">No snapshots yet.</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto mt-2">
                    {versions.map((ver) => (
                      <div key={ver.id} className="p-2 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                          <span>{new Date(ver.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <button
                            type="button"
                            onClick={() => setConfirmingId(ver.id)}
                            className="font-bold text-[#FF5B00] hover:underline"
                          >
                            RESTORE
                          </button>
                        </div>
                        <span className="text-xs font-semibold truncate text-[#111827] block">{ver.label}</span>
                        {confirmingId === ver.id && (
                          <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded-lg flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                restoreVersion(ver.snapshot);
                                setConfirmingId(null);
                              }}
                              className="px-2 py-1 bg-red-500 text-white text-[8px] font-black uppercase rounded"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingId(null)}
                              className="px-2 py-1 bg-gray-100 text-gray-600 text-[8px] font-black uppercase rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSaveDraft}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-[#111827] font-bold text-xs rounded-xl transition"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => setShowPublishModal(true)}
            className="px-4 py-2 bg-[#FF5B00] hover:bg-[#E64A00] text-white font-extrabold text-xs rounded-xl transition shadow-md"
          >
            Publish Live Profile
          </button>
        </div>
      </header>

      <main className="max-w-[1180px] mx-auto w-full px-5 sm:px-8 lg:px-10 pt-6 space-y-8">
        {/* Hero — CreatorProfileHero silhouette */}
        <section className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm relative">
          <div className="absolute top-4 right-4 z-10">
            <button
              type="button"
              onClick={openCoverDrawer}
              className="p-2.5 bg-white border border-[#FF5B00] text-[#FF5B00] hover:bg-[#FF5B00] hover:text-white rounded-xl transition-all shadow-sm flex items-center gap-1.5 text-xs font-bold uppercase cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>EDIT COVER</span>
            </button>
          </div>

          <div className="relative pt-4 px-4 sm:px-6">
            <div className="relative">
              <div className="relative h-[220px] sm:h-[280px] md:h-[320px] overflow-hidden bg-[#1A1A2E] rounded-none">
                {model.coverImage ? (
                  <img src={model.coverImage} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-white/40 font-bold uppercase">
                    Cover banner placeholder
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>

              <div className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-[60px] w-[100px] h-[100px] md:w-[120px] md:h-[120px] z-[5]">
                <div className="w-full h-full rounded-full bg-[#1A1A2E] border-[5px] border-white shadow-[0_16px_36px_rgba(0,0,0,0.28),0_0_0_4px_rgba(7,208,80,0.18)] overflow-hidden flex items-center justify-center text-white text-[30px] font-extrabold">
                  {model.avatar ? (
                    <img
                      src={model.avatar}
                      alt={model.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    initials
                  )}
                </div>
              </div>
            </div>

            {/* Identity read-only preview */}
            <div className="pt-[72px] pb-8 text-center space-y-1.5">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <h2 className="text-xl md:text-2xl font-black text-[#111827] tracking-tight">{model.name}</h2>
                {model.verified !== false && (
                  <span className="inline-flex text-[#2323FF]" title="Verified">
                    <Check className="w-5 h-5" strokeWidth={3} />
                  </span>
                )}
              </div>
              <div className="text-[13px] text-[#2323FF] font-semibold">
                {model.title || 'Creator & Product Researcher'}
              </div>
              <div className="text-[12px] text-slate-500 font-medium">
                {model.handle} · {model.location || 'Dhaka, Bangladesh'}
              </div>
              {model.bio && (
                <p className="text-[12px] text-slate-500 max-w-lg mx-auto pt-2 leading-relaxed">{model.bio}</p>
              )}
            </div>
          </div>
        </section>

        {/* Identity */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 relative shadow-sm text-left">
          <div className="absolute top-6 right-6 z-10">
            <button
              type="button"
              onClick={openIdentityDrawer}
              className="p-2.5 bg-white border border-[#FF5B00] text-[#FF5B00] hover:bg-[#FF5B00] hover:text-white rounded-xl transition-all shadow-sm flex items-center gap-1.5 text-xs font-bold uppercase cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>EDIT IDENTITY</span>
            </button>
          </div>
          <span className="text-[10px] font-black tracking-widest text-[#FF5B00] uppercase">PROFILE IDENTITY</span>
          <h3 className="text-lg font-black text-[#111827] mt-1">TITLE, LOCATION & BIO</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-[#F9FAFB] border border-slate-200 p-4 rounded-2xl">
              <span className="text-[9px] font-extrabold uppercase text-[#FF5B00] block mb-1">Title / Role</span>
              <p className="text-xs font-semibold text-slate-700">{model.title || 'Not set'}</p>
            </div>
            <div className="bg-[#F9FAFB] border border-slate-200 p-4 rounded-2xl">
              <span className="text-[9px] font-extrabold uppercase text-[#FF5B00] block mb-1">Location</span>
              <p className="text-xs font-semibold text-slate-700">{model.location || 'Not set'}</p>
            </div>
            <div className="bg-[#F9FAFB] border border-slate-200 p-4 rounded-2xl md:col-span-1">
              <span className="text-[9px] font-extrabold uppercase text-[#FF5B00] block mb-1">Short Bio</span>
              <p className="text-xs font-semibold text-slate-700 line-clamp-3">{model.bio || 'Not set'}</p>
            </div>
          </div>
        </section>

        {/* Social */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 relative shadow-sm text-left">
          <div className="absolute top-6 right-6 z-10">
            <button
              type="button"
              onClick={openSocialDrawer}
              className="p-2.5 bg-white border border-[#FF5B00] text-[#FF5B00] hover:bg-[#FF5B00] hover:text-white rounded-xl transition-all shadow-sm flex items-center gap-1.5 text-xs font-bold uppercase cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>EDIT SOCIAL</span>
            </button>
          </div>
          <span className="text-[10px] font-black tracking-widest text-[#FF5B00] uppercase">SOCIAL PROFILE PILLS</span>
          <h3 className="text-lg font-black text-[#111827] mt-1">CONNECTED PLATFORMS</h3>
          <div className="flex flex-wrap gap-2.5 mt-5">
            {model.socialLinks?.facebook && (
              <a href={model.socialLinks.facebook} target="_blank" rel="noreferrer" className="p-2 bg-[#F9FAFB] border border-slate-200 rounded-xl text-slate-600 hover:text-[#FF5B00] transition" title="Facebook">
                <Facebook className="w-4 h-4" />
              </a>
            )}
            {model.socialLinks?.instagram && (
              <a href={model.socialLinks.instagram} target="_blank" rel="noreferrer" className="p-2 bg-[#F9FAFB] border border-slate-200 rounded-xl text-slate-600 hover:text-[#FF5B00] transition" title="Instagram">
                <Instagram className="w-4 h-4" />
              </a>
            )}
            {model.socialLinks?.youtube && (
              <a href={model.socialLinks.youtube} target="_blank" rel="noreferrer" className="p-2 bg-[#F9FAFB] border border-slate-200 rounded-xl text-slate-600 hover:text-[#FF5B00] transition" title="YouTube">
                <Youtube className="w-4 h-4" />
              </a>
            )}
            {model.socialLinks?.linkedin && (
              <a href={model.socialLinks.linkedin} target="_blank" rel="noreferrer" className="p-2 bg-[#F9FAFB] border border-slate-200 rounded-xl text-slate-600 hover:text-[#FF5B00] transition" title="LinkedIn">
                <Linkedin className="w-4 h-4" />
              </a>
            )}
            {model.socialLinks?.tiktok && (
              <a href={model.socialLinks.tiktok} target="_blank" rel="noreferrer" className="p-2 bg-[#F9FAFB] border border-slate-200 rounded-xl text-slate-600 hover:text-[#FF5B00] transition text-[10px] font-black uppercase" title="TikTok">
                TikTok
              </a>
            )}
            {!model.socialLinks?.facebook && !model.socialLinks?.instagram && !model.socialLinks?.youtube && !model.socialLinks?.linkedin && !model.socialLinks?.tiktok && (
              <p className="text-xs text-slate-400 italic">No social links added.</p>
            )}
          </div>
        </section>

        {/* Journey (Best For Tags, Platforms, Contact & Reach) */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 relative shadow-sm text-left">
          <div className="absolute top-6 right-6 z-10">
            <button
              type="button"
              onClick={openJourneyDrawer}
              className="p-2.5 bg-white border border-[#FF5B00] text-[#FF5B00] hover:bg-[#FF5B00] hover:text-white rounded-xl transition-all shadow-sm flex items-center gap-1.5 text-xs font-bold uppercase cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>EDIT JOURNEY</span>
            </button>
          </div>
          <span className="text-[10px] font-black tracking-widest text-[#FF5B00] uppercase">JOURNEY & CONTACT</span>
          <h3 className="text-lg font-black text-[#111827] mt-1">BEST FOR, PLATFORMS & REACH</h3>

          <div className="mt-6 space-y-2">
            <span className="text-[9px] font-extrabold uppercase text-[#FF5B00] block">Best For Tags</span>
            <div className="flex flex-wrap gap-1.5">
              {(model.bestForTags || []).map((tag) => (
                <span key={tag} className="px-2.5 py-1 bg-[#F9FAFB] border border-slate-200 rounded-full text-[10px] font-bold text-slate-600">#{tag}</span>
              ))}
              {(!model.bestForTags || model.bestForTags.length === 0) && <p className="text-xs text-slate-400 italic">No tags added.</p>}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <span className="text-[9px] font-extrabold uppercase text-[#FF5B00] block">Platforms</span>
            <div className="flex flex-wrap gap-1.5">
              {(model.platforms || []).map((p) => (
                <span key={p} className="px-2.5 py-1 bg-[#F9FAFB] border border-slate-200 rounded-full text-[10px] font-bold text-slate-600">{p}</span>
              ))}
              {(!model.platforms || model.platforms.length === 0) && <p className="text-xs text-slate-400 italic">No platforms selected.</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <div className="bg-[#F9FAFB] border border-slate-200 p-4 rounded-2xl flex items-start gap-2.5">
              <Mail className="w-4 h-4 text-[#FF5B00] mt-0.5 shrink-0" />
              <div>
                <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Business Email</span>
                <p className="text-xs font-semibold text-slate-700">{model.email || 'Not set'}</p>
              </div>
            </div>
            <div className="bg-[#F9FAFB] border border-slate-200 p-4 rounded-2xl flex items-start gap-2.5">
              <Phone className="w-4 h-4 text-[#FF5B00] mt-0.5 shrink-0" />
              <div>
                <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Phone</span>
                <p className="text-xs font-semibold text-slate-700">{model.phone || 'Not set'}</p>
              </div>
            </div>
            <div className="bg-[#F9FAFB] border border-slate-200 p-4 rounded-2xl flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-[#FF5B00] mt-0.5 shrink-0" />
              <div>
                <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Response Time</span>
                <p className="text-xs font-semibold text-slate-700">{model.responseTime || 'Not set'}</p>
              </div>
            </div>
            <div className="bg-[#F9FAFB] border border-slate-200 p-4 rounded-2xl flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-[#FF5B00] mt-0.5 shrink-0" />
              <div>
                <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Preferred Contact</span>
                <p className="text-xs font-semibold text-slate-700">{model.preferredContact || 'Not set'}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Partnerships & Collaborations */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 relative shadow-sm text-left">
          <div className="absolute top-6 right-6 z-10">
            <button
              type="button"
              onClick={openPartnershipsDrawer}
              className="p-2.5 bg-white border border-[#FF5B00] text-[#FF5B00] hover:bg-[#FF5B00] hover:text-white rounded-xl transition-all shadow-sm flex items-center gap-1.5 text-xs font-bold uppercase cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>EDIT PARTNERSHIPS</span>
            </button>
          </div>
          <span className="text-[10px] font-black tracking-widest text-[#FF5B00] uppercase">BRAND RELATIONSHIPS</span>
          <h3 className="text-lg font-black text-[#111827] mt-1">PARTNERSHIPS & COLLABORATIONS</h3>

          <div className="mt-6 space-y-2">
            <span className="text-[9px] font-extrabold uppercase text-[#FF5B00] block">Top Brand Partners</span>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {(model.brandPartners || []).map((bp) => (
                <div key={bp.name} className="border border-slate-200 rounded-md p-3 text-center text-[11px] font-extrabold" style={{ color: bp.color }}>
                  {bp.name}
                </div>
              ))}
              {(!model.brandPartners || model.brandPartners.length === 0) && <p className="text-xs text-slate-400 italic">No brand partners added.</p>}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <span className="text-[9px] font-extrabold uppercase text-[#FF5B00] block">Collaboration Types</span>
            <div className="flex flex-wrap gap-2">
              {(model.collabTypes || []).map((ct) => (
                <span key={ct} className="bg-[#F9FAFB] border border-slate-200 text-[10.5px] font-semibold text-slate-600 px-3 py-1.5 rounded-full">{ct}</span>
              ))}
              {(!model.collabTypes || model.collabTypes.length === 0) && <p className="text-xs text-slate-400 italic">No collaboration types added.</p>}
            </div>
          </div>
        </section>
      </main>

      {/* Cover drawer */}
      <AnimatePresence>
        {activeDrawer === 'cover' && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveDrawer(null)}
              className="fixed inset-0 bg-black z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white shadow-2xl z-50 overflow-y-auto px-6 py-6 text-left flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                      Edit Cover & Avatar
                    </h3>
                    <p className="text-[10px] font-mono text-slate-500">Live hero preview · Cloudinary uploads</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveDrawer(null)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-5">
                  {/* Mini WYSIWYG hero */}
                  <div className="rounded-2xl overflow-visible border border-slate-200 bg-white shadow-sm pb-14">
                    <div className="relative h-36 bg-[#1A1A2E]">
                      {coverForm.coverImage ? (
                        <img
                          src={coverForm.coverImage}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover brightness-95"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/40 font-bold uppercase">
                          Cover banner
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                      <BrandImageUploadField
                        embedded
                        variant="banner"
                        value={coverForm.coverImage}
                        onChange={(url) => setCoverForm((prev) => ({ ...prev, coverImage: url }))}
                        uploadFn={uploadCreatorImage}
                      />
                    </div>

                    <div className="relative flex justify-center -mt-12 z-10">
                      <div className="relative w-[88px] h-[88px] rounded-full bg-[#1A1A2E] border-[4px] border-white shadow-[0_8px_24px_rgba(0,0,0,0.2),0_0_0_3px_rgba(7,208,80,0.18)] overflow-hidden">
                        {coverForm.avatar ? (
                          <img
                            src={coverForm.avatar}
                            alt=""
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white text-lg font-extrabold">
                            {initials}
                          </div>
                        )}
                        <BrandImageUploadField
                          embedded
                          variant="avatar"
                          value={coverForm.avatar}
                          onChange={(url) => setCoverForm((prev) => ({ ...prev, avatar: url }))}
                          uploadFn={uploadCreatorImage}
                        />
                      </div>
                    </div>
                  </div>

                  <details className="group rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                    <summary className="text-[10px] font-bold text-slate-500 cursor-pointer list-none flex items-center justify-between">
                      <span>Paste image URLs instead</span>
                      <span className="text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                    </summary>
                    <div className="mt-3 space-y-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Cover URL</label>
                        <input
                          type="url"
                          value={coverForm.coverImage}
                          onChange={(e) => setCoverForm((prev) => ({ ...prev, coverImage: e.target.value }))}
                          placeholder="https://…"
                          className="w-full p-2 border rounded-xl text-xs bg-white border-slate-200 text-slate-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Avatar URL</label>
                        <input
                          type="url"
                          value={coverForm.avatar}
                          onChange={(e) => setCoverForm((prev) => ({ ...prev, avatar: e.target.value }))}
                          placeholder="https://…"
                          className="w-full p-2 border rounded-xl text-xs bg-white border-slate-200 text-slate-700"
                        />
                      </div>
                    </div>
                  </details>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveDrawer(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveCoverSection}
                  className="flex-1 py-2.5 bg-[#FF5B00] hover:bg-[#E64A00] text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-lg"
                >
                  Save Section
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Identity / Social / Journey / Partnerships drawers */}
      <AnimatePresence>
        {(activeDrawer === 'identity' || activeDrawer === 'social' || activeDrawer === 'journey' || activeDrawer === 'partnerships') && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveDrawer(null)}
              className="fixed inset-0 bg-black z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white shadow-2xl z-50 overflow-y-auto px-6 py-6 text-left flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                      {activeDrawer === 'identity' && 'Edit Identity'}
                      {activeDrawer === 'social' && 'Edit Social Links'}
                      {activeDrawer === 'journey' && 'Edit Journey & Contact'}
                      {activeDrawer === 'partnerships' && 'Edit Partnerships'}
                    </h3>
                    <p className="text-[10px] font-mono text-slate-500">Live preview updates on save</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveDrawer(null)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-5">
                  {activeDrawer === 'identity' && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Title / Role</label>
                        <input
                          type="text"
                          value={identityForm.title}
                          onChange={(e) => setIdentityForm((prev) => ({ ...prev, title: e.target.value }))}
                          placeholder="Creator & Product Researcher"
                          className="w-full p-2 border rounded-xl text-xs bg-white border-slate-200 text-slate-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Location</label>
                        <input
                          type="text"
                          value={identityForm.location}
                          onChange={(e) => setIdentityForm((prev) => ({ ...prev, location: e.target.value }))}
                          placeholder="Dhaka, Bangladesh"
                          className="w-full p-2 border rounded-xl text-xs bg-white border-slate-200 text-slate-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Short Bio</label>
                        <textarea
                          rows={4}
                          value={identityForm.bio}
                          onChange={(e) => setIdentityForm((prev) => ({ ...prev, bio: e.target.value }))}
                          className="w-full p-2 border rounded-xl text-xs bg-white border-slate-200 text-slate-700"
                        />
                      </div>
                      {/* Live preview against name/title block */}
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center space-y-1">
                        <p className="text-sm font-black text-[#111827]">{model.name}</p>
                        <p className="text-[12px] text-[#2323FF] font-semibold">{identityForm.title || 'Creator & Product Researcher'}</p>
                        <p className="text-[11px] text-slate-500">{model.handle} · {identityForm.location || 'Dhaka, Bangladesh'}</p>
                      </div>
                    </>
                  )}

                  {activeDrawer === 'social' && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5"><Facebook className="w-3 h-3" /> Facebook</label>
                        <input type="url" value={socialForm.facebook} onChange={(e) => setSocialForm((prev) => ({ ...prev, facebook: e.target.value }))} placeholder="https://facebook.com/…" className="w-full p-2 border rounded-xl text-xs bg-white border-slate-200 text-slate-700" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5"><Instagram className="w-3 h-3" /> Instagram</label>
                        <input type="url" value={socialForm.instagram} onChange={(e) => setSocialForm((prev) => ({ ...prev, instagram: e.target.value }))} placeholder="https://instagram.com/…" className="w-full p-2 border rounded-xl text-xs bg-white border-slate-200 text-slate-700" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5"><Youtube className="w-3 h-3" /> YouTube</label>
                        <input type="url" value={socialForm.youtube} onChange={(e) => setSocialForm((prev) => ({ ...prev, youtube: e.target.value }))} placeholder="https://youtube.com/@…" className="w-full p-2 border rounded-xl text-xs bg-white border-slate-200 text-slate-700" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1.5"><Linkedin className="w-3 h-3" /> LinkedIn</label>
                        <input type="url" value={socialForm.linkedin} onChange={(e) => setSocialForm((prev) => ({ ...prev, linkedin: e.target.value }))} placeholder="https://linkedin.com/in/…" className="w-full p-2 border rounded-xl text-xs bg-white border-slate-200 text-slate-700" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">TikTok</label>
                        <input type="url" value={socialForm.tiktok} onChange={(e) => setSocialForm((prev) => ({ ...prev, tiktok: e.target.value }))} placeholder="https://tiktok.com/@…" className="w-full p-2 border rounded-xl text-xs bg-white border-slate-200 text-slate-700" />
                      </div>
                    </>
                  )}

                  {activeDrawer === 'journey' && (
                    <>
                      <BestForTagsChipField
                        tags={journeyForm.bestForTags}
                        onChange={(tags) => setJourneyForm((prev) => ({ ...prev, bestForTags: tags }))}
                        presets={['smartphones', 'laptops', 'gadget guides', 'tech reviews']}
                      />

                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <label className="text-[9px] font-black text-slate-500 block uppercase">Platforms</label>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                          {ALL_PLATFORMS.map((platform) => {
                            const selected = journeyForm.platforms.includes(platform);
                            return (
                              <label key={platform} className="flex items-center gap-1.5 text-xs text-slate-800">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setJourneyForm((prev) => ({ ...prev, platforms: [...prev.platforms, platform] }));
                                    } else {
                                      setJourneyForm((prev) => ({ ...prev, platforms: prev.platforms.filter((p) => p !== platform) }));
                                    }
                                  }}
                                  className="rounded text-orange-600 focus:ring-orange-500"
                                />
                                <span>{platform}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Email</label>
                          <input type="email" value={journeyForm.email} onChange={(e) => setJourneyForm((prev) => ({ ...prev, email: e.target.value }))} className="w-full p-2 border rounded-xl text-xs bg-white border-slate-200 text-slate-700" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Phone</label>
                          <input type="text" value={journeyForm.phone} onChange={(e) => setJourneyForm((prev) => ({ ...prev, phone: e.target.value }))} className="w-full p-2 border rounded-xl text-xs bg-white border-slate-200 text-slate-700" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Response Time</label>
                          <input type="text" value={journeyForm.responseTime} onChange={(e) => setJourneyForm((prev) => ({ ...prev, responseTime: e.target.value }))} placeholder="24 - 48 hours" className="w-full p-2 border rounded-xl text-xs bg-white border-slate-200 text-slate-700" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Preferred Contact</label>
                          <input type="text" value={journeyForm.preferredContact} onChange={(e) => setJourneyForm((prev) => ({ ...prev, preferredContact: e.target.value }))} placeholder="Email" className="w-full p-2 border rounded-xl text-xs bg-white border-slate-200 text-slate-700" />
                        </div>
                      </div>
                    </>
                  )}

                  {activeDrawer === 'partnerships' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 block uppercase">Brand Partners</label>
                        {partnershipsForm.brandPartners.map((bp, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <input
                              type="text"
                              placeholder="Brand name"
                              value={bp.name}
                              onChange={(e) => {
                                const next = [...partnershipsForm.brandPartners];
                                next[idx] = { ...next[idx], name: e.target.value };
                                setPartnershipsForm((prev) => ({ ...prev, brandPartners: next }));
                              }}
                              className="flex-1 p-2 border rounded-lg text-xs"
                            />
                            <input
                              type="color"
                              value={bp.color || '#1A1A2E'}
                              onChange={(e) => {
                                const next = [...partnershipsForm.brandPartners];
                                next[idx] = { ...next[idx], color: e.target.value };
                                setPartnershipsForm((prev) => ({ ...prev, brandPartners: next }));
                              }}
                              className="w-9 h-9 border rounded-lg p-0.5 cursor-pointer"
                              title="Brand chip color"
                            />
                            <button
                              type="button"
                              onClick={() => setPartnershipsForm((prev) => ({ ...prev, brandPartners: prev.brandPartners.filter((_, i) => i !== idx) }))}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setPartnershipsForm((prev) => ({ ...prev, brandPartners: [...prev.brandPartners, { name: '', color: '#1A1A2E' }] }))}
                          className="text-[10px] text-orange-600 font-bold hover:underline"
                        >
                          ＋ Add brand partner...
                        </button>
                        {/* Live preview */}
                        <div className="flex flex-wrap gap-2 pt-2">
                          {partnershipsForm.brandPartners.filter((bp) => bp.name).map((bp) => (
                            <span key={bp.name} className="border border-slate-200 rounded-md px-2.5 py-1 text-[11px] font-extrabold" style={{ color: bp.color }}>{bp.name}</span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <label className="text-[9px] font-black text-slate-500 block uppercase">Collaboration Types</label>
                        <div className="flex flex-wrap gap-1.5">
                          {partnershipsForm.collabTypes.map((ct) => (
                            <span key={ct} className="bg-slate-100 text-[10.5px] font-semibold text-slate-600 px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
                              {ct}
                              <button
                                type="button"
                                onClick={() => setPartnershipsForm((prev) => ({ ...prev, collabTypes: prev.collabTypes.filter((c) => c !== ct) }))}
                                className="text-slate-400 hover:text-red-600"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {COLLAB_TYPE_PRESETS.filter((preset) => !partnershipsForm.collabTypes.includes(preset)).map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setPartnershipsForm((prev) => ({ ...prev, collabTypes: [...prev.collabTypes, preset] }))}
                              className="px-2.5 py-1 bg-slate-50 border hover:bg-slate-100 rounded-lg text-[9px] text-slate-600 font-semibold cursor-pointer"
                            >
                              ＋ {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveDrawer(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activeDrawer === 'identity') saveIdentitySection();
                    if (activeDrawer === 'social') saveSocialSection();
                    if (activeDrawer === 'journey') saveJourneySection();
                    if (activeDrawer === 'partnerships') savePartnershipsSection();
                  }}
                  className="flex-1 py-2.5 bg-[#FF5B00] hover:bg-[#E64A00] text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-lg"
                >
                  Save Section
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-[600] bg-[#000435] text-white border border-green-500/30 p-4 rounded-2xl shadow-2xl"
          >
            <span className="font-extrabold text-orange-400 block uppercase text-[10px]">Information Saved</span>
            <p className="text-[11px] text-white/70 font-medium mt-0.5">{toastMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exit modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-black uppercase">Unsaved draft changes</h3>
            <p className="text-xs text-slate-500">Save before leaving, or discard and exit.</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  handleSaveDraft();
                  setShowExitModal(false);
                  navigate('/admin/creator-studio');
                }}
                className="py-2.5 bg-[#FF5B00] text-white text-xs font-bold rounded-xl"
              >
                Save Draft first then Exit
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitModal(false);
                  navigate('/admin/creator-studio');
                }}
                className="py-2.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
              >
                Discard & Exit
              </button>
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="py-2 text-xs text-slate-400 font-bold"
              >
                Stay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publish modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-black uppercase">Publish profile updates live?</h3>
            <p className="text-xs text-slate-500">
              Saves cover & avatar to the published creator snapshot (local storage for Slice 1).
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublishChanges}
                className="flex-1 py-2.5 bg-[#FF5B00] text-white text-xs font-bold rounded-xl"
              >
                Publish Live Now
              </button>
            </div>
          </div>
        </div>
      )}

      {isPublishing && (
        <div className="fixed inset-0 z-[550] bg-white/80 flex items-center justify-center">
          <p className="text-xs font-black uppercase tracking-widest text-[#FF5B00] animate-pulse">
            Publishing profile…
          </p>
        </div>
      )}
    </div>
  );
}