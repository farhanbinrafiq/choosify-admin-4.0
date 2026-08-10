// BrandEditStudio.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, RotateCw, Check, AlertCircle, History, Sparkles, ShieldAlert,
  Lock, EyeOff, Heart, Eye, Trash2, Plus, Pencil, Facebook, Instagram,
  Youtube, Phone, Mail, MapPin, Globe, Clock, Copy, PlusCircle, ExternalLink,
  Calendar, Users, Award, Play, Star, Sparkles as SparkleIcon, ArrowUp, ArrowDown, ShieldCheck, Video, CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  BrandCMSModel,
  CreatorVideoItem,
  PromoCodeItem,
  BrandStoreEntry,
  BrandServiceCenterEntry,
  BrandStoresModel,
  BrandFaqItem,
} from "./brandSeeds";
import { useAuth } from "../../contexts/AuthContext";
import { useBrandProfiles } from "../../contexts/BrandProfilesContext";
import { catalogApi } from "../../services/catalogApi";
import type { CatalogBrand, CatalogProduct } from "../../types/catalog";
import { BrandImageUploadField } from "./BrandImageUploadField";
import { useEntityDraft } from "../../hooks/useEntityDraft";
import { BrandProfilePresentation } from "../../components/brand-profile";

/**
 * Blank scaffold for a real Brand with no draft/published cache yet.
 * Never falls back to demo Samsung/Aarong seed content — only known catalog
 * fields are filled; everything else starts empty.
 */
function createBlankBrandModel(id: string, name: string, category: string): BrandCMSModel {
  return {
    id,
    brandName: name,
    slug: "",
    logo: "",
    coverImage: "",
    tagline: "",
    category,
    socialFbUrl: "",
    socialInstaUrl: "",
    socialTiktokUrl: "",
    socialYtUrl: "",
    website: "",
    description: "",
    missionStatement: "",
    brandStory: "",
    values: "",
    verificationStatus: "Standard",
    status: "DRAFT",
    choosifyScore: 0,
    qualityScore: 0,
    serviceScore: 0,
    deliveryScore: 0,
    packagingScore: 0,
    recommendationScore: 0,
    verifiedPurchasePercentage: 0,
    returnRate: "0%",
    complaintRate: "0%",
    responseTime: "N/A",
    followersCount: 0,
    logoUrl: "",
    recentTrustAlerts: [],
    products: [],
    deals: [],
    promoCodes: [],
    creators: [],
    reviews: [],
    team: [],
    stores: { authorized: [], distributors: [], serviceCenters: [] },
    faq: [],
    address: "",
    contactEmail: "",
    phone: "",
    mapLink: "",
    audienceType: "",
    ageRange: "",
    genderFocus: "",
    priceRange: "",
    services: [],
    specialties: [],
    bestForTags: [],
    returnPolicy: "",
    warrantyInfo: "",
    deliveryCoverage: "",
    customerServiceHours: "",
    visibility: {
      overview: true,
      products: true,
      featuredProducts: true,
      deals: true,
      promoCodes: true,
      creatorReviews: true,
      publicReviews: true,
      trustSection: true,
      brandInformation: true,
    },
  };
}

function mapCatalogBrandToModel(brand: CatalogBrand): BrandCMSModel {
  const blank = createBlankBrandModel(brand.id, brand.name || "", brand.category || "");
  const ov = brand.overview || {};
  const social = brand.socialLinks || {};
  const stores = brand.stores || {};
  const withId = <T extends { name: string }>(rows: T[] | undefined, prefix: string) =>
    (rows || []).map((row, i) => ({
      id: `${prefix}-${i}`,
      name: row.name,
      sub: ("sub" in row ? String((row as { sub?: string }).sub || "") : "") as string,
      ...("hours" in row ? { hours: String((row as { hours?: string }).hours || "") } : {}),
    }));

  return {
    ...blank,
    brandName: brand.name || "",
    slug: brand.slug || "",
    logo: brand.logo || "",
    logoUrl: brand.logo || "",
    coverImage: brand.coverImage || "",
    tagline: brand.tagline || "",
    category: brand.category || "",
    website: brand.website || "",
    description: brand.description || "",
    brandStory: brand.story || "",
    socialFbUrl: social.facebook || "",
    socialInstaUrl: social.instagram || "",
    socialTiktokUrl: social.tiktok || "",
    socialYtUrl: social.youtube || "",
    verificationStatus: brand.verifiedStatus
      ? "Verified"
      : brand.claimStatus === "pending"
        ? "Suspended"
        : "Standard",
    status: brand.marketplaceAccess ? "LIVE" : "DRAFT",
    choosifyScore: typeof brand.ratings === "number" && brand.ratings > 0 ? brand.ratings : 0,
    followersCount: typeof brand.followers === "number" ? brand.followers : 0,
    address: ov.address || "",
    contactEmail: ov.email || "",
    phone: ov.phone || "",
    priceRange: ov.priceRange || "",
    ageRange: ov.ageFocus || "",
    audienceType: ov.audience || "",
    services: Array.isArray(ov.services) ? ov.services : [],
    bestForTags: Array.isArray(ov.tags) ? ov.tags : [],
    faq: (brand.faq || []).map((f, i) => ({
      id: `faq-${i}`,
      q: f.q || "",
      a: f.a || "",
    })),
    stores: {
      authorized: withId(stores.authorized, "auth") as BrandStoreEntry[],
      distributors: withId(stores.distributors, "dist") as BrandStoreEntry[],
      serviceCenters: withId(stores.serviceCenters, "svc") as BrandServiceCenterEntry[],
    },
    promoCodes: (brand.promoCodes || []).map((p) => ({
      id: p.id,
      code: p.code,
      discountType: p.discountType,
      discountValue: p.discountValue,
      startDate: p.startDate,
      endDate: p.endDate,
      usageLimit: p.usageLimit,
      enabled: p.enabled,
    })),
  };
}

function mapCatalogProductToItem(p: CatalogProduct): BrandCMSModel["products"][number] {
  const statusRaw = String(p.status || "").toLowerCase();
  const status =
    statusRaw === "live" || statusRaw === "active"
      ? "Live"
      : statusRaw === "archived" || statusRaw === "hidden"
        ? "Hidden"
        : "Draft";
  return {
    id: p.id,
    name: p.title || "Untitled",
    sku: (p as { sku?: string }).sku || p.id,
    category: p.categoryName || "",
    price: typeof p.price === "number" ? p.price : Number(p.price) || 0,
    stock: typeof p.stock === "number" ? p.stock : Number(p.stock) || 0,
    featured: Boolean(p.featuredFlag),
    status,
    thumbnail: p.image || (Array.isArray(p.gallery) && p.gallery[0] ? p.gallery[0] : ""),
  };
}

/** Soft URL check — empty is fine; only warn when non-empty looks invalid. */
function softUrlError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    if (!parsed.hostname.includes(".")) return "Enter a valid URL";
    return null;
  } catch {
    return "Enter a valid URL";
  }
}

interface BrandEditStudioProps {
  overrideId?: string;
  isNested?: boolean;
}

