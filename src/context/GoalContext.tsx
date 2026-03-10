import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { goalService } from '../services/goalService';
import type { Goal, CreateGoalRequest, UpdateGoalRequest, JobGoalsSummary, UserGoalsSummary, GoalContextType } from '../types/goal';

const GoalContext = createContext<GoalContextType | undefined>(undefined);

interface GoalProviderProps {
  children: ReactNode;
}

export const GoalProvider: React.FC<GoalProviderProps> = ({ children }) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [currentGoal, setCurrentGoal] = useState<Goal | null>(null);
  const [jobGoals, setJobGoals] = useState<Goal[]>([]);
  const [myGoals, setMyGoals] = useState<Goal[]>([]);
  const [jobGoalsSummary, setJobGoalsSummary] = useState<JobGoalsSummary | null>(null);
  const [userGoalsSummary, setUserGoalsSummary] = useState<UserGoalsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createGoal = useCallback(async (data: CreateGoalRequest): Promise<Goal> => {
    setIsLoading(true);
    setError(null);
    try {
      const newGoal = await goalService.createGoal(data);
      setJobGoals(prev => [...prev, newGoal]);
      return newGoal;
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to create goal';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateGoal = useCallback(async (goalId: string, data: UpdateGoalRequest): Promise<Goal> => {
    setIsLoading(true);
    setError(null);
    try {
      const updatedGoal = await goalService.updateGoal(goalId, data);
      setJobGoals(prev => prev.map(g => g.id === goalId ? updatedGoal : g));
      setMyGoals(prev => prev.map(g => g.id === goalId ? updatedGoal : g));
      if (currentGoal?.id === goalId) {
        setCurrentGoal(updatedGoal);
      }
      return updatedGoal;
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to update goal';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentGoal]);

  const deleteGoal = useCallback(async (goalId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await goalService.deleteGoal(goalId);
      setJobGoals(prev => prev.filter(g => g.id !== goalId));
      setMyGoals(prev => prev.filter(g => g.id !== goalId));
      if (currentGoal?.id === goalId) {
        setCurrentGoal(null);
      }
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to delete goal';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentGoal]);

  const completeGoal = useCallback(async (goalId: string): Promise<Goal> => {
    setIsLoading(true);
    setError(null);
    try {
      const completedGoal = await goalService.completeGoal(goalId);
      setJobGoals(prev => prev.map(g => g.id === goalId ? completedGoal : g));
      setMyGoals(prev => prev.map(g => g.id === goalId ? completedGoal : g));
      if (currentGoal?.id === goalId) {
        setCurrentGoal(completedGoal);
      }
      return completedGoal;
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to complete goal';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentGoal]);

  const voteGoalComplete = useCallback(async (goalId: string): Promise<Goal> => {
    setIsLoading(true);
    setError(null);
    try {
      const votedGoal = await goalService.voteGoalComplete(goalId);
      setJobGoals(prev => prev.map(g => g.id === goalId ? votedGoal : g));
      setMyGoals(prev => prev.map(g => g.id === goalId ? votedGoal : g));
      if (currentGoal?.id === goalId) {
        setCurrentGoal(votedGoal);
      }
      return votedGoal;
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to vote on goal';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentGoal]);

  const forceCompleteGoal = useCallback(async (goalId: string): Promise<Goal> => {
    setIsLoading(true);
    setError(null);
    try {
      const completedGoal = await goalService.forceCompleteGoal(goalId);
      setJobGoals(prev => prev.map(g => g.id === goalId ? completedGoal : g));
      setMyGoals(prev => prev.map(g => g.id === goalId ? completedGoal : g));
      if (currentGoal?.id === goalId) {
        setCurrentGoal(completedGoal);
      }
      return completedGoal;
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to force complete goal';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentGoal]);

  const reopenGoal = useCallback(async (goalId: string): Promise<Goal> => {
    setIsLoading(true);
    setError(null);
    try {
      const reopenedGoal = await goalService.reopenGoal(goalId);
      setJobGoals(prev => prev.map(g => g.id === goalId ? reopenedGoal : g));
      setMyGoals(prev => prev.map(g => g.id === goalId ? reopenedGoal : g));
      if (currentGoal?.id === goalId) {
        setCurrentGoal(reopenedGoal);
      }
      return reopenedGoal;
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to reopen goal';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentGoal]);

  const loadGoal = useCallback(async (goalId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const goal = await goalService.getGoal(goalId);
      setCurrentGoal(goal);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to load goal';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadJobGoals = useCallback(async (jobId: string, status?: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const goals = await goalService.getJobGoals(jobId, status);
      setJobGoals(goals);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to load job goals';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMyGoals = useCallback(async (status?: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const goals = await goalService.getMyGoals(status);
      setMyGoals(goals);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to load my goals';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadJobGoalsSummary = useCallback(async (jobId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const summary = await goalService.getJobGoalsSummary(jobId);
      setJobGoalsSummary(summary);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to load job goals summary';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadUserGoalsSummary = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const summary = await goalService.getMyGoalsSummary();
      setUserGoalsSummary(summary);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to load user goals summary';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const bulkCreateGoals = useCallback(async (jobId: string, goalsData: CreateGoalRequest[]): Promise<Goal[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const newGoals = await goalService.bulkCreateGoals(jobId, goalsData);
      setJobGoals(prev => [...prev, ...newGoals]);
      return newGoals;
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to create goals';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: GoalContextType = {
    goals,
    currentGoal,
    jobGoals,
    myGoals,
    jobGoalsSummary,
    userGoalsSummary,
    isLoading,
    error,
    createGoal,
    updateGoal,
    deleteGoal,
    completeGoal,
    voteGoalComplete,
    forceCompleteGoal,
    reopenGoal,
    loadGoal,
    loadJobGoals,
    loadMyGoals,
    loadJobGoalsSummary,
    loadUserGoalsSummary,
    bulkCreateGoals,
    clearError,
  };

  return (
    <GoalContext.Provider value={value}>
      {children}
    </GoalContext.Provider>
  );
};

export const useGoal = (): GoalContextType => {
  const context = useContext(GoalContext);
  if (!context) {
    throw new Error('useGoal must be used within a GoalProvider');
  }
  return context;
};
