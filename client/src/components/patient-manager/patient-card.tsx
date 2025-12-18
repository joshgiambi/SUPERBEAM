import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, FileStack, Brain, Eye, ChevronDown, ChevronUp, Layers, GitBranch, Loader2, Edit, Star, ArrowRight, Maximize2, ImageIcon, Zap, History, Trash2, FolderOpen, FileImage, User } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'wouter';
import { MetadataEditDialog } from './metadata-edit-dialog';
import { DicomThumbnail } from './dicom-thumbnail';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { pillClassForModality } from '@/lib/pills';
import type { AssociationResponse, RegistrationAssociation } from '@/types/fusion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PatientCardProps {
  patient: any;
  studies: any[];
  series: any[];
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  onUpdate?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onPatientOpened?: () => void;
}

export function PatientCard({ patient, studies, series, isSelectable, isSelected, onSelectionChange, onUpdate, isFavorite, onToggleFavorite, onPatientOpened }: PatientCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [rtStructures, setRtStructures] = useState<{ [key: number]: any[] }>({});
  const [loadingStructures, setLoadingStructures] = useState<{ [key: number]: boolean }>({});
  const [associationData, setAssociationData] = useState<AssociationResponse | null>(null);
  const [loadingAssociations, setLoadingAssociations] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [tags, setTags] = useState<any[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const hasLoadedRef = useRef(false);
  const { toast } = useToast();

  // Group series by study
  const studiesWithSeries = studies.map(study => ({
    ...study,
    series: series.filter(s => s.studyId === study.id)
  }));

  // Categorize series by modality
  const ctSeries = series.filter(s => s.modality === 'CT');
  const mrSeries = series.filter(s => s.modality === 'MR');
  const ptSeries = series.filter(s => s.modality === 'PT' || s.modality === 'PET');
  const rtStructureSeries = series.filter(s => s.modality === 'RTSTRUCT');
  const registrationSeries = series.filter(s => s.modality === 'REG');
  
  // Find the planning CT (best CT for primary)
  const planningCT = ctSeries.length > 0 ? (() => {
    const scoreCT = (ct: any) => {
      let score = 0;
      score += Math.min(200, (ct.imageCount || 0));
      const desc = (ct.seriesDescription || '').toLowerCase();
      if (desc.includes('planning') || desc.includes('plan')) score += 100;
      if (desc.includes('ctac')) score -= 200;
      return score;
    };
    return [...ctSeries].sort((a, b) => scoreCT(b) - scoreCT(a))[0];
  })() : null;

  // Summary counts
  const hasRT = rtStructureSeries.length > 0;
  const hasRegistration = registrationSeries.length > 0 || (associationData?.associations?.length ?? 0) > 0;
  const hasFusion = mrSeries.length > 0 || ptSeries.length > 0;

  // Format series label like viewer: #4 · Series Name
  const formatSeriesLabel = (item: { seriesDescription?: string | null; seriesNumber?: number | null; id?: number }) => {
    const rawDescription = (item.seriesDescription || '').trim();
    const seriesNumber = typeof item.seriesNumber === 'number' ? `#${item.seriesNumber}` : null;
    const fallback = item.id != null ? `Series ${item.id}` : 'Series';
    const baseLabel = rawDescription.length
      ? (rawDescription.length > 40 ? `${rawDescription.slice(0, 37)}…` : rawDescription)
      : fallback;
    return seriesNumber ? `${seriesNumber} · ${baseLabel}` : baseLabel;
  };

  // Load patient tags
  useEffect(() => {
    if (patient?.id) {
      fetch(`/api/patients/${patient.id}/tags`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setTags(data);
          }
        })
        .catch(err => console.error('Error loading tags:', err));
    }
  }, [patient?.id]);

  // Load data when expanded
  useEffect(() => {
    if (isExpanded && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      
      const loadRTStructures = async () => {
        for (const rtSeries of rtStructureSeries) {
          setLoadingStructures(prev => ({ ...prev, [rtSeries.id]: true }));
          try {
            const response = await fetch(`/api/rt-structures/${rtSeries.id}/contours`);
            if (response.ok) {
              const data = await response.json();
              setRtStructures(prev => ({ ...prev, [rtSeries.id]: data.structures || [] }));
            }
          } catch (error) {
            console.error(`Error loading RT structures for series ${rtSeries.id}:`, error);
          } finally {
            setLoadingStructures(prev => ({ ...prev, [rtSeries.id]: false }));
          }
        }
      };
      
      const loadAssociationData = async () => {
        if (patient?.id) {
          setLoadingAssociations(true);
          try {
            const response = await fetch(`/api/registration/associations?patientId=${patient.id}`);
            if (response.ok) {
              const data = await response.json();
              setAssociationData(data);
            }
          } catch (err) {
            console.error('Error loading associations:', err);
          } finally {
            setLoadingAssociations(false);
          }
        }
      };
      
      loadRTStructures();
      loadAssociationData();
    }
  }, [isExpanded]);

  // Open series preview in popup window
  const openSeriesPreview = (seriesItem: any) => {
    const previewUrl = `/preview?seriesId=${seriesItem.id}&studyId=${seriesItem.studyId}`;
    const popupWidth = 700;
    const popupHeight = 600;
    const left = (window.screen.width - popupWidth) / 2;
    const top = (window.screen.height - popupHeight) / 2;
    
    window.open(
      previewUrl,
      `preview-${seriesItem.id}`,
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=no,status=no,toolbar=no,menubar=no,location=no`
    );
  };

  // Parse DICOM date format (YYYYMMDD) to JavaScript Date
  const parseDicomDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    if (/^\d{8}$/.test(dateStr)) {
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      return new Date(year, month, day);
    }
    const parsed = Date.parse(dateStr);
    return isNaN(parsed) ? null : new Date(parsed);
  };
  
  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete patient ${patient.patientName}? This will delete all associated studies, series, and images.`)) {
      return;
    }
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/patients/${patient.id}?full=true`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete patient');
      }
      
      toast({
        title: "Patient deleted",
        description: `Successfully deleted ${patient.patientName} and all associated data.`,
      });
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error deleting patient:', error);
      toast({
        title: "Error",
        description: "Failed to delete patient. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Format study date for display
  const getStudyDateDisplay = () => {
    if (studies.length === 0) return null;
    const date = parseDicomDate(studies[0].studyDate);
    return date ? format(date, 'MMM d, yyyy') : null;
  };

  // Render a series card matching viewer sidebar style
  const renderSeriesCard = (seriesItem: any, isPrimary: boolean = false, showPreview: boolean = true) => (
    <div
      key={seriesItem.id}
      className={cn(
        "group relative py-1.5 px-2 rounded-lg border cursor-pointer transition-all duration-150",
        isPrimary 
          ? 'bg-gradient-to-r from-blue-500/15 to-blue-600/5 border-blue-400/40'
          : 'bg-gray-800/20 border-gray-700/25 hover:bg-gray-800/40 hover:border-gray-600/40'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Badge className={cn("flex-shrink-0", pillClassForModality(seriesItem.modality))}>
            {seriesItem.modality}
            {isPrimary && seriesItem.modality === 'CT' ? ' • Planning' : ''}
          </Badge>
          <span className="text-xs font-medium text-gray-200 truncate group-hover:text-white transition-colors">
            {formatSeriesLabel(seriesItem)}
          </span>
          <span className="text-[10px] text-gray-500 flex-shrink-0 tabular-nums">
            {seriesItem.imageCount || 0}
          </span>
        </div>
        
        {/* Action icons */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {showPreview && ['CT', 'MR', 'PT'].includes(seriesItem.modality) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openSeriesPreview(seriesItem);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
          {isPrimary && (
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          )}
        </div>
      </div>
    </div>
  );

  // Render RT structure card
  const renderRTCard = (rtSeries: any) => (
    <div
      key={rtSeries.id}
      className="group relative py-1.5 px-2 rounded-lg border transition-all duration-150 bg-green-900/10 border-green-500/30 hover:bg-green-900/20"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Badge className={cn("flex-shrink-0", pillClassForModality('RT'))}>
            RT
          </Badge>
          <span className="text-xs text-gray-300 truncate">
            {rtSeries.seriesDescription || 'Structure Set'}
          </span>
        </div>
        <History className="h-3.5 w-3.5 text-gray-500" />
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={200}>
    <div className="flex gap-2">
      {/* Left Floating Action Bar */}
      <div className="flex flex-col gap-1 pt-3 flex-shrink-0">
        {/* Checkbox */}
        {isSelectable && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onSelectionChange?.(!isSelected)}
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 border border-transparent",
                  isSelected
                    ? "bg-indigo-500/30 text-indigo-300 border-indigo-400/60 shadow-[0_0_10px_rgba(99,102,241,0.4)]"
                    : "text-gray-500 hover:bg-indigo-500/20 hover:text-indigo-400 hover:border-indigo-500/40 hover:shadow-[0_0_8px_rgba(99,102,241,0.2)]"
                )}
              >
                {isSelected ? (
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <div className="w-3.5 h-3.5 rounded border-2 border-current" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-gray-900 text-white border-gray-700">
              {isSelected ? 'Deselect' : 'Select'}
            </TooltipContent>
          </Tooltip>
        )}
        
        {/* Favorite Star */}
        {onToggleFavorite && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleFavorite}
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 border border-transparent",
                  isFavorite
                    ? "bg-amber-500/30 text-amber-300 border-amber-400/60 shadow-[0_0_10px_rgba(251,191,36,0.4)]"
                    : "text-gray-500 hover:bg-amber-500/20 hover:text-amber-400 hover:border-amber-500/40 hover:shadow-[0_0_8px_rgba(251,191,36,0.2)]"
                )}
              >
                <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-gray-900 text-white border-gray-700">
              {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            </TooltipContent>
          </Tooltip>
        )}
        
        {/* Edit Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setShowEditDialog(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 text-gray-500 border border-transparent hover:bg-cyan-500/20 hover:text-cyan-400 hover:border-cyan-500/40 hover:shadow-[0_0_8px_rgba(34,211,238,0.2)]"
            >
              <Edit className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-gray-900 text-white border-gray-700">
            Edit patient
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Main Card */}
      <Card 
        className="flex-1 rounded-xl bg-[#161b22] border border-[#2a3441]/50 transition-all duration-200 hover:border-gray-600/60 hover:bg-[#1a1f26] overflow-hidden"
      >
        {/* Header Row */}
        <div className="px-4 py-2.5 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-500" />
            <span className="text-white font-semibold text-sm truncate max-w-[200px]">
              {patient.patientName?.replace(/\^/g, ', ') || 'Unknown Patient'}
            </span>
          </div>
          <span className="text-gray-400 text-[11px] font-mono bg-gray-800/50 px-1.5 py-0.5 rounded">
            {patient.patientID || '—'}
          </span>
          <span className="text-gray-500 text-xs">
            {patient.patientSex || '?'} · {patient.patientAge || '—'}
          </span>
          {tags.length > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              {tags.slice(0, 2).map(tag => {
                const getTagStyle = (tagName: string) => {
                  const lower = tagName.toLowerCase();
                  if (lower.includes('head') || lower.includes('brain')) {
                    return 'bg-purple-500/20 border-purple-400/50 text-purple-300';
                  } else if (lower.includes('chest') || lower.includes('thorax') || lower.includes('lung')) {
                    return 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300';
                  } else if (lower.includes('abdomen') || lower.includes('pelvis')) {
                    return 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300';
                  } else if (lower.includes('spine') || lower.includes('neck')) {
                    return 'bg-amber-500/20 border-amber-400/50 text-amber-300';
                  } else if (lower.includes('contrast') || lower.includes('gad')) {
                    return 'bg-yellow-500/20 border-yellow-400/50 text-yellow-300';
                  } else if (lower.includes('emergency') || lower.includes('urgent')) {
                    return 'bg-red-500/20 border-red-400/50 text-red-300';
                  } else {
                    return 'bg-gray-500/20 border-gray-400/50 text-gray-300';
                  }
                };
                return (
                  <span
                    key={tag.id}
                    className={`px-2 py-0.5 rounded-md border text-[10px] font-medium ${getTagStyle(tag.tagValue)}`}
                  >
                    {tag.tagValue}
                  </span>
                );
              })}
              {tags.length > 2 && (
                <span className="text-[10px] text-gray-500">+{tags.length - 2}</span>
              )}
            </div>
          )}
        </div>
      
        {/* Series Section */}
        <div className="px-4 py-3 bg-[#0d1117]">
          <div className="space-y-2">
          {/* Study Date Header */}
          {studies.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
              <Calendar className="h-3.5 w-3.5 text-cyan-500/70" />
              <span className="text-gray-300">{getStudyDateDisplay() || 'No date'}</span>
              <span className="text-[#2a3441]">•</span>
              <span className="text-cyan-400/80">{series.filter(s => ['CT', 'MR', 'PT', 'RTSTRUCT'].includes(s.modality)).length} series</span>
            </div>
          )}

          {/* Planning CT (Primary) */}
          {planningCT && renderSeriesCard(planningCT, true)}

          {/* Registered CT Section */}
          {ctSeries.filter(s => s.id !== planningCT?.id).length > 0 && (
            <div className="space-y-1 border-l-2 border-cyan-500/30 pl-2 ml-1">
              <div className="text-[10px] text-cyan-400/80 uppercase tracking-wider font-medium px-1">
                Registered CT
              </div>
              {ctSeries
                .filter(s => s.id !== planningCT?.id)
                .slice(0, isExpanded ? undefined : 2)
                .map((s) => renderSeriesCard(s))}
              {!isExpanded && ctSeries.filter(s => s.id !== planningCT?.id).length > 2 && (
                <div className="text-[10px] text-gray-500 px-2">
                  +{ctSeries.filter(s => s.id !== planningCT?.id).length - 2} more
                </div>
              )}
            </div>
          )}

          {/* RT Structure */}
          {rtStructureSeries.slice(0, isExpanded ? undefined : 1).map((rtS) => (
            <div key={rtS.id} className="border-l-2 border-emerald-500/30 pl-2 ml-1">
              {renderRTCard(rtS)}
            </div>
          ))}

          {/* PET/CT Fusion Section */}
          {(ptSeries.length > 0 || mrSeries.length > 0) && (
            <div className="space-y-1 border-l-2 border-purple-500/30 pl-2 ml-1">
              <div className="flex items-center gap-1.5 text-[10px] text-purple-400/90 uppercase tracking-wider font-medium">
                <Zap className="h-3 w-3" />
                {ptSeries.length > 0 ? 'PET/CT Fusion' : 'MR Fusion'}
              </div>
              
              {/* PET Series */}
              {ptSeries.slice(0, isExpanded ? undefined : 2).map((s) => (
                <div key={s.id} className="flex items-center gap-1">
                  <div className="flex-1">
                    {renderSeriesCard(s)}
                  </div>
                  <Zap className="h-3.5 w-3.5 text-amber-400/60 flex-shrink-0" />
                </div>
              ))}
              
              {/* MR Series */}
              {mrSeries.slice(0, isExpanded ? undefined : 2).map((s) => (
                <div key={s.id} className="flex items-center gap-1">
                  <div className="flex-1">
                    {renderSeriesCard(s)}
                  </div>
                  <Zap className="h-3.5 w-3.5 text-purple-400/60 flex-shrink-0" />
                </div>
              ))}
              
              {!isExpanded && (ptSeries.length + mrSeries.length) > 4 && (
                <div className="text-[10px] text-gray-500 px-2">
                  +{(ptSeries.length + mrSeries.length) - 4} more
                </div>
              )}

              {/* Registration indicator */}
              {registrationSeries.length > 0 && (
                <div className="flex items-center gap-2 px-2 py-1 text-xs text-cyan-400/70">
                  <Badge className={cn("flex-shrink-0", pillClassForModality('REG'))}>
                    RT
                  </Badge>
                  <span>Image Registration</span>
                  <History className="h-3.5 w-3.5 text-gray-500 ml-auto" />
                </div>
              )}
            </div>
          )}

          {/* Other Series - Collapsed by default */}
          {!isExpanded && series.filter(s => !['CT', 'MR', 'PT', 'PET', 'RTSTRUCT', 'REG'].includes(s.modality)).length > 0 && (
            <button
              onClick={() => setIsExpanded(true)}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-gray-400 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-colors"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              <span>Other Series ({series.filter(s => !['CT', 'MR', 'PT', 'PET', 'RTSTRUCT', 'REG'].includes(s.modality)).length})</span>
            </button>
          )}

          {/* Expanded Content - Detailed Item List */}
          {isExpanded && (
            <div className="mt-3 space-y-3 pt-3 border-t border-gray-800/50">
              {/* Full Study & Series List */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5" />
                  Studies & Series
                </h4>
                <div className="space-y-2">
                  {studiesWithSeries.map((study) => (
                    <div key={study.id} className="bg-gray-900/40 rounded-lg overflow-hidden">
                      {/* Study Header */}
                      <div className="flex items-center justify-between px-2.5 py-2 bg-gray-800/50 border-b border-gray-700/30">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FolderOpen className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                          <span className="text-xs font-medium text-white truncate">
                            {study.studyDescription || 'Unnamed Study'}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {study.studyDate || 'No date'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-gray-600 text-gray-400">
                            {study.series?.length || 0} series
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!confirm(`Delete study "${study.studyDescription || 'Unnamed'}" and all its series?`)) return;
                              try {
                                const res = await fetch(`/api/studies/${study.id}`, { method: 'DELETE' });
                                if (res.ok) {
                                  toast({ title: "Study deleted", description: "Study and all series removed." });
                                  onUpdate?.();
                                }
                              } catch (err) {
                                toast({ title: "Error", description: "Failed to delete study.", variant: "destructive" });
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Series List */}
                      <div className="divide-y divide-gray-700/20">
                        {study.series?.map((s: any) => (
                          <div key={s.id} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-gray-700/20 transition-colors group">
                            <Badge className={cn("flex-shrink-0 h-5 text-[10px]", pillClassForModality(s.modality))}>
                              {s.modality}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-gray-300 truncate">
                                {formatSeriesLabel(s)}
                              </div>
                              <div className="text-[10px] text-gray-500">
                                {s.imageCount || 0} images
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSeriesPreview(s);
                                }}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!confirm(`Delete series "${s.seriesDescription || s.modality}"?`)) return;
                                  try {
                                    const res = await fetch(`/api/series/${s.id}`, { method: 'DELETE' });
                                    if (res.ok) {
                                      toast({ title: "Series deleted", description: "Series removed." });
                                      onUpdate?.();
                                    }
                                  } catch (err) {
                                    toast({ title: "Error", description: "Failed to delete series.", variant: "destructive" });
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RT Structures with details */}
              {rtStructureSeries.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-green-400 flex items-center gap-1.5">
                    <Brain className="h-3.5 w-3.5" />
                    RT Structures
                  </h4>
                  {rtStructureSeries.map((rtSeries) => (
                    <div key={rtSeries.id}>
                      {loadingStructures[rtSeries.id] ? (
                        <div className="flex items-center gap-2 text-gray-400 text-xs">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading structures...
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {rtStructures[rtSeries.id]?.map((structure: any) => (
                            <div 
                              key={structure.roiNumber}
                              className="flex items-center gap-1 bg-gray-800/50 px-1.5 py-0.5 rounded text-[10px]"
                            >
                              <div 
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ 
                                  backgroundColor: structure.color 
                                    ? `rgb(${structure.color[0]}, ${structure.color[1]}, ${structure.color[2]})`
                                    : '#666'
                                }}
                              />
                              <span className="text-gray-300 truncate max-w-[100px]">
                                {structure.structureName}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Fusion Mapping */}
              {associationData?.associations?.length ? (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-orange-400 flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5" />
                    Fusion Mapping
                  </h4>
                  <div className="space-y-2">
                    {associationData.associations.map((assoc, idx) => {
                      const allSeries = studiesWithSeries.flatMap(study => study.series);
                      const targetSeries = allSeries.find(s => s.id === assoc.targetSeriesId);
                      const sourceSeries = assoc.sourcesSeriesIds.map(id => allSeries.find(s => s.id === id)).filter(Boolean);
                      
                      return (
                        <div key={idx} className="bg-gray-800/30 rounded-lg p-2 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            {sourceSeries.map(s => (
                              <span key={s.id} className="flex items-center gap-1">
                                <Badge className={cn("flex-shrink-0 h-5", pillClassForModality(s.modality))}>
                                  {s.modality}
                                </Badge>
                                <span className="text-gray-400 text-[10px]">{s.id}</span>
                              </span>
                            ))}
                            <ArrowRight className="h-3 w-3 text-orange-400" />
                            {targetSeries && (
                              <span className="flex items-center gap-1 text-green-400">
                                <Badge className={cn("flex-shrink-0 h-5", pillClassForModality(targetSeries.modality))}>
                                  {targetSeries.modality}
                                </Badge>
                                <span className="text-[10px]">{targetSeries.id} (Primary)</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#161b22]">
          <div className="flex items-center gap-1.5">
            <Link href={`/enhanced-viewer?patientId=${patient.patientID}`}>
              <Button 
                variant="outline"
                size="sm" 
                className="h-7 px-3 bg-cyan-950/50 border-cyan-600/50 text-cyan-400 hover:bg-cyan-900/50 hover:border-cyan-500/70 hover:text-cyan-300 rounded-lg transition-all duration-200"
                onClick={onPatientOpened}
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                <span className="text-xs font-medium">Open Viewer</span>
              </Button>
            </Link>
            {hasFusion && (
              <Link href={`/fusion-test?patientId=${patient.patientID}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-3 text-purple-400 hover:text-purple-300 hover:bg-purple-500/15 rounded-md transition-all duration-200"
                >
                  <Layers className="h-3.5 w-3.5 mr-1.5" />
                  <span className="text-xs font-medium">Fusion</span>
                </Button>
              </Link>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 px-2 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ChevronDown className={`h-3.5 w-3.5 mr-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            Details
          </Button>
        </div>
    </Card>
      
    {/* Metadata Edit Dialog */}
    <MetadataEditDialog
      open={showEditDialog}
      onClose={() => setShowEditDialog(false)}
      patient={patient}
      studies={studies}
      series={series}
      onUpdate={() => {
        if (patient) {
          fetch(`/api/patients/${patient.id}/tags`)
            .then(res => res.json())
            .then(data => setTags(data))
            .catch(err => console.error('Error loading tags:', err));
        }
        if (onUpdate) {
          onUpdate();
        }
      }}
    />
    </div>
    </TooltipProvider>
  );
}
