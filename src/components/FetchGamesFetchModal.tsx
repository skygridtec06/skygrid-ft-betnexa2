import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { buildApiUrl } from '@/lib/api';

interface GamePreview {
  api_fixture_id: number;
  league: string;
  home_team: string;
  away_team: string;
  home_odds: number;
  draw_odds: number;
  away_odds: number;
  time_utc: string;
  time_eat: string;
  markets: Record<string, number>;
}

interface FetchGamesFetchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute: (games: GamePreview[]) => Promise<void>;
  adminPhone: string;
}

const getDefaultDateRange = () => {
  const from = new Date();
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
};

export const FetchGamesFetchModal = ({ isOpen, onClose, onExecute, adminPhone }: FetchGamesFetchModalProps) => {
  const [step, setStep] = useState<'idle' | 'fetching' | 'preview' | 'executing' | 'complete' | 'error'>('idle');
  const [games, setGames] = useState<GamePreview[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [dateRange, setDateRange] = useState(getDefaultDateRange);
  const [oddsWarnings, setOddsWarnings] = useState<string[]>([]);

  const handleFetch = async () => {
    if (dateRange.from > dateRange.to) {
      setErrorMsg('The end date must not be before the start date.');
      setStep('error');
      return;
    }

    setStep('fetching');
    setErrorMsg('');
    setOddsWarnings([]);
    try {
      const response = await fetch(buildApiUrl('/api/admin/fetch-api-football/fetch-preview'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: adminPhone,
          from: dateRange.from,
          to: dateRange.to,
        })
      });

      const data: {
        success?: boolean;
        error?: string;
        details?: string;
        games?: GamePreview[];
        warnings?: Array<{ date?: string; error?: string }>;
      } = await response.json();

      if (!response.ok || !data.success) {
        setErrorMsg(
          data.details ||
          data.error ||
          `The API request failed (HTTP ${response.status}).`
        );
        setStep('error');
        return;
      }

      setGames(data.games || []);
      setOddsWarnings(Array.isArray(data.warnings)
        ? data.warnings.map(warning =>
          `${warning.date || 'Unknown date'}: ${warning.error || 'Odds unavailable'}`
        )
        : []);
      setStep('preview');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Fetch failed');
      setStep('error');
    }
  };

  const handleExecute = async () => {
    setStep('executing');
    try {
      await onExecute(games);
      setStep('complete');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Execute failed');
      setStep('error');
    }
  };

  const handleClose = () => {
    setStep('idle');
    setGames([]);
    setErrorMsg('');
    setOddsWarnings([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Fetch Games from API Football
          </DialogTitle>
          <DialogDescription>
            Fetch prematch games and accurate odds from API Football for all BETNEXA markets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {step === 'idle' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select a date range to fetch prematch games from API Football with accurate odds
                for all BETNEXA markets (1X2, BTTS, Over/Under, Double Chance, HT/FT, Correct Score).
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="fetch-games-from" className="text-sm font-medium">From</label>
                  <input
                    id="fetch-games-from"
                    type="date"
                    value={dateRange.from}
                    onChange={event => setDateRange(range => ({ ...range, from: event.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="fetch-games-to" className="text-sm font-medium">To</label>
                  <input
                    id="fetch-games-to"
                    type="date"
                    min={dateRange.from}
                    value={dateRange.to}
                    onChange={event => setDateRange(range => ({ ...range, to: event.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <Button onClick={handleFetch} className="w-full" size="lg">
                <Download className="w-4 h-4 mr-2" />
                Fetch Matches
              </Button>
            </div>
          )}

          {step === 'fetching' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p>Fetching games from {dateRange.from} to {dateRange.to}...</p>
              <p className="text-xs text-muted-foreground">Loading all available matches in the selected date range</p>
            </div>
          )}

          {step === 'preview' && games.length > 0 && (
            <div className="space-y-4">
              <div className="bg-blue-500/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                  ✅ Fetched {games.length} games
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                  Click Execute below to add these {games.length} games to the site.
                </p>
              </div>

              {oddsWarnings.length > 0 && (
                <div role="alert" className="bg-yellow-500/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">
                    Some provider data could not be loaded. Available fixtures may still be shown with fallback odds.
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-yellow-700 dark:text-yellow-400">
                    {oddsWarnings.slice(0, 5).map((warning, index) => (
                      <li key={`${index}-${warning}`}>{warning}</li>
                    ))}
                    {oddsWarnings.length > 5 && <li>And {oddsWarnings.length - 5} more odds warning(s).</li>}
                  </ul>
                </div>
              )}

              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {games.map((game, i) => (
                  <Card key={i} className="p-3 bg-card/50">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {game.home_team} vs {game.away_team}
                        </p>
                        <p className="text-xs text-muted-foreground">{game.league}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-xs font-mono">
                            {game.home_odds} - {game.draw_odds} - {game.away_odds}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(game.time_eat).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'Africa/Nairobi'
                            })} EAT
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={() => setStep('idle')} variant="outline" className="flex-1">
                  Back
                </Button>
                <Button onClick={handleExecute} className="flex-1" size="lg">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Execute: Add {games.length} Matches
                </Button>
              </div>
            </div>
          )}

          {step === 'preview' && games.length === 0 && (
            <div className="space-y-4">
              <div className="bg-yellow-500/10 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-lg font-semibold text-yellow-700 dark:text-yellow-300">
                  ℹ️ No games found
                </p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
                  No prematch games were found from {dateRange.from} to {dateRange.to}.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Choose a different date range or check API Football for available matches.
                </p>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setStep('idle')} variant="outline" className="flex-1">
                  Try Again
                </Button>
                <Button onClick={handleClose} className="flex-1">
                  Close
                </Button>
              </div>
            </div>
          )}

          {step === 'executing' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p>Adding {games.length} games to the site...</p>
            </div>
          )}

          {step === 'complete' && (
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-lg font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Success! Added {games.length} matches
                </p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                  {`${games.length} matches added successfully.`}
                </p>
              </div>
              <Button onClick={handleClose} className="w-full">
                Close
              </Button>
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-lg font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Error
                </p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">{errorMsg}</p>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setStep('idle')} variant="outline" className="flex-1">
                  Try Again
                </Button>
                <Button onClick={handleClose} className="flex-1">
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
