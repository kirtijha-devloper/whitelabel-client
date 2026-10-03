import React from 'react';

const Loader = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D3CD]"></div>
      </div>
  );
}

export default Loader;
