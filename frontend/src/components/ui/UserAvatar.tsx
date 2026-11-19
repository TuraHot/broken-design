'use client';

import { useEffect, useState } from 'react';
import { initials } from '@/lib/creators';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-9 w-9 text-[13px]',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl font-bold',
  xl: 'h-20 w-20 text-2xl sm:h-24 sm:w-24',
};

/** Circular user logo / avatar with HUD border and automatic fallback to user initials. */
export default function UserAvatar({
  name,
  avatarUrl,
  size = 'md',
  className = '',
}: {
  name: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [avatarUrl]);

  const showImage = Boolean(avatarUrl && !broken);
  const label = initials(name) || name.slice(0, 2).toUpperCase() || '?';

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full border border-hud/50 bg-black ${SIZE_CLASSES[size]} ${className}`}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl!}
          alt=""
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden className="font-mono text-hud">
          {label}
        </span>
      )}
    </span>
  );
}
