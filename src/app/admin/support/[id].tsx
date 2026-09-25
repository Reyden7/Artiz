import { SupportDetail } from '@/features/support/support-detail';
import { AdminOnlySupport } from '@/features/support/admin-only';

export default function AdminSupportRequestScreen() { return <AdminOnlySupport><SupportDetail admin /></AdminOnlySupport>; }