export default function BrandEditStudio({ overrideId, isNested }: BrandEditStudioProps = {}) {
  const { id } = useParams<{ id: string }>();
  const { activeBrandId, allBrands, setActiveBrandId } = useAuth();
  const navigate = useNavigate();
  // Never default to demo id "1" (Samsung seed). Prefer route/override/active brand.
  const activeId = overrideId || id || activeBrandId || "";

  useEffect(() => {
    if (activeId) setActiveBrandId(activeId);
  }, [activeId, setActiveBrandId]);

  const brandProfilesRef = useRef<any>(null);
  try {
    brandProfilesRef.current = useBrandProfiles();
  } catch (e) {}

  useEffect(() => {
    try {
      brandProfilesRef.current = useBrandProfiles();
    } catch (e) {}
  });

  // Brand Model state
  const [model, setModel] = useState<BrandCMSModel | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [creatorFilter, setCreatorFilter] = useState<string>("ALL");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Versions and historical rollbacks state
  const [showVersions, setShowVersions] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Exit Modal, Publish Modal, and Drawer state
  const [showExitModal, setShowExitModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<"header" | "creators" | "promos" | "overview" | "stores" | "faq" | "story" | null>(null);

  // --- DRAWER WORKSPACE FORM STATES ---
  // Header editing temporal state
  const [headerForm, setHeaderForm] = useState({
    brandName: "",
    category: "",
    logo: "",
    coverImage: "",
    tagline: "",
    socialFbUrl: "",
    socialInstaUrl: "",
    socialTiktokUrl: "",
    socialYtUrl: "",
    website: ""
  });

  // Creators list temporal copy
  const [tempCreators, setTempCreators] = useState<CreatorVideoItem[]>([]);
  const [editingCreatorId, setEditingCreatorId] = useState<string | null>(null);
  const [creatorForm, setCreatorForm] = useState({
    title: "",
    sourceUrl: "",
    platform: "youtube" as "youtube" | "instagram" | "tiktok" | "facebook",
    thumbnailUrl: "",
    duration: "",
    creatorName: "",
    views: 0,
    clicks: 0
  });

  // Promo Vouchers list temporal copy
  const [tempPromos, setTempPromos] = useState<PromoCodeItem[]>([]);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [promoForm, setPromoForm] = useState({
    code: "",
    discountType: "Percentage" as "Percentage" | "Flat",
    discountValue: 0,
    startDate: "",
    endDate: "",
    usageLimit: 500,
    enabled: true,
    targetAudience: "All Customers" as "New Customers" | "Existing Customers" | "All Customers"
  });

  // Where to Buy stores temporal copy
  const [tempStores, setTempStores] = useState<BrandStoresModel>({ authorized: [], distributors: [], serviceCenters: [] });
  const [storyForm, setStoryForm] = useState({
    brandStory: "",
    missionStatement: "",
    values: "",
  });

  // FAQ list temporal copy
  const [tempFaqs, setTempFaqs] = useState<BrandFaqItem[]>([]);

  // Brand Overview temporal state
  const [overviewForm, setOverviewForm] = useState({
    address: "",
    website: "",
    mapLink: "",
    contactEmail: "",
    phone: "",
    priceRange: "",
    minPrice: 0,
    maxPrice: 0,
    ageRange: "",
    genders: [] as string[],
    services: [] as string[],
    bestForTags: [] as string[]
  });

  const draftKey = `choosify_brand_draft_${activeId}`;
  const pubKey = `choosify_brand_published_${activeId}`;
  const versionsKey = `choosify_brand_versions_${activeId}`;

  const {
    saveDraft: persistDraft,
    versions,
    saveVersion,
    error: draftError,
    isSaving: isDraftSaving,
    isLoading: isDraftLoading,
  } = useEntityDraft<BrandCMSModel>(
    "brand",
    activeId,
    { draftKey, versionsKey },
    (backendDraft) => setModel(backendDraft),
  );

  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (isDraftSaving) {
      setSyncStatus("saving");
    } else if (draftError) {
      setSyncStatus("error");
      triggerToast(`âš  Save failed: ${draftError}`);
    } else if (syncStatus === "saving") {
      setSyncStatus("saved");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDraftSaving, draftError]);

  // Load real Brand data — never Samsung/Aarong demo seeds
  useEffect(() => {
    if (!activeId) {
      setModel(createBlankBrandModel("new", "", ""));
      return;
    }

    let cancelled = false;

    async function loadBrand() {
      let loaded: BrandCMSModel | null = null;
      const cacheDraft = localStorage.getItem(draftKey);
      if (cacheDraft) {
        try {
          loaded = JSON.parse(cacheDraft);
        } catch (_) {}
      }
      if (!loaded) {
        const cachePub = localStorage.getItem(pubKey);
        if (cachePub) {
          try {
            loaded = JSON.parse(cachePub);
          } catch (_) {}
        }
      }

      // Prefer live catalog over any leftover local demo content
      try {
        const brands = await catalogApi.listBrands();
        const catalogBrand = brands.find((b) => b.id === activeId);
        if (catalogBrand) {
          const fromCatalog = mapCatalogBrandToModel(catalogBrand);
          loaded = loaded
            ? {
                ...fromCatalog,
                ...loaded,
                id: activeId,
                brandName: loaded.brandName || fromCatalog.brandName,
                category: loaded.category || fromCatalog.category,
                // Prefer catalog media/story when local draft left them empty
                logo: loaded.logo || fromCatalog.logo,
                coverImage: loaded.coverImage || fromCatalog.coverImage,
                tagline: loaded.tagline || fromCatalog.tagline,
                description: loaded.description || fromCatalog.description,
                brandStory: loaded.brandStory || fromCatalog.brandStory,
                website: loaded.website || fromCatalog.website,
                socialFbUrl: loaded.socialFbUrl || fromCatalog.socialFbUrl,
                socialInstaUrl: loaded.socialInstaUrl || fromCatalog.socialInstaUrl,
                socialTiktokUrl: loaded.socialTiktokUrl || fromCatalog.socialTiktokUrl,
                socialYtUrl: loaded.socialYtUrl || fromCatalog.socialYtUrl,
                faq: loaded.faq?.length ? loaded.faq : fromCatalog.faq,
                stores: loaded.stores || fromCatalog.stores,
                promoCodes: loaded.promoCodes?.length ? loaded.promoCodes : fromCatalog.promoCodes,
                followersCount: fromCatalog.followersCount || loaded.followersCount || 0,
                choosifyScore: fromCatalog.choosifyScore || loaded.choosifyScore || 0,
                verificationStatus: fromCatalog.verificationStatus,
              }
            : fromCatalog;
        }
      } catch (_) {
        // catalog fetch failed — keep local draft/blank
      }

      if (!loaded) {
        const matchedBrand = allBrands.find((b) => b.id === activeId);
        loaded = createBlankBrandModel(
          activeId,
          matchedBrand?.name || "",
          matchedBrand?.category || "",
        );
      }

      // Attach real catalog products for this brand (no fake product cards)
      try {
        const products = await catalogApi.listProducts();
        const brandProducts = products
          .filter(
            (p) =>
              p.brandId === activeId ||
              (loaded?.brandName &&
                p.brandName &&
                p.brandName.toLowerCase() === loaded.brandName.toLowerCase()),
          )
          .map(mapCatalogProductToItem);
        if (brandProducts.length > 0 && loaded) {
          loaded = { ...loaded, products: brandProducts };
        }
      } catch (_) {}

      // Attach real deals for this brand when brandId is present
      try {
        const deals = await catalogApi.listDeals();
        const brandDeals = deals
          .filter((d) => d.brandId === activeId)
          .map((d) => ({
            id: d.id,
            title: d.name,
            discountType: (d.discountType === "flat" ? "Flat" : "Percentage") as "Percentage" | "Flat",
            discountValue: d.discountValue,
            status: (d.status === "live" ? "Active" : d.status === "expired" ? "Expired" : "Scheduled") as
              | "Active"
              | "Scheduled"
              | "Expired",
            startDate: d.validFrom || "",
            endDate: d.validUntil || "",
          }));
        if (brandDeals.length > 0 && loaded) {
          loaded = { ...loaded, deals: brandDeals };
        }
      } catch (_) {}

      if (!cancelled && loaded) {
        setModel(loaded);
      }
    }

    void loadBrand();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Toast notifier trigger helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // --- DRAWER SEED TRIGGER ACTIONS ---
  const openEditDrawer = (type: "header" | "creators" | "promos" | "overview" | "stores" | "faq" | "story") => {
    if (!model) return;
    setActiveDrawer(type);

    if (type === "header") {
      setHeaderForm({
        brandName: model.brandName || "",
        category: model.category || "",
        logo: model.logo || "",
        coverImage: model.coverImage || "",
        tagline: model.tagline || "",
        socialFbUrl: model.socialFbUrl || "",
        socialInstaUrl: model.socialInstaUrl || "",
        socialTiktokUrl: model.socialTiktokUrl || "",
        socialYtUrl: model.socialYtUrl || "",
        website: model.website || ""
      });
    } else if (type === "story") {
      setStoryForm({
        brandStory: model.brandStory || "",
        missionStatement: model.missionStatement || "",
        values: model.values || "",
      });
    } else if (type === "creators") {
      setTempCreators(JSON.parse(JSON.stringify(model.creators || [])));
      setEditingCreatorId(null);
      resetCreatorForm();
    } else if (type === "promos") {
      setTempPromos(JSON.parse(JSON.stringify(model.promoCodes || [])));
      setEditingPromoId(null);
      resetPromoForm();
    } else if (type === "overview") {
      // Map gender focus checklist
      const gendersList: string[] = [];
      if (model.genderFocus) {
        if (model.genderFocus.includes("Male")) gendersList.push("Male");
        if (model.genderFocus.includes("Female")) gendersList.push("Female");
        if (model.genderFocus.includes("Youth")) gendersList.push("Youth");
        if (model.genderFocus.includes("Kids")) gendersList.push("Kids");
        if (model.genderFocus.includes("Unisex")) gendersList.push("Unisex");
      }
      setOverviewForm({
        address: model.address || "",
        website: model.website || "",
        mapLink: model.mapLink || "",
        contactEmail: model.contactEmail || "",
        phone: model.phone || "",
        priceRange: model.priceRange || "",
        minPrice: 500,
        maxPrice: 350000,
        ageRange: model.ageRange || "18 - 55 Years",
        genders: gendersList,
        services: [...(model.services || [])],
        bestForTags: [...(model.bestForTags || [])]
      });
    } else if (type === "stores") {
      setTempStores(JSON.parse(JSON.stringify(model.stores || { authorized: [], distributors: [], serviceCenters: [] })));
    } else if (type === "faq") {
      setTempFaqs(JSON.parse(JSON.stringify(model.faq || [])));
    }
  };

  const resetCreatorForm = () => {
    setCreatorForm({
      title: "",
      sourceUrl: "",
      platform: "youtube",
      thumbnailUrl: "",
      duration: "",
      creatorName: "",
      views: 0,
      clicks: 0
    });
  };

  const resetPromoForm = () => {
    setPromoForm({
      code: "",
      discountType: "Percentage",
      discountValue: 10,
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split("T")[0],
      usageLimit: 1000,
      enabled: true,
      targetAudience: "All Customers"
    });
  };

  const autoGeneratePromoCode = () => {
    if (!model) return;
    const tag = (model.brandName || "SAM").toUpperCase().slice(0, 4).replace(/\s+/g, "");
    const randomValue = Math.floor(100 + Math.random() * 900);
    const generated = `${tag}${randomValue}`;
    setPromoForm(prev => ({ ...prev, code: generated }));
  };

  // --- SAVE PORTAL STATE WRITERS ---
  const saveHeaderSection = () => {
    if (!model) return;
    const nextModel = {
      ...model,
      brandName: headerForm.brandName,
      category: headerForm.category,
      logo: headerForm.logo,
      coverImage: headerForm.coverImage,
      tagline: headerForm.tagline,
      socialFbUrl: headerForm.socialFbUrl,
      socialInstaUrl: headerForm.socialInstaUrl,
      socialTiktokUrl: headerForm.socialTiktokUrl,
      socialYtUrl: headerForm.socialYtUrl,
      website: headerForm.website
    };
    setModel(nextModel);
    setHasUnsavedChanges(true);
    setActiveDrawer(null);
    triggerToast("Brand Header Information Updated");
  };

  const saveCreatorsSection = () => {
    if (!model) return;
    const nextModel = {
      ...model,
      creators: tempCreators
    };
    setModel(nextModel);
    setHasUnsavedChanges(true);
    setActiveDrawer(null);
    triggerToast("Creator Content Updated Successfully");
  };

  const saveStorySection = () => {
    if (!model) return;
    setModel({
      ...model,
      brandStory: storyForm.brandStory,
      missionStatement: storyForm.missionStatement,
      values: storyForm.values,
    });
    setHasUnsavedChanges(true);
    setActiveDrawer(null);
    triggerToast("Brand Story Updated Successfully");
  };

  const savePromosSection = () => {
    if (!model) return;
    const nextModel = {
      ...model,
      promoCodes: tempPromos
    };
    setModel(nextModel);
    setHasUnsavedChanges(true);
    setActiveDrawer(null);
    triggerToast("Promo Codes Updated Successfully");
  };

  const saveOverviewSection = () => {
    if (!model) return;
    const nextModel = {
      ...model,
      address: overviewForm.address,
      website: overviewForm.website,
      mapLink: overviewForm.mapLink,
      contactEmail: overviewForm.contactEmail,
      phone: overviewForm.phone,
      priceRange: overviewForm.priceRange,
      ageRange: overviewForm.ageRange,
      genderFocus: overviewForm.genders.join(", "),
      services: overviewForm.services,
      bestForTags: overviewForm.bestForTags
    };
    setModel(nextModel);
    setHasUnsavedChanges(true);
    setActiveDrawer(null);
    triggerToast("Brand Overview Saved Successfully");
  };

  const saveStoresSection = () => {
    if (!model) return;
    setModel({ ...model, stores: tempStores });
    setHasUnsavedChanges(true);
    setActiveDrawer(null);
    triggerToast("Where to Buy Updated Successfully");
  };

  const saveFaqSection = () => {
    if (!model) return;
    setModel({ ...model, faq: tempFaqs });
    setHasUnsavedChanges(true);
    setActiveDrawer(null);
    triggerToast("FAQ Updated Successfully");
  };

  // --- WHERE TO BUY: generic add/update/remove/reorder helpers for the 3 store columns ---
  const addStoreEntry = (column: keyof BrandStoresModel) => {
    const id = `${column}-${Date.now()}`;
    setTempStores(prev => ({
      ...prev,
      [column]: [
        ...prev[column],
        column === "serviceCenters"
          ? ({ id, name: "New Service Center", sub: "Location", hours: "10AM - 7PM" } as BrandServiceCenterEntry)
          : ({ id, name: "New Entry", sub: "Location" } as BrandStoreEntry),
      ],
    }));
  };

  const updateStoreEntry = (column: keyof BrandStoresModel, id: string, patch: Partial<BrandServiceCenterEntry>) => {
    setTempStores(prev => ({
      ...prev,
      [column]: prev[column].map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    }));
  };

  const removeStoreEntry = (column: keyof BrandStoresModel, id: string) => {
    setTempStores(prev => ({
      ...prev,
      [column]: prev[column].filter((entry) => entry.id !== id),
    }));
  };

  const moveStoreEntry = (column: keyof BrandStoresModel, index: number, direction: "up" | "down") => {
    setTempStores(prev => {
      const list = [...prev[column]];
      const targetIdx = direction === "up" ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= list.length) return prev;
      [list[index], list[targetIdx]] = [list[targetIdx], list[index]];
      return { ...prev, [column]: list };
    });
  };

  // --- FAQ: add/update/remove/reorder helpers ---
  const addFaqEntry = () => {
    setTempFaqs(prev => [...prev, { id: `fq-${Date.now()}`, q: "New question", a: "" }]);
  };

  const updateFaqEntry = (id: string, patch: Partial<BrandFaqItem>) => {
    setTempFaqs(prev => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const removeFaqEntry = (id: string) => {
    setTempFaqs(prev => prev.filter((entry) => entry.id !== id));
  };

  const moveFaqEntry = (index: number, direction: "up" | "down") => {
    setTempFaqs(prev => {
      const list = [...prev];
      const targetIdx = direction === "up" ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= list.length) return prev;
      [list[index], list[targetIdx]] = [list[targetIdx], list[index]];
      return list;
    });
  };

  // --- PERSISTENCE: SAVE DRAFT & LIVE PUBLISH HANDLERS ---
  const handleSaveDraft = () => {
    if (!model) return;
    persistDraft(model);
    setHasUnsavedChanges(false);
    setSyncStatus("saving");
    saveVersion(`Draft Saved: ${model.brandName}`, model);
    triggerToast("Saving draftâ€¦");
  };

  const handlePublishChanges = async () => {
    if (!model) return;
    setIsPublishing(true);
    setShowPublishModal(false);

    let publishSucceeded = false;
    try {
      await catalogApi.updateBrand(activeId, {
        name: model.brandName,
        category: model.category,
        description: model.description,
        logo: model.logo,
        faq: model.faq,
        stores: model.stores,
        promoCodes: model.promoCodes,
      });
      publishSucceeded = true;
    } catch (err) {
      console.warn('[BrandEditStudio] Catalog brand sync failed', err);
    }

    const pubKey = `choosify_brand_published_${activeId}`;
    localStorage.setItem(pubKey, JSON.stringify(model));
    persistDraft(model);
    setHasUnsavedChanges(false);

    // Also update BrandProfilesContext so the brands list reflects this edit
    try {
      const { updateProfile } = brandProfilesRef.current || {};
      if (updateProfile && activeId) {
        updateProfile(activeId, {
          name: model.brandName,
          category: model.category,
          logo: model.logo,
          coverImage: model.coverImage,
          websiteUrl: model.website,
          facebookUrl: model.socialFbUrl,
          instagramUrl: model.socialInstaUrl,
          youtubeUrl: model.socialYtUrl,
          description: model.tagline,
        });
      }
    } catch (err) {
      // Context update is best-effort; localStorage is the source of truth for now
    }

    setIsPublishing(false);
    triggerToast(
      publishSucceeded
        ? "ðŸš€ Brand Profile Published Live in Bangladesh!"
        : "âš  Publish failed to sync to catalog â€” draft saved locally, please retry.",
    );
  };

  const restoreVersion = (snapshot: Record<string, unknown>) => {
    setModel(JSON.parse(JSON.stringify(snapshot)) as BrandCMSModel);
    setHasUnsavedChanges(true);
    setShowVersions(false);
    triggerToast("âœ“ Snapshot restored successfully!");
  };

  // --- DYNAMIC CREATORS ENGINE: REORDER, DEFINE, OR FEATURE ---
  const toggleFeatureCreator = (id: string) => {
    setTempCreators(prev => prev.map(c => ({
      ...c,
      status: (c.id === id ? "Approved" : c.status) as any // Mark approved for feature view
    })));
  };

  const deleteCreatorItem = (id: string) => {
    setTempCreators(prev => prev.filter(c => c.id !== id));
  };

  const moveCreatorOrder = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === tempCreators.length - 1) return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const next = [...tempCreators];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    setTempCreators(next);
  };

  const addOrUpdateCreator = () => {
    if (!creatorForm.title || !creatorForm.creatorName) {
      alert("Please fill Title and Creator Handle");
      return;
    }

    if (editingCreatorId) {
      setTempCreators(prev => prev.map(c => c.id === editingCreatorId ? {
        ...c,
        title: creatorForm.title,
        sourceUrl: creatorForm.sourceUrl,
        platform: creatorForm.platform,
        thumbnailUrl: creatorForm.thumbnailUrl,
        duration: creatorForm.duration,
        creatorName: creatorForm.creatorName,
        views: Number(creatorForm.views),
        clicks: Number(creatorForm.clicks)
      } : c));
      setEditingCreatorId(null);
    } else {
      const newItem: CreatorVideoItem = {
        id: "cr_" + Math.random().toString(36).substr(2, 9),
        title: creatorForm.title,
        sourceUrl: creatorForm.sourceUrl,
        platform: creatorForm.platform,
        thumbnailUrl: creatorForm.thumbnailUrl || "",
        duration: creatorForm.duration || "12:00",
        creatorName: creatorForm.creatorName,
        views: Number(creatorForm.views) || 24000,
        clicks: Number(creatorForm.clicks) || 500,
        status: "Approved"
      };
      setTempCreators(prev => [newItem, ...prev]);
    }
    resetCreatorForm();
  };

  // --- DYNAMIC PROMOS ENGINE: DEACTIVATE, COPY, DUPLICATE ---
  const changePromoEnabled = (id: string, enabled: boolean) => {
    setTempPromos(prev => prev.map(p => p.id === id ? { ...p, enabled } : p));
  };

  const deletePromoItem = (id: string) => {
    setTempPromos(prev => prev.filter(p => p.id !== id));
  };

  const duplicatePromoItem = (id: string) => {
    const target = tempPromos.find(p => p.id === id);
    if (!target) return;
    const copied: PromoCodeItem = {
      ...target,
      id: "pr_" + Math.random().toString(36).substr(2, 9),
      code: `${target.code}-COPY`,
      enabled: false
    };
    setTempPromos(prev => [...prev, copied]);
  };

  const addOrUpdatePromo = () => {
    if (!promoForm.code || !promoForm.discountValue) {
      alert("Please enter Promo Code and discount values");
      return;
    }

    const valueObject = {
      code: promoForm.code.toUpperCase(),
      discountType: promoForm.discountType,
      discountValue: Number(promoForm.discountValue),
      startDate: promoForm.startDate,
      endDate: promoForm.endDate,
      usageLimit: Number(promoForm.usageLimit),
      enabled: promoForm.enabled
    };

    if (editingPromoId) {
      setTempPromos(prev => prev.map(p => p.id === editingPromoId ? { ...p, ...valueObject } : p));
      setEditingPromoId(null);
    } else {
      const newItem: PromoCodeItem = {
        id: "pr_" + Math.random().toString(36).substr(2, 9),
        ...valueObject
      };
      setTempPromos(prev => [...prev, newItem]);
    }
    resetPromoForm();
  };

  // --- FILTERED CREATOR LIST FOR FRONTEND VIEW ---
  const activeCreator = useMemo(() => {
    if (!model) return null;
    const pool = model.creators || [];
    const approved = pool.filter(c => c.status === "Approved");
    return approved[0] || pool[0] || null;
  }, [model]);

  const filteredCreatorsList = useMemo(() => {
    if (!model) return [];
    const pool = model.creators || [];
    const filtered = pool.filter(c => {
      if (creatorFilter === "ALL") return true;
      return c.platform.toLowerCase() === creatorFilter.toLowerCase();
    });
    // Skip the featured one at the top is fine or show all. Let's show all in the filter list!
    return filtered;
  }, [model, creatorFilter]);

  if (!model || isDraftLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[420px] gap-3 text-app-text-muted">
        <RotateCw className="w-10 h-10 animate-spin text-[#EF3C23]" />
        <span className="text-xs font-mono">Loading Choosify Enterprise Workspace...</span>
      </div>
    );
  }

  return (
    <div className="aws-page flex flex-col text-slate-900 select-none relative overflow-x-hidden">
      
      {/* TOP HEADER STATUS TOOLBAR â€” editor chrome inside workspace content */}
      <header className="h-14 shrink-0 bg-white border border-app-border rounded-[18px] px-5 flex items-center justify-between z-30 shadow-sm mb-5">
        <div className="flex items-center gap-4">
          {!isNested && (
            <button 
              onClick={() => hasUnsavedChanges ? setShowExitModal(true) : navigate("/admin/brand-studio")}
              className="p-2 bg-[#F1F3F5] text-slate-700 hover:bg-[#E8EDF2] rounded-[8px] transition-colors flex items-center gap-1 text-[#111827]"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black text-[#111827]">{model.brandName}</h1>
              <span className="p-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-bold px-1.5 flex items-center gap-0.5">
                ● LIVE PROFILE
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono tracking-wider">
              {isNested ? 'Brand Portfolio · Visual Builder' : 'Choosify Brand Visual Builder'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasUnsavedChanges && (
            <span className="flex items-center gap-1 text-[#EF3C23] text-[10px] font-mono font-bold animate-pulse">
              â— UNSAVED DRAFT CHANGES
            </span>
          )}

          {syncStatus === "saving" && (
            <span className="flex items-center gap-1 text-blue-600 text-[10px] font-mono font-bold animate-pulse">
              â— Savingâ€¦
            </span>
          )}
          {syncStatus === "saved" && (
            <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-mono font-bold">
              âœ“ Synced to server
            </span>
          )}
          {syncStatus === "error" && (
            <span className="flex items-center gap-1 text-red-600 text-[10px] font-mono font-bold" title={draftError || undefined}>
              âš  Save failed â€” retry
            </span>
          )}

          {/* VersionsDropdown Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowVersions(!showVersions)}
              className="p-2 bg-white border border-slate-200 rounded-xl text-[#111827] hover:bg-slate-50 transition flex items-center gap-1.5 text-xs font-semibold"
            >
              <History className="w-4 h-4 text-[#EF3C23]" />
              <span>Snapshots ({versions.length})</span>
            </button>
            {showVersions && (
              <div className="absolute right-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 w-80 z-40 text-left text-slate-800">
                <p className="text-xs font-black uppercase text-[#EF3C23] border-b border-slate-100 pb-2">History Logs & Revisions</p>
                {versions.length === 0 ? (
                  <p className="text-[11px] font-mono text-slate-400 py-4">No snapshots registered in this session.</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto mt-2 custom-scrollbar">
                    {versions.map((ver) => (
                      <div key={ver.id} className="p-2 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-1">
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                          <span>{new Date(ver.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          <button
                            onClick={() => setConfirmingId(ver.id)}
                            className="font-bold text-[#EF3C23] hover:underline text-[10px]"
                          >
                            RESTORE
                          </button>
                        </div>
                        <span className="text-xs font-semibold truncate text-[#111827]">{ver.label}</span>

                        {confirmingId === ver.id && (
                          <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded-lg flex flex-col gap-1.5">
                            <span className="text-[9px] font-black text-red-600">Restore snapshot? Current draft will become unsaved.</span>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => { restoreVersion(ver.snapshot); setConfirmingId(null); }}
                                className="px-2 py-1 bg-red-500 text-white text-[8px] font-black uppercase rounded hover:bg-[#E64A00] transition-colors"
                              >Confirm</button>
                              <button
                                onClick={() => setConfirmingId(null)}
                                className="px-2 py-1 bg-gray-100 text-gray-600 text-[8px] font-black uppercase rounded hover:bg-gray-200 transition-colors"
                              >Cancel</button>
                            </div>
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
            onClick={handleSaveDraft}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-[#111827] font-bold text-xs rounded-xl transition"
          >
            Save Draft
          </button>

          <button
            onClick={() => setShowPublishModal(true)}
            className="px-5 py-2 bg-[#EF3C23] hover:bg-[#E64A00] text-app-text-primary font-black rounded-xl text-xs shadow-md transition"
          >
            Publish Live Profile
          </button>
        </div>
      </header>

      {/* Storefront-parity Visual Builder canvas */}
      <main className="w-full pt-5 pb-8">
        <BrandProfilePresentation
          model={model}
          mode="editor"
          compareBrands={allBrands
            .filter((b) => b.id !== model.id)
            .slice(0, 4)
            .map((b) => ({
              id: b.id,
              name: b.name,
              category: b.category,
              score: typeof (b as { ratings?: number }).ratings === "number" ? (b as { ratings?: number }).ratings : undefined,
            }))}
          onEditSection={(section) => {
            if (section === "products") {
              triggerToast("Manage products in Products & Inventory");
              return;
            }
            if (section === "reviews") {
              triggerToast("Reviews come from verified purchases and stay read-only here");
              return;
            }
            if (section === "story") {
              openEditDrawer("story");
              return;
            }
            if (section === "creators") {
              openEditDrawer("creators");
              return;
            }
            openEditDrawer(section);
          }}
        />
      </main>

      {/* --- FLOATING MODULAR SLIDING DRAWER SYSTEM (480px) --- */}
      <AnimatePresence>
        {activeDrawer && (
          <>
            {/* Backdrop cover overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveDrawer(null)}
              className="fixed inset-0 bg-app-card z-40"
            />

            {/* Slide-out Panel Right Side */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white shadow-2xl z-50 overflow-y-auto px-6 py-6 text-left flex flex-col justify-between custom-scrollbar"
            >
              
              {/* Drawer Title Header */}
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                      {activeDrawer === "header" && "Edit Brand Header"}
                      {activeDrawer === "creators" && "Manage Creator Hub"}
                      {activeDrawer === "promos" && "Manage Vouchers"}
                      {activeDrawer === "overview" && "Edit Overview Specs"}
                      {activeDrawer === "stores" && "Manage Where to Buy"}
                      {activeDrawer === "faq" && "Manage FAQ"}
                      {activeDrawer === "story" && "Edit Brand Story"}
                    </h3>
                    <p className="text-[10px] font-mono text-slate-500">Live Workspace Profile Control Panel</p>
                  </div>
                  <button 
                    onClick={() => setActiveDrawer(null)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-app-text-secondary"
                  >
                    âœ•
                  </button>
                </div>

                {/* DRAWERS SECTON: 1. BRAND HEADER â€” WYSIWYG mini hero */}
                {activeDrawer === "header" && (
                  <div className="space-y-5">
                    {/* Live mini hero preview */}
                    <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
                      <div className="relative h-32 bg-slate-100">
                        {headerForm.coverImage ? (
                          <img
                            src={headerForm.coverImage}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover brightness-95"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                            Cover banner
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                        <BrandImageUploadField
                          embedded
                          variant="banner"
                          value={headerForm.coverImage}
                          onChange={(url) => setHeaderForm((prev) => ({ ...prev, coverImage: url }))}
                        />
                      </div>

                      <div className="px-4 pb-4 -mt-10 relative flex items-end gap-3">
                        <div className="relative w-20 h-20 shrink-0 rounded-2xl border-4 border-white bg-white shadow-md overflow-hidden">
                          {headerForm.logo ? (
                            <img src={headerForm.logo} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-400 font-bold uppercase bg-slate-50">
                              Logo
                            </div>
                          )}
                          <BrandImageUploadField
                            embedded
                            variant="logo"
                            value={headerForm.logo}
                            onChange={(url) => setHeaderForm((prev) => ({ ...prev, logo: url }))}
                          />
                        </div>

                        <div className="flex-1 min-w-0 space-y-1 pt-10">
                          <input
                            type="text"
                            value={headerForm.brandName}
                            onChange={(e) => setHeaderForm((prev) => ({ ...prev, brandName: e.target.value }))}
                            placeholder="Brand name"
                            className="w-full bg-transparent border-none p-0 text-base font-black text-[#111827] tracking-tight focus:outline-none focus:ring-0 placeholder:text-slate-300"
                          />
                          <input
                            type="text"
                            value={headerForm.category}
                            onChange={(e) => setHeaderForm((prev) => ({ ...prev, category: e.target.value }))}
                            placeholder="Category"
                            className="w-full bg-transparent border-none p-0 text-[11px] font-extrabold uppercase tracking-widest text-[#EF3C23] focus:outline-none focus:ring-0 placeholder:text-orange-200"
                          />
                          <input
                            type="text"
                            value={headerForm.tagline}
                            onChange={(e) => setHeaderForm((prev) => ({ ...prev, tagline: e.target.value }))}
                            placeholder="Tagline"
                            className="w-full bg-transparent border-none p-0 text-xs text-slate-600 font-medium focus:outline-none focus:ring-0 placeholder:text-slate-300"
                          />
                        </div>
                      </div>
                    </div>

                    <details className="group rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                      <summary className="text-[10px] font-bold text-slate-500 cursor-pointer list-none flex items-center justify-between">
                        <span>Paste image URLs instead</span>
                        <span className="text-slate-400 group-open:rotate-180 transition-transform">â–¾</span>
                      </summary>
                      <div className="mt-3 space-y-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Logo URL</label>
                          <input
                            type="url"
                            value={headerForm.logo}
                            onChange={(e) => setHeaderForm((prev) => ({ ...prev, logo: e.target.value }))}
                            placeholder="https://â€¦"
                            className="w-full p-2 border rounded-xl text-xs bg-white border-slate-200 text-slate-700"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Cover URL</label>
                          <input
                            type="url"
                            value={headerForm.coverImage}
                            onChange={(e) => setHeaderForm((prev) => ({ ...prev, coverImage: e.target.value }))}
                            placeholder="https://â€¦"
                            className="w-full p-2 border rounded-xl text-xs bg-white border-slate-200 text-slate-700"
                          />
                        </div>
                      </div>
                    </details>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5 space-y-3">
                      <p className="text-[9px] font-black text-app-text-secondary uppercase tracking-wide">Social & website</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                            <Facebook className="w-3 h-3" /> Facebook
                          </label>
                          <input
                            type="text"
                            value={headerForm.socialFbUrl}
                            onChange={(e) => setHeaderForm((prev) => ({ ...prev, socialFbUrl: e.target.value }))}
                            className="w-full p-2 border rounded-xl text-xs text-slate-700 bg-white border-slate-200"
                          />
                          {softUrlError(headerForm.socialFbUrl) && (
                            <p className="text-[9px] text-red-600">{softUrlError(headerForm.socialFbUrl)}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                            <Instagram className="w-3 h-3" /> Instagram
                          </label>
                          <input
                            type="text"
                            value={headerForm.socialInstaUrl}
                            onChange={(e) => setHeaderForm((prev) => ({ ...prev, socialInstaUrl: e.target.value }))}
                            className="w-full p-2 border rounded-xl text-xs text-slate-700 bg-white border-slate-200"
                          />
                          {softUrlError(headerForm.socialInstaUrl) && (
                            <p className="text-[9px] text-red-600">{softUrlError(headerForm.socialInstaUrl)}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500">TikTok</label>
                          <input
                            type="text"
                            value={headerForm.socialTiktokUrl}
                            onChange={(e) => setHeaderForm((prev) => ({ ...prev, socialTiktokUrl: e.target.value }))}
                            className="w-full p-2 border rounded-xl text-xs text-slate-700 bg-white border-slate-200"
                          />
                          {softUrlError(headerForm.socialTiktokUrl) && (
                            <p className="text-[9px] text-red-600">{softUrlError(headerForm.socialTiktokUrl)}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                            <Youtube className="w-3 h-3" /> YouTube
                          </label>
                          <input
                            type="text"
                            value={headerForm.socialYtUrl}
                            onChange={(e) => setHeaderForm((prev) => ({ ...prev, socialYtUrl: e.target.value }))}
                            className="w-full p-2 border rounded-xl text-xs text-slate-700 bg-white border-slate-200"
                          />
                          {softUrlError(headerForm.socialYtUrl) && (
                            <p className="text-[9px] text-red-600">{softUrlError(headerForm.socialYtUrl)}</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                          <Globe className="w-3 h-3" /> Website
                        </label>
                        <input
                          type="text"
                          value={headerForm.website}
                          onChange={(e) => setHeaderForm((prev) => ({ ...prev, website: e.target.value }))}
                          className="w-full p-2 border rounded-xl text-xs text-slate-700 bg-white border-slate-200"
                        />
                        {softUrlError(headerForm.website) && (
                          <p className="text-[9px] text-red-600">{softUrlError(headerForm.website)}</p>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1 relative">
                      <span className="block text-[10px] font-bold text-app-text-secondary">READ ONLY SECTOR</span>
                      <p className="text-xs text-slate-500">
                        Verification Seal:{" "}
                        <span className="font-bold text-red-600">{model.verificationStatus}</span>
                      </p>
                      <span className="absolute top-2 right-2 text-app-text-secondary">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                )}

                {/* DRAWERS SECTON: 2. CREATORS EXPERIENCES LIST EDITOR */}
                {activeDrawer === "creators" && (
                  <div className="space-y-5">
                    
                    {/* Creators list visual editor list */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-48 overflow-y-auto space-y-2">
                      <span className="block text-[9px] font-black text-app-text-secondary uppercase">Creator Library Items ({tempCreators.length})</span>
                      {tempCreators.map((cr, idx) => (
                        <div key={cr.id} className="p-2 bg-white border rounded-xl flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-xs font-black p-1 bg-[#000435] text-app-text-primary rounded text-[9px] uppercase">{cr.platform}</span>
                            <span className="text-xs font-bold text-slate-800 truncate">@{cr.creatorName}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button 
                              onClick={() => {
                                setEditingCreatorId(cr.id);
                                setCreatorForm({
                                  title: cr.title,
                                  sourceUrl: cr.sourceUrl,
                                  platform: cr.platform,
                                  thumbnailUrl: cr.thumbnailUrl,
                                  duration: cr.duration,
                                  creatorName: cr.creatorName,
                                  views: cr.views,
                                  clicks: cr.clicks
                                });
                              }}
                              className="p-1 hover:bg-slate-100 rounded text-amber-600"
                              title="Edit Item"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => deleteCreatorItem(cr.id)}
                              className="p-1 hover:bg-slate-100 rounded text-red-600"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => moveCreatorOrder(idx, "up")}
                              className="p-1 hover:bg-slate-100 rounded"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Creator detail add form */}
                    <div className="border border-indigo-100 bg-orange-50/5 p-4 rounded-2xl space-y-3">
                      <p className="text-xs font-black text-[#EF3C23] uppercase border-b border-indigo-100/40 pb-1.5">
                        {editingCreatorId ? "ðŸ“ Update Creator Review Details" : "âž• Add Brand Partner Creator content"}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500">Platform Link type</label>
                          <select
                            value={creatorForm.platform}
                            onChange={e => setCreatorForm(prev => ({ ...prev, platform: e.target.value as any }))}
                            className="w-full p-2 border rounded-lg text-xs"
                          >
                            <option value="youtube">YouTube</option>
                            <option value="instagram">Instagram</option>
                            <option value="tiktok">TikTok</option>
                            <option value="facebook">Facebook</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500">Creator Handle Name</label>
                          <input 
                            type="text"
                            placeholder="e.g. atcbd"
                            value={creatorForm.creatorName}
                            onChange={e => setCreatorForm(prev => ({ ...prev, creatorName: e.target.value }))}
                            className="w-full p-2 border rounded-lg text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500">Review/Campaign Title</label>
                        <input 
                          type="text"
                          placeholder="e.g. S26 Ultra BD Longtest Review"
                          value={creatorForm.title}
                          onChange={e => setCreatorForm(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full p-2 border rounded-lg text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500">Video Source URL Link</label>
                        <input 
                          type="text"
                          placeholder="e.g. https://youtube.com/watch?..."
                          value={creatorForm.sourceUrl}
                          onChange={e => setCreatorForm(prev => ({ ...prev, sourceUrl: e.target.value }))}
                          className="w-full p-2 border rounded-lg text-xs font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500">Custom Thumbnail Image Address</label>
                        <input 
                          type="text"
                          value={creatorForm.thumbnailUrl}
                          onChange={e => setCreatorForm(prev => ({ ...prev, thumbnailUrl: e.target.value }))}
                          className="w-full p-2 border rounded-lg text-xs font-mono"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500">Duration</label>
                          <input 
                            type="text"
                            placeholder="e.g. 14:20"
                            value={creatorForm.duration}
                            onChange={e => setCreatorForm(prev => ({ ...prev, duration: e.target.value }))}
                            className="w-full p-2 border rounded-lg text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500">Views count</label>
                          <input 
                            type="number"
                            value={creatorForm.views}
                            onChange={e => setCreatorForm(prev => ({ ...prev, views: Number(e.target.value) }))}
                            className="w-full p-2 border rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500">Likes / Clicks</label>
                          <input 
                            type="number"
                            value={creatorForm.clicks}
                            onChange={e => setCreatorForm(prev => ({ ...prev, clicks: Number(e.target.value) }))}
                            className="w-full p-2 border rounded-lg text-xs font-mono"
                          />
                        </div>
                      </div>

                      <button
                        onClick={addOrUpdateCreator}
                        className="w-full mt-2 py-2 bg-app-card text-app-text-primary rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-800"
                      >
                        {editingCreatorId ? "ðŸ’¾ Save Review Item" : "ï¼‹ Add Creator Review"}
                      </button>
                    </div>

                  </div>
                )}

                {/* DRAWERS SECTON: 3. PROMO VOUCHERS LIST EDITOR */}
                {activeDrawer === "promos" && (
                  <div className="space-y-5">
                    
                    {/* Exiting voucher coupons list */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-48 overflow-y-auto space-y-2">
                      <span className="block text-[9px] font-black text-app-text-secondary uppercase">Promo Vouchers list ({tempPromos.length})</span>
                      {tempPromos.map((p) => (
                        <div key={p.id} className="p-2.5 bg-white border rounded-xl flex flex-col gap-1 text-xs">
                          <div className="flex justify-between items-center bg-slate-50 p-1 rounded">
                            <span className="font-mono font-black text-orange-950 font-mono text-xs">{p.code}</span>
                            <div className="flex items-center gap-1.5">
                              <button 
                                onClick={() => {
                                  setEditingPromoId(p.id);
                                  setPromoForm({
                                    code: p.code,
                                    discountType: p.discountType,
                                    discountValue: p.discountValue,
                                    startDate: p.startDate,
                                    endDate: p.endDate,
                                    usageLimit: p.usageLimit,
                                    enabled: p.enabled,
                                    targetAudience: "All Customers"
                                  });
                                }}
                                className="font-bold text-amber-600 text-[10px]"
                              >
                                EDIT
                              </button>
                              <button 
                                onClick={() => duplicatePromoItem(p.id)}
                                className="font-bold text-blue-600 text-[10px]"
                              >
                                CLONE
                              </button>
                              <button 
                                onClick={() => deletePromoItem(p.id)}
                                className="font-bold text-[11px] text-red-600"
                              >
                                DELETE
                              </button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                            <span>Status: {p.enabled ? "Active âœ“" : "Inactive ðŸ”’"}</span>
                            <span>Target: All Customers</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Vouchers add Form wrapper details */}
                    <div className="border border-indigo-100 bg-orange-50/5 p-4 rounded-2xl space-y-3 text-left">
                      <p className="text-xs font-black text-[#EF3C23] uppercase border-b pb-1.5">
                        {editingPromoId ? "ðŸ“ Update Promo Voucher" : "âž• CREATE PROMO VOUCHER"}
                      </p>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500">Target Audience Options</label>
                        <select
                          value={promoForm.targetAudience}
                          onChange={e => setPromoForm(prev => ({ ...prev, targetAudience: e.target.value as any }))}
                          className="w-full p-2 border rounded-lg text-xs text-slate-800"
                        >
                          <option value="New Customers">New Customers Only</option>
                          <option value="Existing Customers">Existing Customers Only</option>
                          <option value="All Customers">All Customers General</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500">Promo Voucher Code</label>
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            placeholder="e.g. SAMSUNGFREE"
                            value={promoForm.code}
                            onChange={e => setPromoForm(prev => ({ ...prev, code: e.target.value }))}
                            className="flex-1 p-2 border rounded-lg text-xs font-mono font-bold uppercase"
                          />
                          <button
                            onClick={autoGeneratePromoCode}
                            className="px-3 py-2 bg-app-card text-app-text-primary rounded-lg text-[10px] uppercase font-black tracking-wi"
                          >
                            GENERATE
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500">Discount type</label>
                          <select
                            value={promoForm.discountType}
                            onChange={e => setPromoForm(prev => ({ ...prev, discountType: e.target.value as any }))}
                            className="w-full p-2 border rounded-lg text-xs"
                          >
                            <option value="Percentage">Percentage %</option>
                            <option value="Flat">Flat value BDT</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500">Discount amount</label>
                          <input 
                            type="number"
                            value={promoForm.discountValue}
                            onChange={e => setPromoForm(prev => ({ ...prev, discountValue: Number(e.target.value) }))}
                            className="w-full p-2 border rounded-lg text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500">Valid Until Date</label>
                          <input 
                            type="date"
                            value={promoForm.endDate}
                            onChange={e => setPromoForm(prev => ({ ...prev, endDate: e.target.value }))}
                            className="w-full p-2 border rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500">Usage limits count</label>
                          <input 
                            type="number"
                            value={promoForm.usageLimit}
                            onChange={e => setPromoForm(prev => ({ ...prev, usageLimit: Number(e.target.value) }))}
                            className="w-full p-2 border rounded-lg text-xs font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <input 
                          type="checkbox"
                          id="promo-enabled"
                          checked={promoForm.enabled}
                          onChange={e => setPromoForm(prev => ({ ...prev, enabled: e.target.checked }))}
                          className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                        />
                        <label htmlFor="promo-enabled" className="text-xs font-bold text-slate-800">Activate coupon instantly</label>
                      </div>

                      <button
                        onClick={addOrUpdatePromo}
                        className="w-full mt-2 py-2.5 bg-app-card text-app-text-primary rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-800"
                      >
                        {editingPromoId ? "ðŸ’¾ Update Coupon Voucher" : "ï¼‹ Create Coupon Voucher"}
                      </button>
                    </div>

                  </div>
                )}

                {/* DRAWERS SECTON: 4. BRAND OVERVIEWS BENTO BOX DETAILS */}
                {activeDrawer === "overview" && (
                  <div className="space-y-5">
                    
                    {/* Card 1 Links inputs */}
                    <div className="border p-4 rounded-xl space-y-3 text-left">
                      <span className="text-[10px] font-black text-orange-550 block text-orange-600">CARD 1: SHOP ADDRESS & LINKS</span>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500">Physical shop address</label>
                        <textarea 
                          rows={2}
                          value={overviewForm.address}
                          onChange={e => setOverviewForm(prev => ({ ...prev, address: e.target.value }))}
                          className="w-full p-2 border rounded-lg text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500">Google maps link location</label>
                        <input 
                          type="text"
                          value={overviewForm.mapLink}
                          onChange={e => setOverviewForm(prev => ({ ...prev, mapLink: e.target.value }))}
                          className="w-full p-2 border rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    {/* Card 2 Contacts info */}
                    <div className="border p-4 rounded-xl space-y-3 text-left">
                      <span className="text-[10px] font-black text-orange-600 block">CARD 2: CONTACT INFORMATION</span>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500">Customer Support Email</label>
                          <input 
                            type="text"
                            value={overviewForm.contactEmail}
                            onChange={e => setOverviewForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                            className="w-full p-2 border rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500">Support Desk Phone</label>
                          <input 
                            type="text"
                            value={overviewForm.phone}
                            onChange={e => setOverviewForm(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full p-2 border rounded-lg text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Card 3 Price & Target Audience */}
                    <div className="border p-4 rounded-xl space-y-3 text-left">
                      <span className="text-[10px] font-black text-orange-600 block">CARD 3: PRICE RANGE & DEMOGRAPHIC</span>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 font-mono">Price range description (e.g. 1,000 - 30,000 BDT)</label>
                        <input 
                          type="text"
                          value={overviewForm.priceRange}
                          onChange={e => setOverviewForm(prev => ({ ...prev, priceRange: e.target.value }))}
                          className="w-full p-2 border rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500">Age Range focus description</label>
                        <input 
                          type="text"
                          value={overviewForm.ageRange}
                          onChange={e => setOverviewForm(prev => ({ ...prev, ageRange: e.target.value }))}
                          className="w-full p-2 border rounded-lg text-xs"
                        />
                      </div>
                      
                      {/* Checkbox checklist genders */}
                      <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                        <label className="text-[9px] font-black text-app-text-secondary block uppercase">GENDER AUDIENCE CHECKLIST</label>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                          {["Unisex", "Male", "Female", "Youth", "Kids"].map((gender) => {
                            const selected = overviewForm.genders.includes(gender);
                            return (
                              <label key={gender} className="flex items-center gap-1.5 text-xs text-slate-800">
                                <input 
                                  type="checkbox"
                                  checked={selected}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      setOverviewForm(prev => ({ ...prev, genders: [...prev.genders, gender] }));
                                    } else {
                                      setOverviewForm(prev => ({ ...prev, genders: prev.genders.filter(g => g !== gender) }));
                                    }
                                  }}
                                  className="rounded text-orange-600 focus:ring-orange-500"
                                />
                                <span>{gender}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Card 4 Bullet Specialties */}
                    <div className="border p-4 rounded-xl space-y-3 text-left">
                      <span className="text-[10px] font-black text-orange-600 block">CARD 4: SERVICES & SPECIALTIES BULLET LIST</span>
                      <div className="space-y-2">
                        {overviewForm.services.map((srv, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <input 
                              type="text"
                              value={srv}
                              onChange={e => {
                                const nextList = [...overviewForm.services];
                                nextList[idx] = e.target.value;
                                setOverviewForm(prev => ({ ...prev, services: nextList }));
                              }}
                              className="flex-1 p-2 border rounded-lg text-xs"
                            />
                            <button
                              onClick={() => setOverviewForm(prev => ({ ...prev, services: prev.services.filter((_, i) => i !== idx) }))}
                              className="p-1 hover:bg-red-50 hover:underline text-xs text-red-600"
                            >
                              âœ•
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setOverviewForm(prev => ({ ...prev, services: [...prev.services, "New Official Warranty"] }))}
                          className="text-[10px] text-orange-600 font-bold hover:underline"
                        >
                          ï¼‹ Add custom bullet spec...
                        </button>
                      </div>
                    </div>

                    {/* Card 5 Tag Pills */}
                    <div className="border p-4 rounded-xl space-y-3 text-left">
                      <span className="text-[10px] font-black text-orange-600 block">CARD 5: BEST FOR TAG COLLECTION</span>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {overviewForm.bestForTags.map(tag => (
                          <span key={tag} className="p-1 px-2.5 bg-transparent text-[#8A00C4] rounded text-[10px] font-bold flex items-center gap-1">
                            <span>#{tag}</span>
                            <button 
                              onClick={() => setOverviewForm(prev => ({ ...prev, bestForTags: prev.bestForTags.filter(t => t !== tag) }))}
                              className="font-black hover:text-red-700 text-[#8A00C4]"
                            >
                              âœ•
                            </button>
                          </span>
                        ))}
                      </div>

                      {/* Autocomplete Quick Suggested selection pills */}
                      <p className="text-[9px] font-black text-app-text-secondary uppercase">Suggested Category tags (Click to Add)</p>
                      <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-100">
                        {["Fashion", "Premium", "Lifestyle", "HolidayWear", "WeddingCollection", "Gifts", "Electronics", "Artisanal", "Durable", "Corporate"].map(suggested => {
                          const exist = overviewForm.bestForTags.includes(suggested);
                          if (exist) return null;
                          return (
                            <button
                              key={suggested}
                              onClick={() => setOverviewForm(prev => ({ ...prev, bestForTags: [...prev.bestForTags, suggested] }))}
                              className="p-1 px-2.5 bg-slate-50 border hover:bg-slate-100 rounded-lg text-[9px] text-slate-600 font-bold"
                            >
                              ï¼‹ #{suggested}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                )}

                {/* DRAWERS SECTON: 5. WHERE TO BUY (STORES / DISTRIBUTORS / SERVICE CENTERS) */}
                {activeDrawer === "stores" && (
                  <div className="space-y-5">
                    {([
                      { key: "authorized" as const, label: "AUTHORIZED STORES" },
                      { key: "distributors" as const, label: "DISTRIBUTORS & RESELLERS" },
                      { key: "serviceCenters" as const, label: "SERVICE CENTERS" },
                    ]).map(col => (
                      <div key={col.key} className="border p-4 rounded-xl space-y-3 text-left">
                        <span className="text-[10px] font-black text-orange-600 block">{col.label}</span>
                        <div className="space-y-2">
                          {tempStores[col.key].map((entry, idx) => (
                            <div key={entry.id} className="p-2.5 bg-slate-50 border rounded-xl space-y-1.5">
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="Name"
                                  value={entry.name}
                                  onChange={e => updateStoreEntry(col.key, entry.id, { name: e.target.value })}
                                  className="flex-1 p-2 border rounded-lg text-xs"
                                />
                                <div className="flex flex-col gap-0.5">
                                  <button onClick={() => moveStoreEntry(col.key, idx, "up")} className="text-[10px] text-slate-400 hover:text-slate-700 leading-none">â–²</button>
                                  <button onClick={() => moveStoreEntry(col.key, idx, "down")} className="text-[10px] text-slate-400 hover:text-slate-700 leading-none">â–¼</button>
                                </div>
                              </div>
                              <input
                                type="text"
                                placeholder="Location / subtitle"
                                value={entry.sub}
                                onChange={e => updateStoreEntry(col.key, entry.id, { sub: e.target.value })}
                                className="w-full p-2 border rounded-lg text-xs"
                              />
                              {col.key === "serviceCenters" && (
                                <input
                                  type="text"
                                  placeholder="Hours (e.g. 10AM - 7PM)"
                                  value={(entry as BrandServiceCenterEntry).hours || ""}
                                  onChange={e => updateStoreEntry(col.key, entry.id, { hours: e.target.value })}
                                  className="w-full p-2 border rounded-lg text-xs"
                                />
                              )}
                              <button
                                onClick={() => removeStoreEntry(col.key, entry.id)}
                                className="text-[10px] font-bold text-red-600 hover:underline"
                              >
                                REMOVE
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => addStoreEntry(col.key)}
                            className="text-[10px] text-orange-600 font-bold hover:underline"
                          >
                            ï¼‹ Add entry to {col.label.toLowerCase()}...
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* DRAWERS SECTON: 6. FREQUENTLY ASKED QUESTIONS */}
                {activeDrawer === "faq" && (
                  <div className="space-y-3">
                    <span className="block text-[9px] font-black text-app-text-secondary uppercase">FAQ entries ({tempFaqs.length})</span>
                    {tempFaqs.map((fq, idx) => (
                      <div key={fq.id} className="p-3 bg-slate-50 border rounded-xl space-y-1.5">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Question"
                            value={fq.q}
                            onChange={e => updateFaqEntry(fq.id, { q: e.target.value })}
                            className="flex-1 p-2 border rounded-lg text-xs font-semibold"
                          />
                          <div className="flex flex-col gap-0.5">
                            <button onClick={() => moveFaqEntry(idx, "up")} className="text-[10px] text-slate-400 hover:text-slate-700 leading-none">â–²</button>
                            <button onClick={() => moveFaqEntry(idx, "down")} className="text-[10px] text-slate-400 hover:text-slate-700 leading-none">â–¼</button>
                          </div>
                        </div>
                        <textarea
                          rows={2}
                          placeholder="Answer"
                          value={fq.a}
                          onChange={e => updateFaqEntry(fq.id, { a: e.target.value })}
                          className="w-full p-2 border rounded-lg text-xs"
                        />
                        <button
                          onClick={() => removeFaqEntry(fq.id)}
                          className="text-[10px] font-bold text-red-600 hover:underline"
                        >
                          REMOVE
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addFaqEntry}
                      className="text-[10px] text-orange-600 font-bold hover:underline"
                    >
                      ï¼‹ Add FAQ entry...
                    </button>
                  </div>
                )}

                {activeDrawer === "story" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[9px] font-black text-app-text-secondary uppercase mb-1">Mission</label>
                      <textarea
                        rows={3}
                        value={storyForm.missionStatement}
                        onChange={(e) => setStoryForm({ ...storyForm, missionStatement: e.target.value })}
                        placeholder="What is this Brand’s mission?"
                        className="w-full p-2.5 border rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-app-text-secondary uppercase mb-1">Brand Story</label>
                      <textarea
                        rows={6}
                        value={storyForm.brandStory}
                        onChange={(e) => setStoryForm({ ...storyForm, brandStory: e.target.value })}
                        placeholder="Tell the Brand Story shown on the public storefront"
                        className="w-full p-2.5 border rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-app-text-secondary uppercase mb-1">Values</label>
                      <textarea
                        rows={3}
                        value={storyForm.values}
                        onChange={(e) => setStoryForm({ ...storyForm, values: e.target.value })}
                        placeholder="Brand values"
                        className="w-full p-2.5 border rounded-xl text-xs"
                      />
                    </div>
                  </div>
                )}

              </div>

              {/* Drawer Save Section Bottom Action */}
              <div className="border-t border-slate-100 pt-4 mt-8 flex gap-3">
                <button
                  onClick={() => setActiveDrawer(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (activeDrawer === "header") saveHeaderSection();
                    if (activeDrawer === "creators") saveCreatorsSection();
                    if (activeDrawer === "promos") savePromosSection();
                    if (activeDrawer === "overview") saveOverviewSection();
                    if (activeDrawer === "stores") saveStoresSection();
                    if (activeDrawer === "faq") saveFaqSection();
                    if (activeDrawer === "story") saveStorySection();
                  }}
                  className="flex-1 py-2.5 bg-[#EF3C23] hover:bg-[#E64A00] text-app-text-primary text-xs font-black uppercase tracking-wider rounded-xl transition shadow-lg"
                >
                  Save Section
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* --- FLOATING TOAST SUCCESS MSG --- */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-[600] bg-[#000435] text-app-text-primary border border-green-500/30 p-4.5 p-4 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping shrink-0" />
            <div className="text-left text-xs bg-transparent">
              <span className="font-extrabold text-orange-400 block uppercase text-[10px]">Information Saved</span>
              <p className="text-[11px] text-app-text-secondary font-medium mt-0.5">{toastMessage}</p>
            </div>
            <button 
              onClick={() => setToastMessage(null)}
              className="text-app-text-secondary hover:text-white font-mono ml-4 text-xs font-bold"
            >
              âœ•
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- DRAFT UNSAVED EXIT WARNING OVERLAY --- */}
      {showExitModal && (
        <div className="fixed inset-0 z-[1000] bg-app-card/20 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="bg-white border rounded-2xl p-6 max-w-sm w-full space-y-4 text-center">
            <span className="text-3xl">âš ï¸</span>
            <h3 className="text-sm font-black uppercase text-[#111827]">Unsaved Profile changes exist</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              Exiting without saving will destroy temporary changes made in this session. Protect your brand modifications.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button 
                onClick={() => {
                  setHasUnsavedChanges(false);
                  setShowExitModal(false);
                  navigate("/admin/brand-studio");
                }}
                className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs"
              >
                Discard changes & Exit
              </button>
              <button 
                onClick={() => {
                  handleSaveDraft();
                  setShowExitModal(false);
                  navigate("/admin/brand-studio");
                }}
                className="w-full py-2 bg-green-600 text-app-text-primary hover:bg-green-700 rounded-xl font-bold text-xs"
              >
                Save Draft first then Exit
              </button>
              <button 
                onClick={() => setShowExitModal(false)}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-xs text-slate-700"
              >
                Continue Designing Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- LIVE PUBLISH CONFIRM WARNING OVERLAY --- */}
      {showPublishModal && (
        <div className="fixed inset-0 z-[1000] bg-app-card/20 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="bg-white border rounded-2xl p-6 max-w-sm w-full space-y-4 text-center">
            <span className="text-3xl">ðŸš€</span>
            <h3 className="text-sm font-black uppercase">Publish Profile updates Live?</h3>
            <p className="text-xs text-[#6B7280] leading-relaxed">
              This compiles the live storefront profile for public visitor reviews. All active deals and verified vouchers go live immediately inside Bangladesh.
            </p>
            <div className="flex gap-2.5 pt-2">
              <button 
                onClick={() => setShowPublishModal(false)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-xs text-slate-700"
              >
                Keep Reviewing
              </button>
              <button 
                onClick={handlePublishChanges}
                className="flex-1 py-2 bg-[#EF3C23] hover:bg-[#E64A00] text-[#FFFFFF] rounded-xl font-black text-xs"
              >
                Publish Live Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- LIVE BROADCAST SPINNER BACKGROUND --- */}
      {isPublishing && (
        <div className="fixed inset-0 bg-app-card/20 backdrop-blur-sm z-[1500] flex flex-col items-center justify-center gap-3 text-app-text-primary">
          <RotateCw className="w-12 h-12 animate-spin text-[#EF3C23]" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider">Compiling live production content logs...</span>
        </div>
      )}

    </div>
  );
}
