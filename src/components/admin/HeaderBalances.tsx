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
  const [adminPin, setAdminPin] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');
  const [pinError, setPinError] = useState('');

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

  const fetchLatestPaybillBalance = async (since?: string) => {
    if (!adminPhone) throw new Error('Admin phone is required to fetch paybill balance');
    const params = new URLSearchParams({ phone: adminPhone });
    if (since) params.set('since', since);
    const response = await fetch(buildApiUrl(`/api/admin/daraja-b2c/balance/latest?${params.toString()}`));
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load balance');
    if (data.snapshot) setSnapshot(data.snapshot);
    return data;
  };

  const loadLatestPaybillBalance = async () => {
    if (!adminPhone) return;
    setLoadingPaybill(true);
    setPaybillError('');
    try {
      await fetchLatestPaybillBalance();
    } catch (error) {
      setPaybillError(error instanceof Error ? error.message : 'Failed to load balance');
    } finally {
      setLoadingPaybill(false);
    }
  };

  const refreshPaybillBalance = async () => {
    if (!adminPhone) {
      setPaybillError('Admin phone is required to fetch paybill balance');
      return;
    }
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

      for (let attempt = 0; attempt < 12; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 5000));
        const latest = await fetchLatestPaybillBalance(data.requestedAt);
        if (latest.fresh) return;
      }
      throw new Error('Safaricom has not returned the latest paybill balance yet. Try refreshing again shortly.');
    } catch (error) {
      setPaybillError(error instanceof Error ? error.message : 'Failed to request balance');
    } finally {
      setLoadingPaybill(false);
    }
  };

  // Load both balances on every mount (i.e. every page refresh), independent of which tab is active
  useEffect(() => {
    if (adminPhone) {
      void fetchSmsBalance();
      void loadLatestPaybillBalance();
    }
  }, [adminPhone]);

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
    if (Math.round(parseFloat(amount)) < 10) {
      setSendError('M-Pesa B2C payouts must be at least KSH 10');
      return;
    }
    setAdminPin('');
    setPinError('');
    setConfirmOpen(true);
  };

  const confirmSend = async () => {
    if (!/^\d{6}$/.test(adminPin)) {
      setPinError('Enter the six-digit admin PIN');
      return;
    }
    setSending(true);
    setPinError('');
    try {
      const response = await fetch(buildApiUrl('/api/admin/daraja-b2c/send'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: adminPhone, recipientPhone, amount, remarks, confirm: true, adminPin }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to send payment');
      setSendSuccess(`Payment request accepted (ref: ${data.originatorConversationId})`);
      setConfirmOpen(false);
      setRecipientPhone('');
      setAmount('');
      setRemarks('');
      setAdminPin('');
    } catch (error) {
      setPinError(error instanceof Error ? error.message : 'Failed to send payment');
      setAdminPin('');
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
        <DialogContent className="w-[calc(100vw_-_2rem)] max-w-md max-h-[calc(100dvh_-_2rem)] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="text-center sm:text-left">
            <DialogTitle>Send Money (B2C Payout)</DialogTitle>
            <DialogDescription>Sends real money from the paybill to the recipient's M-Pesa number.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Recipient phone (07XXXXXXXX)"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
              />
            </div>
            <Input placeholder="Amount (KSH; minimum 10)" type="number" min={10} value={amount} onChange={(e) => setAmount(e.target.value)} />
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

      <AlertDialog open={confirmOpen} onOpenChange={(open) => {
        setConfirmOpen(open);
        if (!open) {
          setAdminPin('');
          setPinError('');
        }
      }}>
        <AlertDialogContent className="w-[calc(100vw_-_2rem)] max-w-md max-h-[calc(100dvh_-_2rem)] overflow-y-auto p-4 sm:p-6">
          <AlertDialogHeader className="text-center sm:text-left">
            <AlertDialogTitle>Confirm payout</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to send <strong>KSH {amount}</strong> from the paybill to <strong>{recipientPhone}</strong>. Enter the six-digit admin PIN to authorize this real-money payment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Input
              className="text-center text-lg tracking-[0.5em]"
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]*"
              placeholder="6-digit admin PIN"
              value={adminPin}
              onChange={(e) => {
                setAdminPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                setPinError('');
              }}
              aria-label="Six-digit admin PIN"
            />
            {pinError && <p role="alert" className="text-xs text-destructive">{pinError}</p>}
          </div>
          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel className="mt-0 w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => {
              event.preventDefault();
              void confirmSend();
            }} disabled={sending || adminPin.length !== 6} className="w-full sm:w-auto">
              {sending ? 'Sending...' : 'Confirm & Send'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
