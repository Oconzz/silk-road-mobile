import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { jobService } from '../services/api/domain/jobs/jobService';
import { jobAssignmentService } from '../services/api/domain/jobAssignment/jobAssignmentService';
import { jobNoteService } from '../services/api/domain/jobs/jobNoteService';
import { clientService } from '../services/api/domain/clients/clientService';
import { inventoryService } from '../services/api/domain/inventory/inventoryService';
import { StorageService } from '../services/api/shared/utils';
import { useAuth } from './AuthContext';
import { usePermissions, PermissionKeys } from './PermissionContext';
import type {
  CreateJobVM,
  UpdateJobVM,
} from '../types/apiRequests';
import type {
  JobRM,
  JobListItem,
} from '../types/apiResponses';

import type { JobContextType, SetRecurrenceRequest, JobOccurrencesResponse } from '../types/job';
import { haptics } from '../utils/haptics';

const JobContext = createContext<JobContextType | undefined>(undefined);

export const useJob = () => {
  const context = useContext(JobContext);
  if (!context) {
    throw new Error('useJob must be used within a JobProvider');
  }
  return context;
};

interface JobProviderProps {
  children: ReactNode;
};

export const JobProvider: React.FC<JobProviderProps> = ({ children }) => {
  const { isAuthenticated, currentCompany } = useAuth();
  const { hasPermission } = usePermissions();
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [currentJob, setCurrentJob] = useState<JobRM | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use company-specific cache key for data isolation
  const cacheKey = currentCompany?.companyId
    ? `@nmj_${currentCompany.companyId}_jobs`
    : '@nmj_default_jobs';

  // Clear state when company changes to prevent data leaking between accounts
  useEffect(() => {
    setJobs([]);
    setCurrentJob(null);
    setError(null);
  }, [currentCompany?.companyId]);

  // Helper to check if user can view all jobs (role-based OR permission-based)
  const canViewAllJobs = useCallback(() => {
    if (!currentCompany?.role) return false;
    const role = currentCompany.role.toLowerCase();
    // Admin/Leader by role OR has ViewAllJobs permission
    return role === 'admin' || role === 'superadmin' || role === 'leader' || hasPermission(PermissionKeys.ViewAllJobs);
  }, [currentCompany, hasPermission]);

  // Load jobs from backend or cache
  // For Admin/Leader: loads all jobs
  // For Crew: loads only assigned jobs
  const loadJobs = useCallback(async (forceRefresh = false) => {
    if (!isAuthenticated || !currentCompany) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Try to load from cache first
      if (!forceRefresh) {
        const cached = await StorageService.getData<JobListItem[]>(cacheKey);
        if (cached && cached.length > 0) {
          setJobs(cached);
        }
      }

      let data: JobListItem[] = [];

      // Check if user can view all jobs (by role OR by permission)
      if (canViewAllJobs()) {
        // User has access to all jobs
        console.log('[JobContext] Loading all jobs (canViewAllJobs=true)');
        const response = await jobService.getJobList({
          pageSize: 100,
        });
        data = response?.items || [];
      } else {
        // Crew without ViewAllJobs permission: Load only assigned jobs
        console.log('[JobContext] Loading assigned jobs only (canViewAllJobs=false)');
        const response = await jobAssignmentService.getMyAssignedJobs({
          pageSize: 100,
        });
        data = response?.items || [];
      }

      setJobs(data);

      // Always update cache with current data (even if empty)
      await StorageService.setData(cacheKey, data);
    } catch (err: any) {
      console.error('Error loading jobs:', err);
      setError(err.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, currentCompany, canViewAllJobs, cacheKey]);

  // Load single job
  const loadJob = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      // Use different endpoint based on permissions
      let job;
      if (canViewAllJobs()) {
        job = await jobService.getJobById(id);
      } else {
        // Crew without ViewAllJobs permission uses the assignment endpoint
        job = await jobService.getMyAssignedJobById(id);
      }

      // Null check: job may be null if deleted or unavailable
      if (!job) {
        setError('Job not found or is no longer available');
        setCurrentJob(null);
        return;
      }

      console.log('[JobContext] loadJob API response:', {
        id: job.id,
        title: job.title,
        jobInventoryLength: job.jobInventory?.length,
        jobInventory: job.jobInventory,
      });

      // Normalize jobInventory to always be an array (API may return null)
      const normalizedInventory = job.jobInventory || [];

      // Map jobInventory to lineItems for frontend compatibility
      // Backend returns 'jobInventory', frontend expects 'lineItems' for display
      const mappedJob = {
        ...job,
        // Ensure jobInventory is always an array (not null)
        jobInventory: normalizedInventory,
        lineItems: normalizedInventory.map((item: any) => ({
          id: item.id,
          productId: item.productId,
          warehouseId: item.warehouseId,
          inventoryId: item.inventoryId, // Track inventory ID for deduction on job completion
          title: item.title || item.description || 'Material',
          description: item.title || item.description || '',
          quantity: item.idealQuantity || item.quantity || 1,
          price: item.price || 0,
          sellPrice: item.price || 0,
          labor: item.labor || 0,
          laborRate: item.labor || 0,
          cost: item.price || 0,
          lineTotal: (item.price || 0) * (item.idealQuantity || item.quantity || 1),
        })),
        // Map notes to frontend format (createDatetime -> createdAt, createdByName -> createdBy)
        notes: (job.notes || []).map((n: any) => ({
          id: n.id,
          content: n.content,
          createdAt: n.createDatetime || n.createdAt,
          createdBy: n.createdByName || n.createdBy,
        })),
        // Map media to ensuring uri is present (backend uses webUrl/thumbUrl)
        media: (job.media || []).map((m: any) => ({
          ...m,
          uri: m.webUrl || m.url || m.uri,
          thumbnailUri: m.thumbUrl || m.thumbnailUrl || m.thumbnailUri,
        })),
      };

      setCurrentJob(mappedJob);
    } catch (err: any) {
      console.error('Error loading job:', err);
      setError(err.message || 'Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [canViewAllJobs]);

  // Create job
  const createJob = useCallback(async (data: CreateJobVM): Promise<JobRM> => {
    try {
      setLoading(true);
      setError(null);

      const newJob = await jobService.createJob(data);

      // Haptic feedback on success
      haptics.success();

      // Refresh the list
      await loadJobs(true);

      return newJob;
    } catch (err: any) {
      console.error('Error creating job:', err);
      setError(err.message || 'Failed to create job');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadJobs]);

  // Update job
  const updateJob = useCallback(async (
    id: string,
    data: UpdateJobVM
  ): Promise<JobRM> => {
    try {
      setLoading(true);
      setError(null);

      const updatedJob = await jobService.updateJob({
        ...data,
        id,
      });

      // Refresh the list
      await loadJobs(true);

      // Update current job if it's the one being updated
      if (currentJob?.id === id) {
        // Map the response to match frontend format (same as loadJob)
        const normalizedInventory = updatedJob.jobInventory || [];
        const mappedJob = {
          ...updatedJob,
          jobInventory: normalizedInventory,
          lineItems: normalizedInventory.map((item: any) => ({
            id: item.id,
            productId: item.productId,
            warehouseId: item.warehouseId,
            inventoryId: item.inventoryId,
            title: item.title || item.description || 'Material',
            description: item.title || item.description || '',
            quantity: item.idealQuantity || item.quantity || 1,
            price: item.price || 0,
            sellPrice: item.price || 0,
            labor: item.labor || 0,
            laborRate: item.labor || 0,
            cost: item.price || 0,
            lineTotal: (item.price || 0) * (item.idealQuantity || item.quantity || 1),
          })),
          // Map notes to frontend format (createDatetime -> createdAt, createdByName -> createdBy)
          notes: (updatedJob.notes || []).map((n: any) => ({
            id: n.id,
            content: n.content,
            createdAt: n.createDatetime || n.createdAt,
            createdBy: n.createdByName || n.createdBy,
          })),
          // Map media
          media: (updatedJob.media || []).map((m: any) => ({
            ...m,
            uri: m.webUrl || m.url || m.uri,
            thumbnailUri: m.thumbUrl || m.thumbnailUrl || m.thumbnailUri,
          })),
        };
        setCurrentJob(mappedJob);
      }

      return updatedJob;
    } catch (err: any) {
      console.error('Error updating job:', err);
      setError(err.message || 'Failed to update job');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadJobs, currentJob]);

  // Delete job
  const deleteJob = useCallback(async (id: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      await jobService.deleteJob(id);

      // Remove from local state
      setJobs(prev => prev.filter(j => j.id !== id));

      // Clear current job if it's the one being deleted
      if (currentJob?.id === id) {
        setCurrentJob(null);
      }

      // Update cache
      const updatedJobs = jobs.filter(j => j.id !== id);
      await StorageService.setData(cacheKey, updatedJobs);
    } catch (err: any) {
      console.error('Error deleting job:', err);
      setError(err.message || 'Failed to delete job');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [jobs, currentJob, cacheKey]);

  // Initialize job for edit mode (mirrors EstimateContext pattern)
  const initDraftForEdit = useCallback((job: JobRM) => {
    console.log('[JobContext] initDraftForEdit called with:', {
      id: job.id,
      title: job.title,
      jobInventoryLength: job.jobInventory?.length,
      jobInventory: job.jobInventory,
      lineItemsLength: (job as any).lineItems?.length,
    });
    // Map job data to the format expected by CreateJobScreen
    // IMPORTANT: Preserve jobInventory for CreateJobScreen to convert to lineItems
    const mappedJob = {
      ...job,
      // Ensure IDs are preserved
      id: job.id,
      // Preserve jobInventory explicitly (spread should include it, but being explicit)
      jobInventory: job.jobInventory || [],
      // Map media to ensure uri is available
      media: (job.media || []).map((m: any) => ({
        ...m,
        uri: m.webUrl || m.url || m.uri,
        thumbnailUri: m.thumbUrl || m.thumbnailUrl || m.thumbnailUri,
      })),
      albums: job.albums || [],
    };
    console.log('[JobContext] initDraftForEdit setting currentJob with jobInventory:', mappedJob.jobInventory?.length);
    setCurrentJob(mappedJob);
  }, []);

  // Start job
  const startJob = useCallback(async (jobId: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      await jobService.startJob(jobId);

      // Refresh the list
      await loadJobs(true);

      // Reload current job if it's the one being started
      if (currentJob?.id === jobId) {
        await loadJob(jobId);
      }
    } catch (err: any) {
      console.error('Error starting job:', err);
      setError(err.message || 'Failed to start job');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadJobs, loadJob, currentJob]);

  // Complete job
  const completeJob = useCallback(async (jobId: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      await jobService.completeJob(jobId);

      // Refresh the list
      await loadJobs(true);

      // Reload current job if it's the one being completed
      if (currentJob?.id === jobId) {
        await loadJob(jobId);
      }
    } catch (err: any) {
      console.error('Error completing job:', err);
      setError(err.message || 'Failed to complete job');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadJobs, loadJob, currentJob]);

  // Pause job
  const pauseJob = useCallback(async (jobId: string, reason?: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      await jobService.pauseJob(jobId, reason);

      // Refresh the list
      await loadJobs(true);

      // Reload current job if it's the one being paused
      if (currentJob?.id === jobId) {
        await loadJob(jobId);
      }
    } catch (err: any) {
      console.error('Error pausing job:', err);
      setError(err.message || 'Failed to pause job');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadJobs, loadJob, currentJob]);

  // Cancel job
  const cancelJob = useCallback(async (jobId: string, reason?: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      await jobService.cancelJob(jobId, reason);

      // Refresh the list
      await loadJobs(true);

      // Reload current job if it's the one being cancelled
      if (currentJob?.id === jobId) {
        await loadJob(jobId);
      }
    } catch (err: any) {
      console.error('Error cancelling job:', err);
      setError(err.message || 'Failed to cancel job');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadJobs, loadJob, currentJob]);

  // Search jobs
  const searchJobs = useCallback(async (query: string): Promise<JobListItem[]> => {
    try {
      setLoading(true);
      setError(null);

      const results = await jobService.searchJobs(query);
      return results;
    } catch (err: any) {
      console.error('Error searching jobs:', err);
      setError(err.message || 'Failed to search jobs');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Get jobs by client
  const getJobsByClient = useCallback(async (clientId: string): Promise<JobListItem[]> => {
    try {
      setLoading(true);
      setError(null);

      const results = await jobService.getJobsByClient(clientId);
      return results;
    } catch (err: any) {
      console.error('Error fetching jobs by client:', err);
      setError(err.message || 'Failed to fetch jobs by client');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Get jobs by status
  const getJobsByStatus = useCallback(async (status: string): Promise<JobListItem[]> => {
    try {
      setLoading(true);
      setError(null);

      const results = await jobService.getJobsByStatus(status as any);
      return results;
    } catch (err: any) {
      console.error('Error fetching jobs by status:', err);
      setError(err.message || 'Failed to fetch jobs by status');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Convert estimate to job - creates a new job from the estimate data
  const convertEstimateToJob = useCallback(async (estimateId: string, estimate?: any) => {
    try {
      setLoading(true);
      console.log('Converting estimate to job:', estimateId);
      console.log('[JobContext] Estimate data:', JSON.stringify(estimate, null, 2));

      // Get items - backend returns 'items', frontend maps to 'lineItems'
      const lineItems = estimate?.items || estimate?.lineItems || [];
      console.log('[JobContext] Line items found:', lineItems.length, lineItems);

      // Calculate totals from line items
      const materialsCost = lineItems
        .filter((item: any) => item.type !== 'labor')
        .reduce((sum: number, item: any) => sum + ((item.price || item.cost || 0) * (item.quantity || 1)), 0);
      const laborCost = lineItems
        .reduce((sum: number, item: any) => sum + ((item.labor || 0) * (item.quantity || 1)), 0);
      const estimatedTotal = estimate?.totalCost || estimate?.total || (materialsCost + laborCost);

      // Convert line items to jobInventory format
      // Backend expects productId, warehouseId, and inventoryId for inventory deduction
      const jobInventory = lineItems.map((item: any) => ({
        productId: item.productId || item.id,
        warehouseId: item.warehouseId,
        inventoryId: item.inventoryId,
        idealQuantity: item.quantity || 1,
        actualQuantity: 0,
        price: item.sellPrice || item.price || item.cost || 0,
        labor: item.labor || 0,
        title: item.title || item.description || '',
        description: item.description || '',
      }));
      console.log('[JobContext] jobInventory mapped:', jobInventory);

      // Extract clientId and locationId from nested objects or direct properties
      const clientId = estimate?.clientId || estimate?.client?.id;
      const locationId = estimate?.locationId || estimate?.location?.id;

      // Map proposedStartDate to scheduledStartDate
      const scheduledStartDate = estimate?.proposedStartDate;
      const scheduledEndDate = estimate?.expirationDate;

      // Create job from estimate data
      const jobData: any = {
        title: estimate?.name || 'Job from Estimate',
        description: estimate?.description || '',
        clientId,
        locationId,
        estimateId: estimateId,
        status: 'scheduled',
        scheduledStartDate,
        scheduledEndDate,
        estimatedTotal,
        laborCost,
        materialsCost,
        jobInventory,
      };

      console.log('[JobContext] Creating job with data:', jobData);
      const newJob = await jobService.createJob(jobData);
      console.log('[JobContext] Job created:', newJob);

      // Haptic feedback on success
      haptics.success();

      // Reload jobs to include the new one
      await loadJobs(true);

      return newJob;
    } catch (err: any) {
      console.error('Error converting estimate to job:', err);
      setError(err.message || 'Failed to convert estimate to job');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadJobs]);

  // Stub: Sync job with estimate
  const syncJobWithEstimate = useCallback(async (_jobId: string, _estimateId: string): Promise<void> => {
    console.log('syncJobWithEstimate - stub implementation');
  }, []);

  // Stub: Status and progress methods
  const updateJobStatus = useCallback(async (jobId: string, status: any) => {
    await updateJob(jobId, { status });
  }, [updateJob]);

  const completeMilestone = useCallback(async (_jobId: string, _milestoneId: string) => {
    console.log('completeMilestone - stub implementation');
  }, []);

  const updateMilestone = useCallback(async (_jobId: string, _milestoneId: string, _data: any) => {
    console.log('updateMilestone - stub implementation');
  }, []);

  const addJobNote = useCallback(async (jobId: string, note: { content: string; type?: string }) => {
    try {
      const createdNote = await jobNoteService.createJobNote({
        jobId,
        content: note.content,
        type: note.type || 'general',
      });
      
      // Update currentJob with the new note
      if (currentJob && currentJob.id === jobId) {
        setCurrentJob(prev => {
          if (!prev) return prev;
          const existingNotes = prev.notes || [];
          return {
            ...prev,
            notes: [{
              id: createdNote.id,
              content: createdNote.content,
              createdAt: createdNote.createDatetime,
              createdBy: createdNote.createdByName,
            }, ...existingNotes],
          };
        });
      }
      
      return createdNote;
    } catch (err: any) {
      console.error('Error adding job note:', err);
      throw err;
    }
  }, [currentJob]);

  const markInventoryUsed = useCallback(async (jobId: string, inventoryId: string, quantity: number) => {
    try {
      console.log('[JobContext] Recording inventory usage:', { jobId, inventoryId, quantity });
      await inventoryService.recordUsage({
        inventoryId,
        jobId,
        actionType: 'used',
        quantity,
        notes: `Used for job completion`,
      });
      console.log('[JobContext] Inventory usage recorded successfully');
    } catch (err: any) {
      console.error('[JobContext] Error recording inventory usage:', err);
    }
  }, []);

  const markInventoryReturned = useCallback(async (jobId: string, inventoryId: string, quantity: number) => {
    try {
      console.log('[JobContext] Recording inventory return:', { jobId, inventoryId, quantity });
      await inventoryService.recordUsage({
        inventoryId,
        jobId,
        actionType: 'returned',
        quantity,
        notes: `Returned after job completion`,
      });
      console.log('[JobContext] Inventory return recorded successfully');
    } catch (err: any) {
      console.error('[JobContext] Error recording inventory return:', err);
    }
  }, []);

  // Client profile
  const [clientProfile, setClientProfile] = useState<any | null>(null);
  const [clientProfileLoading, setClientProfileLoading] = useState(false);

  const loadClientProfile = useCallback(async (clientId: string) => {
    try {
      setClientProfileLoading(true);
      const client = await clientService.getClientById(clientId);
      setClientProfile(client);
    } catch (err: any) {
      console.error('Error loading client profile:', err);
      setClientProfile(null);
    } finally {
      setClientProfileLoading(false);
    }
  }, []);

  const addClientNote = useCallback(async (_clientId: string, _note: any) => {
    console.log('addClientNote - stub implementation');
  }, []);
  const removeClientNote = useCallback(async (_clientId: string, _noteId: string) => {
    console.log('removeClientNote - stub implementation');
  }, []);

  // Recurring job methods
  const setRecurrence = useCallback(async (jobId: string, data: SetRecurrenceRequest): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await jobService.setRecurrence(jobId, data);
      // Reload the job to get updated recurrence fields
      await loadJob(jobId);
      await loadJobs(true);
    } catch (err: any) {
      console.error('Error setting recurrence:', err);
      setError(err.message || 'Failed to set recurrence');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadJob, loadJobs]);

  const getOccurrences = useCallback(async (jobId: string, maxOccurrences?: number): Promise<JobOccurrencesResponse | null> => {
    try {
      const result = await jobService.getOccurrences(jobId, maxOccurrences);
      return result as JobOccurrencesResponse;
    } catch (err: any) {
      console.error('Error getting occurrences:', err);
      return null;
    }
  }, []);

  const getChildJobs = useCallback(async (parentJobId: string): Promise<JobListItem[]> => {
    try {
      const result = await jobService.getChildJobs(parentJobId);
      return result.childJobs || [];
    } catch (err: any) {
      console.error('Error getting child jobs:', err);
      return [];
    }
  }, []);

  const skipVisit = useCallback(async (jobId: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await jobService.skipVisit(jobId);
      await loadJob(jobId);
      await loadJobs(true);
    } catch (err: any) {
      console.error('Error skipping visit:', err);
      setError(err.message || 'Failed to skip visit');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadJob, loadJobs]);

  const unskipVisit = useCallback(async (jobId: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await jobService.unskipVisit(jobId);
      await loadJob(jobId);
      await loadJobs(true);
    } catch (err: any) {
      console.error('Error unskipping visit:', err);
      setError(err.message || 'Failed to unskip visit');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadJob, loadJobs]);

  // Clear state when company changes (data isolation)
  useEffect(() => {
    setJobs([]);
    setCurrentJob(null);
    setError(null);
  }, [currentCompany?.companyId]);

  // Load jobs on mount if authenticated
  useEffect(() => {
    // Extra safety check: only load if we have valid auth data
    // This prevents race conditions where context re-mounts before auth is ready
    if (isAuthenticated && currentCompany?.companyId) {
      loadJobs();
    }
  }, [isAuthenticated, currentCompany?.companyId, loadJobs]);

  // Media implementation — no global setLoading to avoid full-screen refresh
  const addMedia = useCallback(async (media: any) => {
    if (!currentJob?.id) return;

    try {
      const addedMedia = await jobService.addMedia({
        jobId: currentJob.id,
        s3Key: media.s3Key,
        fileName: media.fileName,
        type: media.type,
        mimeType: media.mimeType,
        sizeBytes: media.sizeBytes,
        albumId: media.albumId,
        category: media.category || 'general',
      });

      // Map the response to ensure uri is present (backend uses webUrl/thumbUrl)
      const mappedMedia = {
        ...addedMedia,
        uri: (addedMedia as any).webUrl || addedMedia.url || (addedMedia as any).uri,
        thumbnailUri: (addedMedia as any).thumbUrl || addedMedia.thumbnailUrl || (addedMedia as any).thumbnailUri,
      };

      setCurrentJob(prev => {
        if (!prev) return null;
        return { ...prev, media: [...(prev.media || []), mappedMedia] };
      });
    } catch (err: any) {
      console.error('Error adding media:', err);
      setError(err.message || 'Failed to add media');
    }
  }, [currentJob?.id]);

  const removeMedia = useCallback(async (mediaId: string) => {
    try {
      await jobService.removeMedia(mediaId);

      setCurrentJob(prev => {
        if (!prev) return null;
        return { ...prev, media: (prev.media || []).filter((m: any) => m.id !== mediaId) };
      });
    } catch (err: any) {
      console.error('Error removing media:', err);
      setError(err.message || 'Failed to remove media');
    }
  }, []);

  const value: JobContextType = {
    jobs,
    currentJob,
    loading,
    isLoading: loading,
    error,
    loadJobs,
    loadJob,
    createJob,
    updateJob,
    deleteJob,
    initDraftForEdit,
    startJob,
    completeJob,
    pauseJob,
    cancelJob,
    convertEstimateToJob,
    syncJobWithEstimate,
    updateJobStatus,
    completeMilestone,
    updateMilestone,
    addJobNote,
    markInventoryUsed,
    markInventoryReturned,
    searchJobs,
    getJobsByClient,
    getJobsByStatus,
    clientProfile,
    clientProfileLoading,
    loadClientProfile,
    addClientNote,
    removeClientNote,
    addMedia,
    removeMedia,
    setRecurrence,
    getOccurrences,
    getChildJobs,
    skipVisit,
    unskipVisit,
    clearError,
  };

  return (
    <JobContext.Provider value={value}>
      {children}
    </JobContext.Provider>
  );
};
