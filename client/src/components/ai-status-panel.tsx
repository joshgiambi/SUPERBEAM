/**
 * AI Status Panel
 *
 * Shows availability status for AI services:
 * - SAM (Segment Anything) - Client-side ONNX model for 2D segmentation
 * - SuperSeg - Server-side U-Net for 3D brain tumor segmentation
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Download,
  Server,
  Cpu,
  Info
} from 'lucide-react';
import { samController } from '@/lib/sam-controller';
import { supersegClient } from '@/lib/superseg-client';

interface ServiceStatus {
  id: string;
  name: string;
  description: string;
  type: 'client' | 'server';
  available: boolean;
  loading: boolean;
  details?: string;
  error?: string;
  action?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
  };
}

export function AIStatusPanel() {
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState<ServiceStatus[]>([
    { 
      id: 'sam',
      name: 'SAM', 
      description: '2D point-to-contour segmentation',
      type: 'client',
      available: false, 
      loading: false 
    },
    { 
      id: 'superseg',
      name: 'SuperSeg', 
      description: '3D brain tumor segmentation',
      type: 'server',
      available: false, 
      loading: true 
    },
  ]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [samLoading, setSamLoading] = useState(false);

  const checkAllServices = async () => {
    setServices(prev => prev.map(s => ({ ...s, loading: true, error: undefined })));

    // Check SAM (client-side)
    const samReady = samController.isReady();
    const samInitializing = samController.isInitializing();

    // Check SuperSeg (server-side)
    let supersegAvailable = false;
    let supersegDetails = 'Service offline';
    let supersegError: string | undefined;

    try {
      const health = await supersegClient.checkHealth();
      supersegAvailable = health.status === 'ok';
      supersegDetails = supersegAvailable 
        ? `Device: ${health.device || 'CPU'}`
        : 'Service not responding';
    } catch (err: any) {
      supersegError = err.message || 'Connection failed';
    }

    setServices([
      {
        id: 'sam',
        name: 'SAM',
        description: '2D point-to-contour segmentation',
        type: 'client',
        available: samReady,
        loading: samInitializing,
        details: samReady 
          ? 'Models loaded (~200MB)' 
          : samInitializing 
            ? 'Downloading models...'
            : 'Not loaded (click to download)',
        action: !samReady && !samInitializing ? {
          label: 'Load',
          onClick: handleLoadSAM,
          loading: samLoading,
        } : undefined,
      },
      {
        id: 'superseg',
        name: 'SuperSeg',
        description: '3D brain tumor segmentation',
        type: 'server',
        available: supersegAvailable,
        loading: false,
        details: supersegDetails,
        error: supersegError,
      },
    ]);

    setLastChecked(new Date());
  };

  const handleLoadSAM = async () => {
    setSamLoading(true);
    try {
      await samController.initialize();
      await checkAllServices();
    } catch (err) {
      console.error('Failed to load SAM:', err);
    } finally {
      setSamLoading(false);
    }
  };

  // Check services when panel opens
  useEffect(() => {
    if (open) {
      checkAllServices();
    }
  }, [open]);

  // Initial check on mount
  useEffect(() => {
    checkAllServices();
  }, []);

  const anyAvailable = services.some(s => s.available);
  const anyLoading = services.some(s => s.loading);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`group h-8 px-3 text-white/90 hover:text-cyan-400 hover:bg-cyan-600/20 hover:border-cyan-500/50 hover:shadow-md hover:shadow-cyan-500/20 border border-transparent rounded-lg transition-all duration-200 ${
            anyLoading ? 'opacity-70' : ''
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5 text-white/90 group-hover:!text-cyan-400 transition-colors duration-200" />
          <span className="text-xs font-medium">AI</span>
          {anyAvailable && (
            <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 shadow-2xl"
        align="end"
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-gray-700/50">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <h3 className="font-semibold text-sm text-white">AI Services</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={checkAllServices}
              disabled={anyLoading}
              className="h-7 w-7 p-0 hover:bg-gray-800"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-gray-400 ${anyLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Services */}
          <div className="space-y-3">
            {services.map((service) => (
              <div
                key={service.id}
                className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/30"
              >
                <div className="flex items-start gap-3">
                  {/* Status Icon */}
                  <div className="mt-0.5">
                    {service.loading ? (
                      <Loader2 className="h-4 w-4 text-cyan-400 animate-spin" />
                    ) : service.available ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-500" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-white">{service.name}</span>
                      {service.type === 'client' ? (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30">
                          <Cpu className="w-2.5 h-2.5" />
                          Client
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30">
                          <Server className="w-2.5 h-2.5" />
                          Server
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{service.description}</p>
                    <p className="text-xs text-gray-400 mt-1">{service.details}</p>
                    {service.error && (
                      <p className="text-xs text-red-400 mt-1">{service.error}</p>
                    )}
                  </div>

                  {/* Action Button */}
                  {service.action && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={service.action.onClick}
                      disabled={service.action.loading}
                      className="h-7 px-2 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                    >
                      {service.action.loading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Download className="h-3 w-3 mr-1" />
                          {service.action.label}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Info Box */}
          <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 text-cyan-400 flex-shrink-0" />
              <div className="text-xs text-cyan-300/90">
                <p className="font-medium mb-1">Usage:</p>
                <ul className="space-y-0.5 text-cyan-300/70">
                  <li>• <strong>SAM 2D:</strong> AI Tool → Click 2D mode</li>
                  <li>• <strong>SuperSeg 3D:</strong> AI Tool → Click 3D mode</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Last Checked */}
          {lastChecked && (
            <p className="text-[10px] text-gray-500 text-center">
              Last checked: {lastChecked.toLocaleTimeString()}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
