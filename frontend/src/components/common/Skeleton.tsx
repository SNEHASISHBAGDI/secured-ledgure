import React, { HTMLAttributes } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'rectangular' | 'circular' | 'text';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rectangular',
  width,
  height,
  className = '',
  style,
  ...props
}) => {
  const variantStyles = {
    rectangular: 'rounded-lg',
    circular: 'rounded-full',
    text: 'rounded h-4 my-1',
  };

  const inlineStyles: React.CSSProperties = {
    ...style,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };

  return (
    <div
      className={`animate-pulse bg-surface-elevated/80 border border-border/40 ${variantStyles[variant]} ${className}`}
      style={inlineStyles}
      {...props}
    />
  );
};
