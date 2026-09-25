import { SupportList } from '@/features/support/support-list';
import { AdminOnlySupport } from '@/features/support/admin-only';

export default function AdminSupportRequestsScreen() { return <AdminOnlySupport><SupportList admin /></AdminOnlySupport>; }
