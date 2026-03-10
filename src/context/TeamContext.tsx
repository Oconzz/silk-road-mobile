import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  teamService,
  type TeamMember,
  type InviteTeamMemberRequest,
  type TeamMemberListRequest,
} from '../services/api/domain/team/teamService';
import { useAuth } from './AuthContext';

interface TeamContextType {
  teamMembers: TeamMember[];
  selectedMember: TeamMember | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadTeamMembers: (request?: TeamMemberListRequest) => Promise<void>;
  loadTeamMember: (userId: string) => Promise<TeamMember | null>;
  inviteTeamMember: (request: InviteTeamMemberRequest) => Promise<{ 
    success: boolean; 
    message: string;
    email?: string;
    fullName?: string;
    temporaryPassword?: string;
    isNewUser?: boolean;
  }>;
  updateMemberRole: (userId: string, role: string) => Promise<boolean>;
  removeMember: (userId: string) => Promise<boolean>;
  clearError: () => void;
  
  // Check if current user is admin
  isAdmin: boolean;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export const useTeam = () => {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
};

interface TeamProviderProps {
  children: ReactNode;
}

export const TeamProvider: React.FC<TeamProviderProps> = ({ children }) => {
  const { currentCompany } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if current user is admin based on company role
  const isAdmin = currentCompany?.role === 'Admin' || currentCompany?.role === 'SuperAdmin';

  const loadTeamMembers = useCallback(async (request?: TeamMemberListRequest) => {
    if (!currentCompany) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await teamService.getTeamMembers(request);
      setTeamMembers(response.items || []);
    } catch (err: any) {
      console.error('[TeamContext] Error loading team members:', err);
      setError(err.message || 'Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  }, [currentCompany]);

  const loadTeamMember = useCallback(async (userId: string): Promise<TeamMember | null> => {
    if (!currentCompany) return null;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const member = await teamService.getTeamMember(userId);
      setSelectedMember(member);
      return member;
    } catch (err: any) {
      console.error('[TeamContext] Error loading team member:', err);
      setError(err.message || 'Failed to load team member');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentCompany]);

  const inviteTeamMember = useCallback(async (request: InviteTeamMemberRequest): Promise<{ 
    success: boolean; 
    message: string;
    email?: string;
    fullName?: string;
    temporaryPassword?: string;
    isNewUser?: boolean;
  }> => {
    if (!currentCompany) {
      return { success: false, message: 'No company selected' };
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await teamService.inviteTeamMember(request);
      
      if (response.success) {
        // Reload team members list
        await loadTeamMembers();
      }
      
      return { 
        success: response.success, 
        message: response.message,
        email: response.email,
        fullName: response.fullName,
        temporaryPassword: response.temporaryPassword,
        isNewUser: response.isNewUser,
      };
    } catch (err: any) {
      console.error('[TeamContext] Error inviting team member:', err);
      const message = err.message || 'Failed to invite team member';
      setError(message);
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  }, [currentCompany, loadTeamMembers]);

  const updateMemberRole = useCallback(async (userId: string, role: string): Promise<boolean> => {
    if (!currentCompany) return false;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await teamService.updateTeamMemberRole({ userId, role });
      
      // Update local state
      setTeamMembers(prev => 
        prev.map(m => m.id === userId ? { ...m, role } : m)
      );
      
      if (selectedMember?.id === userId) {
        setSelectedMember(prev => prev ? { ...prev, role } : null);
      }
      
      return true;
    } catch (err: any) {
      console.error('[TeamContext] Error updating role:', err);
      setError(err.message || 'Failed to update role');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentCompany, selectedMember]);

  const removeMember = useCallback(async (userId: string): Promise<boolean> => {
    if (!currentCompany) return false;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await teamService.removeTeamMember(userId);
      
      // Update local state
      setTeamMembers(prev => prev.filter(m => m.id !== userId));
      
      if (selectedMember?.id === userId) {
        setSelectedMember(null);
      }
      
      return true;
    } catch (err: any) {
      console.error('[TeamContext] Error removing member:', err);
      setError(err.message || 'Failed to remove team member');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentCompany, selectedMember]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: TeamContextType = {
    teamMembers,
    selectedMember,
    isLoading,
    error,
    loadTeamMembers,
    loadTeamMember,
    inviteTeamMember,
    updateMemberRole,
    removeMember,
    clearError,
    isAdmin,
  };

  return (
    <TeamContext.Provider value={value}>
      {children}
    </TeamContext.Provider>
  );
};
