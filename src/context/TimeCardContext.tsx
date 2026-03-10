import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { timeCardService } from '../services/api/domain/timeCard/timeCardService';
import { useAuth } from './AuthContext';
import type { TimeCardListItem, TimeCardSummary, ActiveTimeCard, ClockInRequest } from '../types/timeCard';

interface LoadTimeCardsOptions {
  viewTeam?: boolean;
  forceRefresh?: boolean;
}

interface TimeCardContextType {
  timeCards: TimeCardListItem[];
  activeTimeCard: ActiveTimeCard | null;
  weeklySummary: TimeCardSummary | null;
  loading: boolean;
  error: string | null;
  isClockedIn: boolean;
  loadTimeCards: (options?: LoadTimeCardsOptions) => Promise<void>;
  loadActiveTimeCard: () => Promise<void>;
  loadWeeklySummary: () => Promise<void>;
  clockIn: (request?: ClockInRequest) => Promise<void>;
  clockOut: (notes?: string) => Promise<void>;
  clearError: () => void;
}

const TimeCardContext = createContext<TimeCardContextType | undefined>(undefined);

export const useTimeCard = () => {
  const context = useContext(TimeCardContext);
  if (!context) {
    throw new Error('useTimeCard must be used within a TimeCardProvider');
  }
  return context;
};

interface TimeCardProviderProps {
  children: ReactNode;
}

export const TimeCardProvider: React.FC<TimeCardProviderProps> = ({ children }) => {
  const { isAuthenticated, currentCompany } = useAuth();
  const [timeCards, setTimeCards] = useState<TimeCardListItem[]>([]);
  const [activeTimeCard, setActiveTimeCard] = useState<ActiveTimeCard | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<TimeCardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isClockedIn = activeTimeCard !== null;

  const loadTimeCards = useCallback(async (options: LoadTimeCardsOptions = {}) => {
    if (!isAuthenticated || !currentCompany) return;
    try {
      setLoading(true);
      setError(null);
      const response = await timeCardService.getTimeCards({ 
        pageSize: 100,
        viewTeam: options.viewTeam ?? false,
      });
      setTimeCards(response.items || []);
    } catch (err: any) {
      console.error('[TimeCardContext] Error loading time cards:', err);
      setError(err.message || 'Failed to load time cards');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentCompany]);

  const loadActiveTimeCard = useCallback(async () => {
    if (!isAuthenticated || !currentCompany) return;
    try {
      const active = await timeCardService.getActiveTimeCard();
      setActiveTimeCard(active);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setActiveTimeCard(null);
      } else {
        console.error('[TimeCardContext] Error loading active time card:', err);
      }
    }
  }, [isAuthenticated, currentCompany]);

  const loadWeeklySummary = useCallback(async () => {
    if (!isAuthenticated || !currentCompany) return;
    try {
      const summary = await timeCardService.getWeeklySummary();
      setWeeklySummary(summary);
    } catch (err: any) {
      console.error('[TimeCardContext] Error loading weekly summary:', err);
    }
  }, [isAuthenticated, currentCompany]);

  const clockIn = useCallback(async (request: ClockInRequest = {}) => {
    try {
      setLoading(true);
      setError(null);
      const result = await timeCardService.clockIn(request);
      setActiveTimeCard({
        id: result.id,
        jobId: result.jobId,
        jobName: result.jobName,
        clockInTime: result.clockInTime,
        elapsedHours: 0,
      });
    } catch (err: any) {
      console.error('[TimeCardContext] Error clocking in:', err);
      setError(err.message || 'Failed to clock in');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clockOut = useCallback(async (notes?: string) => {
    if (!activeTimeCard) {
      setError('No active time card to clock out');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await timeCardService.clockOut({ timeCardId: activeTimeCard.id, notes });
      setActiveTimeCard(null);
      await loadTimeCards({ forceRefresh: true });
      await loadWeeklySummary();
    } catch (err: any) {
      console.error('[TimeCardContext] Error clocking out:', err);
      setError(err.message || 'Failed to clock out');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [activeTimeCard, loadTimeCards, loadWeeklySummary]);

  const clearError = useCallback(() => setError(null), []);

  // Load data on mount
  useEffect(() => {
    if (isAuthenticated && currentCompany) {
      loadActiveTimeCard();
      loadWeeklySummary();
    }
  }, [isAuthenticated, currentCompany, loadActiveTimeCard, loadWeeklySummary]);

  // Clear state on company change
  useEffect(() => {
    setTimeCards([]);
    setActiveTimeCard(null);
    setWeeklySummary(null);
    setError(null);
  }, [currentCompany?.companyId]);

  const value: TimeCardContextType = {
    timeCards,
    activeTimeCard,
    weeklySummary,
    loading,
    error,
    isClockedIn,
    loadTimeCards,
    loadActiveTimeCard,
    loadWeeklySummary,
    clockIn,
    clockOut,
    clearError,
  };

  return <TimeCardContext.Provider value={value}>{children}</TimeCardContext.Provider>;
};
