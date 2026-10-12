import { useState, useEffect } from 'react';
import { buildApiUrl } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface B2CTransaction {
  id: string;
  recipient_phone: string;
  recipient_name_validated: string | null;
  recipient_mpesa_name: string | null;
  mpesa_transaction_id: string | null;
  amount: number;
  status: string;
  result_description: string | null;
  remarks: string | null;
  initiated_by_admin_phone: string;
  created_at: string;
}

export const SpendingsPanel = ({ adminPhone }: { adminPhone: string }) => {
  const [transactions, setTransactions] = useState<B2CTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTransactions = async () => {
    if (!adminPhone) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(buildApiUrl(`/api/admin/daraja-b2c/transactions?phone=${encodeURIComponent(adminPhone)}`));
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load transactions');
      setTransactions(data.transactions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminPhone) void fetchTransactions();
  }, [adminPhone]);

  const statusColor = (status: string) =>
    status === 'completed' ? 'text-green-500' : status === 'failed' ? 'text-destructive' : 'text-yellow-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Send Money Transactions</h3>
        <Button variant="outline" size="sm" onClick={fetchTransactions} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {!error && transactions.length === 0 && !loading && (
        <Card className="p-4 text-center text-sm text-muted-foreground">No payouts sent yet.</Card>
      )}

      {transactions.length > 0 && (
        <Card className="border-border bg-card p-4">
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between border-b border-border/50 pb-2 text-xs last:border-0 last:pb-0">
                <div>
                  <p className="font-semibold text-foreground">{tx.recipient_phone} — KSH {Number(tx.amount).toLocaleString()}</p>
                  <p className="text-muted-foreground">
                    M-Pesa name: {tx.recipient_mpesa_name || tx.recipient_name_validated || 'Pending'}
                    {tx.mpesa_transaction_id ? ` · Receipt: ${tx.mpesa_transaction_id}` : ''}
                  </p>
                  <p className="text-muted-foreground">
                    {new Date(tx.created_at).toLocaleString()} · by {tx.initiated_by_admin_phone}
                    {tx.remarks ? ` · ${tx.remarks}` : ''}
                  </p>
                  {tx.status === 'failed' && tx.result_description && (
                    <p className="text-destructive">{tx.result_description}</p>
                  )}
                </div>
                <span className={`font-semibold uppercase ${statusColor(tx.status)}`}>{tx.status}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
