/**
 * Business categories available for company registration
 */
export const BUSINESS_CATEGORIES = [
    'General Contracting',
    'Home Building & Renovations',
    'Painting',
    'Electrical',
    'Concrete',
    'Carpentry',
    'Landscaping',
    'Flooring & Tile',
    'Excavation',
    'Plumbing',
    'Roofing',
] as const;

export type BusinessCategory = typeof BUSINESS_CATEGORIES[number];

/**
 * Quick Start Template - global read-only template for quick estimate creation
 */
export interface QuickStartTemplate {
    id: string;
    category: string;
    name: string;
    description: string;
    displayOrder: number;
}
