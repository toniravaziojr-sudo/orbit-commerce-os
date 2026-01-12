// =============================================
// REACT INSTANCE GUARD
// Detects and logs multiple React instances (causes #300 errors)
// =============================================

import React from 'react';

declare global {
  interface Window {
    __CC_REACT_INSTANCE__?: typeof React;
    __CC_REACT_VERSIONS__?: string[];
    __CC_REACT_GUARD_INITIALIZED__?: boolean;
  }
}

export interface ReactGuardStatus {
  ok: boolean;
  version: string;
  multipleInstances: boolean;
  versions: string[];
  message: string;
}

/**
 * Initialize React Instance Guard
 * Should be called early in the app lifecycle (e.g., main.tsx)
 */
export function initReactInstanceGuard(): ReactGuardStatus {
  const version = React.version;
  
  // Initialize tracking arrays
  if (!window.__CC_REACT_VERSIONS__) {
    window.__CC_REACT_VERSIONS__ = [];
  }
  
  // Check if another React instance was already registered
  if (window.__CC_REACT_INSTANCE__) {
    const isSameInstance = window.__CC_REACT_INSTANCE__ === React;
    const isDifferentVersion = !window.__CC_REACT_VERSIONS__.includes(version);
    
    if (isDifferentVersion) {
      window.__CC_REACT_VERSIONS__.push(version);
    }
    
    if (!isSameInstance) {
      const status: ReactGuardStatus = {
        ok: false,
        version,
        multipleInstances: true,
        versions: window.__CC_REACT_VERSIONS__,
        message: `MULTIPLE_REACT_INSTANCES_DETECTED: Current=${version}, Previous=${window.__CC_REACT_VERSIONS__.join(', ')}`,
      };
      
      console.error('[ReactInstanceGuard] ⚠️ CRITICAL:', status.message);
      console.error('[ReactInstanceGuard] This will cause "Invalid hook call" errors (React #300)');
      console.error('[ReactInstanceGuard] Possible causes:');
      console.error('  1. Duplicate React in node_modules');
      console.error('  2. Bundler not deduplicating React correctly');
      console.error('  3. A dependency bundles its own React');
      
      return status;
    }
  }
  
  // Register this React instance
  window.__CC_REACT_INSTANCE__ = React;
  if (!window.__CC_REACT_VERSIONS__.includes(version)) {
    window.__CC_REACT_VERSIONS__.push(version);
  }
  window.__CC_REACT_GUARD_INITIALIZED__ = true;
  
  const status: ReactGuardStatus = {
    ok: true,
    version,
    multipleInstances: false,
    versions: [version],
    message: `React ${version} - Single instance ✓`,
  };
  
  console.log('[ReactInstanceGuard] ✓', status.message);
  
  return status;
}

/**
 * Get current React Guard status (can be called anytime after init)
 */
export function getReactGuardStatus(): ReactGuardStatus {
  const version = React.version;
  const versions = window.__CC_REACT_VERSIONS__ || [version];
  const multipleInstances = window.__CC_REACT_INSTANCE__ !== undefined && 
                            window.__CC_REACT_INSTANCE__ !== React;
  
  return {
    ok: !multipleInstances,
    version,
    multipleInstances,
    versions,
    message: multipleInstances 
      ? `MULTIPLE_REACT_INSTANCES: ${versions.join(', ')}`
      : `React ${version} - Single instance ✓`,
  };
}

/**
 * Log React Guard status to console (for debugging)
 */
export function logReactGuardStatus(): void {
  const status = getReactGuardStatus();
  const prefix = status.ok ? '✓' : '⚠️';
  console.log(`[ReactInstanceGuard] ${prefix} ${status.message}`);
}
