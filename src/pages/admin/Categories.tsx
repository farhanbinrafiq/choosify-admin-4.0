import React, { useState, useEffect, useRef, CSSProperties } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CategoryType } from '../../types';
import { catalogApi } from '../../services/catalogApi';
import type { CatalogCategoryAttribute } from '../../types/catalog';
import {
  Folder, Search, Upload, Download, Settings, Undo2, Redo2, ImageOff, Plus,
  Smartphone, Shirt, Home, Briefcase, Grid, Database, Gem, Gamepad2,
  Monitor, Utensils, Tv, Baby, AlertTriangle, Save,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Modal } from '../../components/ui/Modal';

const AVAILABLE_ICONS = [
  { name: 'Shirt', label: 'Fashion & Shirts', icon: Shirt },
  { name: 'Gem', label: 'Jewelry & Accessories', icon: Gem },
  { name: 'Smartphone', label: 'Phones & Gadgets', icon: Smartphone },
  { name: 'Gamepad2', label: 'Sports & PlayStation', icon: Gamepad2 },
  { name: 'Monitor', label: 'Gaming & Entertainment', icon: Monitor },
  { name: 'Utensils', label: 'Food & Restaurants', icon: Utensils },
  { name: 'Cpu', label: 'Tech & Electronics', icon: Grid },
  { name: 'Tv', label: 'TV & Appliances', icon: Tv },
  { name: 'Home', label: 'Home & Living', icon: Home },
  { name: 'Baby', label: 'Baby & Maternity', icon: Baby },
  { name: 'Layers', label: 'Layers & Fabric', icon: Grid },
  { name: 'Briefcase', label: 'Office & Work', icon: Briefcase },
  { name: 'Grid', label: 'Grid / General', icon: Grid },
  { name: 'Database', label: 'Data & Utilities', icon: Database },
  { name: 'Folder', label: 'Standard Folder', icon: Folder },
];
const getIconComponent = (name: string) => AVAILABLE_ICONS.find(i => i.name === name)?.icon || Folder;

/**
 * Category Management Studio.
 *
 * Sprint 13 UI regression lock — Step 1 (restoration method for all dashboard
 * pages). PRESENTATION is a faithful reproduction of the approved standalone
 * `isCategories` section (design-reference/Choosify Admin CMS (standalone).html):
 * exact hex, px, grid and DOM structure, expressed as inline styles rather than
 * translated into shared-component defaults. The single sanctioned deviation is
 * the accent, which uses the canonical `--cms-accent` token for dashboard-wide
 * consistency (per product-owner decision), not the raw reference `#FF5B00`.
 *
 * FUNCTIONALITY is the current canonical layer, copied verbatim from f97c826:
 * useAuth() category CRUD/reorder/import, catalogApi.*CategoryAttribute,
 * Undo/Redo history, circular/self-parent + duplicate guards, slug generation,
 * JSON import/export, children-guarded delete. Nothing here changed.
 *
 * Reference-only fields with no CategoryType column (Category Photo, Featured
 * Brand) keep the reference shape but are genuinely disabled — no handler, no
 * persistence. Functionality absent from the prototype (Attribute & Variant
 * Schema, Undo/Redo, per-category reorder, Add Sibling) is integrated into the
 * same visual system without redesigning the reference around it.
 */
