
import React from 'react';

interface IconProps {
  name: string;
  className?: string;
  onClick?: () => void;
  // FIX: Add optional title prop to allow tooltips on icons, resolving a type error in App.tsx.
  title?: string;
}

export const Icon: React.FC<IconProps> = ({ name, className = '', onClick, title }) => {
  return <i className={`fas fa-${name} ${className}`} onClick={onClick} title={title}></i>;
};
