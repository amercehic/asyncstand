import React from 'react';
import { User } from 'lucide-react';

interface AvatarProps {
  name: string;
  avatar?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-lg',
};

const generateGradient = (name: string): string => {
  // Generate a consistent color based on the name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Generate beautiful, modern gradients that look great
  const gradients = [
    'from-blue-500 via-blue-600 to-indigo-700',
    'from-purple-500 via-purple-600 to-pink-700',
    'from-green-500 via-emerald-600 to-teal-700',
    'from-orange-500 via-red-500 to-red-600',
    'from-cyan-500 via-blue-500 to-blue-700',
    'from-pink-500 via-rose-500 to-rose-700',
    'from-indigo-500 via-purple-500 to-purple-700',
    'from-teal-500 via-green-500 to-emerald-700',
    'from-amber-500 via-orange-500 to-red-600',
    'from-rose-500 via-pink-500 to-purple-600',
    'from-emerald-500 via-teal-500 to-cyan-600',
    'from-violet-500 via-purple-500 to-indigo-700',
    'from-sky-500 via-blue-500 to-indigo-600',
    'from-lime-500 via-green-500 to-teal-600',
    'from-fuchsia-500 via-pink-500 to-rose-600',
    'from-slate-600 via-gray-600 to-gray-700',
  ];

  return gradients[Math.abs(hash) % gradients.length];
};

const getInitials = (name: string): string => {
  if (!name) return '?';

  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    // For single word, use first two characters
    return words[0].substring(0, 2).toUpperCase();
  }

  // For multiple words, use first letter of first two words
  return words
    .slice(0, 2)
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase();
};

export const Avatar: React.FC<AvatarProps> = ({ name, avatar, size = 'lg', className = '' }) => {
  const initials = getInitials(name);
  const gradient = generateGradient(name);
  const sizeClass = sizeClasses[size];

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        className={`${sizeClass} rounded-full object-cover shadow-sm ring-2 ring-white/20 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm ring-2 ring-white/20 ${className}`}
      title={name}
    >
      {initials ? (
        <span className="font-bold text-white select-none drop-shadow-sm">{initials}</span>
      ) : (
        <User
          className={`${size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-8 h-8'} text-white/90`}
        />
      )}
    </div>
  );
};

export default Avatar;
