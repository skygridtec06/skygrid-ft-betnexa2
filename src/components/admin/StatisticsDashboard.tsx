import { useState, useEffect } from 'react';
import { buildApiUrl } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface StatisticsDashboardProps {
  adminPhone: string;
}

const COLORS_CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
const COLORS_STATUS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' };
const COLORS_BLUE_RAMP = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab'];

export const StatisticsDashboard = ({ adminPhone }: StatisticsDashboardProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<any>(null);

  const fetchStatistics = async (date: string) => {
    if (!adminPhone) {
      setError('User phone not available');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        buildApiUrl(`/api/admin/statistics/overview?phone=${encodeURIComponent(adminPhone)}&date=${date}`)
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to load statistics');
      }
      setData(result);
    } catch (err) {
      console.error('Failed to fetch statistics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminPhone) {
      void fetchStatistics(selectedDate);
    }
  }, [adminPhone]);

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    if (adminPhone) {
      void fetchStatistics(newDate);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card className="border-destructive bg-destructive/10 p-4">
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  if (!data) {
    return <Card className="p-4 text-center text-muted-foreground">No data available</Card>;
  }

  const { clients, signupTrend, dailyFunnel, betting, failureRates, webPerformance } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Statistics Dashboard</h3>
        <div className="flex gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="rounded border border-input bg-background px-3 py-2 text-sm"
          />
          <Button variant="outline" size="sm" onClick={() => fetchStatistics(selectedDate)} disabled={loading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Clients KPI Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Users</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{clients.totalUsers.toLocaleString()}</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Signups Today</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{clients.signupsToday}</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activation Rate</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{clients.activationRatePct}%</p>
          <p className="mt-1 text-xs text-muted-foreground">{clients.activatedCount} / {clients.totalUsers}</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Banned Users</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{clients.bannedCount}</p>
        </Card>
      </div>

      {/* Signup Trend Bar Chart */}
      <Card className="border-border bg-card p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Signup Trend (Last 30 Days)</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={signupTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" />
            <XAxis dataKey="date" stroke="#898781" style={{ fontSize: '12px' }} />
            <YAxis stroke="#898781" style={{ fontSize: '12px' }} />
            <Tooltip contentStyle={{ backgroundColor: '#fcfcfb', border: '1px solid #c3c2b7', borderRadius: '4px' }} />
            <Bar dataKey="signups" fill={COLORS_CATEGORICAL[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Daily Conversion Funnel - 3 Pie Charts */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border bg-card p-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">User Base Composition</p>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={dailyFunnel.pies.signupComposition}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#2a78d6"
                dataKey="value"
              >
                {dailyFunnel.pies.signupComposition.map((_: any, idx: number) => (
                  <Cell key={`cell-${idx}`} fill={COLORS_CATEGORICAL[idx % COLORS_CATEGORICAL.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="border-border bg-card p-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Signup → Staked ({dailyFunnel.cohortSize})</p>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={dailyFunnel.pies.signupToStaked}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#eb6834"
                dataKey="value"
              >
                {dailyFunnel.pies.signupToStaked.map((_: any, idx: number) => (
                  <Cell key={`cell-${idx}`} fill={COLORS_CATEGORICAL[(idx + 1) % COLORS_CATEGORICAL.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="border-border bg-card p-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Signup → Activated ({dailyFunnel.cohortSize})</p>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={dailyFunnel.pies.signupToActivated}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#1baf7a"
                dataKey="value"
              >
                {dailyFunnel.pies.signupToActivated.map((_: any, idx: number) => (
                  <Cell key={`cell-${idx}`} fill={COLORS_CATEGORICAL[(idx + 2) % COLORS_CATEGORICAL.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Betting Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border bg-card p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Bets</p>
          <p className="text-2xl font-bold text-foreground">{betting.totalBets.toLocaleString()}</p>
          <p className="mt-2 text-xs text-muted-foreground">Today: {betting.betsToday} bets</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bet Status</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={betting.statusBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={60}
                dataKey="value"
              >
                {betting.statusBreakdown.map((_: any, idx: number) => (
                  <Cell key={`cell-${idx}`} fill={COLORS_CATEGORICAL[idx % COLORS_CATEGORICAL.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Stake Volume */}
      <Card className="border-border bg-card p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stake Volume (Last 30 Days)</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Total Stake</p>
            <p className="text-2xl font-bold text-foreground">KSH {betting.totalStakeLast30Days.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Average Stake</p>
            <p className="text-2xl font-bold text-foreground">KSH {betting.avgStakeLast30Days.toLocaleString()}</p>
          </div>
        </div>
      </Card>

      {/* Failure Rates */}
      <Card className="border-border bg-card p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Failure Rates (Last 30 Days)</p>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-foreground">Deposits</p>
              <p className="text-xs text-muted-foreground">
                {failureRates.deposits.completed} completed, {failureRates.deposits.failed} failed
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted">
                <div
                  className="h-full bg-destructive"
                  style={{ width: `${failureRates.deposits.failureRatePct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-foreground">{failureRates.deposits.failureRatePct}% failed</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Activation Fees</p>
              <p className="text-xs text-muted-foreground">
                {failureRates.activationFees.completed} completed, {failureRates.activationFees.failed} failed
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted">
                <div
                  className="h-full bg-destructive"
                  style={{ width: `${failureRates.activationFees.failureRatePct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-foreground">{failureRates.activationFees.failureRatePct}% failed</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-foreground">Priority Fees</p>
              <p className="text-xs text-muted-foreground">
                {failureRates.priorityFees.completed} completed, {failureRates.priorityFees.failed} failed
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted">
                <div
                  className="h-full bg-destructive"
                  style={{ width: `${failureRates.priorityFees.failureRatePct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-foreground">{failureRates.priorityFees.failureRatePct}% failed</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Payments (3rd Party)</p>
              <p className="text-xs text-muted-foreground">
                {failureRates.payments.success} success, {failureRates.payments.failed} failed, {failureRates.payments.pending} pending
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted">
                <div
                  className="h-full bg-destructive"
                  style={{ width: `${failureRates.payments.failureRatePct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-foreground">{failureRates.payments.failureRatePct}% failed</p>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">C2B Mismatches</p>
            <p className="text-xs text-muted-foreground">
              {failureRates.c2bMismatches.unresolved} unresolved of {failureRates.c2bMismatches.total} total
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-warning"
                style={{
                  width: failureRates.c2bMismatches.total > 0
                    ? `${(failureRates.c2bMismatches.unresolved / failureRates.c2bMismatches.total) * 100}%`
                    : '0%'
                }}
              />
            </div>
          </div>
          {failureRates.notes && failureRates.notes.length > 0 && (
            <div className="border-t border-border pt-3">
              {failureRates.notes.map((note: string, idx: number) => (
                <p key={idx} className="text-xs text-muted-foreground italic">
                  • {note}
                </p>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Web Performance */}
      <Card className="border-border bg-card p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Web Performance {webPerformance.snapshot ? '(Live Snapshot)' : ''}
        </p>
        <div className="space-y-2 text-xs text-muted-foreground">
          <p className="italic">{webPerformance.note}</p>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <div>
              <p className="font-medium text-foreground">Uptime</p>
              <p>{Math.floor(webPerformance.uptimeSeconds / 3600)}h {Math.floor((webPerformance.uptimeSeconds % 3600) / 60)}m</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Memory (RSS)</p>
              <p>{webPerformance.memoryMb.rss} MB</p>
            </div>
            <div>
              <p className="font-medium text-foreground">DB Latency</p>
              <p>{webPerformance.dbLatencyMs}ms</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
