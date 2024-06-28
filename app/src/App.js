import React from 'react';
import Teams from './components/teams/Teams';

function App() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <h1 className="text-4xl font-bold text-blue-500">Hello, Tailwind CSS!</h1>
      <Teams />
    </div>
  );
}

export default App;
