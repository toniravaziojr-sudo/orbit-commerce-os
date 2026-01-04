// =============================================
// COLUMN BLOCK - Grid column span
// =============================================

import React from 'react';

interface ColumnBlockProps {
  children?: React.ReactNode;
  span?: number;
}

export function ColumnBlock({ children, span }: ColumnBlockProps) {
  return (
    <div style={{ gridColumn: `span ${span || 1}` }}>
      {children}
    </div>
  );
}
