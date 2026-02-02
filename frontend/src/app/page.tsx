'use client';

import dynamic from 'next/dynamic';

// Dynamically import the counter component to avoid SSR issues with Stacks packages
const CounterApp = dynamic(() => import('../components/CounterApp'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white flex items-center justify-center">
      <div className="text-2xl text-gray-400 animate-pulse">Loading...</div>
    </div>
  ),
});

export default function Home() {
  return <CounterApp />;
}
