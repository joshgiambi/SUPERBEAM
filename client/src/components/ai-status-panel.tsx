/**
 * AI Status Panel
 *
 * Shows availability status for SAM (Segment Anything Model) server.
 * SAM is used for both 2D and 3D segmentation.
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
  Zap,
  Server,
  Info
} from 'lucide-react';
import { samServerClient } from '@/lib/sam-server-client';

interface SAMStatus {
  available: boolean;
  loading: boolean;
  starting: boolean;
  device?: string;
  error?: string;
}

export function AIStatusPanel() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<SAMStatus>({
    available: false,
    loading: true,
    starting: false,
  });
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkStatus = async () => {
    setStatus(prev => ({ ...prev, loading: true, error: undefined }));

    try {
      const health = await samServerClient.checkHealth();
      setStatus({
        available: true,
        loading: false,
        starting: false,
        device: health.device || 'CPU',
      });
    } catch (err: any) {
      setStatus({
        available: false,
        loading: false,
        starting: false,
        error: err.message || 'Server offline',
      });
    }

    setLastChecked(new Date());
  };

  const handleStartServer = async () => {
    setStatus(prev => ({ ...prev, starting: true, error: undefined }));
    
    try {
      const result = await samServerClient.startServer();
      
      if (result.status === 'started' || result.status === 'already_running') {
        setStatus({
          available: true,
          loading: false,
          starting: false,
          device: result.device || 'CPU',
        });
      } else if (result.status === 'starting') {
        // Poll for readiness
        let attempts = 0;
        const maxAttempts = 20;
        const poll = async () => {
          try {
            await samServerClient.checkHealth();
            setStatus({
              available: true,
              loading: false,
              starting: false,
            });
          } catch {
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(poll, 3000);
            } else {
              setStatus({
                available: false,
                loading: false,
                starting: false,
                error: 'Server failed to start',
              });
            }
          }
        };
        setTimeout(poll, 3000);
      } else {
        setStatus({
          available: false,
          loading: false,
          starting: false,
          error: result.message || 'Failed to start server',
        });
      }
    } catch (err: any) {
      setStatus({
        available: false,
        loading: false,
        starting: false,
        error: err.message || 'Failed to start server',
      });
    }
  };

  // Check status when panel opens
  useEffect(() => {
    if (open) {
      checkStatus();
    }
  }, [open]);

  // Initial check on mount
  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`group h-8 px-3 text-white/90 hover:text-cyan-400 hover:bg-cyan-600/20 hover:border-cyan-500/50 hover:shadow-md hover:shadow-cyan-500/20 border border-transparent rounded-lg transition-all duration-200 ${
            status.loading || status.starting ? 'opacity-70' : ''
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5 text-white/90 group-hover:!text-cyan-400 transition-colors duration-200" />
          <span className="text-xs font-medium">AI</span>
          {status.available && (
            <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          )}
          {status.starting && (
            <Loader2 className="ml-1.5 h-3 w-3 text-amber-400 animate-spin" />
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
              <h3 className="font-semibold text-sm text-white">AI Segmentation</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={checkStatus}
              disabled={status.loading}
              className="h-7 w-7 p-0 hover:bg-gray-800"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-gray-400 ${status.loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* SAM Status */}
          <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/30">
            <div className="flex items-start gap-3">
              {/* Status Icon */}
              <div className="mt-0.5">
                {status.loading ? (
                  <Loader2 className="h-4 w-4 text-cyan-400 animate-spin" />
                ) : status.starting ? (
                  <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />
                ) : status.available ? (
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-white">SAM Server</span>
                  <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30">
                    <Server className="w-2.5 h-2.5" />
                    Server
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">Segment Anything Model</p>
                
                {status.loading ? (
                  <p className="text-xs text-gray-400 mt-1">Checking status...</p>
                ) : status.starting ? (
                  <p className="text-xs text-amber-400 mt-1">Starting server (may take ~60s)...</p>
                ) : status.available ? (
                  <p className="text-xs text-green-400 mt-1">
                    Ready • Device: {status.device || 'CPU'}
                  </p>
                ) : (
                  <p className="text-xs text-red-400 mt-1">
                    {status.error || 'Server offline'}
                  </p>
                )}
              </div>

              {/* Action Button */}
              {!status.available && !status.loading && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStartServer}
                  disabled={status.starting}
                  className="h-7 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                >
                  {status.starting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Zap className="h-3 w-3 mr-1" />
                      Start
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 text-cyan-400 flex-shrink-0" />
              <div className="text-xs text-cyan-300/90">
                <p className="font-medium mb-1">Usage:</p>
                <ul className="space-y-0.5 text-cyan-300/70">
                  <li>• <strong>2D Mode:</strong> Click → segment current slice</li>
                  <li>• <strong>3D Mode:</strong> Click → propagate through slices</li>
                </ul>
                <p className="mt-2 text-cyan-300/50 text-[10px]">
                  Select AI tool in contour toolbar, then click on target structure.
                </p>
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
