/**
 * AI Status Panel
 *
 * Shows availability status for key AI services (SegVol, nnInteractive)
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Sparkles, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { segvolClient } from '@/lib/segvol-client';
import { monaiClient } from '@/lib/monai-client';
import { nninteractiveClient } from '@/lib/nninteractive-client';

interface ServiceStatus {
  name: string;
  available: boolean;
  loading: boolean;
  details?: string;
  error?: string;
}

export function AIStatusPanel() {
  const [open, setOpen] = useState(false);
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'SegVol', available: false, loading: true },
    { name: 'MONAI', available: false, loading: true },
    { name: 'nnInteractive', available: false, loading: true },
  ]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkAllServices = async () => {
    setServices(prev => prev.map(s => ({ ...s, loading: true })));

    try {
      // Check all services in parallel
      const [segvolHealth, monaiHealth, nninteractiveHealth] = await Promise.all([
        segvolClient.checkHealth().catch(err => ({
          status: 'error' as const,
          segvol_service: undefined,
          segvol_available: false,
          service_url: '',
          error: err.message,
        })),
        monaiClient.checkHealth().catch(err => ({
          status: 'error' as const,
          monai_service: undefined,
          monai_available: false,
          service_url: '',
          error: err.message,
        })),
        nninteractiveClient.checkHealth().catch(err => ({
          status: 'unavailable' as const,
          nninteractive_available: false,
          device: undefined,
          mock_mode: false,
          error: err.message,
        })),
      ]);

      setServices([
        {
          name: 'SegVol',
          available: segvolHealth.status === 'ok' && segvolHealth.segvol_service?.model_loaded === true,
          loading: false,
          details: segvolHealth.status === 'ok'
            ? `Device: ${segvolHealth.segvol_service?.device || 'unknown'}`
            : 'Service offline',
          error: segvolHealth.error,
        },
        {
          name: 'MONAI',
          available: monaiHealth.status === 'ok' && (monaiHealth.monai_service?.status === 'healthy' || monaiHealth.monai_available === true),
          loading: false,
          details: monaiHealth.status === 'ok'
            ? `Mode: ${monaiHealth.monai_service?.mode || 'unknown'}`
            : 'Service offline',
          error: monaiHealth.error,
        },
        {
          name: 'nnInteractive',
          available: nninteractiveHealth.nninteractive_available === true,
          loading: false,
          details: nninteractiveHealth.nninteractive_available
            ? `Device: ${nninteractiveHealth.device || 'unknown'}${nninteractiveHealth.mock_mode ? ' (Mock)' : ''}`
            : 'Service offline',
          error: nninteractiveHealth.error,
        },
      ]);

      setLastChecked(new Date());
    } catch (error) {
      console.error('Error checking AI services:', error);
      setServices(prev => prev.map(s => ({ ...s, loading: false, error: 'Check failed' })));
    }
  };

  // Check services on mount and when panel opens
  useEffect(() => {
    if (open) {
      checkAllServices();
    }
  }, [open]);

  // Initial check on mount
  useEffect(() => {
    checkAllServices();
  }, []);

  const allAvailable = services.every(s => s.available);
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
          <span className="text-xs font-medium">AI Services</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-gray-900 border-gray-700 text-white">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">AI Service Status</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={checkAllServices}
              disabled={anyLoading}
              className="h-7 w-7 p-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${anyLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          <div className="space-y-2">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-start gap-3 p-2 rounded-md bg-gray-800/50"
              >
                <div className="mt-0.5">
                  {service.loading ? (
                    <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                  ) : service.available ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{service.name}</div>
                  <div className="text-xs text-gray-400 truncate">
                    {service.loading ? 'Checking...' : service.details || 'Unknown'}
                  </div>
                  {service.error && (
                    <div className="text-xs text-red-400 mt-1 truncate">
                      {service.error}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {lastChecked && (
            <div className="text-xs text-gray-500 text-center">
              Last checked: {lastChecked.toLocaleTimeString()}
            </div>
          )}

          <div className="pt-2 border-t border-gray-700">
            <div className="text-xs text-gray-400">
              <div className="font-medium mb-1">Available Tools:</div>
              <ul className="space-y-0.5 ml-2">
                <li>• SegVol: Volume segmentation</li>
                <li>• MONAI: Contour propagation</li>
                <li>• nnInteractive: Tumor segmentation</li>
              </ul>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
