import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CategoryType } from '../../types';
import { 
  Folder, FolderPlus, FolderOpen, ChevronRight, ChevronDown, Plus, Trash2, 
  Save, X, Search, ArrowUp, ArrowDown, Upload, Download, ToggleLeft, 
  ToggleRight, Eye, EyeOff, Settings, AlertTriangle, Layers, Smartphone, 
  Shirt, User, Tablet, Apple, Home, Briefcase, Grid, Filter, Database, 
  Undo2, Redo2, FileJson, Check, Copy, HelpCircle, Edit3, Gem, Gamepad2,
  Monitor, Utensils, Tv, Baby
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  { name: 'Layers', label: 'Layers & Fabric', icon: Layers },
  { name: 'Briefcase', label: 'Office & Work', icon: Briefcase },
  { name: 'Grid', label: 'Grid / General', icon: Grid },
  { name: 'Database', label: 'Data & Utilities', icon: Database },
  { name: 'Folder', label: 'Standard Folder', icon: Folder }
];

// Helper to resolve the icon component
const getIconComponent = (name: string) => {
  const match = AVAILABLE_ICONS.find(i => i.name === name);
  return match ? match.icon : Folder;
};

/**
 * Categories Management Component for Choosify.bd Admin Dashboard.
 * Includes hierarchical tree, real-time edit form, slug generator, bulk actions, and history states (Undo/Redo).
 */
