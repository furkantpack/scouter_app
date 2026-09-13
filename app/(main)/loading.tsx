export default function MainLoading() {
  return (
    <div className='flex min-h-screen items-center justify-center bg-bg-white-0'>
      <div className='flex items-center gap-3 text-label-sm text-text-sub-600'>
        <span className='size-2 animate-pulse rounded-full bg-orange-500' />
        Loading
      </div>
    </div>
  );
}
