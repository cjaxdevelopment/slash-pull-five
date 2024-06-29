import React from 'react';

const Spinner = () => {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="spinner-border animate-spin inline-block w-22 h-22 border-4 rounded-full" role="status">
        <span className="visually-hidden"></span>
      </div>
    </div>
  );
};

export default Spinner;
