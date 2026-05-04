import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const supabaseUrl = "https://ioicyqsvogvwvyrxgmse.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJImlvaWN5cXN2b2d2d3Z5cnhnbXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzM4ODksImV4cCI6MjA5MjkwOTg4OX0.l-Z5us9NhtHBBRLlL_Bf-ZUylzfYvOqQ2fDtcoDvf3c";

export default defineConfig({
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseAnonKey),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseAnonKey),
    },
  },
});
