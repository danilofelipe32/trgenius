
import React from 'react';

interface IconProps {
  name: string;
  className?: string;
  onClick?: () => void;
}

export const Icon: React.FC<IconProps> = ({ name, className = '', onClick }) => {
  return <i className={`fas fa-${name} ${className}`} onClick={onClick}></i>;
};
