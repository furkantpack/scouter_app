import { redirect } from 'next/navigation';
export default function LegacyListDetail({ params }: { params: { id: string } }) { redirect(`/lists/${params.id}`); }
