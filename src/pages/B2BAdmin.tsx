import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Lock, Loader2, Building2, Users, CheckCircle, XCircle, Clock,
  FileText, Mail, Phone, MapPin, User, Eye, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface ApplicationSummary {
  id: string;
  email: string;
  representativeName: string;
  phoneNumber: string;
  address: string;
  companyName: string;
  documentName: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

interface ApplicationDetail extends Omit<ApplicationSummary, 'documentName'> {
  document: { name: string; type: string; data: string };
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', variant: 'outline' as const, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  approved: { label: 'Approved', variant: 'default' as const, color: 'text-green-600 bg-green-50 border-green-200' },
  rejected: { label: 'Rejected', variant: 'destructive' as const, color: 'text-red-600 bg-red-50 border-red-200' },
};

function LoginGate({ onLogin }: { onLogin: (key: string) => void }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/b2b-list', { headers: { 'x-admin-key': password } });
      if (res.ok) {
        sessionStorage.setItem('b2b-admin-key', password);
        onLogin(password);
      } else {
        toast.error('Invalid password.', { position: 'top-center' });
      }
    } catch {
      toast.error('Connection error.', { position: 'top-center' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>B2B Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input type="password" placeholder="Enter admin password" value={password}
              onChange={(e) => setPassword(e.target.value)} autoFocus />
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Users; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-lg border p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function DocumentViewer({ document }: { document: { name: string; type: string; data: string } }) {
  const [imgError, setImgError] = useState(false);
  const dataUrl = `data:${document.type};base64,${document.data}`;

  if (document.type === 'application/pdf') {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium flex items-center gap-2"><FileText className="h-4 w-4" />{document.name}</p>
        <iframe src={dataUrl} className="w-full h-[500px] border rounded-lg" title="Business Registration Document" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium flex items-center gap-2"><FileText className="h-4 w-4" />{document.name}</p>
      {imgError ? (
        <div className="w-full border rounded-lg bg-muted/50 p-8 flex flex-col items-center gap-2 text-muted-foreground">
          <FileText className="h-10 w-10" />
          <p className="text-sm">Unable to preview this file.</p>
          <a href={dataUrl} download={document.name} className="text-xs text-primary underline">Download file</a>
        </div>
      ) : (
        <img src={dataUrl} alt="Business Registration Document" className="w-full rounded-lg border"
          onError={() => setImgError(true)} />
      )}
    </div>
  );
}

function DetailDialog({
  app, adminKey, onClose, onStatusChange,
}: {
  app: ApplicationSummary; adminKey: string;
  onClose: () => void; onStatusChange: () => void;
}) {
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/b2b-detail?id=${app.id}`, { headers: { 'x-admin-key': adminKey } });
        const data = await res.json();
        setDetail(data.application);
      } catch { toast.error('Failed to load details.'); }
      finally { setLoading(false); }
    })();
  }, [app.id, adminKey]);

  const handleApprove = async () => {
    setActing(true);
    try {
      const res = await fetch('/api/b2b-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ id: app.id, action: 'approve' }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Application approved successfully.', { position: 'top-center' });
        onStatusChange();
        onClose();
      } else {
        toast.error(data.error || 'Action failed.', { position: 'top-center' });
      }
    } catch { toast.error('Network error.'); }
    finally { setActing(false); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please enter a rejection reason.', { position: 'top-center' });
      return;
    }
    setActing(true);
    try {
      const res = await fetch('/api/b2b-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ id: app.id, action: 'reject', reason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Application rejected.', { position: 'top-center' });
        onStatusChange();
        onClose();
      } else {
        toast.error(data.error || 'Action failed.', { position: 'top-center' });
      }
    } catch { toast.error('Network error.'); }
    finally { setActing(false); }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Application Detail
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : detail ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge className={STATUS_CONFIG[detail.status].color}>{STATUS_CONFIG[detail.status].label}</Badge>
              <span className="text-xs text-muted-foreground">{new Date(detail.createdAt).toLocaleDateString()}</span>
            </div>

            <Separator />

            <div className="grid gap-3">
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div><p className="text-xs text-muted-foreground">Company</p><p className="text-sm font-medium">{detail.companyName}</p></div>
              </div>
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div><p className="text-xs text-muted-foreground">Representative</p><p className="text-sm font-medium">{detail.representativeName}</p></div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div><p className="text-xs text-muted-foreground">Email</p><p className="text-sm font-medium">{detail.email}</p></div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm font-medium">{detail.phoneNumber}</p></div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div><p className="text-xs text-muted-foreground">Address</p><p className="text-sm font-medium">{detail.address}</p></div>
              </div>
            </div>

            <Separator />

            <DocumentViewer document={detail.document} />

            {detail.status === 'pending' && (
              <>
                <Separator />
                {showRejectForm ? (
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-destructive">Rejection Reason</Label>
                    <Textarea
                      placeholder="Please explain why this application is being rejected..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-3">
                      <Button onClick={handleReject} disabled={acting || !rejectReason.trim()} variant="destructive" className="flex-1">
                        {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                        Confirm Reject
                      </Button>
                      <Button onClick={() => { setShowRejectForm(false); setRejectReason(''); }} disabled={acting} variant="outline" className="flex-1">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button onClick={handleApprove} disabled={acting} className="flex-1 bg-green-600 hover:bg-green-700">
                      {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      Approve
                    </Button>
                    <Button onClick={() => setShowRejectForm(true)} disabled={acting} variant="destructive" className="flex-1">
                      <XCircle className="h-4 w-4 mr-2" /> Reject
                    </Button>
                  </div>
                )}
              </>
            )}

            {detail.status === 'rejected' && (detail as any).rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-600 mb-1">Rejection Reason</p>
                <p className="text-sm text-red-800">{(detail as any).rejectionReason}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Application not found.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function B2BAdmin() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('b2b-admin-key') || '');
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedApp, setSelectedApp] = useState<ApplicationSummary | null>(null);

  const fetchApplications = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const res = await fetch('/api/b2b-list', { headers: { 'x-admin-key': adminKey } });
      if (res.status === 401) { setAdminKey(''); sessionStorage.removeItem('b2b-admin-key'); return; }
      const data = await res.json();
      setApplications(data.applications || []);
    } catch { toast.error('Failed to load applications.'); }
    finally { setLoading(false); }
  }, [adminKey]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  if (!adminKey) return <LoginGate onLogin={setAdminKey} />;

  const filtered = filter === 'all' ? applications : applications.filter((a) => a.status === filter);
  const counts = {
    total: applications.length,
    pending: applications.filter((a) => a.status === 'pending').length,
    approved: applications.filter((a) => a.status === 'approved').length,
    rejected: applications.filter((a) => a.status === 'rejected').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-bold">B2B Admin</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchApplications} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setAdminKey(''); sessionStorage.removeItem('b2b-admin-key'); }}>
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Users} label="Total" value={counts.total} color="bg-blue-50 text-blue-600" />
          <StatCard icon={Clock} label="Pending" value={counts.pending} color="bg-yellow-50 text-yellow-600" />
          <StatCard icon={CheckCircle} label="Approved" value={counts.approved} color="bg-green-50 text-green-600" />
          <StatCard icon={XCircle} label="Rejected" value={counts.rejected} color="bg-red-50 text-red-600" />
        </div>

        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">All ({counts.total})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No applications found.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((app) => (
              <Card key={app.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedApp(app)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{app.companyName}</p>
                        <p className="text-xs text-muted-foreground truncate">{app.representativeName} · {app.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge className={STATUS_CONFIG[app.status].color}>{STATUS_CONFIG[app.status].label}</Badge>
                      <span className="text-xs text-muted-foreground hidden sm:block">{new Date(app.createdAt).toLocaleDateString()}</span>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {selectedApp && (
        <DetailDialog app={selectedApp} adminKey={adminKey}
          onClose={() => setSelectedApp(null)} onStatusChange={fetchApplications} />
      )}
    </div>
  );
}