export default function CategoriesPage() {
  const {
    categories,
    categoriesLoading,
    createCategory,
    updateCategory,
    deleteCategory,
    moveCategory,
    reorderCategory,
    importCategories,
  } = useAuth();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<'tree' | 'editor'>('tree');
  const [searchQuery, setSearchQuery] = useState('');

  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formIcon, setFormIcon] = useState('Folder');
  const [formDescription, setFormDescription] = useState('');
  const [formParentId, setFormParentId] = useState<string | null>(null);
  const [formEnabled, setFormEnabled] = useState(true);

  const [editorMode, setEditorMode] = useState<'edit' | 'create_child' | 'create_root'>('edit');
  const [targetParentId, setTargetParentId] = useState<string | null>(null);

  const [history, setHistory] = useState<CategoryType[][]>([]);
  const [historyPointer, setHistoryPointer] = useState(-1);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [schemaAttrs, setSchemaAttrs] = useState<CatalogCategoryAttribute[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [attrName, setAttrName] = useState('');
  const [attrType, setAttrType] = useState<'text' | 'number' | 'boolean' | 'select' | 'multi_select'>('text');
  const [attrRequired, setAttrRequired] = useState(false);
  const [attrVariant, setAttrVariant] = useState(false);
  const [attrOptions, setAttrOptions] = useState('');

  const skipHistoryTrackRef = useRef(false);

  // ── functional code — verbatim from f97c826 ──────────────────────────────
  useEffect(() => {
    if (!categories) return;
    if (history.length === 0) { setHistory([categories]); setHistoryPointer(0); return; }
    if (skipHistoryTrackRef.current) { skipHistoryTrackRef.current = false; return; }
    const current = history[historyPointer];
    if (current && JSON.stringify(current) === JSON.stringify(categories)) return;
    setHistory(prev => { const t = prev.slice(0, historyPointer + 1); t.push(categories); return t; });
    setHistoryPointer(prev => prev + 1);
  }, [categories]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedId || editorMode !== 'edit') { setSchemaAttrs([]); return; }
    setSchemaLoading(true);
    catalogApi.listCategoryAttributes(selectedId)
      .then((rows) => { if (!cancelled) setSchemaAttrs(rows); })
      .catch(() => { if (!cancelled) setSchemaAttrs([]); })
      .finally(() => { if (!cancelled) setSchemaLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId, editorMode]);

  const refreshSchema = async () => {
    if (!selectedId) return;
    try { setSchemaAttrs(await catalogApi.listCategoryAttributes(selectedId)); } catch { /* keep prior */ }
  };

  const handleAddAttribute = async () => {
    if (!selectedId || !attrName.trim()) { showToast('Attribute name is required', 'error'); return; }
    try {
      await catalogApi.createCategoryAttribute(selectedId, {
        name: attrName.trim(),
        type: attrType,
        required: attrRequired,
        variantEligible: attrVariant,
        options: attrType === 'select' || attrType === 'multi_select'
          ? attrOptions.split(',').map((o) => o.trim()).filter(Boolean) : [],
      });
      setAttrName(''); setAttrOptions(''); setAttrRequired(false); setAttrVariant(false); setAttrType('text');
      await refreshSchema();
      showToast('Attribute saved', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save attribute', 'error');
    }
  };

  const handleToggleAttrFlag = async (attr: CatalogCategoryAttribute, patch: Partial<CatalogCategoryAttribute>) => {
    if (!selectedId) return;
    try {
      await catalogApi.updateCategoryAttribute(selectedId, attr.id, patch);
      await refreshSchema();
      showToast('Attribute updated', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update attribute', 'error');
    }
  };

  const handleRemoveAttribute = async (attr: CatalogCategoryAttribute) => {
    if (!selectedId) return;
    try {
      await catalogApi.deleteCategoryAttribute(selectedId, attr.id);
      await refreshSchema();
      showToast('Attribute removed', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to remove attribute', 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3500);
  };

  const handleUndo = async () => {
    if (historyPointer <= 0) return;
    const p = historyPointer - 1;
    skipHistoryTrackRef.current = true;
    try { await importCategories(history[p]); setHistoryPointer(p); showToast('Undid last category change', 'info'); }
    catch (error) { skipHistoryTrackRef.current = false; showToast(error instanceof Error ? error.message : 'Failed to undo category change.', 'error'); }
  };

  const handleRedo = async () => {
    if (historyPointer >= history.length - 1) return;
    const p = historyPointer + 1;
    skipHistoryTrackRef.current = true;
    try { await importCategories(history[p]); setHistoryPointer(p); showToast('Redid category change', 'info'); }
    catch (error) { skipHistoryTrackRef.current = false; showToast(error instanceof Error ? error.message : 'Failed to redo category change.', 'error'); }
  };

  useEffect(() => {
    if (editorMode === 'edit' && selectedId) {
      const cat = categories.find(c => c.id === selectedId);
      if (cat) {
        setFormName(cat.name); setFormSlug(cat.slug); setFormIcon(cat.icon);
        setFormDescription(cat.description); setFormParentId(cat.parentId); setFormEnabled(cat.enabled);
      }
    } else if (editorMode === 'create_child') {
      const parentName = targetParentId ? categories.find(c => c.id === targetParentId)?.name : 'Root';
      setFormName(''); setFormSlug(''); setFormIcon('Folder');
      setFormDescription(`Subcategory under ${parentName}`); setFormParentId(targetParentId); setFormEnabled(true);
    } else if (editorMode === 'create_root') {
      setFormName(''); setFormSlug(''); setFormIcon('Folder');
      setFormDescription(''); setFormParentId(null); setFormEnabled(true);
    }
  }, [selectedId, editorMode, targetParentId, categories]);

  const handleNameChange = (val: string) => {
    setFormName(val);
    setFormSlug(val.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, ''));
  };

  const [savingCategory, setSavingCategory] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) { showToast('Category name cannot be empty', 'error'); return; }

    if (editorMode === 'edit' && selectedId) {
      const duplicate = categories.some(
        c => c.parentId === formParentId && c.name.toLowerCase() === formName.trim().toLowerCase() && c.id !== selectedId,
      );
      if (duplicate) { showToast(`A category named "${formName}" already exists under this parent.`, 'error'); return; }
      if (formParentId === selectedId) { showToast('A category cannot be its own parent', 'error'); return; }
      let tempParent = formParentId;
      while (tempParent !== null) {
        if (tempParent === selectedId) { showToast('Circular reference detected. Cannot set child as parent.', 'error'); return; }
        tempParent = categories.find(c => c.id === tempParent)?.parentId || null;
      }
      setSavingCategory(true);
      try {
        await updateCategory(selectedId, {
          name: formName.trim(), slug: formSlug.trim(), icon: formIcon,
          description: formDescription, parentId: formParentId, enabled: formEnabled,
        });
        showToast('Category updated successfully', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to update category.', 'error');
      } finally { setSavingCategory(false); }
    } else {
      const duplicate = categories.some(
        c => c.parentId === formParentId && c.name.toLowerCase() === formName.trim().toLowerCase(),
      );
      if (duplicate) { showToast(`A category named "${formName}" already exists under this level.`, 'error'); return; }
      setSavingCategory(true);
      try {
        const newCat = await createCategory(formParentId, formName.trim(), formIcon, formDescription);
        setSelectedId(newCat.id); setEditorMode('edit');
        showToast('Category created successfully', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to create category.', 'error');
      } finally { setSavingCategory(false); }
    }
  };

  const handleDeleteTrigger = (id: string) => {
    if (categories.some(c => c.parentId === id)) {
      showToast('Cannot delete category with subcategories. Move children first!', 'error');
      return;
    }
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    const targetId = deleteConfirmId;
    setDeleteConfirmId(null);
    try {
      const success = await deleteCategory(targetId);
      if (success) {
        showToast('Category deleted successfully', 'success');
        if (selectedId === targetId) { setSelectedId(null); setEditorMode('create_root'); }
      } else {
        showToast('Cannot delete category with subcategories. Move children first!', 'error');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete category.', 'error');
    }
  };

  const handleMoveNode = async (id: string, direction: 'up' | 'down') => {
    const item = categories.find(c => c.id === id);
    if (!item) return;
    const siblings = categories.filter(c => c.parentId === item.parentId).sort((a, b) => a.displayOrder - b.displayOrder);
    const index = siblings.findIndex(s => s.id === id);
    if (direction === 'up' && index > 0) {
      try { await reorderCategory(id, index - 1); showToast('Moved category order up', 'success'); }
      catch (error) { showToast(error instanceof Error ? error.message : 'Failed to reorder category.', 'error'); }
    } else if (direction === 'down' && index < siblings.length - 1) {
      try { await reorderCategory(id, index + 1); showToast('Moved category order down', 'success'); }
      catch (error) { showToast(error instanceof Error ? error.message : 'Failed to reorder category.', 'error'); }
    }
  };

  const [togglingAll, setTogglingAll] = useState(false);
  const handleToggleAll = async () => {
    const allEnabled = categories.every(c => c.enabled);
    setTogglingAll(true);
    try {
      await importCategories(categories.map(c => ({ ...c, enabled: !allEnabled })));
      showToast(`All categories ${!allEnabled ? 'Enabled' : 'Disabled'}`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to toggle categories.', 'error');
    } finally { setTogglingAll(false); }
  };

  const handleExportJSON = () => {
    setExporting(true);
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(categories, null, 2));
      const a = document.createElement('a');
      a.setAttribute('href', dataStr);
      a.setAttribute('download', 'choosify_bd_category_taxonomy.json');
      document.body.appendChild(a); a.click(); a.remove();
      showToast('Taxonomy JSON exported successfully', 'success');
    } catch (e) { showToast('Failed to export taxonomy', 'error'); }
    finally { setExporting(false); }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0 && 'parentId' in parsed[0] && 'name' in parsed[0]) {
          await importCategories(parsed);
          showToast(`Successfully imported ${parsed.length} categories!`, 'success');
        } else {
          showToast('Invalid file format. Ensure it contains a Category array.', 'error');
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to parse category file. Ensure JSON is correct.', 'error');
      } finally { setImporting(false); }
    };
    reader.readAsText(file);
  };

  const filteredCategories = categories.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
  });

  const getBreadcrumb = (catId: string | null): string => {
    if (!catId) return 'Taxonomy Root';
    const path: string[] = [];
    let currentId: string | null = catId;
    while (currentId !== null) {
      const match = categories.find(c => c.id === currentId);
      if (match) { path.unshift(match.name); currentId = match.parentId; } else break;
    }
    return path.join(' › ');
  };

  const childrenOf = (id: string | null) => categories.filter(c => c.parentId === id);

  // Flat DFS order over the filtered set — approved reference renders the
  // hierarchy as a flat card list (no chevrons / indent).
  const flatHierarchy: CategoryType[] = React.useMemo(() => {
    const out: CategoryType[] = [];
    const visit = (parentId: string | null) => {
      filteredCategories
        .filter(c => c.parentId === parentId)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .forEach(c => { out.push(c); visit(c.id); });
    };
    visit(null);
    // include filtered nodes whose parent is filtered out (search) at the end
    const seen = new Set(out.map(c => c.id));
    filteredCategories.forEach(c => { if (!seen.has(c.id)) out.push(c); });
    return out;
  }, [filteredCategories]);

  // ── presentation — exact reference values ───────────────────────────────
  const ACCENT = 'var(--cms-accent)';
  const ACCENT_WASH = 'color-mix(in srgb, var(--cms-accent) 10%, transparent)';
  const S: Record<string, CSSProperties> = {
    headerBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
    h1wrap: { display: 'flex', alignItems: 'center', gap: 8 },
    h1: { fontSize: '15.5px', fontWeight: 800, letterSpacing: '0.02em', color: '#111827' },
    sub: { fontSize: 12, color: '#6B7280', fontWeight: 600, marginTop: 4 },
    btnRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
    btn: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 8, padding: '9px 16px', fontSize: '11.5px', fontWeight: 800, color: '#111827', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
    btnAccent: { background: ACCENT_WASH, border: `1px solid ${ACCENT}`, borderRadius: 8, padding: '9px 16px', fontSize: '11.5px', fontWeight: 800, color: ACCENT, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
    card: { background: '#fff', border: '1px solid #E8EDF2', borderRadius: 10 },
    hierHeadRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    hierLabel: { fontSize: 11, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.05em' },
    addLink: { fontSize: '11.5px', fontWeight: 800, color: ACCENT, cursor: 'pointer', background: 'none', border: 0, padding: 0 },
    search: { width: '100%', boxSizing: 'border-box', height: 36, borderRadius: 8, border: '1px solid #E8EDF2', padding: '0 12px 0 34px', fontSize: 12, marginBottom: 12, outline: 'none' },
    list: { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 640, overflowY: 'auto' },
    row: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 8, cursor: 'pointer' },
    dot: { width: 6, height: 6, borderRadius: '50%', background: '#9CA3AF', flexShrink: 0 },
    rowName: { fontSize: '12.5px', fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    countPill: { width: 22, height: 22, borderRadius: '50%', background: '#F1F3F5', color: '#6B7280', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    edHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 },
    edCrumbLabel: { fontSize: 10, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.05em' },
    edCrumb: { fontSize: 13, fontWeight: 800, color: ACCENT, marginTop: 2 },
    edActive: { fontSize: '9.5px', fontWeight: 800, color: '#16A34A', letterSpacing: '0.04em', whiteSpace: 'nowrap' },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 },
    grid3: { display: 'grid', gridTemplateColumns: '90px 1fr 1fr', gap: 14, marginBottom: 14 },
    fLabel: { fontSize: 10, fontWeight: 800, color: '#9CA3AF', letterSpacing: '0.04em', marginBottom: 6, display: 'block' },
    input: { width: '100%', boxSizing: 'border-box', height: 40, borderRadius: 8, border: '1px solid #E8EDF2', padding: '0 12px', fontSize: '12.5px', outline: 'none', background: '#fff' },
    textarea: { width: '100%', boxSizing: 'border-box', height: 70, borderRadius: 8, border: '1px solid #E8EDF2', padding: '10px 12px', fontSize: 12, resize: 'vertical', fontFamily: 'inherit', outline: 'none' },
    section: { borderTop: '1px solid #F1F3F5', paddingTop: 14, marginBottom: 14 },
    sectionLast: { borderTop: '1px solid #F1F3F5', paddingTop: 14, marginBottom: 20 },
    subRow: { display: 'flex', alignItems: 'center', gap: 10, background: '#F9FAFB', borderRadius: 8, padding: '8px 10px' },
    subInput: { flex: 1, minWidth: 0, height: 32, borderRadius: 6, border: '1px solid #E8EDF2', padding: '0 10px', fontSize: '11.5px', background: '#fff', outline: 'none' },
    subX: { color: '#DC2626', fontSize: 12, fontWeight: 800, cursor: 'pointer', flexShrink: 0, background: 'none', border: 0, padding: 0 },
    emptyBox: { textAlign: 'center', color: '#9CA3AF', fontSize: '11.5px', fontWeight: 600, fontStyle: 'italic', padding: '14px 0', border: '1px dashed #E8EDF2', borderRadius: 8 },
    footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F3F5', paddingTop: 16, gap: 12, flexWrap: 'wrap' },
    saveBtn: { background: ACCENT, color: '#fff', border: 'none', borderRadius: 8, padding: '11px 20px', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
    ghost: { fontSize: 11, fontWeight: 700, color: '#6B7280', background: 'none', border: 0, cursor: 'pointer', padding: 0 },
    ghostDanger: { fontSize: 11, fontWeight: 700, color: '#DC2626', background: 'none', border: 0, cursor: 'pointer', padding: 0 },
    chip: { fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.03em' },
  };

  const selectedChildren = selectedId ? childrenOf(selectedId) : [];
  const canUndo = historyPointer > 0;
  const canRedo = historyPointer < history.length - 1;
  const IconPreview = getIconComponent(formIcon);

  return (
    <div style={{ color: '#111827' }}>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100,
              background: toast.type === 'error' ? '#DC2626' : '#111827', color: '#fff',
              borderRadius: 12, padding: '11px 18px', fontSize: 12.5, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
            }}
          >
            {toast.type === 'error' ? <AlertTriangle size={15} /> : <Save size={15} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <Modal isOpen={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Confirm taxonomy removal" maxWidth="max-w-md">
        <div className="space-y-4">
          <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
            Delete <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#111827' }}>
              &quot;{categories.find(c => c.id === deleteConfirmId)?.name}&quot;
            </span>? This removes it from the catalog routing tree and cannot be undone.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={() => setDeleteConfirmId(null)} style={{ ...S.btn, borderColor: '#E8EDF2' }}>Cancel</button>
            <button onClick={handleConfirmDelete} style={{ ...S.saveBtn, background: '#DC2626' }}>Delete category</button>
          </div>
        </div>
      </Modal>

      {/* ── Studio header (reference) ── */}
      <div style={S.headerBar}>
        <div>
          <div style={S.h1wrap}>
            <span style={{ fontSize: 16 }} aria-hidden>🗂</span>
            <span style={S.h1}>CATEGORY MANAGEMENT STUDIO</span>
          </div>
          <div style={S.sub}>Manage hierarchical taxonomy and product classification configurations for Choosify.bd</div>
        </div>
        <div style={S.btnRow}>
          <button onClick={handleUndo} disabled={!canUndo} title="Undo" style={{ ...S.btn, padding: '9px 12px', opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'not-allowed' }}>
            <Undo2 size={14} />
          </button>
          <button onClick={handleRedo} disabled={!canRedo} title="Redo" style={{ ...S.btn, padding: '9px 12px', opacity: canRedo ? 1 : 0.4, cursor: canRedo ? 'pointer' : 'not-allowed' }}>
            <Redo2 size={14} />
          </button>
          <button onClick={handleToggleAll} disabled={togglingAll} style={{ ...S.btn, opacity: togglingAll ? 0.6 : 1 }}>
            <Settings size={13} /> {togglingAll ? 'Updating…' : 'Toggle Status'}
          </button>
          <button onClick={handleExportJSON} disabled={exporting} style={S.btn}>
            <Download size={13} /> {exporting ? 'Exporting…' : 'Export JSON'}
          </button>
          <label style={S.btnAccent}>
            <Upload size={13} /> {importing ? 'Importing…' : 'Import Taxonomy'}
            <input type="file" accept=".json" onChange={handleImportJSON} style={{ display: 'none' }} disabled={importing} />
          </label>
        </div>
      </div>

      {/* mobile tree/editor switch */}
      <div className="flex md:hidden" style={{ background: '#fff', border: '1px solid #E8EDF2', borderRadius: 10, padding: 4, marginBottom: 16 }}>
        {(['tree', 'editor'] as const).map(t => (
          <button key={t} onClick={() => setActiveMobileTab(t)} style={{
            flex: 1, padding: '8px 0', fontSize: 11.5, fontWeight: 800, borderRadius: 8, border: 0, cursor: 'pointer',
            background: activeMobileTab === t ? ACCENT : 'transparent', color: activeMobileTab === t ? '#fff' : '#6B7280',
          }}>
            {t === 'tree' ? 'Category Tree' : 'Category Editor'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]" style={{ gap: 16, alignItems: 'start' }}>
        {/* ── Left: hierarchy ── */}
        <div className={activeMobileTab === 'tree' ? 'block' : 'hidden md:block'} style={{ ...S.card, padding: 16 }}>
          <div style={S.hierHeadRow}>
            <div style={S.hierLabel}>CATEGORY HIERARCHY</div>
            <button onClick={() => { setEditorMode('create_root'); setActiveMobileTab('editor'); }} style={S.addLink}>+ Add Root</button>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={14} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: 11 }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search taxonomy rule..."
              style={S.search}
            />
          </div>

          <div style={S.list}>
            {categoriesLoading && categories.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 11, color: '#9CA3AF' }}>Loading category taxonomy…</div>
            ) : flatHierarchy.length > 0 ? (
              flatHierarchy.map(cat => {
                const isSel = selectedId === cat.id && editorMode === 'edit';
                const RowIcon = getIconComponent(cat.icon);
                const kids = childrenOf(cat.id).length;
                return (
                  <div
                    key={cat.id}
                    onClick={() => { setSelectedId(cat.id); setEditorMode('edit'); setActiveMobileTab('editor'); }}
                    className="group"
                    style={{ ...S.row, ...(isSel ? { background: ACCENT_WASH, color: ACCENT } : {}) }}
                  >
                    <span style={S.dot} />
                    <RowIcon size={14} style={{ flexShrink: 0, opacity: cat.enabled ? 1 : 0.4 }} />
                    <span style={{ ...S.rowName, textDecoration: cat.enabled ? 'none' : 'line-through', color: cat.enabled ? undefined : '#9CA3AF' }}>
                      {cat.name}
                    </span>
                    {/* retained reorder — no reference slot; hover-revealed, does not alter row height */}
                    <span className="opacity-0 group-hover:opacity-100" style={{ display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'opacity .12s' }}>
                      <button onClick={(e) => { e.stopPropagation(); handleMoveNode(cat.id, 'up'); }} title="Move up" style={{ ...S.ghost, padding: '0 3px', fontSize: 12 }}>↑</button>
                      <button onClick={(e) => { e.stopPropagation(); handleMoveNode(cat.id, 'down'); }} title="Move down" style={{ ...S.ghost, padding: '0 3px', fontSize: 12 }}>↓</button>
                    </span>
                    {/* reference count circle — real direct-subcategory count, not the mock product count */}
                    {kids > 0 && <span style={S.countPill}>{kids}</span>}
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <p style={{ fontSize: 11, color: '#9CA3AF' }}>No matching taxonomy rules found.</p>
                {searchQuery && <button onClick={() => setSearchQuery('')} style={{ ...S.addLink, marginTop: 8, fontSize: 10 }}>Clear filter</button>}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: editor ── */}
        <div className={activeMobileTab === 'editor' ? 'block' : 'hidden md:block'} style={{ ...S.card, padding: 20 }}>
          <div style={S.edHead}>
            <div style={{ minWidth: 0 }}>
              <div style={S.edCrumbLabel}>BREADCRUMB PATH</div>
              <div style={S.edCrumb}>
                {editorMode === 'edit'
                  ? getBreadcrumb(selectedId)
                  : editorMode === 'create_child'
                    ? `${getBreadcrumb(targetParentId)} › [New Sub]`
                    : '[New Root Category]'}
              </div>
            </div>
            <span style={S.edActive}>
              {editorMode === 'edit' ? 'EDITOR ACTIVE' : editorMode === 'create_child' ? 'SUBCATEGORY CREATION' : 'ROOT CREATION'}
            </span>
          </div>

          <form onSubmit={handleSave}>
            <div style={S.grid2}>
              <div style={{ minWidth: 0 }}>
                <label style={S.fLabel}>CATEGORY NAME <span style={{ color: '#DC2626' }}>*</span></label>
                <input value={formName} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Jamdani & Silk Sarees" style={S.input} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={S.fLabel}>ROUTING SLUG</span>
                  <span style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 600 }}>auto-generated</span>
                </div>
                <input value={formSlug} onChange={(e) => setFormSlug(e.target.value)} placeholder="e.g. jamdani-silk-sarees" style={{ ...S.input, color: '#6B7280' }} />
              </div>
            </div>

            <div style={S.grid3}>
              <div style={{ minWidth: 0 }}>
                <label style={S.fLabel}>ICON</label>
                {/* reference is a raw emoji input; production icon = named lucide
                    component, so a working select is retained, with a live preview
                    glyph in the 40px box to keep the reference's visual intent */}
                <div style={{ position: 'relative', height: 40 }}>
                  <IconPreview size={16} style={{ position: 'absolute', left: 11, top: 12, pointerEvents: 'none' }} />
                  <select value={formIcon} onChange={(e) => setFormIcon(e.target.value)} style={{ ...S.input, paddingLeft: 32, fontSize: 12 }}>
                    {AVAILABLE_ICONS.map(i => <option key={i.name} value={i.name}>{i.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={S.fLabel}>PARENT NODE</label>
                <select value={formParentId || ''} onChange={(e) => setFormParentId(e.target.value || null)} style={{ ...S.input, fontSize: 12 }}>
                  <option value="">[No Parent - Root Category]</option>
                  {categories.filter(c => c.id !== selectedId).map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.slug})</option>
                  ))}
                </select>
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={S.fLabel}>ENABLED STATUS</label>
                <div onClick={() => setFormEnabled(!formEnabled)} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, cursor: 'pointer', userSelect: 'none' }}>
                  <span style={{ fontSize: 20, lineHeight: 1, color: formEnabled ? '#16A34A' : '#9CA3AF' }}>◉</span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{formEnabled ? 'Visible in Stores' : 'Taxonomy Hidden'}</span>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={S.fLabel}>CATEGORY TAXONOMY DESCRIPTION</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe product classification, search indexing words, tags, and tax rules of this category."
                style={S.textarea}
              />
            </div>

            {/* CATEGORY PHOTO — reference shape, genuinely disabled (no CategoryType field) */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ ...S.fLabel, marginBottom: 8 }}>CATEGORY PHOTO</label>
              <div
                aria-disabled="true"
                style={{
                  width: 220, height: 120, borderRadius: 8, border: '1px dashed #D1D5DB', background: '#F9FAFB',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: 0.75,
                }}
              >
                <ImageOff size={18} color="#9CA3AF" />
                <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textAlign: 'center', maxWidth: 180 }}>
                  Category photo — not available in this release
                </span>
              </div>
            </div>

            {/* SUBCATEGORIES — reference layout; real child categories */}
            {editorMode === 'edit' && selectedId && (
              <div style={S.section}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={S.fLabel}>SUBCATEGORIES</div>
                  <button type="button" onClick={() => { setTargetParentId(selectedId); setEditorMode('create_child'); }} style={S.addLink}>+ Add Subcategory</button>
                </div>
                {selectedChildren.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedChildren.map(sub => (
                      <div key={sub.id} style={S.subRow}>
                        <input
                          defaultValue={sub.name}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== sub.name) {
                              updateCategory(sub.id, { name: v }).catch((err) =>
                                showToast(err instanceof Error ? err.message : 'Failed to rename subcategory.', 'error'));
                            }
                          }}
                          style={S.subInput}
                        />
                        <button type="button" onClick={() => setSelectedId(sub.id)} style={{ ...S.ghost, flexShrink: 0, fontSize: 10 }}>open</button>
                        <button type="button" onClick={() => handleDeleteTrigger(sub.id)} title="Delete subcategory" style={S.subX}>✕</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={S.emptyBox}>No subcategories yet — add as many as needed.</div>
                )}
              </div>
            )}

            {/* ATTRIBUTE & VARIANT SCHEMA — canonical catalogApi; no reference slot, integrated in the same system */}
            {editorMode === 'edit' && selectedId && (
              <div style={S.section}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={S.fLabel}>ATTRIBUTE &amp; VARIANT SCHEMA</div>
                  {schemaLoading && <span style={{ fontSize: 9, color: '#9CA3AF', fontFamily: 'monospace' }}>Loading…</span>}
                </div>
                {schemaAttrs.length === 0 && !schemaLoading ? (
                  <p style={{ fontSize: 11, color: '#9CA3AF' }}>No attributes defined for this category yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 176, overflowY: 'auto' }}>
                    {schemaAttrs.map((attr) => (
                      <div key={attr.id} style={{ ...S.subRow, flexWrap: 'wrap', justifyContent: 'space-between', fontSize: 11 }}>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ color: '#111827', fontWeight: 700 }}>{attr.name}</span>
                          <span style={{ color: '#9CA3AF', fontFamily: 'monospace', marginLeft: 8 }}>{attr.key}</span>
                          <span style={{ color: '#9CA3AF', marginLeft: 8 }}>{attr.type}</span>
                          {attr.required && <span style={{ ...S.chip, color: '#DC2626', marginLeft: 8 }}>Required</span>}
                          {attr.variantEligible && <span style={{ ...S.chip, color: ACCENT, marginLeft: 8 }}>Variant</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <button type="button" onClick={() => handleToggleAttrFlag(attr, { required: !attr.required })} style={{ ...S.ghost, fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>Required</button>
                          <button type="button" onClick={() => handleToggleAttrFlag(attr, { variantEligible: !attr.variantEligible })} style={{ ...S.ghost, fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>Variant</button>
                          <button type="button" onClick={() => handleRemoveAttribute(attr)} style={{ ...S.ghostDanger, fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                  <input value={attrName} onChange={(e) => setAttrName(e.target.value)} placeholder="Attribute name" style={{ ...S.input, height: 36, fontSize: 12 }} />
                  <select value={attrType} onChange={(e) => setAttrType(e.target.value as typeof attrType)} style={{ ...S.input, height: 36, fontSize: 12 }}>
                    <option value="text">text</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="select">select</option>
                    <option value="multi_select">multi_select</option>
                  </select>
                  {(attrType === 'select' || attrType === 'multi_select') && (
                    <input value={attrOptions} onChange={(e) => setAttrOptions(e.target.value)} placeholder="Options (comma-separated)" style={{ ...S.input, height: 36, fontSize: 12, gridColumn: '1 / -1' }} />
                  )}
                  <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase' }}>
                      <input type="checkbox" checked={attrRequired} onChange={(e) => setAttrRequired(e.target.checked)} style={{ accentColor: '#ef3c23' }} /> Required
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase' }}>
                      <input type="checkbox" checked={attrVariant} onChange={(e) => setAttrVariant(e.target.checked)} style={{ accentColor: '#ef3c23' }} /> Variant
                    </label>
                    <button type="button" onClick={handleAddAttribute} style={{ ...S.saveBtn, marginLeft: 'auto', padding: '8px 14px', fontSize: 11 }}>
                      <Plus size={13} /> Add Attribute
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* FEATURED BRAND — reference shape, genuinely disabled (no CategoryType field) */}
            <div style={S.sectionLast}>
              <label style={{ ...S.fLabel, marginBottom: 8 }}>FEATURED BRAND (SHOWN ON STOREFRONT CARD)</label>
              <select disabled value="" style={{ ...S.input, width: 280, maxWidth: '100%', fontSize: '12.5px', background: '#F9FAFB', color: '#9CA3AF', cursor: 'not-allowed' }}>
                <option value="">Not available in this release</option>
              </select>
            </div>

            {/* FOOTER — reference: SAVE right-aligned; retained Add Sibling / Delete as ghost links on the left */}
            <div style={S.footer}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {editorMode === 'edit' && selectedId && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const cat = categories.find(c => c.id === selectedId);
                        setTargetParentId(cat ? cat.parentId : null);
                        setEditorMode('create_child');
                      }}
                      style={S.ghost}
                    >
                      + Add Sibling
                    </button>
                    <button type="button" onClick={() => handleDeleteTrigger(selectedId)} style={S.ghostDanger}>Delete Category</button>
                  </>
                )}
                {editorMode !== 'edit' && (
                  <button
                    type="button"
                    onClick={() => { setEditorMode('edit'); if (!selectedId && categories.length > 0) setSelectedId(categories[0].id); }}
                    style={S.ghost}
                  >
                    Cancel
                  </button>
                )}
              </div>
              <button type="submit" disabled={savingCategory} style={{ ...S.saveBtn, opacity: savingCategory ? 0.6 : 1 }}>
                <Save size={14} /> {savingCategory ? 'SAVING…' : editorMode === 'edit' ? 'SAVE CHANGES' : 'CREATE CATEGORY'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
