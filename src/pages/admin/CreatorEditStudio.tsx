import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  History,
  Pencil,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { BrandImageUploadField } from './BrandImageUploadField';
import { CreatorCMSModel, initialCreatorSeeds, CREATOR_STUDIO_LIST_KEY } from './creatorSeeds';
import { uploadCreatorImage } from '../../services/mediaUpload';

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
  const [versions, setVersions] = useState<{ timestamp: string; label: string; snapshot: CreatorCMSModel }[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<'cover' | null>(null);

  const [coverForm, setCoverForm] = useState({ coverImage: '', avatar: '' });

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    const draftKey = `choosify_creator_draft_${activeId}`;
    const pubKey = `choosify_creator_published_${activeId}`;
    const versionsKey = `choosify_creator_versions_${activeId}`;

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

    const cachedVersions = localStorage.getItem(versionsKey);
    if (cachedVersions) {
      try {
        setVersions(JSON.parse(cachedVersions));
      } catch {
        /* ignore */
      }
    }
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

  const handleSaveDraft = () => {
    if (!model) return;
    const draftKey = `choosify_creator_draft_${activeId}`;
    localStorage.setItem(draftKey, JSON.stringify(model));
    setHasUnsavedChanges(false);

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nextVer = {
      timestamp: timeStr,
      label: `Draft Saved: ${model.name}`,
      snapshot: model,
    };
    const updatedVersions = [nextVer, ...versions.slice(0, 8)];
    setVersions(updatedVersions);
    localStorage.setItem(`choosify_creator_versions_${activeId}`, JSON.stringify(updatedVersions));

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

    triggerToast('✓ Draft Saved Locally!');
  };

  const handlePublishChanges = () => {
    if (!model) return;
    setIsPublishing(true);
    setShowPublishModal(false);

    setTimeout(() => {
      localStorage.setItem(`choosify_creator_published_${activeId}`, JSON.stringify(model));
      localStorage.setItem(`choosify_creator_draft_${activeId}`, JSON.stringify(model));
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
      triggerToast('Creator Profile Published Live!');
    }, 900);
  };

  const restoreVersion = (snapshot: CreatorCMSModel) => {
    setModel(snapshot);
    setHasUnsavedChanges(true);
    setShowVersions(false);
    triggerToast('Snapshot restored into working draft');
  };

  const requestExit = () => {
    if (hasUnsavedChanges) setShowExitModal(true);
    else navigate('/admin/creator-studio');
  };

  if (!model) {
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
                    {versions.map((ver, idx) => (
                      <div key={idx} className="p-2 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                          <span>{ver.timestamp}</span>
                          <button
                            type="button"
                            onClick={() => setConfirmingId(ver.timestamp)}
                            className="font-bold text-[#FF5B00] hover:underline"
                          >
                            RESTORE
                          </button>
                        </div>
                        <span className="text-xs font-semibold truncate text-[#111827] block">{ver.label}</span>
                        {confirmingId === ver.timestamp && (
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

            {/* Identity read-only placeholders (later slices edit these) */}
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
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider pt-2">
                Identity / social / journey drawers come in later slices
              </p>
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