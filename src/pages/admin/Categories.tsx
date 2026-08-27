import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CategoryType } from '../../types';
import { catalogApi } from '../../services/catalogApi';
import type { CatalogCategoryAttribute } from '../../types/catalog';
import {
  Folder, ChevronRight, ChevronDown, Plus, Trash2,
  Save, X, Search, ArrowUp, ArrowDown, Upload, Download,
  Settings, AlertTriangle, Smartphone,
  Shirt, Home, Briefcase, Grid, Database,
  Undo2, Redo2, Gem, Gamepad2,
  Monitor, Utensils, Tv, Baby,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Modal } from '../../components/ui/Modal';

// Supported Lucide Icons for Categorization
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

const getIconComponent = (name: string) => {
  const match = AVAILABLE_ICONS.find(i => i.name === name);
  return match ? match.icon : Folder;
};

/**
 * Category Management Studio.
 *
 * Sprint 13 UI regression lock: PRESENTATION follows the approved reference
 * (`design-reference/Choosify Admin CMS (standalone).html` → `isCategories`).
 * FUNCTIONALITY is the current canonical layer — unchanged from 03711be:
 * useAuth() category CRUD/reorder/import, catalogApi.*CategoryAttribute,
 * Undo/Redo history, circular-parent guard, slug generation, JSON import/export.
 * Reference-only fields with no CategoryType column (Category Photo, Featured
 * Brand) render as clearly-disabled placeholders and persist nothing.
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
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'cat-fashion': true,
    'cat-mobile': true,
  });

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

  // Undo/Redo snapshot tracking off the live `categories` state (real
  // /catalog/categories API). Unchanged from 03711be.
  useEffect(() => {
    if (!categories) return;
    if (history.length === 0) {
      setHistory([categories]);
      setHistoryPointer(0);
      return;
    }
    if (skipHistoryTrackRef.current) {
      skipHistoryTrackRef.current = false;
      return;
    }
    const current = history[historyPointer];
    if (current && JSON.stringify(current) === JSON.stringify(categories)) return;
    setHistory(prev => {
      const trimmed = prev.slice(0, historyPointer + 1);
      trimmed.push(categories);
      return trimmed;
    });
    setHistoryPointer(prev => prev + 1);
  }, [categories]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedId || editorMode !== 'edit') {
      setSchemaAttrs([]);
      return;
    }
    setSchemaLoading(true);
    catalogApi
      .listCategoryAttributes(selectedId)
      .then((rows) => { if (!cancelled) setSchemaAttrs(rows); })
      .catch(() => { if (!cancelled) setSchemaAttrs([]); })
      .finally(() => { if (!cancelled) setSchemaLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId, editorMode]);

  const refreshSchema = async () => {
    if (!selectedId) return;
    try {
      const rows = await catalogApi.listCategoryAttributes(selectedId);
      setSchemaAttrs(rows);
    } catch { /* keep prior */ }
  };

  const handleAddAttribute = async () => {
    if (!selectedId || !attrName.trim()) {
      showToast('Attribute name is required', 'error');
      return;
    }
    try {
      await catalogApi.createCategoryAttribute(selectedId, {
        name: attrName.trim(),
        type: attrType,
        required: attrRequired,
        variantEligible: attrVariant,
        options:
          attrType === 'select' || attrType === 'multi_select'
            ? attrOptions.split(',').map((o) => o.trim()).filter(Boolean)
            : [],
      });
      setAttrName('');
      setAttrOptions('');
      setAttrRequired(false);
      setAttrVariant(false);
      setAttrType('text');
      await refreshSchema();
      showToast('Attribute saved', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save attribute', 'error');
    }
  };

  const handleToggleAttrFlag = async (
    attr: CatalogCategoryAttribute,
    patch: Partial<CatalogCategoryAttribute>,
  ) => {
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
    const prevPointer = historyPointer - 1;
    const targetState = history[prevPointer];
    skipHistoryTrackRef.current = true;
    try {
      await importCategories(targetState);
      setHistoryPointer(prevPointer);
      showToast('Undid last category change', 'info');
    } catch (error) {
      skipHistoryTrackRef.current = false;
      showToast(error instanceof Error ? error.message : 'Failed to undo category change.', 'error');
    }
  };

  const handleRedo = async () => {
    if (historyPointer >= history.length - 1) return;
    const nextPointer = historyPointer + 1;
    const targetState = history[nextPointer];
    skipHistoryTrackRef.current = true;
    try {
      await importCategories(targetState);
      setHistoryPointer(nextPointer);
      showToast('Redid category change', 'info');
    } catch (error) {
      skipHistoryTrackRef.current = false;
      showToast(error instanceof Error ? error.message : 'Failed to redo category change.', 'error');
    }
  };

  useEffect(() => {
    if (editorMode === 'edit' && selectedId) {
      const cat = categories.find(c => c.id === selectedId);
      if (cat) {
        setFormName(cat.name);
        setFormSlug(cat.slug);
        setFormIcon(cat.icon);
        setFormDescription(cat.description);
        setFormParentId(cat.parentId);
        setFormEnabled(cat.enabled);
      }
    } else if (editorMode === 'create_child') {
      const parentName = targetParentId ? categories.find(c => c.id === targetParentId)?.name : 'Root';
      setFormName('');
      setFormSlug('');
      setFormIcon('Folder');
      setFormDescription(`Subcategory under ${parentName}`);
      setFormParentId(targetParentId);
      setFormEnabled(true);
    } else if (editorMode === 'create_root') {
      setFormName('');
      setFormSlug('');
      setFormIcon('Folder');
      setFormDescription('');
      setFormParentId(null);
      setFormEnabled(true);
    }
  }, [selectedId, editorMode, targetParentId, categories]);

  const handleNameChange = (val: string) => {
    setFormName(val);
    const generated = val
      .toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setFormSlug(generated);
  };

  const [savingCategory, setSavingCategory] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Category name cannot be empty', 'error');
      return;
    }

    if (editorMode === 'edit' && selectedId) {
      const duplicate = categories.some(
        c => c.parentId === formParentId &&
             c.name.toLowerCase() === formName.trim().toLowerCase() &&
             c.id !== selectedId
      );
      if (duplicate) {
        showToast(`A category named "${formName}" already exists under this parent.`, 'error');
        return;
      }
      if (formParentId === selectedId) {
        showToast('A category cannot be its own parent', 'error');
        return;
      }
      let tempParent = formParentId;
      while (tempParent !== null) {
        if (tempParent === selectedId) {
          showToast('Circular reference detected. Cannot set child as parent.', 'error');
          return;
        }
        tempParent = categories.find(c => c.id === tempParent)?.parentId || null;
      }

      setSavingCategory(true);
      try {
        await updateCategory(selectedId, {
          name: formName.trim(),
          slug: formSlug.trim(),
          icon: formIcon,
          description: formDescription,
          parentId: formParentId,
          enabled: formEnabled,
        });
        showToast('Category updated successfully', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to update category.', 'error');
      } finally {
        setSavingCategory(false);
      }
    } else {
      const duplicate = categories.some(
        c => c.parentId === formParentId &&
             c.name.toLowerCase() === formName.trim().toLowerCase()
      );
      if (duplicate) {
        showToast(`A category named "${formName}" already exists under this level.`, 'error');
        return;
      }
      setSavingCategory(true);
      try {
        const newCat = await createCategory(formParentId, formName.trim(), formIcon, formDescription);
        setSelectedId(newCat.id);
        setEditorMode('edit');
        showToast('Category created successfully', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to create category.', 'error');
      } finally {
        setSavingCategory(false);
      }
    }
  };

  const handleDeleteTrigger = (id: string) => {
    const hasChildren = categories.some(c => c.parentId === id);
    if (hasChildren) {
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
        if (selectedId === targetId) {
          setSelectedId(null);
          setEditorMode('create_root');
        }
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
    const siblings = categories
      .filter(c => c.parentId === item.parentId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const index = siblings.findIndex(s => s.id === id);
    if (direction === 'up' && index > 0) {
      try {
        await reorderCategory(id, index - 1);
        showToast('Moved category order up', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to reorder category.', 'error');
      }
    } else if (direction === 'down' && index < siblings.length - 1) {
      try {
        await reorderCategory(id, index + 1);
        showToast('Moved category order down', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to reorder category.', 'error');
      }
    }
  };

  const [togglingAll, setTogglingAll] = useState(false);

  const handleToggleAll = async () => {
    const allEnabled = categories.every(c => c.enabled);
    const updated = categories.map(c => ({ ...c, enabled: !allEnabled }));
    setTogglingAll(true);
    try {
      await importCategories(updated);
      showToast(`All categories ${!allEnabled ? 'Enabled' : 'Disabled'}`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to toggle categories.', 'error');
    } finally {
      setTogglingAll(false);
    }
  };

  const handleExportJSON = () => {
    setExporting(true);
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(categories, null, 2));
      const a = document.createElement('a');
      a.setAttribute('href', dataStr);
      a.setAttribute('download', 'choosify_bd_category_taxonomy.json');
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Taxonomy JSON exported successfully', 'success');
    } catch (e) {
      showToast('Failed to export taxonomy', 'error');
    } finally {
      setExporting(false);
    }
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
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const toggleNode = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const filteredCategories = categories.filter(c => {
    if (!searchQuery) return true;
    return (
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const rootNodes = filteredCategories.filter(c => c.parentId === null);

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

  // ── Hierarchy: approved reference renders flat "cards". We keep the real
  // expand/collapse + depth indent as an integrated affordance the prototype
  // omitted (per the regression lock: never drop working functionality).
  const renderTreeNode = (cat: CategoryType, depth = 0) => {
    const kids = filteredCategories.filter(c => c.parentId === cat.id);
    const isExpanded = !!expandedNodes[cat.id];
    const isSelected = selectedId === cat.id && editorMode === 'edit';
    const Icon = getIconComponent(cat.icon);

    return (
      <div key={cat.id} className="select-none" id={`node-${cat.id}`}>
        <div
          onClick={() => { setSelectedId(cat.id); setEditorMode('edit'); setActiveMobileTab('editor'); }}
          style={{ marginLeft: depth ? `${depth * 14}px` : undefined }}
          className={`group flex items-center gap-2.5 px-3.5 py-3 rounded-lg cursor-pointer border transition-colors ${
            isSelected
              ? 'bg-app-accent/10 border-app-accent/45 text-app-accent'
              : 'bg-white border-app-border hover:border-app-accent/30 text-app-text-primary'
          }`}
        >
          <button
            onClick={(e) => toggleNode(cat.id, e)}
            className="shrink-0 text-app-text-muted hover:text-app-text-primary"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {kids.length > 0
              ? (isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)
              : <span className="block w-1.5 h-1.5 rounded-full bg-app-text-muted/60" />}
          </button>

          <Icon className={`w-4 h-4 shrink-0 ${cat.enabled ? '' : 'opacity-40'}`} />

          <span className={`flex-1 min-w-0 truncate text-[12.5px] font-bold ${!cat.enabled ? 'line-through text-app-text-muted' : ''}`}>
            {cat.name}
          </span>

          {/* Retained controls — no reference equivalent; subtle, hover-revealed */}
          <span className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => { e.stopPropagation(); handleMoveNode(cat.id, 'up'); }} title="Move up" className="p-1 rounded text-app-text-muted hover:text-app-text-primary hover:bg-slate-100">
              <ArrowUp className="w-3 h-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleMoveNode(cat.id, 'down'); }} title="Move down" className="p-1 rounded text-app-text-muted hover:text-app-text-primary hover:bg-slate-100">
              <ArrowDown className="w-3 h-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setTargetParentId(cat.id); setEditorMode('create_child'); setActiveMobileTab('editor'); }} title="Add subcategory" className="p-1 rounded text-app-accent hover:bg-app-accent/10">
              <Plus className="w-3 h-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleDeleteTrigger(cat.id); }} title="Delete" className="p-1 rounded text-rose-500 hover:text-rose-600 hover:bg-rose-50">
              <Trash2 className="w-3 h-3" />
            </button>
          </span>
        </div>

        {kids.length > 0 && isExpanded && (
          <div className="mt-2 flex flex-col gap-2">
            {kids.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const label = 'text-[10px] font-extrabold uppercase tracking-[0.04em] text-app-text-muted block mb-1.5';
  const field = 'w-full box-border h-10 rounded-lg border border-app-border px-3 text-[12.5px] text-app-text-primary bg-white focus:outline-none focus:border-app-accent';
  const headBtn = 'flex items-center gap-1.5 bg-white border border-app-border rounded-lg px-4 py-2.5 text-[11.5px] font-extrabold text-app-text-primary hover:border-app-accent/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const selectedChildren = selectedId ? childrenOf(selectedId) : [];

  return (
    <div className="space-y-4 pb-12">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-3 z-[100] text-white ${
              toast.type === 'error' ? 'bg-rose-600' : toast.type === 'info' ? 'bg-indigo-600' : 'bg-app-accent'
            }`}
          >
            {toast.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Confirm taxonomy removal"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-[12px] text-app-text-secondary leading-relaxed">
            Delete{' '}
            <span className="font-bold font-mono text-app-text-primary">
              &quot;{categories.find(c => c.id === deleteConfirmId)?.name}&quot;
            </span>
            ? This removes it from the catalog routing tree and cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 text-xs font-bold text-app-text-secondary bg-slate-100 hover:bg-slate-200 rounded-lg">Cancel</button>
            <button onClick={handleConfirmDelete} className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg">Delete category</button>
          </div>
        </div>
      </Modal>

      {/* ── Studio header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[16px]" aria-hidden>🗂</span>
            <span className="text-[15.5px] font-extrabold tracking-[0.02em] text-app-text-primary">CATEGORY MANAGEMENT STUDIO</span>
          </div>
          <div className="text-[12px] text-app-text-secondary font-semibold mt-1">
            Manage hierarchical taxonomy and product classification configurations for Choosify.bd
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Undo/Redo — retained, integrated (no reference slot) */}
          <div className="flex bg-white border border-app-border rounded-lg p-0.5">
            <button onClick={handleUndo} disabled={historyPointer <= 0} title="Undo" className="p-2 rounded-md text-app-text-secondary hover:text-app-text-primary hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent">
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleRedo} disabled={historyPointer >= history.length - 1} title="Redo" className="p-2 rounded-md text-app-text-secondary hover:text-app-text-primary hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent">
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <button onClick={handleToggleAll} disabled={togglingAll} className={headBtn}>
            <Settings className="w-3.5 h-3.5" />
            <span>{togglingAll ? 'Updating…' : 'Toggle Status'}</span>
          </button>
          <button onClick={handleExportJSON} disabled={exporting} className={headBtn}>
            <Download className="w-3.5 h-3.5" />
            <span>{exporting ? 'Exporting…' : 'Export JSON'}</span>
          </button>
          <label className="flex items-center gap-1.5 bg-app-accent/10 border border-app-accent/40 rounded-lg px-4 py-2.5 text-[11.5px] font-extrabold text-app-accent hover:bg-app-accent/15 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>{importing ? 'Importing…' : 'Import Taxonomy'}</span>
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" disabled={importing} />
          </label>
        </div>
      </div>

      {/* Mobile switch */}
      <div className="flex md:hidden bg-white border border-app-border rounded-xl p-1">
        {(['tree', 'editor'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveMobileTab(t)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg text-center transition-colors ${
              activeMobileTab === t ? 'bg-app-accent text-white' : 'text-app-text-secondary'
            }`}
          >
            {t === 'tree' ? 'Category Tree' : 'Category Editor'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 items-start md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        {/* ── Left: hierarchy ── */}
        <div className={`bg-white border border-app-border rounded-[10px] p-4 ${activeMobileTab === 'tree' ? 'block' : 'hidden md:block'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] font-extrabold tracking-[0.05em] text-app-text-muted">CATEGORY HIERARCHY</div>
            <button
              onClick={() => { setEditorMode('create_root'); setActiveMobileTab('editor'); }}
              className="text-[11.5px] font-extrabold text-app-accent hover:opacity-80"
            >
              + Add Root
            </button>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-app-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search taxonomy rule..."
              className="w-full box-border h-9 rounded-lg border border-app-border pl-9 pr-8 text-[12px] text-app-text-primary bg-white focus:outline-none focus:border-app-accent"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-app-text-muted hover:text-app-text-primary">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 max-h-[640px] overflow-y-auto pr-1">
            {categoriesLoading && categories.length === 0 ? (
              <div className="py-10 text-center text-[11px] text-app-text-muted">Loading category taxonomy…</div>
            ) : rootNodes.length > 0 ? (
              rootNodes.map(node => renderTreeNode(node))
            ) : (
              <div className="py-10 text-center">
                <p className="text-[11px] text-app-text-muted">No matching taxonomy rules found.</p>
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="mt-2 text-[10px] text-app-accent hover:underline">Clear filter</button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: editor ── */}
        <div className={`bg-white border border-app-border rounded-[10px] p-5 ${activeMobileTab === 'editor' ? 'block' : 'hidden md:block'}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] font-extrabold tracking-[0.05em] text-app-text-muted">BREADCRUMB PATH</div>
              <div className="text-[13px] font-extrabold text-app-accent mt-0.5">
                {editorMode === 'edit'
                  ? getBreadcrumb(selectedId)
                  : editorMode === 'create_child'
                    ? `${getBreadcrumb(targetParentId)} › [New Sub]`
                    : '[New Root Category]'}
              </div>
            </div>
            <span className="text-[9.5px] font-extrabold tracking-[0.04em] text-emerald-600">
              {editorMode === 'edit' ? 'EDITOR ACTIVE' : editorMode === 'create_child' ? 'SUBCATEGORY CREATION' : 'ROOT CREATION'}
            </span>
          </div>

          <form onSubmit={handleSave} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className={label}>Category Name <span className="text-rose-500">*</span></label>
                <input value={formName} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Jamdani &amp; Silk Sarees" className={field} />
              </div>
              <div>
                <label className={`${label} flex items-center justify-between`}>
                  <span>Routing Slug</span>
                  <span className="text-[8px] normal-case text-app-text-muted font-semibold">auto-generated</span>
                </label>
                <input value={formSlug} onChange={(e) => setFormSlug(e.target.value)} placeholder="e.g. jamdani-silk-sarees" className={`${field} text-app-text-secondary`} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[90px_1fr_1fr] gap-3.5">
              <div>
                <label className={label}>Icon</label>
                {/* Reference uses a raw emoji input; production icon model is a
                    named lucide component, so the working select is retained. */}
                <select value={formIcon} onChange={(e) => setFormIcon(e.target.value)} className={`${field} px-2`}>
                  {AVAILABLE_ICONS.map(i => <option key={i.name} value={i.name}>{i.label}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Parent Node</label>
                <select value={formParentId || ''} onChange={(e) => setFormParentId(e.target.value || null)} className={field}>
                  <option value="">[No Parent - Root Category]</option>
                  {categories.filter(c => c.id !== selectedId).map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.slug})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Enabled Status</label>
                <div onClick={() => setFormEnabled(!formEnabled)} className="flex items-center gap-2 h-10 cursor-pointer select-none">
                  <span className={`text-[20px] leading-none ${formEnabled ? 'text-app-accent' : 'text-app-text-muted'}`}>◉</span>
                  <span className="text-[12px] font-bold text-app-text-primary">
                    {formEnabled ? 'Visible in Stores' : 'Taxonomy Hidden'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className={label}>Category Taxonomy Description</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe product classification, search indexing words, tags, and tax rules of this category."
                rows={3}
                className="w-full box-border rounded-lg border border-app-border px-3 py-2.5 text-[12px] text-app-text-primary bg-white focus:outline-none focus:border-app-accent resize-y"
              />
            </div>

            {/* CATEGORY PHOTO — reference layout slot; no CategoryType field → disabled, persists nothing */}
            <div>
              <label className={label}>Category Photo</label>
              <div className="w-[220px] h-[120px] rounded-lg border border-dashed border-app-border bg-slate-50 flex items-center justify-center text-center px-3">
                <span className="text-[10px] font-semibold text-app-text-muted leading-snug">
                  Category photos are not available in this release
                </span>
              </div>
            </div>

            {/* ── Subcategories (real: children of the selected category) ── */}
            {editorMode === 'edit' && selectedId && (
              <div className="border-t border-slate-100 pt-3.5">
                <div className="flex items-center justify-between mb-2.5">
                  <div className={label + ' mb-0'}>Subcategories</div>
                  <button
                    type="button"
                    onClick={() => { setTargetParentId(selectedId); setEditorMode('create_child'); }}
                    className="text-[11.5px] font-extrabold text-app-accent hover:opacity-80"
                  >
                    + Add Subcategory
                  </button>
                </div>
                {selectedChildren.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {selectedChildren.map(sub => (
                      <div key={sub.id} className="flex items-center gap-2.5 bg-slate-50 rounded-lg px-2.5 py-2">
                        <input
                          defaultValue={sub.name}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== sub.name) {
                              updateCategory(sub.id, { name: v }).catch((err) =>
                                showToast(err instanceof Error ? err.message : 'Failed to rename subcategory.', 'error'),
                              );
                            }
                          }}
                          className="flex-1 min-w-0 h-8 rounded-md border border-app-border px-2.5 text-[11.5px] bg-white text-app-text-primary focus:outline-none focus:border-app-accent"
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedId(sub.id)}
                          className="shrink-0 text-[10px] font-bold text-app-text-muted hover:text-app-accent"
                        >
                          open
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTrigger(sub.id)}
                          className="shrink-0 text-rose-600 hover:text-rose-700 text-[12px] font-extrabold"
                          title="Delete subcategory"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-app-text-muted text-[11.5px] font-semibold italic py-3.5 border border-dashed border-app-border rounded-lg">
                    No subcategories yet — add as many as needed.
                  </div>
                )}
              </div>
            )}

            {/* ── Attribute & Variant Schema — real, canonical catalogApi; no reference slot, integrated here ── */}
            {editorMode === 'edit' && selectedId && (
              <div className="border-t border-slate-100 pt-3.5">
                <div className="flex items-center justify-between mb-2.5">
                  <div className={label + ' mb-0'}>Attribute &amp; Variant Schema</div>
                  {schemaLoading && <span className="text-[9px] text-app-text-muted font-mono">Loading…</span>}
                </div>
                {schemaAttrs.length === 0 && !schemaLoading ? (
                  <p className="text-[11px] text-app-text-muted">No attributes defined for this category yet.</p>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto">
                    {schemaAttrs.map((attr) => (
                      <div key={attr.id} className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-slate-50 border border-app-border rounded-lg px-2.5 py-1.5">
                        <div className="min-w-0">
                          <span className="text-app-text-primary font-bold">{attr.name}</span>
                          <span className="text-app-text-muted font-mono ml-2">{attr.key}</span>
                          <span className="text-app-text-muted ml-2">{attr.type}</span>
                          {attr.required && <span className="ml-2 text-[9px] uppercase text-rose-500 font-bold">Required</span>}
                          {attr.variantEligible && <span className="ml-2 text-[9px] uppercase text-app-accent font-bold">Variant</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => handleToggleAttrFlag(attr, { required: !attr.required })} className="px-2 py-0.5 text-[9px] font-bold text-app-text-secondary bg-white border border-app-border hover:border-app-accent hover:text-app-accent rounded">Required</button>
                          <button type="button" onClick={() => handleToggleAttrFlag(attr, { variantEligible: !attr.variantEligible })} className="px-2 py-0.5 text-[9px] font-bold text-app-text-secondary bg-white border border-app-border hover:border-app-accent hover:text-app-accent rounded">Variant</button>
                          <button type="button" onClick={() => handleRemoveAttribute(attr)} className="px-2 py-0.5 text-[9px] font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 rounded">Remove</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 mt-2 border-t border-slate-100">
                  <input value={attrName} onChange={(e) => setAttrName(e.target.value)} placeholder="Attribute name" className="h-9 rounded-lg border border-app-border px-2.5 text-[12px] bg-white text-app-text-primary focus:outline-none focus:border-app-accent" />
                  <select value={attrType} onChange={(e) => setAttrType(e.target.value as typeof attrType)} className="h-9 rounded-lg border border-app-border px-2 text-[12px] bg-white text-app-text-primary focus:outline-none focus:border-app-accent">
                    <option value="text">text</option>
                    <option value="number">number</option>
                    <option value="boolean">boolean</option>
                    <option value="select">select</option>
                    <option value="multi_select">multi_select</option>
                  </select>
                  {(attrType === 'select' || attrType === 'multi_select') && (
                    <input value={attrOptions} onChange={(e) => setAttrOptions(e.target.value)} placeholder="Options (comma-separated)" className="sm:col-span-2 h-9 rounded-lg border border-app-border px-2.5 text-[12px] bg-white text-app-text-primary focus:outline-none focus:border-app-accent" />
                  )}
                  <div className="sm:col-span-2 flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-[10px] text-app-text-secondary font-bold uppercase tracking-wider">
                      <input type="checkbox" checked={attrRequired} onChange={(e) => setAttrRequired(e.target.checked)} className="accent-app-accent" /> Required
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] text-app-text-secondary font-bold uppercase tracking-wider">
                      <input type="checkbox" checked={attrVariant} onChange={(e) => setAttrVariant(e.target.checked)} className="accent-app-accent" /> Variant
                    </label>
                    <button type="button" onClick={handleAddAttribute} className="ml-auto px-3 py-1.5 text-xs font-bold text-white bg-app-accent hover:bg-app-accent-hover rounded-lg flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Add Attribute
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* FEATURED BRAND — reference layout slot; no CategoryType field → disabled, persists nothing */}
            <div className="border-t border-slate-100 pt-3.5">
              <label className={label}>Featured Brand (shown on storefront card)</label>
              <select disabled className="w-[280px] max-w-full box-border h-10 rounded-lg border border-app-border px-3 text-[12.5px] bg-slate-50 text-app-text-muted cursor-not-allowed">
                <option>Not available in this release</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2">
                {editorMode === 'edit' && selectedId && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const cat = categories.find(c => c.id === selectedId);
                        setTargetParentId(cat ? cat.parentId : null);
                        setEditorMode('create_child');
                      }}
                      className="px-3 py-2 text-xs font-bold text-app-text-secondary bg-white border border-app-border hover:bg-slate-50 hover:text-app-text-primary rounded-lg"
                    >
                      Add Sibling
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTrigger(selectedId)}
                      className="px-3 py-2 text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                    >
                      Delete Category
                    </button>
                  </>
                )}
                {editorMode !== 'edit' && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditorMode('edit');
                      if (!selectedId && categories.length > 0) setSelectedId(categories[0].id);
                    }}
                    className="px-4 py-2 text-xs font-bold text-app-text-secondary hover:text-app-text-primary"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={savingCategory}
                className="px-5 py-2.5 text-[12.5px] font-extrabold text-white bg-app-accent hover:bg-app-accent-hover rounded-lg flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingCategory ? 'Saving…' : editorMode === 'edit' ? 'Save Changes' : 'Create Category'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
