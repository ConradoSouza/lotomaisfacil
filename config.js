// Configuração do Supabase (contas, perfil e sincronização de jogos).
// A chave "anon/public" é PÚBLICA: a segurança real é feita pelas regras RLS do banco.
// NUNCA cole aqui a chave "service_role".
window.LOTO_CFG = {
  SUPABASE_URL: 'https://ycmnpbnjcnkidayxbaqe.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljbW5wYm5qY25raWRheXhiYXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NDYzMTMsImV4cCI6MjEwMTQyMjMxM30.6GzkdoesdrpiV3Dj5e9XJv_0jfZNrVRk3H2aGJMoEb4',
  // Chave PÚBLICA VAPID do Web Push (pode ficar aqui, é pública). Gere com: npx web-push generate-vapid-keys
  // Cole a "Public Key" abaixo. Enquanto estiver vazia, o botão de notificações fica oculto.
  VAPID_PUBLIC: ''
};
