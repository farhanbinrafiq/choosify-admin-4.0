import React from 'react';

export interface ChoosifyLogoProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  variant?: 'full' | 'icon' | 'stacked' | 'wordmark';
  theme?: 'light' | 'dark' | 'auto';
}

const SRC = {
  fullDark: '/brand/choosify-logo-horizontal-white.svg',
  fullLight: '/brand/choosify-logo-horizontal-navy.svg',
  icon: '/brand/choosify-logo-icon.svg',
  stackedDark: '/brand/choosify-logo-stacked-white.svg',
  stackedLight: '/brand/choosify-logo-stacked-navy.svg',
  wordmarkDark: '/brand/choosify-logo-wordmark-white.svg',
  wordmarkLight: '/brand/choosify-logo-wordmark-navy.svg',
} as const;

export const ChoosifyLogo: React.FC<ChoosifyLogoProps> = ({
  width,
  height,
  className = 'h-8',
  variant = 'full',
  theme = 'dark',
}) => {
  const light = theme === 'light';
  let src: string = light ? SRC.fullLight : SRC.fullDark;
  if (variant === 'icon') src = SRC.icon;
  else if (variant === 'stacked') src = light ? SRC.stackedLight : SRC.stackedDark;
  else if (variant === 'wordmark') src = light ? SRC.wordmarkLight : SRC.wordmarkDark;

  return (
    <img
      src={src}
      alt="Choosify"
      className={className}
      style={{
        width,
        height,
        display: 'inline-block',
        verticalAlign: 'middle',
        objectFit: 'contain',
      }}
      draggable={false}
      decoding="async"
    />
  );
};
