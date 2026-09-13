import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from "react";
import { buildApiUrl } from "@/lib/api";

export interface GameOdds {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  time: string;
  status: "upcoming" | "live" | "finished";
  markets: Record<string, number>;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  seconds?: number; // Seconds component for display
  kickoffStartTime?: number | string; // Timestamp when kickoff started (ISO string or milliseconds)
  isKickoffStarted?: boolean;
  gamePaused?: boolean;
  kickoffPausedAt?: number | string; // Timestamp when paused (ISO string or milliseconds)
  isHalftime?: boolean;
  sport?: string; // 'football' | 'basketball' | 'tennis' | 'cricket' | 'boxing'
  isHot?: boolean; // Hot/popular match
}

interface OddsContextType {
  games: GameOdds[];
  isLoading: boolean;
  addGame: (game: GameOdds) => void;
  updateGame: (id: string, game: Partial<GameOdds>) => void;
  removeGame: (id: string) => void;
  getGame: (id: string) => GameOdds | undefined;
  updateGameMarkets: (id: string, markets: Record<string, number>) => void;
  refreshGames: () => Promise<void>;
}

const OddsContext = createContext<OddsContextType | undefined>(undefined);

export function OddsProvider({ children }: { children: ReactNode }) {
  const [games, setGames] = useState<GameOdds[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const gamesRef = useRef<GameOdds[]>([]);
  const kickoffTimesRef = useRef<Record<string, number>>({}); // Track when each game kicked off
  const fetchInProgressRef = useRef(false); // Prevent duplicate fetches
  const refreshInProgressRef = useRef(false); // Prevent overlapping full database scans
  const pendingLocalGamesRef = useRef<Map<string, { game: GameOdds; createdAt: number }>>(new Map());

  const mergePendingLocalGames = useCallback((serverGames: GameOdds[]) => {
    const merged = new Map<string, GameOdds>();
    for (const game of serverGames) {
      if (game?.id) merged.set(game.id, game);
    }

    for (const [gameId, pending] of pendingLocalGamesRef.current.entries()) {
      const existing = merged.get(gameId);
      if (!existing) {
        merged.set(gameId, pending.game);
      } else {
        merged.set(gameId, { ...existing, ...pending.game });
      }
    }

    for (const localGame of gamesRef.current) {
      if (!localGame?.id) continue;
      const isApiManaged = /^(af|ab|bb|tn|ck|bx)-/i.test(String(localGame.id || ''));
      if (isApiManaged) continue;
      if (!merged.has(localGame.id)) {
        merged.set(localGame.id, localGame);
      } else {
        merged.set(localGame.id, { ...merged.get(localGame.id), ...localGame });
      }
    }

    return Array.from(merged.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, []);

  const preserveCurrentGames = useCallback(() => {
    const currentGames = [...gamesRef.current];
    if (currentGames.length > 0) {
      setGames(currentGames);
      gamesRef.current = currentGames;
    }
  }, []);

  const hasApiGamesNeedingSync = () => {
    const now = Date.now();
    return gamesRef.current.some((game) => {
      const isApiManaged = /^(af|ab|bb|tn|ck|bx)-/i.test(String(game.id || ''));
      if (!isApiManaged || game.status === 'finished') return false;
      if (game.status === 'live') return true;
      const kickoffMs = new Date(game.time).getTime();
      if (isNaN(kickoffMs)) return false;
      return kickoffMs <= now + 2 * 60 * 1000;
    });
  };

  const fetchAllGames = useCallback(async (
    apiUrl: string,
    signal?: AbortSignal,
    onFirstPage?: (games: any[]) => void,
    status?: string
  ) => {
    const pageSize = status === 'upcoming' ? 999 : 250;
    const allGames: any[] = [];
    const fetchPage = async (page: number) => {
      const response = await fetch(
        `${apiUrl}/admin/games?page=${page}&page_size=${pageSize}${status ? `&status=${encodeURIComponent(status)}` : ''}`,
        { signal, keepalive: true }
      );
      if (!response.ok) {
        throw new Error(`Games request failed with HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !Array.isArray(data.games)) {
        throw new Error('Games response did not contain a valid page');
      }

      if (page === 0 && onFirstPage) {
        onFirstPage(data.games);
      }
      return data;
    };

    let page = 0;
    let firstPage = await fetchPage(page);
    allGames.push(...firstPage.games);
    let hasMore = firstPage.has_more === true;
    page += 1;

    // Keep the database load bounded while avoiding dozens of sequential
    // round trips for large datasets.
    while (hasMore) {
      const pages = Array.from({ length: 4 }, (_, index) => page + index);
      const results = await Promise.all(pages.map((pageNumber) => fetchPage(pageNumber)));

      for (const data of results) {
        allGames.push(...data.games);
      }

      hasMore = results[results.length - 1]?.has_more === true;
      page += pages.length;

      if (page > 10000) {
        throw new Error('Games pagination exceeded the expected page count');
      }
    }

    return {
      success: true,
      games: allGames,
      total_games: allGames.length,
      pagination: { complete: true }
    };
  }, []);

  // Fetch games from database - immediately on component mount, not in useEffect
  const performFetch = useCallback(async () => {
    if (fetchInProgressRef.current) return;
    fetchInProgressRef.current = true;

    try {
      const apiUrl = buildApiUrl('/api');
      
      console.log('🔄 Fetching fresh games from:', apiUrl);

      const showFirstPage = (firstPage: any[]) => {
        const firstGames: GameOdds[] = firstPage.map((g: any) => ({
          id: g.game_id || g.id,
          league: g.league || '',
          homeTeam: g.home_team,
          awayTeam: g.away_team,
          homeOdds: parseFloat(g.home_odds) || 2.0,
          drawOdds: parseFloat(g.draw_odds) || 3.0,
          awayOdds: parseFloat(g.away_odds) || 3.0,
          time: g.scheduled_time || g.time || new Date().toISOString(),
          status: g.status || 'upcoming',
          markets: g.markets || {},
          homeScore: g.home_score || 0,
          awayScore: g.away_score || 0,
          minute: g.minute || 0,
          seconds: 0,
          kickoffStartTime: g.kickoff_start_time || undefined,
          isKickoffStarted: g.is_kickoff_started || false,
          gamePaused: g.game_paused || false,
          kickoffPausedAt: g.kickoff_paused_at || undefined,
          isHalftime: g.is_halftime || false,
          sport: g.sport || 'football',
        }));
        const visibleGames = mergePendingLocalGames(firstGames);
        setGames(visibleGames);
        gamesRef.current = visibleGames;
        setIsLoading(false);
        console.log('⚡ Rendered first game page:', visibleGames.length);
      };

      // Upcoming is the first user-visible section. Request it separately so
      // every current upcoming match is rendered together instead of showing
      // an ID-sorted subset while the full archive loads.
      await fetchAllGames(apiUrl, undefined, showFirstPage, 'upcoming');
      const data = await fetchAllGames(apiUrl);
      console.log('📊 Loaded all game pages');

      if (data.success && Array.isArray(data.games)) {
          console.log(
            '✅ Successfully loaded',
            data.games.length,
            'of',
            data.total_games ?? data.games.length,
            'games from API'
          );
          
          // Transform database games to GameOdds format
          const transformedGames: GameOdds[] = data.games.map((g: any) => ({
            id: g.game_id || g.id,
            league: g.league || '',
            homeTeam: g.home_team,
            awayTeam: g.away_team,
            homeOdds: parseFloat(g.home_odds) || 2.0,
            drawOdds: parseFloat(g.draw_odds) || 3.0,
            awayOdds: parseFloat(g.away_odds) || 3.0,
            time: g.scheduled_time || g.time || new Date().toISOString(),
            status: g.status || 'upcoming',
            markets: g.markets || {},
            homeScore: g.home_score || 0,
            awayScore: g.away_score || 0,
            minute: g.minute || 0,
            seconds: 0, // Initialize seconds to 0 - calculated on frontend
            kickoffStartTime: g.kickoff_start_time || undefined,
            isKickoffStarted: g.is_kickoff_started || false,
            gamePaused: g.game_paused || false,
            kickoffPausedAt: g.kickoff_paused_at || undefined,
            isHalftime: g.is_halftime || false,
            sport: g.sport || 'football',
          }));
          
          // Remove duplicates by ID and sort by ID for stable ordering to prevent reranking/collision issues
          const seenIds = new Set<string>();
          const deduplicatedGames = transformedGames.filter(game => {
            if (seenIds.has(game.id)) {
              console.warn(`⚠️ Duplicate game removed: ${game.id} (${game.homeTeam} vs ${game.awayTeam})`);
              return false;
            }
            seenIds.add(game.id);
            return true;
          });
          
          const sortedGames = mergePendingLocalGames(deduplicatedGames);
          setGames(sortedGames);
          gamesRef.current = sortedGames;
          for (const gameId of pendingLocalGamesRef.current.keys()) {
            if (deduplicatedGames.some((game) => game.id === gameId)) {
              pendingLocalGamesRef.current.delete(gameId);
            }
          }
          setLoadError(null);
      } else {
        console.warn('⚠️ Invalid response format:', data);
        preserveCurrentGames();
        setLoadError(null);
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('❌ Error fetching games:', error);
      }
      preserveCurrentGames();
      setLoadError(null); // Don't block app from loading
    } finally {
      setIsLoading(false);
      fetchInProgressRef.current = false;
    }
  }, [fetchAllGames, mergePendingLocalGames, preserveCurrentGames]);

  useEffect(() => {
    try {
      localStorage.removeItem('betnexa_games_cache');
    } catch (error) {
      console.warn('⚠️ Unable to clear stale local game cache:', error);
    }
  }, []);

  // Fetch games immediately on mount - this runs before useEffect
  useEffect(() => {
    performFetch();

    // No auto-refresh needed - timer polling handles live game updates
    return () => {
      // Cleanup handled by timer effect
    };
  }, [performFetch]);

  // Timer polling for live games - fetch server time to sync across all users/admin
  useEffect(() => {
    const timerInterval = setInterval(async () => {
      // Find all live games that are in kickoff using the ref (avoids recreating interval)
      const liveGames = gamesRef.current.filter(g => g.isKickoffStarted && (g.status === 'live' || g.minute === undefined));
      
      if (liveGames.length === 0) return; // No live games, skip fetch

      const apiUrl = import.meta.env.VITE_API_URL || 'https://www.betnexabackend.co.ke';
      const now = Date.now();

      // Separate games into local-calc and backend-fetch groups
      const localGames = [];
      const backendGames = [];

      for (const game of liveGames) {
        const kickoffTime = kickoffTimesRef.current[game.id];
        const timeSinceKickoff = kickoffTime ? now - kickoffTime : -1;
        
        if (kickoffTime && timeSinceKickoff < 2000) {
          // Game just kicked off - use local time
          const elapsedMs = timeSinceKickoff;
          const totalSeconds = Math.floor(elapsedMs / 1000);
          localGames.push({
            gameId: game.id,
            minute: Math.floor(totalSeconds / 60),
            seconds: totalSeconds % 60,
            isHalftime: false,
            gamePaused: false,
            source: 'local'
          });
        } else {
          // After 2 seconds, add to backend fetch list
          backendGames.push(game);
        }
      }

      // ⚡ OPTIMIZATION: Use batch endpoint for multiple games (replaces individual requests)
      // This reduces: 20 games = 20 requests → 1 request (95% reduction)
      let backendResults = [];
      if (backendGames.length > 0) {
        try {
          const gameIds = backendGames.map(g => g.id).join(',');
          const response = await fetch(`${apiUrl}/api/admin/games/times/batch?ids=${encodeURIComponent(gameIds)}`);

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.games) {
              backendResults = data.games.map((g: any) => ({
                gameId: g.gameId,
                minute: g.minute ?? 0,
                seconds: g.seconds ?? 0,
                isHalftime: g.isHalftime ?? false,
                gamePaused: g.gamePaused ?? false,
                source: 'batch'
              }));
            }
          }
        } catch (error) {
          console.error('Timer batch fetch failed:', error);
        }
      }

      // Combine local and backend results
      const allResults = [...localGames, ...backendResults];

      // Batch all updates into a single setGames call
      if (allResults.length > 0) {
        setGames(prev => {
          let hasChanges = false;
          const updated = prev.map(g => {
            const timerUpdate = allResults.find(r => r.gameId === g.id);
            if (timerUpdate && (g.minute !== timerUpdate.minute || g.seconds !== timerUpdate.seconds || g.isHalftime !== timerUpdate.isHalftime || g.gamePaused !== timerUpdate.gamePaused)) {
              hasChanges = true;
              return { ...g, minute: timerUpdate.minute, seconds: timerUpdate.seconds, isHalftime: timerUpdate.isHalftime, gamePaused: timerUpdate.gamePaused };
            }
            return g;
          });
          if (!hasChanges) return prev;
          gamesRef.current = updated;
          return updated;
        });
      }
    }, 1000); // Poll every second for live games

    return () => clearInterval(timerInterval);
  }, []); // No dependencies - interval runs once and uses ref for current games

  // ⛔ Live data polling DISABLED — automatic sync from API-Football disabled
  // Admin must manually trigger syncs. This prevents continuous API calls.
  // useEffect(() => {
  //   const syncApiGames = async () => {
  //     if (!hasApiGamesNeedingSync()) return;
  //
  //     const apiUrl = import.meta.env.VITE_API_URL || 'https://www.betnexabackend.co.ke';
  //
  //     try {
  //       // 1. Trigger a server-side sync of scores + odds from API-Football
  //       await fetch(`${apiUrl}/api/live/sync`, { signal: AbortSignal.timeout(15000) });
  //
  //       // 2. Refresh full game list so status transitions (live -> finished)
  //       // are reflected immediately in the UI sections.
  //       await refreshGames();
  //     } catch {
  //       // Silently ignore — live data will try again next cycle
  //     }
  //   };
  //
  //   syncApiGames();
  //   const liveDataInterval = setInterval(syncApiGames, 30000); // Poll every 30 seconds
  //
  //   return () => clearInterval(liveDataInterval);
  // }, []); // No dependencies - uses ref for current games

  // Refresh the full game list periodically so DB-driven status changes
  // (such as scheduled kickoff events) appear for all users without a manual reload.
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      refreshGames();
    }, 15000);

    return () => clearInterval(refreshInterval);
  }, []);

  // ⛔ Daily schedule maintenance DISABLED — automatic bootstrap-schedule fetch removed
  // useEffect(() => {
  //   const ensureSchedule = async () => {
  //     const apiUrl = import.meta.env.VITE_API_URL || 'https://www.betnexabackend.co.ke';
  //     try {
  //       const resp = await fetch(`${apiUrl}/api/live/bootstrap-schedule`, {
  //         signal: AbortSignal.timeout(45000),
  //       });
  //       if (!resp.ok) return;
  //       const data = await resp.json();
  //       if (data?.success && data?.refreshed) {
  //         await refreshGames();
  //       }
  //     } catch {
  //       // Silent retry on next interval
  //     }
  //   };
  //
  //   const scheduleInterval = setInterval(ensureSchedule, 10 * 60 * 1000);
  //   return () => clearInterval(scheduleInterval);
  // }, []);

  const refreshGames = async () => {
    if (refreshInProgressRef.current) return;
    refreshInProgressRef.current = true;

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'https://www.betnexabackend.co.ke';
      
      const controller = new AbortController();
      // Pagination can require several round trips once the database has more
      // than Supabase's 1,000-row response limit.
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const data = await fetchAllGames(`${apiUrl}/api`, controller.signal);

      clearTimeout(timeoutId);

      if (data.success && Array.isArray(data.games)) {
          if (data.pagination?.complete !== true) {
            console.warn('⚠️ Games response did not confirm complete pagination:', data.pagination);
          }

          // Transform database games to GameOdds format
          const transformedGames: GameOdds[] = data.games.map((g: any) => ({
            id: g.game_id || g.id,
            league: g.league || '',
            homeTeam: g.home_team,
            awayTeam: g.away_team,
            homeOdds: parseFloat(g.home_odds) || 2.0,
            drawOdds: parseFloat(g.draw_odds) || 3.0,
            awayOdds: parseFloat(g.away_odds) || 3.0,
            time: g.scheduled_time || g.time || new Date().toISOString(),
            status: g.status || 'upcoming',
            markets: g.markets || {},
            homeScore: g.home_score || 0,
            awayScore: g.away_score || 0,
            minute: g.minute || 0,
            seconds: 0, // Initialize seconds to 0 - calculated on frontend
            kickoffStartTime: g.kickoff_start_time || undefined,
            isKickoffStarted: g.is_kickoff_started || false,
            gamePaused: g.game_paused || false,
            kickoffPausedAt: g.kickoff_paused_at || undefined,
            isHalftime: g.is_halftime || false,
            isHot: g.is_hot || false,
          }));
          
          // Remove duplicates by ID and sort by ID for stable ordering to prevent reranking/collision issues
          const seenIds = new Set<string>();
          const deduplicatedGames = transformedGames.filter(game => {
            if (seenIds.has(game.id)) {
              console.warn(`⚠️ Duplicate game removed in refresh: ${game.id} (${game.homeTeam} vs ${game.awayTeam})`);
              return false;
            }
            seenIds.add(game.id);
            return true;
          });
          
          const sortedGames = mergePendingLocalGames(deduplicatedGames);
          setGames(sortedGames);
          gamesRef.current = sortedGames;
      } else {
        preserveCurrentGames();
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('❌ Error refreshing games:', error);
      }
      preserveCurrentGames();
    } finally {
      refreshInProgressRef.current = false;
    }
  };

  const addGame = (game: GameOdds) => {
    pendingLocalGamesRef.current.set(game.id, { game, createdAt: Date.now() });
    setGames((prev) => {
      // Check for duplicates by ID
      if (prev.some(g => g.id === game.id)) {
        console.warn(`⚠️ Duplicate game detected with ID ${game.id}, skipping add`);
        return prev;
      }
      // Add new game and maintain stable sort by ID
      const updated = [...prev, game].sort((a, b) => a.id.localeCompare(b.id));
      gamesRef.current = updated;
      return updated;
    });
  };

  const updateGame = (id: string, updates: Partial<GameOdds>) => {
    const existingPending = pendingLocalGamesRef.current.get(id);
    if (existingPending) {
      pendingLocalGamesRef.current.set(id, {
        game: { ...existingPending.game, ...updates },
        createdAt: existingPending.createdAt,
      });
    }

    setGames((prev) => {
      const updated = prev.map((game) => {
        if (game.id === id) {
          const newGame = { ...game, ...updates };
          // Track when game was kicked off
          if (!game.isKickoffStarted && newGame.isKickoffStarted) {
            kickoffTimesRef.current[id] = Date.now();
            console.log(`⏱️ [KICKOFF] Game ${id} started at ${new Date(kickoffTimesRef.current[id]).toISOString()}`);
          }
          return newGame;
        }
        return game;
      });
      // Maintain stable sort order by ID to prevent reranking issues
      const stableSorted = updated.sort((a, b) => a.id.localeCompare(b.id));
      gamesRef.current = stableSorted;
      return stableSorted;
    });
  };

  const removeGame = (id: string) => {
    pendingLocalGamesRef.current.delete(id);
    setGames((prev) => {
      const updated = prev.filter((game) => game.id !== id);
      gamesRef.current = updated;
      return updated;
    });
  };

  const getGame = (id: string) => {
    return games.find((game) => game.id === id);
  };

  const updateGameMarkets = (id: string, markets: Record<string, number>) => {
    updateGame(id, { markets });
  };

  return (
    <OddsContext.Provider
      value={{ games, isLoading, addGame, updateGame, removeGame, getGame, updateGameMarkets, refreshGames }}
    >
      {children}
    </OddsContext.Provider>
  );
}

export function useOdds() {
  const context = useContext(OddsContext);
  if (context === undefined) {
    throw new Error("useOdds must be used within an OddsProvider");
  }
  return context;
}
