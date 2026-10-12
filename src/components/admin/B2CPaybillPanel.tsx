import { useState, useEffect } from 'react';
import { buildApiUrl } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DollarSign, RefreshCw, Send, Loader2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BalanceSnapshot {
  utilityAvailable: number | null;
  fetchedAt: string;
}

interface B2CTransaction {
  id: string;
  recipient_phone: string;
  amount: number;
  status: string;
  remarks: string | null;
  created_at: string;
}

export const B2CPaybillPanel = ({ adminPhone }: { adminPhone: string }) => {
  const [snapshot, setSnapshot] = useState<BalanceSnapshot | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState('');

  const [recipientPhone, setRecipientPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [transactions, setTransactions] = useState<B2CTransaction[]>([]);

  const fetchLatestBalance = async () => {
    if (!adminPhone) return;
    setLoadingBalance(true);
    setBalanceError('');
    try {
      const response = await fetch(buildApiUrl(`/api/admin/daraja-b2c/balance/latest?phone=${encodeURIComponent(adminPhone)}`));
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load balance');
      setSnapshot(data.snapshot);
    } catch (error) {
      setBalanceError(error instanceof Error ? error.message : 'Failed to load balance');
    } finally {
      setLoadingBalance(false);
    }
  };

  const fetchTransactions = async () => {
    if (!adminPhone) return;
    try {
      const response = await fetch(buildApiUrl(`/api/admin/daraja-b2c/transactions?phone=${encodeURIComponent(adminPhone)}`));
      const data = await response.json();
      if (response.ok && data.success) setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Failed to load B2C transactions:', error);
    }
  };

  useEffect(() => {
    if (adminPhone) {
      void fetchLatestBalance();
      void fetchTransactions();
    }
  }, [adminPhone]);

  const refreshBalance = async () => {
    setLoadingBalance(true);
    setBalanceError('');
    try {
      const response = await fetch(buildApiUrl('/api/admin/daraja-b2c/balance'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: adminPhone }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to request balance');
      // Safaricom replies asynchronously via callback — wait a moment then re-fetch the snapshot
      setTimeout(() => { void fetchLatestBalance(); }, 6000);
    } catch (error) {
      setBalanceError(error instanceof Error ? error.message : 'Failed to request balance');
      setLoadingBalance(false);
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
      void fetchTransactions();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Failed to send payment');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Card className="border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">M-Pesa Paybill Balance (Utility Account)</p>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary opacity-60" />
            <Button variant="outline" size="sm" onClick={refreshBalance} disabled={loadingBalance}>
              <RefreshCw className={`mr-1 h-4 w-4 ${loadingBalance ? 'animate-spin' : ''}`} />
              {loadingBalance ? 'Checking...' : 'Refresh'}
            </Button>
          </div>
        </div>
        {balanceError ? (
          <p role="alert" className="mt-2 text-xs text-destructive">{balanceError}</p>
        ) : (
          <>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {snapshot?.utilityAvailable != null ? `KSH ${snapshot.utilityAvailable.toLocaleString()}` : '—'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {snapshot?.fetchedAt ? `Last checked: ${new Date(snapshot.fetchedAt).toLocaleString()}` : 'No balance checked yet — click Refresh.'}
            </p>
          </>
        )}
      </Card>

      <Card className="border-border bg-card p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Send Money (B2C Payout)</p>
        <div className="grid gap-3 md:grid-cols-3">
          <Input placeholder="Recipient phone (07XXXXXXXX)" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} />
          <Input placeholder="Amount (KSH)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input placeholder="Remarks (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
        <Button className="mt-3" onClick={handleSendClick} disabled={sending}>
          {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
          {sending ? 'Sending...' : 'Send'}
        </Button>
        {sendError && <p role="alert" className="mt-2 text-xs text-destructive">{sendError}</p>}
        {sendSuccess && <p className="mt-2 text-xs text-green-500">{sendSuccess}</p>}

        {transactions.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent Payouts</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              {transactions.slice(0, 10).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between">
                  <span>{tx.recipient_phone} — KSH {Number(tx.amount).toLocaleString()}</span>
                  <span className={tx.status === 'completed' ? 'text-green-500' : tx.status === 'failed' ? 'text-destructive' : 'text-yellow-500'}>
                    {tx.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

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
    </>
  );
};
