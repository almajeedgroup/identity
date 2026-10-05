import Link from 'next/link';

export default function StaffNotFound() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-10">
      <h1 className="text-2xl font-extrabold">Not found</h1>
      <p>This page does not exist, or your role does not allow it.</p>
      <Link href="/staff" className="btn-secondary">
        Back to the console
      </Link>
    </main>
  );
}
