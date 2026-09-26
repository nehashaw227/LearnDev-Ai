declare global {
    interface Window {
        ENV?: {
            VITE_SUPABASE_URL: string;
            VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: string;
        };
    }
}
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = window.ENV?.VITE_SUPABASE_URL;
const supabaseKey = window.ENV?.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration is missing.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
