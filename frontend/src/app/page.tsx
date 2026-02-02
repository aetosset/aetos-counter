'use client';

import { useState, useEffect, useCallback } from 'react';

const CONTRACT_ADDRESS = 'SP312F1KXPTFJH6BHVFJTB5VYYGZQBYPYC7VT62SV';
const CONTRACT_NAME = 'counter';
const API_BASE = 'https://api.hiro.so';

export default function Home() {
  const [counter, setCounter] = useState<number | null>(null);
  const [lastCaller, setLastCaller] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch counter using REST API (no SDK needed for reads)
  const fetchCounter = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/get-counter`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender: CONTRACT_ADDRESS, arguments: [] }),
        }
      );
      const data = await res.json();
      if (data.okay && data.result) {
        // Parse Clarity (ok uint) response: 0x0701 + 16 bytes big-endian
        // 07 = ok, 01 = uint type
        const hex = data.result.replace('0x', '');
        if (hex.startsWith('0701')) {
          // Skip 0701, take last 8 chars (32-bit safe for reasonable counters)
          const valueHex = hex.slice(-8);
          const value = parseInt(valueHex, 16);
          setCounter(value);
        }
      }
    } catch (e) {
      console.error('Error fetching counter:', e);
    }
  }, []);

  const fetchLastCaller = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/get-last-caller`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender: CONTRACT_ADDRESS, arguments: [] }),
        }
      );
      const data = await res.json();
      if (data.okay && data.result) {
        // Parse optional principal - this is complex, simplified for now
        const hex = data.result.replace('0x', '');
        if (hex.startsWith('0a')) {
          // some principal - extract it
          // For now just show we have a caller
          setLastCaller('(has value)');
        }
      }
    } catch (e) {
      console.error('Error fetching last caller:', e);
    }
  }, []);

  useEffect(() => {
    fetchCounter();
    fetchLastCaller();
    const interval = setInterval(() => {
      fetchCounter();
      fetchLastCaller();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchCounter, fetchLastCaller]);

  const connectWallet = async () => {
    try {
      // Dynamically load stacks connect only when needed
      const { showConnect, AppConfig, UserSession } = await import('@stacks/connect');
      const appConfig = new AppConfig(['store_write', 'publish_data']);
      const userSession = new UserSession({ appConfig });
      
      showConnect({
        appDetails: {
          name: 'Aetos Counter',
          icon: window.location.origin + '/favicon.ico',
        },
        onFinish: () => {
          const data = userSession.loadUserData();
          setUserData(data);
          // Store session for later
          (window as any).__userSession = userSession;
        },
        onCancel: () => {
          console.log('Cancelled');
        },
        userSession,
      });
    } catch (e: any) {
      console.error('Connect error:', e);
      setError(e.message);
    }
  };

  const disconnect = () => {
    const session = (window as any).__userSession;
    if (session) {
      session.signUserOut();
    }
    setUserData(null);
  };

  const callContract = async (functionName: string) => {
    if (!userData) return;
    
    setLoading(true);
    setTxId(null);
    
    try {
      const { openContractCall } = await import('@stacks/connect');
      const { PostConditionMode } = await import('@stacks/transactions');
      
      await openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName,
        functionArgs: [],
        network: 'mainnet' as any,
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data: any) => {
          setTxId(data.txId);
          setLoading(false);
          setTimeout(() => {
            fetchCounter();
            fetchLastCaller();
          }, 5000);
        },
        onCancel: () => {
          setLoading(false);
        },
      });
    } catch (e: any) {
      console.error('Contract call error:', e);
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Aetos Counter
          </h1>
          <p className="text-gray-400 text-lg">On-chain counter on Stacks mainnet</p>
          <p className="text-gray-500 text-sm mt-2 font-mono">{CONTRACT_ADDRESS}.{CONTRACT_NAME}</p>
        </div>

        <div className="max-w-md mx-auto bg-gray-800/50 backdrop-blur rounded-2xl p-8 mb-8 border border-gray-700">
          <div className="text-center">
            <p className="text-gray-400 mb-2">Current Count</p>
            <div className="text-8xl font-bold text-blue-400 mb-4">
              {counter !== null ? counter : '...'}
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto space-y-4">
          {!userData ? (
            <button
              onClick={connectWallet}
              className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl font-semibold text-lg transition-all shadow-lg hover:shadow-xl"
            >
              Connect Wallet
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <span className="text-gray-400">Connected</span>
                <span className="font-mono text-sm text-green-400">
                  {userData.profile?.stxAddress?.mainnet?.slice(0, 6)}...
                </span>
                <button onClick={disconnect} className="text-red-400 text-sm">Disconnect</button>
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={() => callContract('decrement')}
                  disabled={loading || counter === 0}
                  className="flex-1 py-4 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-xl text-xl text-red-400 disabled:opacity-50"
                >
                  -
                </button>
                <button
                  onClick={() => callContract('increment')}
                  disabled={loading}
                  className="flex-1 py-4 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-xl text-xl text-green-400 disabled:opacity-50"
                >
                  +
                </button>
              </div>
            </>
          )}
          
          {loading && <p className="text-center text-yellow-400 animate-pulse">Waiting for wallet...</p>}
          
          {txId && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <p className="text-green-400 text-sm mb-2">Transaction submitted!</p>
              <a
                href={`https://explorer.hiro.so/txid/${txId}?chain=mainnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 text-xs font-mono"
              >
                View on Explorer →
              </a>
            </div>
          )}
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>

        <div className="text-center mt-16 text-gray-500 text-sm">
          <p>Built by Aetos 🏛️</p>
          <a href="https://github.com/aetosset/aetos-counter" className="text-blue-400">GitHub</a>
        </div>
      </div>
    </div>
  );
}
