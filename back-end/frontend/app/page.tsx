import Link from 'next/link';
import { Disc, Book, Monitor, Music, ShieldCheck, Users } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          Amadeus&nbsp;
          <code className="font-bold">v1.0.0-alpha</code>
        </p>
        <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-gradient-to-t from-white via-white dark:from-black dark:via-black lg:static lg:h-auto lg:w-auto lg:bg-none">
          <Link href="/login" className="px-4 py-2 bg-amadeus-600 text-white rounded-md hover:bg-amadeus-700 transition">
            Sign In
          </Link>
        </div>
      </div>

      <div className="relative flex place-items-center">
        <div className="text-center">
          <h1 className="text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-7xl">
            Own your <span className="text-amadeus-600">Collection</span>.
          </h1>
          <p className="mt-6 text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            The ultimate platform for cataloging records, CDs, movies, and books. 
            Focused on physical ownership, not streaming.
          </p>
        </div>
      </div>

      <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-4 lg:text-left gap-8">
        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
          <Disc className="mb-3 h-8 w-8 text-amadeus-500" />
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Media Support{' '}
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
            Catalog Vinyl, CDs, DVDs, Blu-rays, and Books with ease.
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
          <ShieldCheck className="mb-3 h-8 w-8 text-amadeus-500" />
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Insurance{' '}
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
            Export your collection to CSV or PDF for insurance records.
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
          <Users className="mb-3 h-8 w-8 text-amadeus-500" />
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Social{' '}
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50`}>
            Connect with friends and see what they are collecting.
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30">
          <Monitor className="mb-3 h-8 w-8 text-amadeus-500" />
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Dashboard{' '}
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50 text-balance`}>
            Detailed statistics on your collection's value and growth.
          </p>
        </div>
      </div>
    </main>
  );
}
