import { useState, useEffect } from 'react';
import { buildApiUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Wallet, DollarSign, RefreshCw, Send, Loader2 } from 'lucide-react';

interface BalanceSnapshot {
  utilityAvailable: number | null;
  fetchedAt: string;
}

export const HeaderBalances = ({ adminPhone }: { adminPhone: string }) => {
  const [smsBalance, setSmsBalance] = useState<number | null>(null);
  const [loadingSms, setLoadingSms] = useState(false);
  const [smsError, setSmsError] = useState('');

  const [snapshot, setSnapshot] = useState<BalanceSnapshot | null>(null);
  const [loadingPaybill, setLoadingPaybill] = useState(false);
  const [paybillError, setPaybillError] = useState('');

  const [sendOpen, setSendOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recipientPhone, setRecipientPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');

  const fetchSmsBalance = async () => {
    if (!adminPhone) return;
    setLoadingSms(true);
    setSmsError('');
    try {
      const response = await fetch(buildApiUrl(`/api/admin/sms-balance?phone=${encodeURIComponent(adminPhone)}`));
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load SMS balance');
      setSmsBalance(typeof data.balance === 'number' ? data.balance : null);
    } catch (error) {
      setSmsError(error instanceof Error ? error.message : 'Failed to load SMS balance');
    } finally {
      setLoadingSms(false);
    }
  };

  const fetchLatestPaybillBalance = async () => {
    if (!adminPhone) return;
    setLoadingPaybill(true);
    setPaybillError('');
    try {
      const response = await fetch(buildApiUrl(`/api/admin/daraja-b2c/balance/latest?phone=${encodeURIComponent(adminPhone)}`));
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load balance');
      setSnapshot(data.snapshot);
    } catch (error) {
      setPaybillError(error instanceof Error ? error.message : 'Failed to load balance');
    } finally {
      setLoadingPaybill(false);
    }
  };

  // Load both balances on every mount (i.e. every page refresh), independent of which tab is active
  useEffect(() => {
    if (adminPhone) {
      void fetchSmsBalance();
      void fetchLatestPaybillBalance();
    }
  }, [adminPhone]);

  const refreshPaybillBalance = async () => {
    setLoadingPaybill(true);
    setPaybillError('');
    try {
      const response = await fetch(buildApiUrl('/api/admin/daraja-b2c/balance'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: adminPhone }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to request balance');
      setTimeout(() => { void fetchLatestPaybillBalance(); }, 6000);
    } catch (error) {
      setPaybillError(error instanceof Error ? error.message : 'Failed to request balance');
      setLoadingPaybill(false);
    }
  };

  const handleSendClick = () => {
    setSendError('');
    setSendSuccess('');
    if (!recipientPhone.trim() || !amount.trim()) {
      setSendError('Recipient phone and amount are required');
      return;
    }
    if (!(parseFloat(amount) > 0)) {
      setSendError('Amount must be a positive number');
      return;
    }
    setConfirmOpen(true);
  };

  const confirmSend = async () => {
    setConfirmOpen(false);
    setSending(true);
    setSendError('');
    setSendSuccess('');
    try {
      const response = await fetch(buildApiUrl('/api/admin/daraja-b2c/send'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: adminPhone, recipientPhone, amount, remarks, confirm: true }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to send payment');
      setSendSuccess(`Payment request accepted (ref: ${data.originatorConversationId})`);
      setRecipientPhone('');
      setAmount('');
      setRemarks('');
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Failed to send payment');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
        <Wallet className="h-4 w-4 text-primary" />
        <span className="text-xs text-muted-foreground">SMS:</span>
        <span className="text-sm font-bold text-foreground">
          {loadingSms ? '...' : smsError ? '—' : (smsBalance !== null ? smsBalance.toLocaleString() : '—')}
        </span>
        <button onClick={fetchSmsBalance} disabled={loadingSms} aria-label="Refresh SMS balance">
          <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${loadingSms ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
        <DollarSign className="h-4 w-4 text-primary" />
        <span className="text-xs text-muted-foreground">Paybill:</span>
        <span className="text-sm font-bold text-foreground">
          {loadingPaybill ? '...' : paybillError ? '—' : (snapshot?.utilityAvailable != null ? `KSH ${snapshot.utilityAvailable.toLocaleString()}` : '—')}
        </span>
        <button onClick={refreshPaybillBalance} disabled={loadingPaybill} aria-label="Refresh paybill balance">
          <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${loadingPaybill ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogTrigger asChild>
          <Button variant="hero" size="sm">
            <Send className="mr-1 h-4 w-4" /> Send Money
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Money (B2C Payout)</DialogTitle>
            <DialogDescription>Sends real money from the paybill to the recipient's M-Pesa number.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Recipient phone (07XXXXXXXX)" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} />
            <Input placeholder="Amount (KSH)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input placeholder="Remarks (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            <Button className="w-full" onClick={handleSendClick} disabled={sending}>
              {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
              {sending ? 'Sending...' : 'Send'}
            </Button>
            {sendError && <p role="alert" className="text-xs text-destructive">{sendError}</p>}
            {sendSuccess && <p className="text-xs text-green-500">{sendSuccess}</p>}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm payout</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to send <strong>KSH {amount}</strong> from the paybill to <strong>{recipientPhone}</strong>. This moves real money and cannot be undone. Proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSend}>Confirm &amp; Send</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
