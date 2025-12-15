/**
 * Patient Manager V4 Aurora Prototype
 * 
 * Subtle visual upgrade of the existing patient manager:
 * - Same layout structure
 * - Cleaner borders and backgrounds
 * - Refined spacing and typography
 * - Consistent color usage
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  User,
  FileText,
  Search,
  Upload,
  Network,
  Star,
  Clock,
  Eye,
  ChevronDown,
  Layers,
  Zap,
  X,
  Check,
  Info,
  Merge,
  Database,
  CheckSquare,
  Trash2,
  FolderDown,
} from 'lucide-react';

// ============================================================================
// MOCK DATA
// ============================================================================

interface MockPatient {
  id: number;
  patientID: string;
  patientName: string;
  patientSex: string;
  patientAge: string;
  isFavorite: boolean;
  lastOpened?: string;
  tags: string[];
}

interface MockStudy {
  id: number;
  patientId: number;
  modality: string;
  description: string;
  date: string;
  seriesCount: number;
  imageCount: number;
  hasFusion: boolean;
  hasRTStruct: boolean;
}

const MOCK_PATIENTS: MockPatient[] = [
  { id: 1, patientID: 'HN-001', patientName: 'Thompson^Sarah', patientSex: 'F', patientAge: '52Y', isFavorite: true, lastOpened: '2h ago', tags: ['Head & Neck', 'Priority'] },
  { id: 2, patientID: 'LUNG-042', patientName: 'Williams^Marcus', patientSex: 'M', patientAge: '67Y', isFavorite: false, lastOpened: '1d ago', tags: ['Thorax', 'SBRT'] },
  { id: 3, patientID: 'BRAIN-119', patientName: 'Chen^David', patientSex: 'M', patientAge: '45Y', isFavorite: true, tags: ['Brain', 'SRS'] },
  { id: 4, patientID: 'PELV-078', patientName: 'Anderson^Emily', patientSex: 'F', patientAge: '58Y', isFavorite: false, tags: ['Pelvis'] },
  { id: 5, patientID: 'SPINE-023', patientName: 'Roberts^James', patientSex: 'M', patientAge: '71Y', isFavorite: false, tags: ['Spine', 'Palliative'] },
];

const MOCK_STUDIES: MockStudy[] = [
  { id: 1, patientId: 1, modality: 'CT', description: 'Head Neck C+', date: '2024-12-10', seriesCount: 4, imageCount: 287, hasFusion: true, hasRTStruct: true },
  { id: 2, patientId: 1, modality: 'PT', description: 'PET/CT Oncology', date: '2024-12-09', seriesCount: 2, imageCount: 412, hasFusion: true, hasRTStruct: false },
  { id: 3, patientId: 1, modality: 'MR', description: 'T1 Post Gad', date: '2024-12-08', seriesCount: 3, imageCount: 192, hasFusion: true, hasRTStruct: false },
  { id: 4, patientId: 2, modality: 'CT', description: 'Chest 4D', date: '2024-12-09', seriesCount: 10, imageCount: 1240, hasFusion: false, hasRTStruct: true },
  { id: 5, patientId: 2, modality: 'PT', description: 'PET Lung', date: '2024-12-08', seriesCount: 2, imageCount: 380, hasFusion: true, hasRTStruct: false },
  { id: 6, patientId: 3, modality: 'MR', description: 'Brain MPRAGE', date: '2024-12-08', seriesCount: 5, imageCount: 256, hasFusion: false, hasRTStruct: true },
  { id: 7, patientId: 3, modality: 'CT', description: 'CT Sim', date: '2024-12-07', seriesCount: 2, imageCount: 156, hasFusion: true, hasRTStruct: true },
  { id: 8, patientId: 4, modality: 'CT', description: 'Pelvis C+', date: '2024-12-07', seriesCount: 3, imageCount: 324, hasFusion: false, hasRTStruct: true },
  { id: 9, patientId: 5, modality: 'CT', description: 'T-L Spine', date: '2024-12-06', seriesCount: 2, imageCount: 198, hasFusion: false, hasRTStruct: false },
];

const TAGS = ['Head & Neck', 'Brain', 'Thorax', 'Pelvis', 'Spine', 'SBRT', 'SRS', 'Priority', 'Palliative'];

// ============================================================================
// HELPERS
// ============================================================================

const getModalityStyle = (mod: string) => {
  switch (mod?.toUpperCase()) {
    case 'CT': return 'bg-blue-500/10 border-blue-500/25 text-blue-400';
    case 'PT': case 'PET': return 'bg-amber-500/10 border-amber-500/25 text-amber-400';
    case 'MR': case 'MRI': return 'bg-purple-500/10 border-purple-500/25 text-purple-400';
    default: return 'bg-gray-500/10 border-gray-500/25 text-gray-400';
  }
};

const getTagStyle = (tag: string, isSelected: boolean) => {
  if (!isSelected) return 'bg-transparent border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-400';
  
  const t = tag.toLowerCase();
  if (t.includes('head') || t.includes('brain')) return 'bg-purple-500/15 border-purple-500/40 text-purple-300';
  if (t.includes('thorax')) return 'bg-blue-500/15 border-blue-500/40 text-blue-300';
  if (t.includes('pelvis')) return 'bg-green-500/15 border-green-500/40 text-green-300';
  if (t.includes('spine')) return 'bg-orange-500/15 border-orange-500/40 text-orange-300';
  if (t.includes('priority')) return 'bg-red-500/15 border-red-500/40 text-red-300';
  if (t.includes('sbrt') || t.includes('srs')) return 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300';
  if (t.includes('palliative')) return 'bg-amber-500/15 border-amber-500/40 text-amber-300';
  return 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300';
};

// ============================================================================
// PATIENT CARD
// ============================================================================

interface PatientCardProps {
  patient: MockPatient;
  studies: MockStudy[];
  isSelected: boolean;
  onSelect: (sel: boolean) => void;
  onToggleFavorite: () => void;
}

function PatientCard({ patient, studies, isSelected, onSelect, onToggleFavorite }: PatientCardProps) {
  const [expanded, setExpanded] = useState(false);

  const modalities = useMemo(() => {
    const m: Record<string, number> = {};
    studies.forEach(s => m[s.modality] = (m[s.modality] || 0) + 1);
    return m;
  }, [studies]);

  const hasFusion = studies.some(s => s.hasFusion);
  const hasRT = studies.some(s => s.hasRTStruct);
  const totalImages = studies.reduce((sum, s) => sum + s.imageCount, 0);

  return (
    <div className={cn(
      'rounded-xl border transition-all',
      isSelected 
        ? 'bg-cyan-500/5 border-cyan-500/30' 
        : 'bg-gray-900/40 border-gray-800 hover:border-gray-700'
    )}>
      <div className="p-4">
        {/* Row 1: Checkbox, Avatar, Name, Favorite, View button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelect(!isSelected)}
            className={cn(
              'w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
              isSelected ? 'bg-cyan-500 border-cyan-500 text-white' : 'border-gray-600 hover:border-gray-500'
            )}
          >
            {isSelected && <Check className="w-3 h-3" />}
          </button>

          <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-gray-500" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-medium text-sm truncate">
                {patient.patientName.replace('^', ', ')}
              </span>
              <button onClick={onToggleFavorite} className="flex-shrink-0">
                <Star className={cn('w-4 h-4', patient.isFavorite ? 'text-amber-400 fill-amber-400' : 'text-gray-600 hover:text-gray-500')} />
              </button>
            </div>
            <p className="text-gray-500 text-xs">{patient.patientID} • {patient.patientAge} • {patient.patientSex}</p>
          </div>

          <Button size="sm" variant="outline" className="h-8 px-3 bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white">
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            View
          </Button>
        </div>

        {/* Row 2: Stats */}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            {studies.length} studies
          </span>
          <span className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            {totalImages.toLocaleString()} images
          </span>
          {patient.lastOpened && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {patient.lastOpened}
            </span>
          )}
        </div>

        {/* Row 3: Modality badges */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {Object.entries(modalities).map(([mod, count]) => (
            <Badge key={mod} variant="outline" className={cn('text-[10px] font-medium h-5 px-1.5', getModalityStyle(mod))}>
              {mod}{count > 1 && ` ×${count}`}
            </Badge>
          ))}
          {hasFusion && (
            <Badge variant="outline" className="text-[10px] font-medium h-5 px-1.5 bg-emerald-500/10 border-emerald-500/25 text-emerald-400">
              <Zap className="w-2.5 h-2.5 mr-1" />Fusion
            </Badge>
          )}
          {hasRT && (
            <Badge variant="outline" className="text-[10px] font-medium h-5 px-1.5 bg-pink-500/10 border-pink-500/25 text-pink-400">
              RT
            </Badge>
          )}
        </div>

        {/* Row 4: Tags */}
        {patient.tags.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {patient.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded border text-[10px] font-medium bg-gray-800/50 border-gray-700 text-gray-400">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expand studies */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 py-2 border-t border-gray-800 text-xs text-gray-500 hover:text-gray-400 hover:bg-gray-800/30 transition-colors"
      >
        {expanded ? 'Hide' : 'Show'} Studies
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-800"
          >
            <div className="p-3 space-y-1">
              {studies.map(study => (
                <div key={study.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-colors">
                  <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5', getModalityStyle(study.modality))}>
                    {study.modality}
                  </Badge>
                  <span className="text-xs text-gray-300 flex-1 truncate">{study.description}</span>
                  <span className="text-[10px] text-gray-600">{study.imageCount} imgs</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// SELECTION BAR
// ============================================================================

function SelectionBar({ count, onClear }: { count: number; onClear: () => void }) {
  if (count === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="mb-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between"
    >
      <div className="flex items-center gap-2">
        <CheckSquare className="w-4 h-4 text-cyan-400" />
        <span className="text-white text-sm font-medium">{count} selected</span>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs bg-transparent border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20">
          <FolderDown className="w-3.5 h-3.5 mr-1" />Export
        </Button>
        {count >= 2 && (
          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs bg-transparent border-purple-500/30 text-purple-300 hover:bg-purple-500/20">
            <Merge className="w-3.5 h-3.5 mr-1" />Merge
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs bg-transparent border-red-500/30 text-red-400 hover:bg-red-500/20">
          <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
        </Button>
        <button onClick={onClear} className="p-1 rounded text-gray-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAIN PROTOTYPE
// ============================================================================

export function PatientManagerV4AuroraPrototype() {
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('patients');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [patients, setPatients] = useState(MOCK_PATIENTS);

  const filtered = useMemo(() => {
    return patients.filter(p => {
      const matchSearch = p.patientName.toLowerCase().includes(search.toLowerCase()) ||
                          p.patientID.toLowerCase().includes(search.toLowerCase());
      const matchTags = selectedTags.length === 0 || selectedTags.some(t => p.tags.includes(t));
      return matchSearch && matchTags;
    });
  }, [patients, search, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const toggleSelect = (id: number, sel: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      sel ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const toggleFavorite = (id: number) => {
    setPatients(prev => prev.map(p => p.id === id ? { ...p, isFavorite: !p.isFavorite } : p));
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Info */}
      <Card className="m-4 bg-gray-900/50 border-gray-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-white flex items-center gap-2 text-sm">
            <Info className="w-4 h-4 text-cyan-400" />
            Patient Manager - Subtle Upgrade
          </CardTitle>
          <CardDescription className="text-xs text-gray-500">
            Same layout as current patient manager with cleaner styling
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="px-4 pb-4">
        {/* Header */}
        <div className="rounded-xl bg-gray-900/80 border border-gray-800 px-4 py-3 mb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-wide">
              <span className="text-white">SUPER</span>
              <span className="text-cyan-400">BEAM</span>
            </h1>
            <Button size="sm" className="h-8 bg-cyan-600 hover:bg-cyan-500 text-white">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
          </div>
        </div>

        {/* Tabs + Search + Filters */}
        <div className="rounded-xl bg-gray-900/80 border border-gray-800 p-3 mb-4">
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-6 bg-gray-950 rounded-lg p-1 mb-3 h-auto">
              {[
                { id: 'patients', icon: User, label: 'Patients' },
                { id: 'import', icon: Upload, label: 'Import' },
                { id: 'pacs', icon: Network, label: 'PACS' },
                { id: 'query', icon: Database, label: 'Query' },
                { id: 'fusion', icon: Merge, label: 'Fusion' },
                { id: 'metadata', icon: FileText, label: 'Metadata' },
              ].map(tab => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="text-xs py-2 gap-1.5 data-[state=active]:bg-gray-800 data-[state=active]:text-white text-gray-500 rounded-md"
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patients..."
              className="h-9 pl-9 bg-gray-950 border-gray-800 text-white placeholder:text-gray-600 rounded-lg focus:border-gray-700"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Tag filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  'px-2 py-1 rounded-md border text-[11px] font-medium transition-colors',
                  getTagStyle(tag, selectedTags.includes(tag))
                )}
              >
                {tag}
              </button>
            ))}
            {selectedTags.length > 0 && (
              <button onClick={() => setSelectedTags([])} className="text-xs text-gray-500 hover:text-white ml-2">
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Selection bar */}
        <AnimatePresence>
          <SelectionBar count={selected.size} onClear={() => setSelected(new Set())} />
        </AnimatePresence>

        {/* Patient list */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-10 h-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">No patients found</p>
            </div>
          ) : (
            filtered.map(patient => (
              <PatientCard
                key={patient.id}
                patient={patient}
                studies={MOCK_STUDIES.filter(s => s.patientId === patient.id)}
                isSelected={selected.has(patient.id)}
                onSelect={(sel) => toggleSelect(patient.id, sel)}
                onToggleFavorite={() => toggleFavorite(patient.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