export default function CategoriesPage() {
  const { 
    categories, 
    createCategory, 
    updateCategory, 
    deleteCategory, 
    moveCategory, 
    reorderCategory,
    importCategories 
  } = useAuth();

  // Selected state for category editor
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Tab control on Mobile Layouts: 'tree' | 'editor'
  const [activeMobileTab, setActiveMobileTab] = useState<'tree' | 'editor'>('tree');

  // Search filter query
  const [searchQuery, setSearchQuery] = useState('');
  
  // Expanded node state tracker (by Category ID)
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'cat-fashion': true,
    'cat-mobile': true,
  });

  // Editor form state
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formIcon, setFormIcon] = useState('Folder');
  const [formDescription, setFormDescription] = useState('');
  const [formParentId, setFormParentId] = useState<string | null>(null);
  const [formEnabled, setFormEnabled] = useState(true);
  
  // Editor mode: 'edit' | 'create_child' | 'create_root'
  const [editorMode, setEditorMode] = useState<'edit' | 'create_child' | 'create_root'>('edit');
  const [targetParentId, setTargetParentId] = useState<string | null>(null);

  // Undo/Redo tracking
  const [history, setHistory] = useState<CategoryType[][]>([]);
  const [historyPointer, setHistoryPointer] = useState(-1);

  // Toast status
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // File import/loading states
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Confirmation modal state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Initialize History state
  useEffect(() => {
    if (categories && history.length === 0) {
      setHistory([categories]);
      setHistoryPointer(0);
    }
  }, [categories]);

  /**
   * Helper to trigger elegant auto-dismissing toast alerts
   */
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  /**
   * Records the current category state into Undo/Redo history
   */
  const recordHistoryState = (newState: CategoryType[]) => {
    const updatedHistory = history.slice(0, historyPointer + 1);
    updatedHistory.push(newState);
    setHistory(updatedHistory);
    setHistoryPointer(updatedHistory.length - 1);
  };

  /**
   * Performs an Undo operation returning to the previous state
   */
  const handleUndo = () => {
    if (historyPointer > 0) {
      const prevPointer = historyPointer - 1;
      const targetState = history[prevPointer];
      setHistoryPointer(prevPointer);
      importCategories(targetState);
      showToast('Undid last category change', 'info');
    }
  };

  /**
   * Performs a Redo operation restoring the forward state
   */
  const handleRedo = () => {
    if (historyPointer < history.length - 1) {
      const nextPointer = historyPointer + 1;
      const targetState = history[nextPointer];
      setHistoryPointer(nextPointer);
      importCategories(targetState);
      showToast('Redid category change', 'info');
    }
  };

  // Sync editor form state when selection or mode changes
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

  // Handle Slug auto-generation from category Name
  const handleNameChange = (val: string) => {
    setFormName(val);
    // Auto-generate slug with simple regex sanitize
    const generated = val
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setFormSlug(generated);
  };

  /**
   * Save category handler
   */
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Category name cannot be empty', 'error');
      return;
    }

    if (editorMode === 'edit' && selectedId) {
      // Uniqueness within parent check
      const duplicate = categories.some(
        c => c.parentId === formParentId && 
             c.name.toLowerCase() === formName.trim().toLowerCase() && 
             c.id !== selectedId
      );
      if (duplicate) {
        showToast(`A category named "${formName}" already exists under this parent.`, 'error');
        return;
      }

      // Check circular parent setting
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

      updateCategory(selectedId, {
        name: formName.trim(),
        slug: formSlug.trim(),
        icon: formIcon,
        description: formDescription,
        parentId: formParentId,
        enabled: formEnabled
      });

      // Fetch newly updated categories to record in history
      const savedState = JSON.parse(localStorage.getItem('choosify_categories') || '[]');
      recordHistoryState(savedState);
      showToast('Category updated successfully', 'success');
    } else {
      // Create mode
      const duplicate = categories.some(
        c => c.parentId === formParentId && 
             c.name.toLowerCase() === formName.trim().toLowerCase()
      );
      if (duplicate) {
        showToast(`A category named "${formName}" already exists under this level.`, 'error');
        return;
      }

      const newCat = createCategory(formParentId, formName.trim(), formIcon, formDescription);
      
      const savedState = JSON.parse(localStorage.getItem('choosify_categories') || '[]');
      recordHistoryState(savedState);
      
      setSelectedId(newCat.id);
      setEditorMode('edit');
      showToast('Category created successfully', 'success');
    }
  };

  /**
   * Deletion sequence with guard checks
   */
  const handleDeleteTrigger = (id: string) => {
    const hasChildren = categories.some(c => c.parentId === id);
    if (hasChildren) {
      showToast('Cannot delete category with subcategories. Move children first!', 'error');
      return;
    }
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmId) {
      const success = deleteCategory(deleteConfirmId);
      if (success) {
        const savedState = JSON.parse(localStorage.getItem('choosify_categories') || '[]');
        recordHistoryState(savedState);
        showToast('Category deleted successfully', 'success');
        if (selectedId === deleteConfirmId) {
          setSelectedId(null);
          setEditorMode('create_root');
        }
      } else {
        showToast('Failed to delete category.', 'error');
      }
      setDeleteConfirmId(null);
    }
  };

  /**
   * Moves a category node using standard arrow navigation
   */
  const handleMoveNode = (id: string, direction: 'up' | 'down') => {
    const item = categories.find(c => c.id === id);
    if (!item) return;

    const siblings = categories
      .filter(c => c.parentId === item.parentId)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    const index = siblings.findIndex(s => s.id === id);
    if (direction === 'up' && index > 0) {
      reorderCategory(id, index - 1);
      const savedState = JSON.parse(localStorage.getItem('choosify_categories') || '[]');
      recordHistoryState(savedState);
      showToast('Moved category order up', 'success');
    } else if (direction === 'down' && index < siblings.length - 1) {
      reorderCategory(id, index + 1);
      const savedState = JSON.parse(localStorage.getItem('choosify_categories') || '[]');
      recordHistoryState(savedState);
      showToast('Moved category order down', 'success');
    }
  };

  /**
   * Bulk action: Global Toggle
   */
  const handleToggleAll = () => {
    const allEnabled = categories.every(c => c.enabled);
    const updated = categories.map(c => ({ ...c, enabled: !allEnabled }));
    importCategories(updated);
    recordHistoryState(updated);
    showToast(`All categories ${!allEnabled ? 'Enabled' : 'Disabled'}`, 'success');
  };

  /**
   * Bulk action: Export JSON taxonomy file
   */
  const handleExportJSON = () => {
    setExporting(true);
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(categories, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "choosify_bd_category_taxonomy.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Taxonomy JSON exported successfully', 'success');
    } catch (e) {
      showToast('Failed to export taxonomy', 'error');
    } finally {
      setExporting(false);
    }
  };

  /**
   * Bulk action: Import JSON taxonomy file
   */
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0 && 'parentId' in parsed[0] && 'name' in parsed[0]) {
          importCategories(parsed);
          recordHistoryState(parsed);
          showToast(`Successfully imported ${parsed.length} categories!`, 'success');
        } else {
          showToast('Invalid file format. Ensure it contains a Category array.', 'error');
        }
      } catch (err) {
        showToast('Failed to parse category file. Ensure JSON is correct.', 'error');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  // Toggle tree node expanded state
  const toggleNode = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  // Search filter implementation
  const filteredCategories = categories.filter(c => {
    if (!searchQuery) return true;
    return (
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Top level categories to start the recursive tree
  const rootNodes = filteredCategories.filter(c => c.parentId === null);

  // Return full hierarchy breadcrumb of selected category
  const getBreadcrumb = (catId: string | null): string => {
    if (!catId) return 'Taxonomy Root';
    const path: string[] = [];
    let currentId: string | null = catId;
    while (currentId !== null) {
      const match = categories.find(c => c.id === currentId);
      if (match) {
        path.unshift(match.name);
        currentId = match.parentId;
      } else {
        break;
      }
    }
    return path.join(' › ');
  };

  // Dynamic Product Link Counter simulator
  const getProductCount = (categoryName: string): number => {
    // Matches Bangladesh standard mocked products
    const standardMockCounts: Record<string, number> = {
      'Fashion & Lifestyle': 32,
      'Jewelry & Accessories': 14,
      'Mobile & Phones': 28,
      'Sporting & Playstation': 18,
      'Gaming & Entertainment': 22,
      'Food & Restaurants': 15,
      'Tech & Electronics': 45,
      'TV & Appliances': 12,
      'Home & Living': 15,
      'Baby & Maternity': 10,
    };
    return standardMockCounts[categoryName] || Math.floor((categoryName.length * 3) % 19);
  };

  // Tree Node recursive renderer
  const renderTreeNode = (cat: CategoryType, depth = 0) => {
    const children = filteredCategories.filter(c => c.parentId === cat.id);
    const isExpanded = !!expandedNodes[cat.id];
    const isSelected = selectedId === cat.id && editorMode === 'edit';
    const IconComponent = getIconComponent(cat.icon);

    return (
      <div key={cat.id} className="select-none" id={`node-${cat.id}`}>
        <div 
          onClick={() => {
            setSelectedId(cat.id);
            setEditorMode('edit');
            setActiveMobileTab('editor');
          }}
          style={{ paddingLeft: `${Math.max(8, depth * 16)}px` }}
          className={`group flex items-center justify-between py-2 px-3 rounded-md transition-all cursor-pointer border ${
            isSelected 
              ? 'bg-[#FF6A00]/10 border-[#FF6A00]/40 text-[#FF6A00]' 
              : 'border-transparent hover:bg-slate-800/50 text-slate-300 hover:text-white'
          }`}
        >
          <div className="flex items-center space-x-2 min-w-0">
            {/* Expand / Collapse trigger */}
            <button 
              onClick={(e) => toggleNode(cat.id, e)}
              className="p-1 rounded hover:bg-slate-700/60 transition-colors text-slate-500 hover:text-slate-300"
            >
              {children.length > 0 ? (
                isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full bg-slate-700/40 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                </div>
              )}
            </button>

            {/* Icon representation */}
            <IconComponent className={`w-4 h-4 shrink-0 ${cat.enabled ? 'text-orange-400' : 'text-slate-500'}`} />

            {/* Name and enabled indicator */}
            <span className={`text-xs font-semibold truncate ${!cat.enabled && 'line-through text-slate-500'}`}>
              {cat.name}
            </span>

            {/* Product count tag */}
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              {getProductCount(cat.name)}
            </span>
          </div>

          {/* Node Hover Quick Actions */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 shrink-0 pl-2">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleMoveNode(cat.id, 'up');
              }}
              className="p-0.5 rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-all"
              title="Move Up"
            >
              <ArrowUp className="w-3 h-3" />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleMoveNode(cat.id, 'down');
              }}
              className="p-0.5 rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-all"
              title="Move Down"
            >
              <ArrowDown className="w-3 h-3" />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setTargetParentId(cat.id);
                setEditorMode('create_child');
                setActiveMobileTab('editor');
              }}
              className="p-0.5 rounded text-[#FF6A00] hover:text-[#FF9E2C] hover:bg-slate-700 transition-all"
              title="Add Subcategory"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteTrigger(cat.id);
              }}
              className="p-0.5 rounded text-red-400 hover:text-red-500 hover:bg-slate-700 transition-all"
              title="Delete Category"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Recursive Children rendering */}
        {children.length > 0 && isExpanded && (
          <div className="mt-0.5 border-l border-slate-800 ml-4">
            {children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 sm:p-6 font-sans">
      
      {/* Toast alert notice */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-md shadow-2xl border text-sm font-semibold max-w-sm ${
              toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-300 border-emerald-800/50' :
              toast.type === 'error' ? 'bg-rose-950/90 text-rose-300 border-rose-800/50' :
              'bg-[#1a1a2e]/95 text-sky-300 border-[#FF6A00]/30'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-400' : toast.type === 'error' ? 'bg-rose-400' : 'bg-[#FF6A00]'} animate-pulse`} />
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Delete Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#121424] border border-slate-800 rounded-lg p-5 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center space-x-3 text-red-400 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h4 className="text-base font-bold text-white uppercase tracking-wider">Confirm Taxonomy Removal</h4>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Are you sure you want to delete the category <span className="text-white font-bold font-mono">"{categories.find(c => c.id === deleteConfirmId)?.name}"</span>? 
              This will remove this rule from the e-commerce routing tree. This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-400 bg-slate-800 hover:bg-slate-700 hover:text-white rounded transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded transition-all"
              >
                Delete Taxonomy Rule
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* HEADER SECTION WITH ACTION TOOLBARS */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-slate-900 flex items-center space-x-2">
            <Layers className="w-6 h-6 text-[#FF6A00]" />
            <span>Category Taxonomy Studio</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage hierarchical taxonomy and product classification configurations for Choosify.bd
          </p>
        </div>

        {/* UTILITY ACTIONS CONTAINER */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Undo/Redo */}
          <div className="flex bg-[#121424] border border-slate-800 rounded p-0.5">
            <button
              onClick={handleUndo}
              disabled={historyPointer <= 0}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent transition-all"
              title="Undo Action"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyPointer >= history.length - 1}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent transition-all"
              title="Redo Action"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Toggle All */}
          <button
            onClick={handleToggleAll}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-300 bg-[#121424] border border-slate-800 rounded hover:bg-slate-800 hover:text-white transition-all"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span>Toggle Status</span>
          </button>

          {/* Export Taxonomy */}
          <button
            onClick={handleExportJSON}
            disabled={exporting}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-slate-300 bg-[#121424] border border-slate-800 rounded hover:bg-slate-800 hover:text-white transition-all"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>{exporting ? 'Exporting...' : 'Export JSON'}</span>
          </button>

          {/* Import Taxonomy file-input proxied by stylish button */}
          <label className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-[#FF6A00] bg-[#FF6A00]/10 border border-[#FF6A00]/30 rounded hover:bg-[#FF6A00]/20 cursor-pointer transition-all">
            <Upload className="w-3.5 h-3.5" />
            <span>{importing ? 'Importing...' : 'Import Taxonomy'}</span>
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImportJSON} 
              className="hidden" 
              disabled={importing}
            />
          </label>
        </div>
      </div>

      {/* MOBILE TABS CONTROLLER */}
      <div className="flex md:hidden bg-[#121424] border border-slate-800 rounded-lg p-1 mb-4">
        <button
          onClick={() => setActiveMobileTab('tree')}
          className={`flex-1 py-1.5 text-xs font-bold rounded text-center transition-all ${
            activeMobileTab === 'tree' ? 'bg-[#FF6A00] text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          Category Tree
        </button>
        <button
          onClick={() => setActiveMobileTab('editor')}
          className={`flex-1 py-1.5 text-xs font-bold rounded text-center transition-all ${
            activeMobileTab === 'editor' ? 'bg-[#FF6A00] text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          Category Editor
        </button>
      </div>

      {/* SEARCH AND STRUCTURAL CONTENT GRID */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: HIERARCHICAL TREE VIEW */}
        <div className={`md:col-span-4 bg-[#121424] border border-slate-800 rounded-lg p-4 shadow-xl ${
          activeMobileTab === 'tree' ? 'block' : 'hidden md:block'
        }`}>
          <div className="mb-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#FF6A00] mb-2 flex items-center justify-between">
              <span>Category Hierarchy</span>
              <button
                onClick={() => {
                  setEditorMode('create_root');
                  setActiveMobileTab('editor');
                }}
                className="text-[10px] bg-slate-800 text-slate-300 hover:bg-[#FF6A00] hover:text-white px-2 py-0.5 rounded transition-all flex items-center space-x-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Root</span>
              </button>
            </h2>

            {/* SEARCH TEXTFIELD */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search taxonomy rule..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#090a12] border border-slate-800 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#FF6A00] transition-colors"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 p-0.5 rounded text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* TREE VIEW PORT CONTAINER */}
          <div className="space-y-1.5 max-h-[550px] overflow-y-auto custom-scrollbar pr-1">
            {rootNodes.length > 0 ? (
              rootNodes.map(node => renderTreeNode(node))
            ) : (
              <div className="py-8 text-center">
                <FolderOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-[11px] text-slate-500">No matching taxonomy rules found.</p>
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="mt-2 text-[10px] text-[#FF6A00] hover:underline"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: TAXONOMY DATA EDITOR */}
        <div className={`md:col-span-8 bg-[#121424] border border-slate-800 rounded-lg p-5 shadow-xl ${
          activeMobileTab === 'editor' ? 'block' : 'hidden md:block'
        }`}>
          
          {/* EDITOR SECTION SUBHEADER */}
          <div className="border-b border-slate-800 pb-3 mb-5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                Breadcrumb Path
              </div>
              <div className="text-xs font-bold font-mono text-slate-300 mt-0.5 flex items-center space-x-1.5">
                <span className="text-[#FF6A00]">
                  {editorMode === 'edit' ? getBreadcrumb(selectedId) : 
                   editorMode === 'create_child' ? `${getBreadcrumb(targetParentId)} › [New Sub]` : 
                   '[New Root Category]'}
                </span>
              </div>
            </div>

            {/* Quick State Indicators */}
            <div className="flex items-center space-x-2">
              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                editorMode === 'edit' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/50' :
                editorMode === 'create_child' ? 'bg-[#FF6A00]/10 text-[#FF9E2C] border border-[#FF6A00]/20' :
                'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
              }`}>
                {editorMode === 'edit' ? 'Editor Active' : 
                 editorMode === 'create_child' ? 'Subcategory Creation' : 
                 'Root Creation'}
              </span>
            </div>
          </div>

          {/* MAIN FORM */}
          <form onSubmit={handleSave} className="space-y-4">
            
            {/* Grid for Name & Slug */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Jamdani & Silk Sarees"
                  className="w-full px-3 py-2 text-xs bg-[#090a12] border border-slate-800 rounded text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#FF6A00] transition-colors font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1 flex items-center justify-between">
                  <span>Routing Slug</span>
                  <span className="text-[8px] text-slate-500 lowercase font-mono">auto-generated</span>
                </label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="e.g. jamdani-silk-sarees"
                  className="w-full px-3 py-2 text-xs bg-[#090a12] border border-slate-800 rounded text-slate-300 placeholder-slate-600 focus:outline-none focus:border-[#FF6A00] transition-colors font-mono"
                />
              </div>
            </div>

            {/* Grid for Icon & Parent Category & Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Icon dropdown */}
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">
                  Taxonomy Icon
                </label>
                <select
                  value={formIcon}
                  onChange={(e) => setFormIcon(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#090a12] border border-slate-800 rounded text-slate-300 focus:outline-none focus:border-[#FF6A00] transition-colors"
                >
                  {AVAILABLE_ICONS.map(i => (
                    <option key={i.name} value={i.name}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Parent Category Dropdown Selector */}
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">
                  Parent Node
                </label>
                <select
                  value={formParentId || ''}
                  onChange={(e) => setFormParentId(e.target.value || null)}
                  className="w-full px-3 py-2 text-xs bg-[#090a12] border border-slate-800 rounded text-slate-300 focus:outline-none focus:border-[#FF6A00] transition-colors"
                >
                  <option value="">[No Parent - Root Category]</option>
                  {categories
                    // Exclude self and self-children to prevent circular relations
                    .filter(c => c.id !== selectedId)
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.slug})
                      </option>
                    ))
                  }
                </select>
              </div>

              {/* Status Toggle */}
              <div>
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">
                  Enabled Status
                </label>
                <div className="flex items-center space-x-2 py-1">
                  <button
                    type="button"
                    onClick={() => setFormEnabled(!formEnabled)}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    {formEnabled ? (
                      <ToggleRight className="w-8 h-8 text-[#FF6A00]" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-slate-600" />
                    )}
                  </button>
                  <span className="text-xs font-bold text-slate-300">
                    {formEnabled ? 'Visible in Stores' : 'Taxonomy Hidden'}
                  </span>
                </div>
              </div>
            </div>

            {/* Description textarea */}
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block mb-1">
                Category Taxonomy Description
              </label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe product classification, search indexing words, tags, and tax rules of this category."
                rows={3}
                className="w-full px-3 py-2 text-xs bg-[#090a12] border border-slate-800 rounded text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#FF6A00] transition-colors"
              />
            </div>

            {/* Extra Stats Metadata Panel */}
            {editorMode === 'edit' && selectedId && (
              <div className="bg-[#090a12] border border-slate-850 rounded p-3 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-slate-500" />
                  <span>Linked Products (Simulated): <strong className="text-white font-mono">{getProductCount(formName)} products</strong></span>
                </div>
                <div className="flex items-center space-x-2 font-mono text-[10px]">
                  <span>ID:</span>
                  <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{selectedId}</span>
                </div>
              </div>
            )}

            {/* ACTIONS PANEL */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
              
              {/* Left Side: Create Actions if editing */}
              <div className="flex items-center space-x-2">
                {editorMode === 'edit' && selectedId && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetParentId(selectedId);
                        setEditorMode('create_child');
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-[#FF6A00] hover:text-white rounded transition-all flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Subcategory</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const cat = categories.find(c => c.id === selectedId);
                        setTargetParentId(cat ? cat.parentId : null);
                        setEditorMode('create_child');
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-slate-300 bg-[#090a12] border border-slate-800 hover:bg-slate-800 hover:text-white rounded transition-all"
                    >
                      Add Sibling Category
                    </button>
                  </>
                )}
              </div>

              {/* Right Side: Form Actions (Save, Cancel, Delete) */}
              <div className="flex items-center space-x-2">
                {editorMode !== 'edit' && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditorMode('edit');
                      if (!selectedId && categories.length > 0) {
                        setSelectedId(categories[0].id);
                      }
                    }}
                    className="px-4 py-2 text-xs font-bold text-slate-400 bg-transparent hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                )}

                {editorMode === 'edit' && selectedId && (
                  <button
                    type="button"
                    onClick={() => handleDeleteTrigger(selectedId)}
                    className="px-3 py-2 text-xs font-bold text-red-400 bg-red-950/20 hover:bg-red-900/30 hover:text-red-300 rounded transition-all"
                  >
                    Delete Category
                  </button>
                )}

                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black uppercase tracking-wider text-white bg-gradient-to-r from-[#FF6A00] to-[#FF9E2C] rounded shadow-lg hover:brightness-110 transition-all flex items-center space-x-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editorMode === 'edit' ? 'Save Changes' : 'Create Category'}</span>
                </button>
              </div>

            </div>

          </form>

        </div>

      </div>

    </div>
  );
}
