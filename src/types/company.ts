export interface Company {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    city?: string;
    state?: string;
    zipcode?: string;
    country?: string;
    category?: string;
    logo?: string;
    logoThumbnail?: string;
    active: boolean;
    createDatetime: string;
    updateDatetime: string;
}
