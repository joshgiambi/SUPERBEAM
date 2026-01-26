/**
 * Regulatory Compliance Dashboard
 * 
 * A professional living submission document for FDA 510(k) preparation
 * Displays requirements traceability, test coverage, and compliance metrics
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  FileText,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Download,
  ChevronRight,
  Activity,
  GitCommit,
  FileCode,
  TestTube,
  BookOpen,
  Target,
  BarChart3,
  AlertCircle,
  ExternalLink,
  Code2,
  Layers,
  Play,
  Eye,
  Copy,
  Check,
  Building2,
  Scale,
  Stethoscope,
  Cpu,
  Database,
  TrendingUp,
  Calendar,
  Users,
  Zap,
} from 'lucide-react';

interface TestFile {
  name: string;
  path: string;
  content: string;
  testCount: number;
  passedCount: number;
  categories: string[];
}

interface RegulatoryData {
  requirements: {
    version: string;
    generatedAt: string;
    totalRequirements: number;
    byCategory: Record<string, number>;
    byRisk: Record<string, number>;
    requirements: Array<{
      id: string;
      title: string;
      description: string;
      category: string;
      riskClass: string;
      sourceFile: string;
      sourceType: string;
      relatedTests: string[];
      status: string;
      createdDate: string;
      lastModified: string;
    }>;
  };
  changeControl: {
    repositoryInfo: {
      totalCommits: number;
      firstCommit: string;
      lastCommit: string;
      contributors: string[];
      branch: string;
    };
    commits: Array<{
      shortHash: string;
      hash: string;
      date: string;
      author: string;
      subject: string;
      regulatoryDescription: string;
      affectedCategories: string[];
      changeType: string;
      riskImpact: 'high' | 'medium' | 'low' | 'none';
      verificationStatus: 'verified' | 'pending' | 'not-required';
      requirementIds: string[];
    }>;
    byCategory: Record<string, number>;
    byChangeType: Record<string, number>;
  };
  traceability: {
    generatedAt: string;
    entries: Array<{
      requirementId: string;
      title: string;
      category: string;
      riskClass: string;
      designRef: string;
      implementationRef: string;
      verificationRef: string;
      validationStatus: string;
      relatedChanges: string[];
    }>;
  };
  testFiles: TestFile[];
  summary: {
    totalRequirements: number;
    verifiedCount: number;
    partialCount: number;
    pendingCount: number;
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
    coveragePercent: number;
    lastGenerated: string;
    categories: Array<{ name: string; count: number; verified: number }>;
    testSummary: {
      totalTests: number;
      totalTestFiles: number;
      categories: string[];
    };
  };
}

function RiskBadge({ risk }: { risk: string }) {
  const variants: Record<string, { color: string; icon: React.ReactNode }> = {
    high: { color: 'bg-red-500/20 text-red-400 border-red-500/50', icon: <AlertCircle className="w-3 h-3" /> },
    medium: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50', icon: <AlertTriangle className="w-3 h-3" /> },
    low: { color: 'bg-green-500/20 text-green-400 border-green-500/50', icon: <CheckCircle2 className="w-3 h-3" /> },
  };
  
  const variant = variants[risk] || variants.low;
  
  return (
    <Badge variant="outline" className={`${variant.color} gap-1`}>
      {variant.icon}
      {risk.charAt(0).toUpperCase() + risk.slice(1)}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    complete: { color: 'bg-green-500/20 text-green-400 border-green-500/50', label: 'Verified', icon: <CheckCircle2 className="w-3 h-3" /> },
    partial: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/50', label: 'Implemented', icon: <Code2 className="w-3 h-3" /> },
    pending: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/50', label: 'Pending', icon: <Clock className="w-3 h-3" /> },
  };
  
  const variant = variants[status] || variants.pending;
  
  return (
    <Badge variant="outline" className={`${variant.color} gap-1`}>
      {variant.icon}
      {variant.label}
    </Badge>
  );
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon,
  color = 'blue',
  trend,
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  icon: any;
  color?: string;
  trend?: { value: string; positive: boolean };
}) {
  const colors: Record<string, string> = {
    blue: 'from-blue-500/10 to-blue-600/5 border-blue-500/20 hover:border-blue-500/40',
    green: 'from-green-500/10 to-green-600/5 border-green-500/20 hover:border-green-500/40',
    yellow: 'from-yellow-500/10 to-yellow-600/5 border-yellow-500/20 hover:border-yellow-500/40',
    red: 'from-red-500/10 to-red-600/5 border-red-500/20 hover:border-red-500/40',
    purple: 'from-purple-500/10 to-purple-600/5 border-purple-500/20 hover:border-purple-500/40',
    cyan: 'from-cyan-500/10 to-cyan-600/5 border-cyan-500/20 hover:border-cyan-500/40',
  };
  
  const iconColors: Record<string, string> = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
    purple: 'text-purple-400',
    cyan: 'text-cyan-400',
  };
  
  return (
    <Card className={`bg-gradient-to-br ${colors[color]} border transition-all duration-200`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            {trend && (
              <div className={`flex items-center gap-1 text-xs ${trend.positive ? 'text-green-400' : 'text-red-400'}`}>
                <TrendingUp className={`w-3 h-3 ${!trend.positive ? 'rotate-180' : ''}`} />
                {trend.value}
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl bg-black/20 ${iconColors[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CodeViewer({ content, filename }: { content: string; filename: string }) {
  const [copied, setCopied] = useState(false);
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10">
        <Button size="sm" variant="ghost" onClick={copyToClipboard}>
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>
      <pre className="text-xs overflow-auto bg-black/40 p-4 rounded-lg border border-white/10 max-h-[500px]">
        <code className="language-typescript">{content}</code>
      </pre>
    </div>
  );
}

function CategoryCoverageChart({ categories }: { categories: Array<{ name: string; count: number; verified: number }> }) {
  return (
    <div className="space-y-4">
      {categories.slice(0, 12).map((cat) => {
        const pct = Math.round((cat.verified / cat.count) * 100);
        return (
          <div key={cat.name} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground truncate max-w-[180px]" title={cat.name}>
                {cat.name}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">
                  {cat.verified}/{cat.count}
                </span>
                <Badge variant="outline" className={`text-xs ${pct === 100 ? 'bg-green-500/20 text-green-400' : pct > 50 ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {pct}%
                </Badge>
              </div>
            </div>
            <div className="relative h-2 bg-black/30 rounded-full overflow-hidden">
              <div 
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : pct > 50 ? 'bg-blue-500' : 'bg-yellow-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function RegulatoryDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [selectedTest, setSelectedTest] = useState<TestFile | null>(null);
  
  const { data, isLoading, error, refetch } = useQuery<RegulatoryData>({
    queryKey: ['regulatory-data'],
    queryFn: async () => {
      const res = await fetch('/api/regulatory/data');
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch regulatory data');
      }
      return res.json();
    },
    staleTime: 60000,
    retry: false,
  });
  
  const { data: docContent, isLoading: docLoading } = useQuery({
    queryKey: ['regulatory-doc', activeDoc],
    queryFn: async () => {
      if (!activeDoc) return null;
      const res = await fetch(`/api/regulatory/docs/${activeDoc}`);
      if (!res.ok) throw new Error('Failed to fetch document');
      return res.json();
    },
    enabled: !!activeDoc,
  });
  
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/regulatory/regenerate', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to regenerate');
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Documentation Regenerated',
        description: 'All regulatory documentation has been updated from the codebase.',
      });
      queryClient.invalidateQueries({ queryKey: ['regulatory-data'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Regeneration Failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-500/30 rounded-full animate-pulse" />
            <RefreshCw className="w-8 h-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-blue-400" />
          </div>
          <p className="text-muted-foreground">Loading regulatory documentation...</p>
        </div>
      </div>
    );
  }
  
  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-8">
        <div className="max-w-2xl mx-auto mt-20">
          <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/30">
            <CardHeader>
              <CardTitle className="text-red-400 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                Documentation Not Generated
              </CardTitle>
              <CardDescription className="text-red-300/70">
                Regulatory documentation needs to be generated from your codebase
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-muted-foreground">
                The regulatory compliance system automatically extracts requirements, tracks changes, 
                and generates traceability documentation from your codebase. Run the generation script to get started.
              </p>
              
              <div className="bg-black/30 p-4 rounded-lg border border-white/10">
                <p className="text-xs text-muted-foreground mb-2">Run this command in your terminal:</p>
                <code className="text-sm font-mono text-green-400">
                  npx tsx scripts/regulatory/run-all.ts
                </code>
              </div>
              
              <div className="flex gap-3">
                <Button 
                  onClick={() => regenerateMutation.mutate()} 
                  disabled={regenerateMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {regenerateMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Generate Now
                </Button>
                <Link href="/">
                  <Button variant="outline">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to App
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  const { summary, requirements, changeControl, traceability, testFiles } = data;
  
  // Calculate readiness score
  const readinessScore = Math.round(
    (summary.coveragePercent * 0.4) + 
    ((summary.verifiedCount / summary.totalRequirements) * 100 * 0.3) +
    ((testFiles.length > 0 ? 50 : 0) + (summary.testSummary.totalTests > 10 ? 50 : summary.testSummary.totalTests * 5)) * 0.3
  );
  
  const getReadinessStatus = (score: number) => {
    if (score >= 80) return { label: 'Ready for Review', color: 'green', icon: CheckCircle2 };
    if (score >= 60) return { label: 'Nearly Ready', color: 'yellow', icon: Clock };
    if (score >= 40) return { label: 'In Progress', color: 'blue', icon: Activity };
    return { label: 'Early Stage', color: 'red', icon: AlertTriangle };
  };
  
  const readiness = getReadinessStatus(readinessScore);
  
  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Professional Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl flex-shrink-0 z-50">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-white">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <Separator orientation="vertical" className="h-8" />
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
                  <Shield className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold">Regulatory Compliance Hub</h1>
                  <p className="text-xs text-muted-foreground">
                    CONVERGE Medical Imaging Viewer • FDA 510(k) Documentation
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/30 border border-white/10">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Updated: {new Date(summary.lastGenerated).toLocaleDateString()}
                </span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => regenerateMutation.mutate()}
                disabled={regenerateMutation.isPending}
              >
                {regenerateMutation.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Regenerate
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto">
        <main className="container mx-auto px-6 py-8 space-y-8">
        {/* Hero Section - Compliance Overview */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Readiness Score Card */}
          <Card className="lg:col-span-1 bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-white/10 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5" />
            <CardContent className="pt-6 relative">
              <div className="text-center space-y-4">
                <p className="text-sm font-medium text-muted-foreground">Submission Readiness</p>
                <div className="relative inline-flex">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      className="text-white/5"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${(readinessScore / 100) * 352} 352`}
                      className={`${readiness.color === 'green' ? 'text-green-500' : readiness.color === 'yellow' ? 'text-yellow-500' : readiness.color === 'blue' ? 'text-blue-500' : 'text-red-500'} transition-all duration-1000`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <span className="text-3xl font-bold">{readinessScore}</span>
                      <span className="text-lg text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className={`${readiness.color === 'green' ? 'bg-green-500/20 text-green-400 border-green-500/50' : readiness.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' : readiness.color === 'blue' ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'bg-red-500/20 text-red-400 border-red-500/50'}`}>
                  <readiness.icon className="w-3 h-3 mr-1" />
                  {readiness.label}
                </Badge>
              </div>
            </CardContent>
          </Card>
          
          {/* Key Metrics */}
          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              title="Requirements"
              value={summary.totalRequirements}
              subtitle="Total tracked"
              icon={FileText}
              color="blue"
            />
            <MetricCard
              title="Verified"
              value={`${summary.coveragePercent}%`}
              subtitle={`${summary.verifiedCount} with tests`}
              icon={CheckCircle2}
              color="green"
            />
            <MetricCard
              title="High Risk"
              value={summary.highRiskCount}
              subtitle="Critical items"
              icon={AlertTriangle}
              color="red"
            />
            <MetricCard
              title="Test Cases"
              value={summary.testSummary.totalTests}
              subtitle={`${summary.testSummary.totalTestFiles} files`}
              icon={TestTube}
              color="purple"
            />
          </div>
        </section>
        
        {/* Device Classification Banner */}
        <Card className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-cyan-500/10 border-white/10">
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-400" />
                  <span className="text-sm"><strong>Regulatory Body:</strong> FDA</span>
                </div>
                <div className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-purple-400" />
                  <span className="text-sm"><strong>Classification:</strong> Class II Medical Device</span>
                </div>
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-cyan-400" />
                  <span className="text-sm"><strong>Pathway:</strong> 510(k) Premarket Notification</span>
                </div>
              </div>
              <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/50">
                21 CFR 892.2050
              </Badge>
            </div>
          </CardContent>
        </Card>
        
        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-black/40 border border-white/10 p-1 h-12">
            <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300">
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="requirements" className="gap-2 data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300">
              <FileText className="w-4 h-4" />
              Requirements
            </TabsTrigger>
            <TabsTrigger value="traceability" className="gap-2 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
              <Target className="w-4 h-4" />
              Traceability
            </TabsTrigger>
            <TabsTrigger value="tests" className="gap-2 data-[state=active]:bg-green-500/20 data-[state=active]:text-green-300">
              <TestTube className="w-4 h-4" />
              Verification
            </TabsTrigger>
            <TabsTrigger value="changes" className="gap-2 data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-300">
              <GitCommit className="w-4 h-4" />
              Changes
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2 data-[state=active]:bg-red-500/20 data-[state=active]:text-red-300">
              <BookOpen className="w-4 h-4" />
              Documents
            </TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Risk Distribution */}
              <Card className="bg-black/20 border-white/10">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    Risk Classification
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <span className="text-sm font-medium">High Risk</span>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-red-400">{summary.highRiskCount}</span>
                        <p className="text-xs text-muted-foreground">Clinical impact</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm font-medium">Medium Risk</span>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-yellow-400">{summary.mediumRiskCount}</span>
                        <p className="text-xs text-muted-foreground">Data modification</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-medium">Low Risk</span>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-green-400">{summary.lowRiskCount}</span>
                        <p className="text-xs text-muted-foreground">Display only</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Coverage by Category */}
              <Card className="lg:col-span-2 bg-black/20 border-white/10">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-400" />
                    Coverage by Category
                  </CardTitle>
                  <CardDescription>Test coverage across functional areas</CardDescription>
                </CardHeader>
                <CardContent>
                  <CategoryCoverageChart categories={summary.categories} />
                </CardContent>
              </Card>
            </div>
            
            {/* High Risk Items */}
            <Card className="bg-black/20 border-white/10">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  High-Risk Items Requiring Verification
                </CardTitle>
                <CardDescription>
                  These items have direct clinical impact and require test coverage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Requirement</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {traceability.entries
                      .filter(e => e.riskClass === 'high')
                      .slice(0, 10)
                      .map((entry) => (
                        <TableRow key={entry.requirementId}>
                          <TableCell className="font-mono text-xs text-blue-400">
                            {entry.requirementId}
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate">
                            {entry.title}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {entry.category}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={entry.validationStatus} />
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Requirements Tab */}
          <TabsContent value="requirements">
            <Card className="bg-black/20 border-white/10">
              <CardHeader>
                <CardTitle>Software Requirements Specification (SRS)</CardTitle>
                <CardDescription>
                  Version {requirements.version} • {requirements.totalRequirements} requirements extracted from codebase
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {Object.entries(requirements.byCategory).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([category, count]) => {
                    const categoryReqs = requirements.requirements.filter(r => r.category === category);
                    const verifiedCount = categoryReqs.filter(r => r.status === 'verified').length;
                    
                    return (
                      <AccordionItem key={category} value={category} className="border-white/10">
                        <AccordionTrigger className="hover:no-underline hover:bg-white/5 px-4 rounded-lg">
                          <div className="flex items-center justify-between w-full pr-4">
                            <span className="font-medium">{category}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-blue-500/20 text-blue-400">
                                {count as number} requirements
                              </Badge>
                              <Badge variant="outline" className={verifiedCount === categoryReqs.length ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}>
                                {verifiedCount}/{categoryReqs.length} verified
                              </Badge>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4">
                          <ScrollArea className="h-[300px]">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[140px]">ID</TableHead>
                                  <TableHead>Title</TableHead>
                                  <TableHead className="w-[80px]">Risk</TableHead>
                                  <TableHead className="w-[200px]">Source</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {categoryReqs.map((req) => (
                                  <TableRow key={req.id}>
                                    <TableCell className="font-mono text-xs text-blue-400">{req.id}</TableCell>
                                    <TableCell>{req.title}</TableCell>
                                    <TableCell>
                                      <RiskBadge risk={req.riskClass} />
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[200px]" title={req.sourceFile}>
                                      {req.sourceFile.split('/').pop()}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </ScrollArea>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Traceability Tab */}
          <TabsContent value="traceability">
            <Card className="bg-black/20 border-white/10">
              <CardHeader>
                <CardTitle>Requirements Traceability Matrix</CardTitle>
                <CardDescription>
                  Complete mapping from requirements → design → implementation → verification
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px] sticky top-0 bg-slate-900">Requirement</TableHead>
                        <TableHead className="sticky top-0 bg-slate-900">Title</TableHead>
                        <TableHead className="w-[150px] sticky top-0 bg-slate-900">Design Ref</TableHead>
                        <TableHead className="w-[80px] sticky top-0 bg-slate-900">Risk</TableHead>
                        <TableHead className="w-[100px] sticky top-0 bg-slate-900">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {traceability.entries.map((entry) => (
                        <TableRow key={entry.requirementId}>
                          <TableCell className="font-mono text-xs text-blue-400">
                            {entry.requirementId}
                          </TableCell>
                          <TableCell className="max-w-[300px]">
                            <div>
                              <p className="truncate">{entry.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{entry.implementationRef}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-purple-400">
                            {entry.designRef}
                          </TableCell>
                          <TableCell>
                            <RiskBadge risk={entry.riskClass} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={entry.validationStatus} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Tests Tab */}
          <TabsContent value="tests">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-4">
                <Card className="bg-black/20 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-base">Test Files</CardTitle>
                    <CardDescription>{testFiles.length} files • {summary.testSummary.totalTests} test cases</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {testFiles.length === 0 ? (
                      <div className="text-center py-8">
                        <TestTube className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">No test files found</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Add tests to client/src/lib/__tests__/
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {testFiles.map((file) => (
                          <Button
                            key={file.name}
                            variant={selectedTest?.name === file.name ? 'secondary' : 'ghost'}
                            className="w-full justify-start h-auto py-3"
                            onClick={() => setSelectedTest(file)}
                          >
                            <div className="flex items-center gap-3 w-full">
                              <FileCode className="w-4 h-4 text-green-400 flex-shrink-0" />
                              <div className="text-left flex-1 min-w-0">
                                <p className="text-sm truncate">{file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {file.testCount} tests • {file.categories.length} suites
                                </p>
                              </div>
                              <Badge variant="outline" className="bg-green-500/20 text-green-400 flex-shrink-0">
                                {file.testCount}
                              </Badge>
                            </div>
                          </Button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {testFiles.length > 0 && (
                  <Card className="bg-black/20 border-white/10">
                    <CardHeader>
                      <CardTitle className="text-base">Test Categories</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {summary.testSummary.categories.map((cat) => (
                          <Badge key={cat} variant="outline" className="bg-purple-500/20 text-purple-400">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              <div className="lg:col-span-2">
                <Card className="bg-black/20 border-white/10 h-full">
                  <CardHeader>
                    <CardTitle className="text-base">
                      {selectedTest ? selectedTest.name : 'Test Code Viewer'}
                    </CardTitle>
                    {selectedTest && (
                      <CardDescription>{selectedTest.path}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {selectedTest ? (
                      <CodeViewer content={selectedTest.content} filename={selectedTest.name} />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                        <Eye className="w-12 h-12 mb-4 opacity-50" />
                        <p>Select a test file to view its contents</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          
          {/* Changes Tab */}
          <TabsContent value="changes">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card className="bg-black/20 border-white/10">
                  <CardHeader>
                    <CardTitle>Change Control Log</CardTitle>
                    <CardDescription>
                      {changeControl?.repositoryInfo?.totalCommits || 0} tracked changes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-3">
                        {changeControl?.commits?.slice(0, 30).map((commit) => {
                          const typeConfig: Record<string, { icon: string; color: string }> = {
                            feature: { icon: '✨', color: 'text-green-400' },
                            enhancement: { icon: '📈', color: 'text-blue-400' },
                            fix: { icon: '🔧', color: 'text-red-400' },
                            refactor: { icon: '♻️', color: 'text-purple-400' },
                            docs: { icon: '📝', color: 'text-yellow-400' },
                            other: { icon: '📦', color: 'text-gray-400' },
                          };
                          const riskConfig: Record<string, { icon: string; color: string; label: string }> = {
                            high: { icon: '🔴', color: 'bg-red-500/20 text-red-400 border-red-500/50', label: 'High Risk' },
                            medium: { icon: '🟡', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50', label: 'Medium Risk' },
                            low: { icon: '🟢', color: 'bg-green-500/20 text-green-400 border-green-500/50', label: 'Low Risk' },
                            none: { icon: '⚪', color: 'bg-gray-500/20 text-gray-400 border-gray-500/50', label: 'No Risk' },
                          };
                          const config = typeConfig[commit.changeType] || typeConfig.other;
                          const risk = riskConfig[commit.riskImpact] || riskConfig.none;
                          
                          return (
                            <div 
                              key={commit.shortHash}
                              className={`p-4 rounded-lg bg-black/20 border transition-colors ${
                                commit.riskImpact === 'high' ? 'border-red-500/30 hover:border-red-500/50' :
                                commit.riskImpact === 'medium' ? 'border-yellow-500/20 hover:border-yellow-500/40' :
                                'border-white/5 hover:border-white/10'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-xl">{config.icon}</span>
                                  <span className="text-xs">{risk.icon}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <code className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-mono">
                                      {commit.shortHash}
                                    </code>
                                    <span className="text-xs text-muted-foreground">
                                      {commit.date}
                                    </span>
                                    <Badge variant="outline" className={`text-xs ${risk.color}`}>
                                      {risk.label}
                                    </Badge>
                                    {commit.verificationStatus === 'verified' && (
                                      <Badge variant="outline" className="text-xs bg-green-500/20 text-green-400 border-green-500/50">
                                        ✓ Verified
                                      </Badge>
                                    )}
                                    {commit.verificationStatus === 'pending' && (
                                      <Badge variant="outline" className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
                                        Pending Verification
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm font-medium mb-1">{commit.regulatoryDescription || commit.subject}</p>
                                  <div className="flex gap-1 mt-2 flex-wrap">
                                    {commit.affectedCategories.map((cat) => (
                                      <Badge key={cat} variant="outline" className="text-xs bg-black/30">
                                        {cat}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
              
              <div className="space-y-4">
                <Card className="bg-black/20 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-base">Change Types</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(changeControl?.byChangeType || {}).map(([type, count]) => {
                      const icons: Record<string, string> = {
                        feature: '✨',
                        enhancement: '📈',
                        fix: '🔧',
                        refactor: '♻️',
                        docs: '📝',
                        other: '📦',
                      };
                      return (
                        <div key={type} className="flex items-center justify-between p-2 rounded bg-black/20">
                          <span className="flex items-center gap-2">
                            <span>{icons[type] || '📦'}</span>
                            <span className="capitalize text-sm">{type}</span>
                          </span>
                          <Badge variant="secondary">{count as number}</Badge>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
                
                <Card className="bg-black/20 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-base">Risk Impact</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(() => {
                      const riskCounts = { high: 0, medium: 0, low: 0, none: 0 };
                      changeControl?.commits?.forEach(c => {
                        if (c.riskImpact) riskCounts[c.riskImpact]++;
                      });
                      return (
                        <>
                          <div className="flex items-center justify-between p-2 rounded bg-red-500/10 border border-red-500/20">
                            <span className="flex items-center gap-2 text-red-400">
                              <span>🔴</span>
                              <span className="text-sm">High Risk</span>
                            </span>
                            <Badge variant="outline" className="bg-red-500/20 text-red-400">{riskCounts.high}</Badge>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                            <span className="flex items-center gap-2 text-yellow-400">
                              <span>🟡</span>
                              <span className="text-sm">Medium Risk</span>
                            </span>
                            <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400">{riskCounts.medium}</Badge>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-green-500/10 border border-green-500/20">
                            <span className="flex items-center gap-2 text-green-400">
                              <span>🟢</span>
                              <span className="text-sm">Low Risk</span>
                            </span>
                            <Badge variant="outline" className="bg-green-500/20 text-green-400">{riskCounts.low}</Badge>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-gray-500/10 border border-gray-500/20">
                            <span className="flex items-center gap-2 text-gray-400">
                              <span>⚪</span>
                              <span className="text-sm">No Risk</span>
                            </span>
                            <Badge variant="outline" className="bg-gray-500/20 text-gray-400">{riskCounts.none}</Badge>
                          </div>
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
                
                <Card className="bg-black/20 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Contributors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {changeControl?.repositoryInfo?.contributors?.map((contributor) => (
                        <div 
                          key={contributor}
                          className="flex items-center gap-3 p-2 rounded bg-black/20"
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-sm font-medium">
                            {contributor.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm">{contributor}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          
          {/* Documents Tab */}
          <TabsContent value="documents">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <h3 className="font-semibold mb-4 text-sm text-muted-foreground uppercase tracking-wider">
                  Submission Documents
                </h3>
                {[
                  { id: 'srs', name: 'Software Requirements (SRS)', icon: FileText, color: 'blue' },
                  { id: 'traceability', name: 'Traceability Matrix', icon: Target, color: 'purple' },
                  { id: 'verification', name: 'Verification Summary', icon: TestTube, color: 'green' },
                  { id: 'change-control', name: 'Change Control Log', icon: GitCommit, color: 'yellow' },
                ].map((doc) => (
                  <Button
                    key={doc.id}
                    variant={activeDoc === doc.id ? 'secondary' : 'ghost'}
                    className="w-full justify-start h-auto py-3"
                    onClick={() => setActiveDoc(doc.id)}
                  >
                    <doc.icon className={`w-4 h-4 mr-3 text-${doc.color}-400`} />
                    <span className="text-sm">{doc.name}</span>
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </Button>
                ))}
              </div>
              
              <div className="lg:col-span-3">
                <Card className="bg-black/20 border-white/10">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>
                        {activeDoc ? docContent?.filename || 'Loading...' : 'Document Viewer'}
                      </CardTitle>
                      <CardDescription>
                        {activeDoc ? 'Auto-generated from codebase' : 'Select a document to view'}
                      </CardDescription>
                    </div>
                    {activeDoc && docContent && (
                      <Button variant="outline" size="sm" onClick={() => {
                        const blob = new Blob([docContent.content], { type: 'text/markdown' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = docContent.filename;
                        a.click();
                      }}>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[600px]">
                      {docLoading ? (
                        <div className="flex items-center justify-center h-full">
                          <RefreshCw className="w-6 h-6 animate-spin" />
                        </div>
                      ) : docContent?.content ? (
                        <pre className="text-xs whitespace-pre-wrap font-mono bg-black/20 p-4 rounded-lg">
                          {docContent.content}
                        </pre>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                          <BookOpen className="w-12 h-12 mb-4 opacity-50" />
                          <p>Select a document from the left</p>
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Footer */}
        <footer className="pt-8 border-t border-white/10">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-white">CONVERGE Medical Imaging Viewer</p>
              <p className="text-xs mt-1">
                Class II Medical Device • Software as a Medical Device (SaMD) • IEC 62304 Compliant
              </p>
            </div>
            <div className="text-right">
              <p>Documentation auto-generated from codebase</p>
              <p className="text-xs mt-1">
                <code className="bg-black/30 px-2 py-0.5 rounded">npm run regulatory:generate</code>
              </p>
            </div>
          </div>
        </footer>
      </main>
      </div>
    </div>
  );
}
