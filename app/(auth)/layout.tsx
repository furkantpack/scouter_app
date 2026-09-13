import AuthFooter from './footer';
import AuthHeader from './header';

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className='relative min-h-screen overflow-hidden bg-[#f7f8ff] px-4 py-6 sm:px-6 lg:py-10'>
      <div
        className='pointer-events-none absolute inset-0'
        style={{
          background:
            'radial-gradient(ellipse 72% 46% at 50% -4%, rgba(255,255,255,.98) 0%, rgba(255,255,255,.82) 35%, rgba(255,255,255,0) 72%), radial-gradient(ellipse 68% 58% at 12% 34%, rgba(46,112,255,.95) 0%, rgba(77,103,246,.72) 42%, rgba(77,103,246,0) 75%), radial-gradient(ellipse 70% 58% at 88% 35%, rgba(50,111,255,.92) 0%, rgba(88,91,244,.68) 42%, rgba(88,91,244,0) 76%), radial-gradient(ellipse 72% 62% at 50% 72%, rgba(255,39,164,.92) 0%, rgba(255,71,183,.76) 42%, rgba(255,71,183,0) 76%), linear-gradient(180deg,#eef4ff 0%,#7e8df5 40%,#ed65da 68%,#ff3c8b 100%)',
        }}
      />
      <div className='pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#ff245f]/75 to-transparent' />

      <section className='relative mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-[560px] flex-col rounded-[28px] border border-white/70 bg-bg-white-0/95 px-5 py-5 shadow-[0_32px_90px_rgba(48,36,112,.28)] backdrop-blur-xl sm:px-8 lg:min-h-[calc(100vh-80px)] lg:px-11 lg:py-6'>
        <AuthHeader />

        <div className='flex flex-1 flex-col justify-center py-10 lg:py-12'>
          <div className='mx-auto flex w-full max-w-[392px] flex-col gap-6'>
            {children}
          </div>
        </div>

        <AuthFooter />
      </section>
    </main>
  );
}
