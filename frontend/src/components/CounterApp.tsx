'use client';

import { useState, useEffect, useCallback } from 'react';
import { STACKS_MAINNET } from '@stacks/network';
import {
  uintCV,
  cvToValue,
  fetchCallReadOnlyFunction,
  PostConditionMode
} from '@stacks/transactions';

const CONTRACT_ADDRESS = 'SP312F1KXPTFJH6BHVFJTB5VYYGZQBYPYC7VT62SV';
const CONTRACT_NAME = 'counter';

export default function CounterApp() {
  const [counter, setCounter] = useState<number | null>(null);
  const [lastCaller, setLastCaller] = useState<string | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [txId, setTxId] = useState<string | null>(null);
  const [connectLib, setConnectLib] = useState<any>(null);
  const [userSession, setUserSession] = useState<any>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Lazy load @stacks/connect to avoid SSR issues
  useEffect(() => {
    const loadConnect = async () => {
      try {
        // Dynamically import to avoid SSR issues
        const connectModule = await import('@stacks/connect');
        const { AppConfig, UserSession, showConnect, openContractCall } = connectModule;
        
        const appConfig = new AppConfig(['store_write', 'publish_data']);
        const session = new UserSession({ appConfig });
        
        setConnectLib({ showConnect, openContractCall });
        setUserSession(session);
        
        if (session.isUserSignedIn()) {
          setUserData(session.loadUserData());
        }
      } catch (e: any) {
        console.error('Error loading Stacks Connect:', e);
        // Still try to work with whatever provider exists
        setConnectError(e.message || 'Failed to load wallet connector');
      }
    };
    
    // Small delay to let wallet extensions initialize first
    const timer = setTimeout(loadConnect, 100);
    return () => clearTimeout(timer);
  }, []);

  const fetchCounter = useCallback(async () => {
    try {
      const result = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-counter',
        functionArgs: [],
        network: STACKS_MAINNET,
        senderAddress: CONTRACT_ADDRESS,
      });
      const value = cvToValue(result);
      setCounter(value.value);
    } catch (e) {
      console.error('Error fetching counter:', e);
    }
  }, []);

  const fetchLastCaller = useCallback(async () => {
    try {
      const result = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'get-last-caller',
        functionArgs: [],
        network: STACKS_MAINNET,
        senderAddress: CONTRACT_ADDRESS,
      });
      const value = cvToValue(result);
      if (value.value) {
        setLastCaller(value.value);
      }
    } catch (e) {
      console.error('Error fetching last caller:', e);
    }
  }, []);

  useEffect(() => {
    fetchCounter();
    fetchLastCaller();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(() => {
      fetchCounter();
      fetchLastCaller();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchCounter, fetchLastCaller]);

  const connectWallet = async () => {
    if (!connectLib || !userSession) {
      // Fallback: try to use existing StacksProvider if available
      if (typeof window !== 'undefined' && (window as any).StacksProvider) {
        try {
          const provider = (window as any).StacksProvider;
          const response = await provider.authenticationRequest();
          if (response) {
            setUserData({ profile: { stxAddress: { mainnet: response.address } } });
          }
        } catch (e) {
          console.error('Fallback auth failed:', e);
          alert('Please install a Stacks wallet (Leather, Xverse) to connect');
        }
        return;
      }
      alert('Wallet connector not loaded. Please refresh or install a Stacks wallet.');
      return;
    }
    
    try {
      connectLib.showConnect({
        appDetails: {
          name: 'Aetos Counter',
          icon: window.location.origin + '/favicon.ico',
        },
        redirectTo: '/',
        onFinish: () => {
          setUserData(userSession.loadUserData());
        },
        userSession,
      });
    } catch (e) {
      console.error('Error connecting wallet:', e);
    }
  };

  const disconnect = () => {
    if (userSession) {
      userSession.signUserOut('/');
    }
    setUserData(null);
  };

  const callContract = async (functionName: string, args: any[] = []) => {
    if (!userData) return;
    
    setLoading(true);
    setTxId(null);
    
    try {
      if (connectLib?.openContractCall) {
        await connectLib.openContractCall({
          contractAddress: CONTRACT_ADDRESS,
          contractName: CONTRACT_NAME,
          functionName,
          functionArgs: args,
          network: STACKS_MAINNET,
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
      } else if (typeof window !== 'undefined' && (window as any).StacksProvider) {
        // Fallback to direct provider call
        const provider = (window as any).StacksProvider;
        // This is a simplified fallback
        alert('Direct provider transactions not yet implemented. Please refresh the page.');
        setLoading(false);
      }
    } catch (e) {
      console.error('Error calling contract:', e);
      setLoading(false);
    }
  };

  const increment = () => callContract('increment');
  const decrement = () => callContract('decrement');
  const incrementBy = (amount: number) => callContract('increment-by', [uintCV(amount)]);

  const walletReady = connectLib && userSession;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Aetos Counter
          </h1>
          <p className="text-gray-400 text-lg">
            A simple on-chain counter on Stacks mainnet
          </p>
          <p className="text-gray-500 text-sm mt-2 font-mono">
            {CONTRACT_ADDRESS}.{CONTRACT_NAME}
          </p>
        </div>

        {/* Counter Display */}
        <div className="max-w-md mx-auto bg-gray-800/50 backdrop-blur rounded-2xl p-8 mb-8 border border-gray-700">
          <div className="text-center">
            <p className="text-gray-400 mb-2">Current Count</p>
            <div className="text-8xl font-bold text-blue-400 mb-4">
              {counter !== null ? counter : '...'}
            </div>
            {lastCaller && (
              <p className="text-gray-500 text-sm">
                Last updated by: <span className="font-mono text-xs">{lastCaller.slice(0, 8)}...{lastCaller.slice(-4)}</span>
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="max-w-md mx-auto">
          {!userData ? (
            <div className="space-y-4">
              <button
                onClick={connectWallet}
                className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Connect Wallet
              </button>
              {connectError && (
                <p className="text-yellow-500 text-xs text-center">
                  Note: {connectError}. You may need to refresh after installing a wallet.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <span className="text-gray-400">Connected:</span>
                <span className="font-mono text-sm">
                  {userData.profile?.stxAddress?.mainnet?.slice(0, 8)}...{userData.profile?.stxAddress?.mainnet?.slice(-4)}
                </span>
                <button
                  onClick={disconnect}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Disconnect
                </button>
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={decrement}
                  disabled={loading || counter === 0}
                  className="flex-1 py-4 px-6 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-xl font-semibold text-xl text-red-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <button
                  onClick={increment}
                  disabled={loading}
                  className="flex-1 py-4 px-6 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 rounded-xl font-semibold text-xl text-green-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
              
              <button
                onClick={() => incrementBy(10)}
                disabled={loading}
                className="w-full py-3 px-6 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 rounded-xl font-semibold text-purple-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                +10
              </button>
              
              {loading && (
                <p className="text-center text-yellow-400 animate-pulse">
                  Waiting for wallet...
                </p>
              )}
              
              {txId && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                  <p className="text-green-400 text-sm mb-2">Transaction submitted!</p>
                  <a
                    href={`https://explorer.hiro.so/txid/${txId}?chain=mainnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-xs font-mono break-all"
                  >
                    View on Explorer →
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-16 text-gray-500 text-sm">
          <p>Built by Aetos (Lux OpenClaw) 🏛️</p>
          <p className="mt-2">
            <a
              href="https://github.com/aetosset"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300"
            >
              GitHub
            </a>
            {' · '}
            <a
              href={`https://explorer.hiro.so/address/${CONTRACT_ADDRESS}?chain=mainnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300"
            >
              Contract
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
