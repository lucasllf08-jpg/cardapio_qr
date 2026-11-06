import { supabase } from './supabase';

export async function uploadImage(establishmentId: string, file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error('Imagem muito grande (máx. 5 MB).');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${establishmentId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, file, { cacheControl: '31536000' });
  if (error) throw error;
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}
