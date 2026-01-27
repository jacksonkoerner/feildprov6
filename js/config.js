// FieldVoice Pro - Shared Configuration
// This is the single source of truth for Supabase credentials and app constants

const SUPABASE_URL = 'https://ruzadotbgkjhgwkvotlz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1emFkb3RiZ2tqaGd3a3ZvdGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyMDY1MzQsImV4cCI6MjA4NDc4MjUzNH0.RiW5IFA_i8Fj4QIc1Swe1ERx3rEwPyOnQ5tOicAFXI0';

// Initialize Supabase client (requires @supabase/supabase-js to be loaded first)
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
