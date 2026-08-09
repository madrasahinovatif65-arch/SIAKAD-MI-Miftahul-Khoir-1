'use client';

import { useState, useEffect } from 'react';
import { useSWRConfig } from 'swr';

export default function PullToRefresh({ children }) {
  const [startY, setStartY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  
  const { mutate } = useSWRConfig();

  useEffect(() => {
    // Only enable pull to refresh on mobile devices (simple check via touch support)
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    const handleTouchStart = (e) => {
      let node = e.target;
      let isScrolled = false;
      while (node && node !== document.documentElement) {
        if (node.scrollTop > 0) {
          isScrolled = true;
          break;
        }
        node = node.parentNode;
      }
      
      if (!isScrolled && window.scrollY <= 0) {
        setStartY(e.touches[0].clientY);
      } else {
        setStartY(0);
      }
    };

    const handleTouchMove = (e) => {
      if (startY > 0) {
        let node = e.target;
        let isScrolled = false;
        while (node && node !== document.documentElement) {
          if (node.scrollTop > 0) {
            isScrolled = true;
            break;
          }
          node = node.parentNode;
        }

        if (isScrolled || window.scrollY > 0) {
          setStartY(0);
          return;
        }

        const y = e.touches[0].clientY;
        if (y > startY) {
          const distance = y - startY;
          if (distance > 10) { // Add small threshold
            setIsPulling(true);
            setPullDistance(Math.min(distance, 150)); // Max visual pull
            
            // Prevent default scroll when pulling down at the top
            if (e.cancelable) {
              e.preventDefault();
            }
          }
        }
      }
    };

    const handleTouchEnd = async () => {
      if (isPulling && pullDistance > 80) {
        setRefreshing(true);
        
        // Revalidate all SWR active cache
        await mutate(() => true, undefined, { revalidate: true });
        
        // Timeout just for visual feedback
        setTimeout(() => {
          setRefreshing(false);
        }, 500);
      }
      setIsPulling(false);
      setPullDistance(0);
      setStartY(0);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [startY, isPulling, pullDistance, mutate]);

  return (
    <>
      {isPulling && !refreshing && (
        <div className="fixed top-0 left-0 right-0 h-16 flex items-center justify-center z-50 pointer-events-none transition-all duration-200" style={{ transform: `translateY(${Math.min(pullDistance - 50, 0)}px)` }}>
          <div 
            className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-md flex items-center justify-center"
            style={{ transform: `rotate(${pullDistance * 2}deg)`, opacity: pullDistance / 100 }}
          >
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </div>
        </div>
      )}
      
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 h-16 flex items-center justify-center z-50 pointer-events-none animate-in slide-in-from-top-4">
          <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-md flex items-center justify-center animate-spin">
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </div>
        </div>
      )}
      
      {children}
    </>
  );
}
