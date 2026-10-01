'use client';

import { useAuthStore } from '@/store/authStore';
import UsersPanel from '@/components/admin/UsersPanel';

export default function Page() {
  const user = useAuthStore((s) => s.user);
  return <UsersPanel currentUserId={user?.id} />;
}
