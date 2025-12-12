import { Route, Switch } from "wouter";
import { useQuery } from "react-query";
import { useState, useEffect } from "react";
import { FlexibleFusionLayout } from "@/components/dicom/flexible-fusion-layout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function OHIFPrototypeGemini() {
  const { toast } = useToast();
  // Fixed test patient ID as requested
  const patientId = "OZa7UswspYAakrgYemxMdqy1E"; 
  
  const [primarySeriesId, setPrimarySeriesId] = useState<number | null>(null);
  const [secondarySeriesIds, setSecondarySeriesIds] = useState<number[]>([]);
  const [studyId, setStudyId] = useState<number | null>(null);
  const [availableSeries, setAvailableSeries] = useState<any[]>([]);
  
  // Load patient data
  useEffect(() => {
    const loadData = async () => {
      try {
        // 1. Find patient
        const patientRes = await fetch(`/api/patients/${patientId}`);
        if (!patientRes.ok) throw new Error("Patient not found");
        const patient = await patientRes.json();
        
        // 2. Find first study
        if (patient.studies && patient.studies.length > 0) {
          const study = patient.studies[0];
          setStudyId(study.id);
          
          // 3. Load series for study
          const seriesRes = await fetch(`/api/studies/${study.id}/series`);
          if (!seriesRes.ok) throw new Error("Failed to load series");
          const series = await seriesRes.json();
          setAvailableSeries(series);
          
          // 4. Select Primary (CT) and Secondaries (PT, MR, DOSE)
          const ct = series.find((s: any) => s.modality === 'CT');
          if (ct) {
            setPrimarySeriesId(ct.id);
            
            // Find valid secondaries
            const secondaries = series
              .filter((s: any) => s.id !== ct.id && ['PT', 'MR', 'RTDOSE'].includes(s.modality))
              .map((s: any) => s.id);
            setSecondarySeriesIds(secondaries);
          } else {
             toast({ title: "No CT Found", description: "Could not find a primary CT series for this patient.", variant: "destructive" });
          }
        }
      } catch (e) {
        console.error(e);
        toast({ title: "Error", description: "Failed to load prototype data", variant: "destructive" });
      }
    };
    
    loadData();
  }, [patientId]);

  if (!primarySeriesId || !studyId) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          <h2 className="text-xl font-semibold">Loading OHIF Gemini Prototype...</h2>
          <p className="text-gray-400 text-sm">Patient: {patientId}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black flex flex-col overflow-hidden">
      {/* OHIF-style Header */}
      <div className="h-12 bg-[#090c29] border-b border-[#3e5cc9]/30 flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-xs">
            OHIF
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-sm leading-none">GEMINI PROTOTYPE</span>
            <span className="text-cyan-400 text-[10px] leading-none mt-1">v3.11 Feature Set</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-xs font-mono text-gray-400">
          <div>PATIENT: <span className="text-white">TEST-GEMINI</span></div>
          <div>STUDY: <span className="text-white">Multi-Modal Fusion</span></div>
        </div>
      </div>
      
      {/* Main Viewport Grid */}
      <div className="flex-1 relative overflow-hidden">
        <FlexibleFusionLayout
          primarySeriesId={primarySeriesId}
          secondarySeriesIds={secondarySeriesIds}
          studyId={studyId}
          availableSeries={availableSeries}
          fusionOpacity={0.5}
          onFusionOpacityChange={() => {}}
          selectedFusionSecondaryId={secondarySeriesIds[0] || null}
          onSecondarySeriesSelect={() => {}}
          fusionDisplayMode="overlay"
          fusionLayoutPreset="side-by-side"
          isMPRVisible={false}
          onMPRToggle={() => {}}
        />
      </div>
    </div>
  );
}

