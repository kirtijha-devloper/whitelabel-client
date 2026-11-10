import React from 'react';

const PgLogo = ({ className = 'w-6 h-6', variant = '1', ...props }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      {...props}
    >
      <rect width="48" height="48" rx="12" fill="#00D3CD" fillOpacity="0.12" />
      <path
        d="M14 18C14 15.7909 15.7909 14 18 14H30C32.2091 14 34 15.7909 34 18V30C34 32.2091 32.2091 34 30 34H18C15.7909 34 14 32.2091 14 30V18Z"
        stroke="#00D3CD"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 22H34"
        stroke="#00D3CD"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="20" cy="28" r="2" fill="#00D3CD" />
      <path
        d="M26 28H30"
        stroke="#00D3CD"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {variant === '2' ? (
        <circle cx="36" cy="12" r="5" fill="#00D3CD" stroke="#ffffff" strokeWidth="2" />
      ) : (
        <path
          d="M34 10L38 14L34 18"
          stroke="#00D3CD"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
};

export default PgLogo;

